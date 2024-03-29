import calendar
import dns
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from functools import lru_cache
import io
import json
import math
import os
import re
import tarfile
import time

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
import jsonschema
import psycopg2.extras
import requests
from slugify import slugify

from dbutils import db
from utils import log
from validators import (
    DashboardInputs, WidgetSchemaInputs, WidgetsPositionsSchemaInputs, PersonSchemaInputsPOST,
    PersonSchemaInputsPUT, PersonCredentialSchemaInputs, AccountSchemaInputs, PermissionSchemaInputs,
    AccountBotSchemaInputs, BotSchemaInputs, EntitySchemaInputs, CredentialSchemaInputs,
    SensorSchemaInputs, PersonChangePasswordSchemaInputsPOST, PathSchemaInputs, PersonSignupNewPOST,
    PersonSignupValidatePinPOST, PersonSignupCompletePOST, ForgotPasswordPOST, ForgotPasswordResetPOST,
    WidgetPluginManifestSchemaInputs,
)
from auth import Auth
from const import SYSTEM_PATH_PREFIX, SYSTEM_PATH_INSERTED_COUNT


def clear_all_lru_cache():
    # when testing, it is important to clear memoization cache in between runs, or the results will be... interesting.
    # Dashboard.get_id.cache_clear()
    # Path._get_path_id_from_db.cache_clear()
    # PathFilter._find_matching_paths_for_filter.cache_clear()
    pass


class ValidationError(HTTPException):
    def __init__(self, s):
        super().__init__(status_code=400, detail=s)


class AccessDeniedError(Exception):
    pass


class PathNotInDBError(Exception):
    pass


class _RegexValidatedInputValue(object):
    """ Helper parent class; allows easy creation of classes which validate their input with a regular expression. """
    _regex = None

    def __init__(self, v):
        if not self.is_valid(str(v)):
            raise ValidationError("Invalid {} format: {}".format(self.__class__.__name__, v))
        self.v = v

    @classmethod
    def is_valid(cls, v):
        return bool(cls._regex.match(v))

    def __str__(self):
        return str(self.v)

class PathInputValue(_RegexValidatedInputValue):
    _regex = re.compile(r'^([a-zA-Z0-9_-]|([%](2e|3a)))+([.]([a-zA-Z0-9_-]|([%](2e|3a)))+)*$')

class Path(object):

    def __init__(self, path, account_id, force_id=None, newly_created=False):
        self.path = str(PathInputValue(path))
        self.account_id = account_id
        self.force_id = force_id
        self.newly_created = newly_created

    @classmethod
    def forge_from_path(cls, path, account_id, ensure_in_db=True, allow_system=False):
        if not allow_system and path.startswith(SYSTEM_PATH_PREFIX):
            raise ValidationError("Invalid path - should not start with 'system.'!")

        path_id = None
        if not ensure_in_db:
            return cls(path, account_id)

        try:
            path_id = Path._get_path_id_from_db(account_id, path)
            return cls(path, account_id, path_id)
        except PathNotInDBError:
            path_id = Path._insert_path_to_db(account_id, path)
            return cls(path, account_id, path_id, newly_created=True)

    @classmethod
    def forge_from_input(cls, json_data, account_id, force_id=None):
        jsonschema.validate(json_data, PathSchemaInputs)

        path = json_data['path']
        return cls(path, account_id, force_id=force_id)

    @staticmethod
    # The problem with lru_cache: when do we clear it? Any change should invalidate cache, but in multi-worker
    # setup this means clearing lru_cache in another process. For this reason we disable cache until a better
    # solution is found.
    #@lru_cache(maxsize=None)
    def _get_path_id_from_db(account_id, path):
        with db.cursor() as c:
            path_cleaned = path.strip()
            c.execute('SELECT id FROM paths WHERE account = %s AND path=%s;', (account_id, path_cleaned,))
            res = c.fetchone()
            if not res:
                # If path record doesn't exist (yet), we avoid lru_cache by throwing an exception. This works
                # as of Python 3.6 but is not documented behaviour. The tests will warn us if it ever
                # starts failing.
                raise PathNotInDBError()

            path_id = res[0]
            return path_id

    @staticmethod
    def _insert_path_to_db(account_id, path):
        with db.cursor() as c:
            path_cleaned = path.strip()
            c.execute('INSERT INTO paths (account, path) VALUES (%s, %s) RETURNING id;', (account_id, path_cleaned,))
            res = c.fetchone()
            path_id = res[0]
            return path_id

    @staticmethod
    def get(path_id, account_id):
        with db.cursor() as c:
            c.execute('SELECT path FROM paths WHERE account = %s AND id = %s;', (account_id, path_id,))
            res = c.fetchone()
            if not res:
                return None
            path = res[0]

        return {
            'path': path,
        }

    def update(self):
        if self.force_id is None:
            return 0
        with db.cursor() as c:
            c.execute("UPDATE paths SET path = %s WHERE id = %s AND account = %s;", (self.path, self.force_id, self.account_id,))
            # if c.rowcount:
            #     Path._get_path_id_from_db.cache_clear()
            return c.rowcount

    @staticmethod
    def delete(path_id, account_id):
        with db.cursor() as c:
            # delete just the path, "ON DELETE CASCADE" takes care of removing values:
            c.execute("DELETE FROM paths WHERE id = %s AND account = %s;", (path_id, account_id,))
            # if c.rowcount:
            #     Path._get_path_id_from_db.cache_clear()
            return c.rowcount


class PathFilter(_RegexValidatedInputValue):
    _regex = re.compile(r'^([a-zA-Z0-9_-]+|[*?])([.]([a-zA-Z0-9_-]+|[*?]))*$')

    @staticmethod
    def find_matching_paths(account_id, path_filter, limit=200, allow_trailing_chars=False):
        pf_regex = PathFilter._regex_from_filter(path_filter, allow_trailing_chars)
        with db.cursor() as c:
            c.execute('SELECT id, path FROM paths WHERE account = %s AND path ~ %s ORDER BY path LIMIT %s;', (account_id, pf_regex, limit + 1,))
            found_paths = [{
                "id": r[0],
                "path": r[1],
            } for r in c.fetchall()]
            if len(found_paths) > limit:  # we have found one element over the limit - we don't add it, but we know it exists
                return found_paths[:limit], True
            else:
                return found_paths, False

    @staticmethod
    def _regex_from_filter(path_filter_str, allow_trailing_chars=False):
        """ Prepares regex for asking Postgres from supplied path filter string. """
        # - replace all "." with "[.]"
        # - replace all "*" with ".*"
        # - replace all "?" with "[^.]+"
        # - add ^ and $
        path_filter_str = path_filter_str.replace(".", "[.]")
        path_filter_str = path_filter_str.replace("*", "[^.]+([.][^.]+)*")
        path_filter_str = path_filter_str.replace("?", "[^.]+")
        if allow_trailing_chars:
            path_filter_str += '.*'
        path_filter_str = "^{}$".format(path_filter_str)
        return path_filter_str


# when user is entering a path filter, it is not finished yet - but we must validate it to display the matches:
class UnfinishedPathFilter(PathFilter):
    _regex = re.compile(r'^(([a-zA-Z0-9_-]+|[*?])[.])*([a-zA-Z0-9_-]*|[*?])$')


class Timestamp(_RegexValidatedInputValue):
    _regex = re.compile(r'^[1-9][0-9]{1,9}([.][0-9]{1,6})?$')

    def __init__(self, v):
        # allow initialization with numeric types:
        if isinstance(v, (float, int,)):
            self.v = v
        else:
            super().__init__(v)

    def __float__(self):
        return float(self.v)

    def __int__(self):
        return int(self.v)

    def __lt__(self, other):
        return float(self.v) < float(other.v)
    def __le__(self, other):
        return float(self.v) <= float(other.v)
    def __gt__(self, other):
        return float(self.v) > float(other.v)
    def __ge__(self, other):
        return float(self.v) >= float(other.v)
    def __eq__(self, other):
        return float(self.v) == float(other.v)
    def __ne__(self, other):
        return float(self.v) != float(other.v)


class MeasuredValue(object):
    def __init__(self, v):
        if not self.is_valid(v):
            raise ValidationError("Invalid {} format: {}".format(self.__class__.__name__, v))
        self.v = v

    @classmethod
    def is_valid(cls, v):
        try:
            float(v)
            return True
        except:
            return False

    def __str__(self):
        return str(self.v)


class BotToken(_RegexValidatedInputValue):
    _regex = re.compile(r'^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$')


class EmailAddress(object):
    def __init__(self, v, strict_check=False):
        try:
            if not self.is_valid(str(v)):
                raise ValidationError("Invalid email: {}".format(str(v)))
        except (dns.exception.Timeout, dns.resolver.NoResolverConfiguration):
            if strict_check:
                raise ValidationError("Could not validate email: {}".format(str(v)))
            else:
                pass  # allow - we were unable to check the e-mail due to DNS timeout
        self.v = str(v)

    @classmethod
    def is_valid(cls, v):
        """
            Returns False if validation failed (invalid format or MX DNS record
            not available), True otherwise. If DNS check timed out it raises
            dns.exception.Timeout exception.
        """
        if '@' not in v:
            return False
        domain = v.rsplit('@', 1)[-1]
        try:
            dns_records = dns.resolver.query(domain, 'MX', lifetime=10.0)
            return len(dns_records) > 0
        except dns.exception.Timeout:
            log.warning("Could not validate email address due to DNS timeout!")
            raise
        except:
            return False

    def __str__(self):
        return self.v


class Measurement(object):
    AGGR_FACTOR = 3
    MAX_AGGR_LEVEL = 6  # 0 == one point per 1h; 1 == 1 point per 3h; ...; 6 == one point per ~month
    MAX_DATAPOINTS_RETURNED = 100000

    @classmethod
    def save_values_data_to_db(cls, account_id, put_data):

        paths = [Path.forge_from_path(x['p'], account_id, ensure_in_db=True, allow_system=False) for x in put_data]

        # to use execute_values, we need an iterator which will feed our data:
        def _get_data(put_data, paths):
            for x, path in zip(put_data, paths):
                yield (
                    path.force_id,
                    datetime.utcfromtimestamp(float(Timestamp(x['t']))),
                    str(MeasuredValue(x['v'])),
                )

        data_iterator = _get_data(put_data, paths)

        with db.cursor() as c:
            # https://stackoverflow.com/a/34529505/593487
            psycopg2.extras.execute_values(c, "INSERT INTO measurements (path, ts, value) VALUES %s ON CONFLICT (path, ts) DO UPDATE SET value=excluded.value", data_iterator, "(%s, %s, %s)", page_size=100)

        newly_created_paths = [p for p in paths if p.newly_created]
        return newly_created_paths

    @classmethod
    def get_suggested_aggr_level(cls, t_from, t_to, max_points=100):
        aggr_level = cls._get_aggr_level(max_points, math.ceil((float(t_to) - float(t_from))/3600.0))
        if aggr_level < 0:
            return None
        else:
            return aggr_level

    @classmethod
    def _get_aggr_level(cls, max_points, n_hours):
        for l in range(-1, cls.MAX_AGGR_LEVEL):
            if max_points >= n_hours / (cls.AGGR_FACTOR**l):
                return l
        return cls.MAX_AGGR_LEVEL

    @classmethod
    def fetch_data(cls, account_id, paths, aggr_level, t_froms, t_to, should_sort_asc, max_records):
        # t_froms: an array of t_from, one for each path (because the subsequent fetchings usually request a different t_from for each path)
        paths_data = {}
        sort_order = 'ASC' if should_sort_asc else 'DESC'  # PgSQL doesn't allow sort order to be parametrized
        t_to_timestamp = datetime.utcfromtimestamp(float(t_to))
        with db.cursor() as c:
            for p, t_from in zip(paths, t_froms):
                str_p = str(p)
                path_data = []
                path_id = Path._get_path_id_from_db(account_id, str_p)
                t_from_timestamp = datetime.utcfromtimestamp(float(t_from))

                # trick: fetch one result more than is allowed (by MAX_DATAPOINTS_RETURNED) so that we know that the result set is not complete and where the client should continue from
                if aggr_level is None:  # fetch raw data
                    c.execute('SELECT ts, value FROM measurements WHERE path = %s AND ts >= %s AND ts <= %s ORDER BY ts ' + sort_order + ' LIMIT %s;', (path_id, t_from_timestamp, t_to_timestamp, max_records + 1,))
                    for ts, value in c.fetchall():
                        path_data.append({'t': ts.replace(tzinfo=timezone.utc).timestamp(), 'v': float(value)})
                else:  # fetch aggregated data
                    aggr_interval_h = cls.AGGR_FACTOR ** aggr_level
                    # TimescaleDB quirk: while we could change the offset to `TIMESTAMP '1970-01-01'` for normal SQL queries, we would not be able to create an index for
                    # such time_bucket, so we must align our buckets with TIMESCALEDB_EPOCH (2000-01-03).
                    c.execute(f"""
                        SELECT
                            period,
                            average,
                            minimum,
                            maximum
                        FROM
                            measurements_aggr_{aggr_level}
                        WHERE
                            path = %s AND
                            period >= %s AND
                            period <= %s
                        ORDER BY
                            period {sort_order}
                    """, (path_id, t_from_timestamp, t_to_timestamp,))
                    move_ts_to_middle_of_interval = aggr_interval_h * 1800
                    for ts, vavg, vmin, vmax in c.fetchall():
                        path_data.append({'t': ts.replace(tzinfo=timezone.utc).timestamp() + move_ts_to_middle_of_interval, 'v': float(vavg), 'minv': float(vmin), 'maxv': float(vmax)})

                # if we have one result too many, eliminate it and set "next_data_point" field:
                if len(path_data) > max_records:
                    paths_data[str_p] = {
                        'next_data_point': path_data[max_records]['t'],
                        'data': path_data[:max_records],
                    }
                else:
                    paths_data[str_p] = {
                        'next_data_point': None,
                        'data': path_data,
                    }

        return paths_data

    @classmethod
    def fetch_topn(cls, account_id, path_filter, ts_to, max_results):
        pf_regex = PathFilter._regex_from_filter(path_filter, allow_trailing_chars=False)
        with db.cursor() as c, db.cursor() as c2:
            # Correct, but slow:
            # """
            #     SELECT m.ts, p.path, m.value
            #     FROM paths p, measurements m
            #     WHERE
            #         p.path ~ %s  AND
            #         p.id = m.path AND
            #         m.ts <= %s
            #     ORDER BY m.ts desc, m.value DESC
            #     LIMIT %s
            #
            # Better, but still very slow when we have ~200k matching paths, like with NetFlow top connections:
            # """
            #     SELECT m.ts, p.path, m.value
            #     FROM paths p, measurements m
            #     WHERE
            #         p.path LIKE %s AND
            #         p.path ~ %s AND
            #         p.id = m.path AND
            #         m.ts = (
            #             SELECT max(m2.ts) FROM measurements m2 WHERE m2.path = p.id AND m2.ts <= %s
            #         )
            #     ORDER BY m.ts DESC, m.value DESC
            #     LIMIT %s
            # """,

            # This query is problematic from performance point of view. Until we find a better way,
            # we hardcode the groups of timestamps in the query. Note that replacing this with a SELECT
            # slows the query down considerably.
            for top_ts in (datetime.utcfromtimestamp(float(ts_to)) - timedelta(minutes=5 * n) for n in range(12)):
                c.execute("SELECT DISTINCT(ts) FROM measurements WHERE ts <= %s AND ts > %s - INTERVAL '5 minute' ORDER BY ts desc;", (top_ts, top_ts,))
                timestamps = tuple(ts for ts, in c.fetchall())
                if not timestamps:
                    continue

                c.execute("""
                        SELECT
                            m.ts, p.path, m.value
                        FROM
                            paths p, measurements m
                        WHERE
                            p.path ~ %s AND
                            p.id = m.path AND
                            m.ts IN %s
                        ORDER BY m.ts desc, m.value DESC
                        LIMIT %s
                    """, (pf_regex, timestamps, max_results,)
                )

                found_ts = None
                topn = []
                for ts, path, value in c.fetchall():
                    if found_ts is None:
                        found_ts = ts
                    elif found_ts != ts:
                        break  # only use those records which have the same timestamp as the first one
                    topn.append({'p': path, 'v': float(value)})

                if found_ts:
                    break

            if not found_ts:
                return datetime.utcfromtimestamp(float(ts_to)), 0, []

            # find the sum of all values at that timestamp so we can display percentages:
            c.execute("SELECT SUM(m.value) FROM paths p, measurements m WHERE p.path ~ %s AND p.id = m.path AND m.ts = %s", (pf_regex, found_ts,))
            total, = c.fetchone()
            return found_ts, total, topn


    @classmethod
    def get_oldest_measurement_time(cls, account_id, paths):
        path_ids = tuple(Path._get_path_id_from_db(account_id, str(p)) for p in paths)
        with db.cursor() as c:
            c.execute('SELECT MIN(ts) FROM measurements WHERE path IN %s;', (path_ids,))
            res = c.fetchone()
            if not res:
                return None
            ts = res[0]
            return ts.replace(tzinfo=timezone.utc).timestamp()


class Stats(object):
    @classmethod
    def update_account_stats(cls, account_id, stats_updates):
        with db.cursor() as c:
            topics_with_payloads = []
            for k in stats_updates:
                path = Path.forge_from_path(k, account_id, allow_system=True)
                t = stats_updates[k]['t']
                v = stats_updates[k]['v']
                c.execute("INSERT INTO measurements (path, ts, value) VALUES (%s, %s, %s) ON CONFLICT (path, ts) DO UPDATE SET value = measurements.value + excluded.value RETURNING value;",
                (
                    path.force_id,
                    datetime.utcfromtimestamp(t),
                    str(MeasuredValue(v)),
                ))
                new_value = float(c.fetchone()[0])
                topics_with_payloads.append((
                    f'accounts/{account_id}/values/{k}',
                    { 'v': new_value, 't': t },
                ))
            # returns new values in a form which is ready for mqtt_publish_changed_multiple_payloads function:
            return topics_with_payloads


class Widget(object):

    def __init__(self, dashboard_id, widget_type, title, content, widget_id, position_p):
        self.dashboard_id = dashboard_id
        self.widget_type = widget_type
        self.title = title
        self.content = content
        self.widget_id = widget_id
        self.position_p = position_p

    @classmethod
    def forge_from_input(cls, account_id, dashboard_slug, json_data, widget_id=None):
        jsonschema.validate(json_data, WidgetSchemaInputs)

        widget_type = json_data['type']
        title = json_data['title']
        position_p = json_data.get('p', 'default')
        content = json_data['content']
        # users reference the dashboards by its slug, but we need to know its ID:
        dashboard_id = Dashboard.get_id(account_id, dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        if widget_id is not None and not Widget._check_exists(widget_id):
            raise ValidationError("Unknown widget id")

        return cls(dashboard_id, widget_type, title, content, widget_id, position_p)

    @staticmethod
    def set_positions(account_id, dashboard_slug, json_data):
        dashboard_id = Dashboard.get_id(account_id, dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        jsonschema.validate(json_data, WidgetsPositionsSchemaInputs)

        with db.cursor() as c:
            # Instead of traversing, we update multiple values at once:
            #   http://initd.org/psycopg/docs/extras.html#psycopg2.extras.execute_values
            widgets_positions_tuples = [(dashboard_id, pos['widget_id'], pos['x'], pos['y'], pos['w'], pos['h'], pos['p']) for pos in json_data]
            psycopg2.extras.execute_values(c, """
                UPDATE widgets AS w
                SET
                    position_x = v.position_x,
                    position_y = v.position_y,
                    position_w = v.position_w,
                    position_h = v.position_h,
                    position_p = v.position_p
                FROM (VALUES %s) AS v(dashboard_id, widget_id, position_x, position_y, position_w, position_h, position_p)
                WHERE v.dashboard_id = w.dashboard AND v.widget_id = w.id;
            """, widgets_positions_tuples)


    @staticmethod
    def _check_exists(widget_id):
        with db.cursor() as c:
            c.execute('SELECT id FROM widgets WHERE id = %s;', (widget_id,))
            res = c.fetchone()
            if res:
                return True
            return False

    def insert(self):
        with db.cursor() as c:
            # we will position the new widget below each of the known widgets, which means that we set
            # its position to: x=0, y=max(y + h), w=12, h=8
            c.execute('SELECT MAX(position_y + position_h) FROM widgets WHERE dashboard = %s and position_p = %s;', (self.dashboard_id, self.position_p,))
            res = c.fetchone()
            position_y = res[0] if res and res[0] else 0

            c.execute("INSERT INTO widgets (dashboard, type, title, position_x, position_y, position_w, position_h, position_p, content) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;",
                      (self.dashboard_id, self.widget_type, self.title, 0, position_y, 12, 10, self.position_p, self.content,))
            widget_id = c.fetchone()[0]
            return widget_id

    def update(self):
        with db.cursor() as c:
            c.execute("UPDATE widgets SET type = %s, title = %s, position_p = %s, content = %s  WHERE id = %s and dashboard = %s;", (self.widget_type, self.title, self.position_p, self.content, self.widget_id, self.dashboard_id,))
            if not c.rowcount:
                return 0
            return 1

    @staticmethod
    def delete(account_id, dashboard_slug, widget_id):
        dashboard_id = Dashboard.get_id(account_id, dashboard_slug)
        with db.cursor() as c:
            c.execute("DELETE FROM widgets WHERE id = %s and dashboard = %s;", (widget_id, dashboard_id,))
            return c.rowcount

    @staticmethod
    def get_list(account_id, dashboard_slug, paths_limit=200):
        dashboard_id = Dashboard.get_id(account_id, dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        with db.cursor() as c:
            c.execute('SELECT id, type, title, position_x, position_y, position_w, position_h, position_p, content FROM widgets WHERE dashboard = %s ORDER BY position_y, position_x;', (dashboard_id,))
            ret = []
            for widget_id, widget_type, title, position_x, position_y, position_w, position_h, position_p, content in c.fetchall():
                ret.append({
                    'id': widget_id,
                    'type': widget_type,
                    'title': title,
                    'x': position_x,
                    'y': position_y,
                    'w': position_w,
                    'h': position_h,
                    'p': position_p,
                    'content': content,
                })
            return ret

    @staticmethod
    def get(account_id, dashboard_slug, widget_id, paths_limit=200):
        dashboard_id = Dashboard.get_id(account_id, dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        with db.cursor() as c:
            c.execute('SELECT type, title, position_x, position_y, position_w, position_h, position_p, content FROM widgets WHERE id = %s and dashboard = %s;', (widget_id, dashboard_id,))
            res = c.fetchone()
            if not res:
                return None

            widget_type, title, position_x, position_y, position_w, position_h, position_p, content = res
            return {
                'id': widget_id,
                'type': widget_type,
                'title': title,
                'x': position_x,
                'y': position_y,
                'w': position_w,
                'h': position_h,
                'p': position_p,
                'content': content,
            }


class Dashboard(object):

    def __init__(self, account_id, name, slug):
        self.account_id = account_id
        self.name = name
        self.slug = slug

    @classmethod
    def forge_from_input(cls, account_id, json_data, force_slug=None):
        """ This function validates input and returns an object which can be used for inserting or updating. """
        jsonschema.validate(json_data, DashboardInputs)

        name = json_data['name']
        slug = json_data.get('slug')
        if force_slug:  # when updating existing record, we want to supply slug through query parameters, not through JSON
            if slug:
                raise ValidationError("Field 'slug' shouldn't be specified in JSON body")
            slug = force_slug
        else:
            if not slug:
                slug = cls._suggest_new_slug(account_id, name)
        return cls(account_id, name, slug)

    @classmethod
    def _suggest_new_slug(cls, account_id, name):
        # Find a suitable slug from name, appending numbers for as long as it takes to find a non-existing slug.
        # This is probably not 100% race-condition safe, but it doesn't matter - unique contraint is on DB level,
        # and this is just a nicety from us.
        postfix_nr = 1
        while True:
            slug = slugify(name[:40]) + ('' if postfix_nr == 1 else '-{}'.format(postfix_nr))
            if Dashboard.get_id(account_id, slug) is None:
                return slug  # we have found a slug which doesn't exist yet, use it
            postfix_nr += 1

    def insert(self):
        with db.cursor() as c:
            c.execute("INSERT INTO dashboards (name, account, slug) VALUES (%s, %s, %s);", (self.name, self.account_id, self.slug,))
            # we must invalidate get_id()'s lru_cache, otherwise it will keep returning None instead of new ID:
            # Dashboard.get_id.cache_clear()

    def update(self):
        with db.cursor() as c:
            c.execute("UPDATE dashboards SET name = %s WHERE account = %s AND slug = %s;", (self.name, self.account_id, self.slug,))
            return c.rowcount

    @staticmethod
    def delete(account_id, slug):
        with db.cursor() as c:
            c.execute("DELETE FROM dashboards WHERE account = %s AND slug = %s;", (account_id, slug,))
            # we must invalidate get_id()'s lru_cache, otherwise it will keep returning the old ID instead of None:
            # Dashboard.get_id.cache_clear()
            return c.rowcount

    @staticmethod
    def get_list(account_id):
        with db.cursor() as c:
            ret = []
            c.execute('SELECT name, slug FROM dashboards WHERE account = %s ORDER BY name;', (account_id,))
            for name, slug in c.fetchall():
                ret.append({'name': name, 'slug': slug})
            return ret

    @staticmethod
    def get(account_id, slug):
        with db.cursor() as c:
            c.execute('SELECT name FROM dashboards WHERE account = %s AND slug = %s;', (account_id, slug,))
            res = c.fetchone()
            if not res:
                return None
            name = res[0]

        widgets = Widget.get_list(account_id, slug)
        return {
            'name': name,
            'slug': slug,
            'widgets': widgets,
        }

    @staticmethod
    # @lru_cache(maxsize=256)
    def get_id(account_id, slug):
        """ This is a *cached* function which returns ID based on dashboard slug. Make sure
            to invalidate lru_cache whenever one of the existing slug <-> ID relationships
            changes in any way (delete, insert). """
        with db.cursor() as c:
            c.execute('SELECT id FROM dashboards WHERE account = %s AND slug = %s;', (account_id, slug,))
            res = c.fetchone()
            if not res:
                return None
            return res[0]


class Account(object):
    RESOURCE_ACCOUNTS_REGEX = re.compile('^accounts/([0-9]+)([/].*)?$')

    def __init__(self, name, force_id=None):
        self.name = name
        self.force_id = force_id

    @classmethod
    def forge_from_input(cls, data, force_id=None):
        jsonschema.validate(data, AccountSchemaInputs)

        name = data['name']
        return cls(name, force_id)

    def insert(self, create_first_records=True):
        with db.cursor() as c:
            c.execute("INSERT INTO accounts (name) VALUES (%s) RETURNING id;", (self.name,))
            account_id = c.fetchone()[0]

            # to help users, we create first records like ping credential and sensor:
            if create_first_records:
                # ICMP Ping:
                credential_details = {"n_packets": "3", "sleep_packets": "1.0", "timeout": "1.0", "retry": "0"}
                c = Credential("Default ICMP ping credential (3 packets)", 'ping', credential_details, account_id)
                c.insert()
                s = Sensor("Default ICMP ping sensor", 'ping', 60, {}, account_id)
                s.insert()

                # SNMP "public" credential and a few sensors for good measure:
                credential_details = {"version": "snmpv2c", "snmpv12_community": "public"}
                c = Credential("Default SNMP credential (SNMPv2c, 'public')", 'snmp', credential_details, account_id)
                c.insert()
                # https://www.alvestrand.no/objectid/1.3.6.1.2.1.2.2.1.html
                s_if_in_octets_details = {"oids": [{"oid": "1.3.6.1.2.1.2.2.1.2", "fetch_method": "walk"}, {"oid": "1.3.6.1.2.1.2.2.1.10", "fetch_method": "walk"}], "expression": "$2", "output_path": "if.in-octets.{$index}.{$1}"}
                s = Sensor("Traffic IN [bps]", 'snmp', 60, s_if_in_octets_details, account_id)
                s.insert()
                s_if_out_octets_details = {"oids": [{"oid": "1.3.6.1.2.1.2.2.1.2", "fetch_method": "walk"}, {"oid": "1.3.6.1.2.1.2.2.1.16", "fetch_method": "walk"}], "expression": "$2", "output_path": "if.out-octets.{$index}.{$1}"}
                s = Sensor("Traffic OUT [bps]", 'snmp', 60, s_if_out_octets_details, account_id)
                s.insert()
                s_lmsensors_temp_details = {"oids": [{"oid": "1.3.6.1.4.1.2021.13.16.2.1.2", "fetch_method": "walk"}, {"oid": "1.3.6.1.4.1.2021.13.16.2.1.3", "fetch_method": "walk"}], "expression": "$2 / 1000.0", "output_path": "lmsensors.temp.{$index}.{$1}"}
                s = Sensor("Linux lmsensors - temperature [°C]", 'snmp', 60, s_lmsensors_temp_details, account_id)
                s.insert()

                # NetFlow:
                credential_details = {}
                c = Credential("Default NetFlow credential", 'netflow', credential_details, account_id)
                c.insert()
                s = Sensor("Default NetFlow sensor", 'netflow', None, {}, account_id)
                s.insert()
            return account_id

    def update(self):
        if self.force_id is None:
            return 0
        with db.cursor() as c:
            c.execute("UPDATE accounts SET name = %s WHERE id = %s;", (self.name, self.force_id,))
            return c.rowcount

    @staticmethod
    def get_list(user_id):
        with db.cursor() as c:
            ret = []
            if not user_id:
                #c.execute('SELECT id, name FROM accounts ORDER BY name;')
                raise AccessDeniedError("User id not available - this should not happen!")

            # get the list of accounts that this user has the permission to access: (GET)
            # - get user's permissions, then:
            #   - find a permission that grants access to all accounts, or
            #   - find specific accounts that users has GET permission for
            can_access_all_accounts = False
            specific_accounts = []
            for permission in Permission.get_list(user_id):
                # we are only interested in GET methods: (or None)
                if permission['resource_prefix'] is None or permission['resource_prefix'] == 'accounts':
                    can_access_all_accounts = True
                    break
                m = Account.RESOURCE_ACCOUNTS_REGEX.match(permission['resource_prefix'])
                if m:
                    specific_accounts.append(int(m.group(1)))

            if can_access_all_accounts:
                c.execute('SELECT id, name FROM accounts ORDER BY name;')
            elif specific_accounts:
                c.execute('SELECT id, name FROM accounts WHERE id IN %s ORDER BY name;', (tuple(specific_accounts),))
            else:
                c = []

            for account_id, name in c:
                ret.append({'id': account_id, 'name': name})
            return ret

    @staticmethod
    def get(account_id):
        with db.cursor() as c:
            c.execute('SELECT name FROM accounts WHERE id = %s;', (account_id,))
            res = c.fetchone()
            if not res:
                return None
            name = res[0]
            return {
                'id': account_id,
                'name': name,
            }


class Permission(object):
    # some of the resources (endpoints) are accessible to any authenticated user:
    NO_PERMISSION_CHECK_RESOURCES_READ = ["profile", "accounts", "profile/permissions", "bots"]

    def __init__(self, user_id, resource_prefix, methods):
        self.user_id = user_id
        # resource_prefix always implicitly ends with a slash, so let's make sure it is always in the same format here:
        self.resource_prefix = None if resource_prefix is None else resource_prefix.rstrip('/')
        self.methods = methods

    @classmethod
    def forge_from_input(cls, json_data, user_id):
        jsonschema.validate(json_data, PermissionSchemaInputs)
        return cls(user_id, json_data['resource_prefix'], json_data['methods'])

    @staticmethod
    def get_list(user_id):
        with db.cursor() as c:
            ret = []
            c.execute('SELECT id, user_id, resource_prefix, methods FROM permissions WHERE user_id = %s ORDER BY resource_prefix, id;', (user_id,))
            for permission_id, user_id, resource_prefix, methods in c:
                methods_as_list = None if not methods else [m.strip('{ }') for m in methods.split(',')]  # not sure why, but we get what we inserted (string instead of a list)... this is workaround
                ret.append({'id': permission_id, 'resource_prefix': resource_prefix, 'methods': methods_as_list})
            return ret

    def insert(self, granting_user_id, skip_checks=False):
        if not skip_checks:
            # make sure user is not granting permissions to themselves:
            if int(granting_user_id) == int(self.user_id):
                raise AccessDeniedError("Can't grant permissions to yourself")
            # make sure that authenticated user's permissions are a superset of the ones that they wish to grant:
            granting_user_permissions = Permission.get_list(granting_user_id)
            if not Permission.can_grant_permission(granting_user_permissions, self.resource_prefix, self.methods):
                raise AccessDeniedError("Can't grant permission you don't have")

        with db.cursor() as c:
            methods_array = None if self.methods is None else '{' + ",".join(self.methods) + '}'  # passing the list directly results in integrity error, this is another way - https://stackoverflow.com/a/15073439/593487
            c.execute("INSERT INTO permissions (user_id, resource_prefix, methods) VALUES (%s, %s, %s) RETURNING id;", (self.user_id, self.resource_prefix, methods_array,))
            account_id = c.fetchone()[0]
            return account_id

    @staticmethod
    def has_all_permissions(user_permissions, target_user_id):
        """ Does the user have all the permissions that some other (target) user has? """
        for target_permission in Permission.get_list(target_user_id):
            if not Permission.can_grant_permission(user_permissions, target_permission['resource_prefix'], target_permission['methods']):
                return False
        return True

    @staticmethod
    def is_access_allowed(user_id, resource, method):
        method = method.upper()
        if method == 'HEAD':
            method = 'GET'  # access for HEAD is the same as for GET

        # some of the endpoints are accessible to any authenticated user:
        if method == 'GET' and resource in Permission.NO_PERMISSION_CHECK_RESOURCES_READ:
            return True

        with db.cursor() as c:
            # with resource_prefix, make sure that it either matches the urls exactly, or that the url continues with '/' + anything (not just anything)
            c.execute('SELECT id FROM permissions WHERE ' + \
                '(user_id = %s) AND ' + \
                "(resource_prefix IS NULL OR resource_prefix = %s OR %s LIKE resource_prefix || '/%%') AND " + \
                '(methods IS NULL OR %s = ANY(methods));',
                (user_id, resource, resource, method,))
            res = c.fetchone()
            if res:
                return True
            else:
                return False

    @staticmethod
    def delete(permission_id, user_id, granting_user_id):
        # make sure user is not removing their own permission:
        if int(granting_user_id) == int(user_id):
            raise AccessDeniedError("Can't grant permissions to yourself")
        with db.cursor() as c:
            c.execute('DELETE FROM permissions WHERE id = %s AND user_id = %s;', (permission_id, user_id,))
            return c.rowcount


    @staticmethod
    def can_grant_permission(granting_user_permissions, requested_resource_prefix, requested_methods):
        # User can grant a permission if he has a (single!) permission which includes the desired permission

        def is_resource_prefix_subset_of(subset_resource_prefix, superset_resource_prefix):
            if superset_resource_prefix is None:
                return True
            if subset_resource_prefix is None:  # we can't grant access to every resource if we don't have it
                return False
            if superset_resource_prefix == subset_resource_prefix:
                return True
            if subset_resource_prefix.startswith(superset_resource_prefix + '/'):
                return True
            return False

        def are_methods_subset_of(subset_methods, superset_methods):
            if superset_methods is None:
                return True
            if subset_methods is None:  # we can't grant access for every method if we don't have it
                return False
            if set(superset_methods).issuperset(set(subset_methods)):
                return True
            return False

        for granting_permission in granting_user_permissions:
            if is_resource_prefix_subset_of(requested_resource_prefix, granting_permission['resource_prefix']) and \
                are_methods_subset_of(requested_methods, granting_permission['methods']):
                return True

        return False


class User(object):
    """
        Users can be either persons or bots. Since the permissions system is the same, we are
        using the same top-level DB table (users) for both, and reference them by user_id. This
        class offers common functionality.
    """
    @staticmethod
    def get(user_id):
        with db.cursor() as c:
            c.execute('SELECT user_type FROM users WHERE id = %s;', (user_id,))
            res = c.fetchone()
            if not res:
                return None
            user_type, = res
            # get the underlying record, either a person or a bot:
            record = None
            if user_type == 'bot':
                bot_tied_to_account = Bot.get_tied_to_account(user_id)
                if bot_tied_to_account:
                    record = Bot.get(user_id, bot_tied_to_account)
                else:
                    record = Bot.get(user_id, None)
            elif user_type == 'person':
                record = Person.get(user_id)
        return {
            'user_id': user_id,
            'user_type': user_type,
            'name': record['name'],
        }


class Bot(object):
    """
        There are two types of bots, account bots and systemwide bots. Account bots are tied to
        a (single!) account and can be only used with its context, while systemwide bots can be
        used by any account.
        TODO: Note that database representation for this is currently a bit misleading, since
        it uses users_accounts table instead of a special field in bots table. Additionally,
        users_accounts table should be named persons_accounts (and only used for persons).
    """
    def __init__(self, name, protocol, config, force_account=None, force_id=None):
        self.name = name
        self.protocol = protocol
        self.config = config
        self.force_account = force_account
        self.force_id = force_id

    @classmethod
    def forge_from_input(cls, json_data, force_account=None, force_id=None):
        if force_account:
            jsonschema.validate(json_data, AccountBotSchemaInputs)
        else:
            jsonschema.validate(json_data, BotSchemaInputs)

        name = json_data['name']
        protocol = json_data.get('protocol', None)
        config = json_data.get('config', None)
        return cls(name, protocol, config, force_account=force_account, force_id=force_id)

    @staticmethod
    def get_list(force_account=None):
        with db.cursor() as c:
            ret = []
            if force_account is None:
                # return systemwide bots:
                # Note: in hindsight, it would probably make sense to have a field "account" in a bots
                # table, instead of having a separate users_account table. This SELECT finds those
                # rows that *don't* have a corresponding entry in users_accounts:
                c.execute('SELECT b.user_id, b.name, b.protocol, b.insert_time, b.last_login ' +
                          'FROM bots AS b LEFT JOIN users_accounts AS ua ON b.user_id = ua.user_id ' +
                          'WHERE ua.account IS NULL ORDER BY b.insert_time DESC;')
            else:
                # return bots tied to a specific account:
                c.execute('SELECT b.user_id, b.name, b.protocol, b.insert_time, b.last_login ' +
                          'FROM bots AS b INNER JOIN users_accounts AS ua ON b.user_id = ua.user_id ' +
                          'WHERE ua.account = %s ORDER BY b.insert_time DESC;', (force_account,))
            for user_id, name, protocol, insert_time, last_login in c:
                ret.append({
                    'id': user_id,
                    'name': name,
                    'protocol': protocol,
                    'tied_to_account': force_account,
                    'insert_time': calendar.timegm(insert_time.timetuple()),
                    'last_login': None if last_login is None else calendar.timegm(last_login.timetuple()),
                })
            return ret

    def insert(self):
        with db.cursor() as c:
            c.execute("INSERT INTO users (user_type) VALUES ('bot') RETURNING id;")
            user_id, = c.fetchone()
            c.execute("INSERT INTO bots (user_id, name, protocol) VALUES (%s, %s, %s) RETURNING token;", (user_id, self.name, self.protocol,))
            bot_token, = c.fetchone()
            if self.force_account:
                c.execute("INSERT INTO users_accounts (user_id, account, config) VALUES (%s, %s, %s);", (user_id, self.force_account, self.config,))
            return user_id, bot_token

    def update(self):
        if self.force_id is None:
            return 0
        with db.cursor() as c:
            if self.force_account is not None:
                if self.force_account != Bot.get_tied_to_account(self.force_id):
                    return 0

            c.execute("UPDATE bots SET name = %s, protocol = %s WHERE user_id = %s;", (self.name, self.protocol, self.force_id,))
            if not c.rowcount:
                return 0
            # if account id is known, we must update config information in users_accounts table:
            if self.force_account:
                c.execute("UPDATE users_accounts SET config = %s WHERE user_id = %s and account = %s;", (self.config, self.force_id, self.force_account,))
            return 1

    @staticmethod
    def delete(user_id, force_account=None):
        with db.cursor() as c:
            if force_account is not None:
                if force_account != Bot.get_tied_to_account(user_id):
                    return 0
            c.execute("DELETE FROM users WHERE id = %s AND user_type = 'bot';", (user_id,))  # record from bots will be removed automatically (cascade)
            return c.rowcount

    @staticmethod
    def get(user_id, tied_to_account=None):
        with db.cursor() as c:
            if tied_to_account:
                c.execute('SELECT b.name, b.protocol, ua.config, b.insert_time, b.last_login ' +
                          'FROM bots AS b INNER JOIN users_accounts AS ua ON b.user_id = ua.user_id ' +
                          'WHERE ua.account = %s AND b.user_id = %s;', (tied_to_account, user_id,))
            else:
                c.execute('SELECT b.name, b.protocol, NULL, b.insert_time, b.last_login ' +
                          'FROM bots AS b LEFT JOIN users_accounts AS ua ON b.user_id = ua.user_id ' +
                          'WHERE ua.account IS NULL AND b.user_id = %s;', (user_id,))
            res = c.fetchone()
            if not res:
                return None
            name, protocol, config, insert_time, last_login = res
        return {
            'id': int(user_id),
            'name': name,
            'protocol': protocol,
            'tied_to_account': tied_to_account,
            'config': config,
            'insert_time': calendar.timegm(insert_time.timetuple()),
            'last_login': None if last_login is None else calendar.timegm(last_login.timetuple()),
        }

    @staticmethod
    def get_token(user_id, tied_to_account=None):
        """ Token is a bit special - we only return it upon special request, because endpoints need
            to make sure that requesting user has all the permissions necessary.
        """
        with db.cursor() as c:
            if tied_to_account:
                c.execute('SELECT b.token ' +
                          'FROM bots AS b INNER JOIN users_accounts AS ua ON b.user_id = ua.user_id ' +
                          'WHERE ua.account = %s AND b.user_id = %s;', (tied_to_account, user_id,))
            else:
                c.execute('SELECT b.token ' +
                          'FROM bots AS b LEFT JOIN users_accounts AS ua ON b.user_id = ua.user_id ' +
                          'WHERE ua.account IS NULL AND b.user_id = %s;', (user_id,))
            res = c.fetchone()
            if not res:
                return None
            token, = res
        return token

    @staticmethod
    def get_tied_to_account(user_id):
        with db.cursor() as c:
            c.execute('SELECT account FROM users_accounts WHERE user_id = %s;', (user_id,))
            res = c.fetchone()
            if not res:
                return None
            account_id, = res
        return account_id

    @staticmethod
    def authenticate_token(bot_token_unclean):
        try:
            bot_token = str(BotToken(bot_token_unclean))
        except:
            log.info("Invalid bot token format")
            return None
        # authenticate against DB:
        with db.cursor() as c:
            # instead of just SELECTing the value, update last_login too: (if bot_token is correct of course)
            # c.execute("SELECT user_id FROM bots WHERE token = %s;", (bot_token,))
            # this works, but with N requests it becomes performance critical:
            # c.execute("UPDATE bots SET last_login = CURRENT_TIMESTAMP WHERE token = %s RETURNING user_id;", (bot_token,))
            c.execute("SELECT user_id, last_login FROM bots WHERE token = %s;", (bot_token,))
            res = c.fetchone()
            if not res:
                log.info("No such bot token")
                return None
            user_id, last_login = res
            # update token only if it needs to be updated:
            if last_login is None or calendar.timegm(last_login.timetuple()) < time.time() - 10:
                c.execute("UPDATE bots SET last_login = CURRENT_TIMESTAMP WHERE token = %s;", (bot_token,))
            return user_id

    @staticmethod
    def ensure_default_systemwide_bots_exist():
        """ To help users, a few default systemwide bots are included by default. The credentials are shared
            with their Docker containers via a shared file (/shared-secrets/<protocol>-bot.token).
        """
        if not os.path.exists('/shared-secrets/tokens/'):
            log.warning('Shared secrets dir (/shared-secrets/tokens/) does not exist, not creating default systemwide bots.')
            return

        for protocol_slug, protocol_label in [('ping', 'ICMP Ping'), ('snmp', 'SNMP'), ('netflow', 'NetFlow')]:
            BOT_TOKEN_FILENAME = f'/shared-secrets/tokens/{protocol_slug}-bot.token'
            if os.path.exists(BOT_TOKEN_FILENAME):
                log.warning('Overwriting existing {}'.format(BOT_TOKEN_FILENAME))
            bot = Bot(f"Systemwide {protocol_label} bot", protocol_slug, None, force_account=None)
            bot_id, bot_token = bot.insert()
            with open(BOT_TOKEN_FILENAME, 'wt') as f:
                f.write(bot_token)
            # assign permissions for this bot to work with any account, any method:
            permission = Permission(bot_id, 'accounts', None)
            permission.insert(None, skip_checks=True)


class Person(object):
    def __init__(self, name, email, username, password, timezone, email_confirmed, force_id=None):
        self.name = name
        self.email = EmailAddress(email, strict_check=False)
        self.username = username
        self.password = password
        self.timezone = timezone
        self.email_confirmed = email_confirmed
        self.force_id = force_id

    @classmethod
    def forge_from_input(cls, person_data, force_id=None):
        if force_id is None:
            jsonschema.validate(person_data, PersonSchemaInputsPOST)
        else:
            jsonschema.validate(person_data, PersonSchemaInputsPUT)

        name = person_data.get('name', None)
        email = person_data.get('email', None)
        username = person_data.get('username', None)
        password = person_data.get('password', None)
        timezone = person_data.get('timezone', None)
        if timezone is None:
            timezone = 'UTC'
        email_confirmed = True  # when manually entering user, e-mail check is not performed
        return cls(name, email, username, password, timezone, email_confirmed, force_id)

    @staticmethod
    def get_list():
        with db.cursor() as c:
            ret = []
            c.execute('SELECT user_id, name, email, username, timezone, email_confirmed FROM persons ORDER BY username ASC;')
            for user_id, name, email, username, timezone, email_confirmed in c:
                ret.append({
                    'user_id': user_id,
                    'name': name,
                    'email': email,
                    'username': username,
                    'timezone': timezone,
                    'email_confirmed': email_confirmed,
                })
            return ret

    @classmethod
    def signup_new(cls, json_data):
        jsonschema.validate(json_data, PersonSignupNewPOST)

        # make sure that the user clicked "I agree...":
        agree = json_data.get('agree', False)
        if not agree:
            raise ValidationError("User must agree to Terms of Use")
        email = json_data.get('email', None)

        # insert a person which needs the e-mail to be confirmed and password entered before it can login:
        person = cls('', email, email, None, 'UTC', False)
        user_id = person.insert()
        if user_id is None:
            return None, None

        with db.cursor() as c:
            c.execute('SELECT confirm_pin FROM persons WHERE user_id = %s;', (user_id,))
            confirm_pin, = c.fetchone()
        return user_id, confirm_pin

    @classmethod
    def signup_pin_valid(cls, json_data):
        jsonschema.validate(json_data, PersonSignupValidatePinPOST)

        user_id = json_data['user_id']
        confirm_pin = json_data['confirm_pin']

        with db.cursor() as c:
            c.execute('SELECT user_id FROM persons WHERE user_id = %s and confirm_pin = %s;', (user_id, confirm_pin,))
            res = c.fetchone()
            if not res:
                return False
            else:
                return True

    @classmethod
    def signup_complete(cls, json_data, create_account=True):
        jsonschema.validate(json_data, PersonSignupCompletePOST)

        user_id = json_data['user_id']
        confirm_pin = json_data['confirm_pin']
        password = json_data['password']
        pass_hash = Auth.password_hash(password)

        with db.cursor() as c:
            c.execute('UPDATE persons SET email_confirmed = TRUE, passhash = %s, confirm_pin = NULL, confirm_until = NULL '
                'WHERE user_id = %s AND confirm_pin = %s AND email_confirmed = FALSE;', (pass_hash, user_id, confirm_pin,))
            if not c.rowcount:
                return False

        if not create_account:
            return True

        # create an account to go with this user:
        account = Account("My account")
        account_id = account.insert()

        # grant permissions - user can access the newly created account, their profile and any systemwide bots:
        permission = Permission(user_id, f'accounts/{account_id}', None)
        permission.insert(None, skip_checks=True)
        permission = Permission(user_id, f'persons/{user_id}', ["GET", "POST", "PUT"])
        permission.insert(None, skip_checks=True)
        permission = Permission(user_id, f'bots', ["GET"])
        permission.insert(None, skip_checks=True)
        return True

    @classmethod
    def forgot_password(cls, json_data):
        jsonschema.validate(json_data, ForgotPasswordPOST)

        email = EmailAddress(json_data['email'], strict_check=False)
        with db.cursor() as c:
            c.execute('UPDATE persons SET confirm_pin = DEFAULT, confirm_until = DEFAULT WHERE email = %s AND email_confirmed = TRUE AND passhash IS NOT NULL RETURNING user_id, confirm_pin;', (str(email),))
            res = c.fetchone()
            if not res:
                return None, None
            user_id, confirm_pin, = res
            return user_id, confirm_pin

    @classmethod
    def forgot_password_reset(cls, json_data):
        jsonschema.validate(json_data, ForgotPasswordResetPOST)

        user_id = json_data['user_id']
        confirm_pin = json_data['confirm_pin']
        password = json_data['password']
        pass_hash = Auth.password_hash(password)

        with db.cursor() as c:
            c.execute('UPDATE persons SET confirm_pin = NULL, confirm_until = NULL, passhash = %s WHERE '
                'user_id = %s AND confirm_pin = %s AND confirm_until > EXTRACT(EPOCH FROM NOW()) '
                'AND email_confirmed = TRUE AND passhash IS NOT NULL ;',
                (pass_hash, user_id, confirm_pin,)
            )
            return c.rowcount

    def insert(self):
        with db.cursor() as c:
            c.execute("START TRANSACTION;")
            try:
                c.execute("INSERT INTO users (user_type) VALUES ('person') RETURNING id;")
                user_id, = c.fetchone()
                pass_hash = Auth.password_hash(self.password) if self.password is not None else None
                c.execute("INSERT INTO persons (user_id, name, email, username, passhash, timezone, email_confirmed) VALUES (%s, %s, %s, %s, %s, %s, %s);",
                    (user_id, self.name, str(self.email), self.username, pass_hash, self.timezone, self.email_confirmed,))
                c.execute("COMMIT;")
                return user_id
            except psycopg2.errors.UniqueViolation:
                # duplicated record - but we do not let the user know this, we just rollback the partial insert:
                c.execute("ROLLBACK;")
                return None
            except:
                c.execute("ROLLBACK;")
                raise

    def update(self):
        if self.force_id is None:
            raise ValidationError("Invalid user id")  # this should never happen
        with db.cursor() as c:
            if self.name:
                c.execute("UPDATE persons SET name = %s WHERE user_id = %s;", (self.name, self.force_id,))
            if self.username:
                c.execute("UPDATE persons SET username = %s WHERE user_id = %s;", (self.username, self.force_id,))
            if self.email:
                c.execute("UPDATE persons SET email = %s WHERE user_id = %s;", (str(self.email), self.force_id,))
            if self.timezone:
                c.execute("UPDATE persons SET timezone = %s WHERE user_id = %s;", (str(self.timezone), self.force_id,))
            # changing password is disabled here - it is only allowed through change_password(), which requests the old password too.
            # if self.password:
            #     pass_hash = Auth.password_hash(self.password)
            #     c.execute("UPDATE persons SET passhash = %s WHERE user_id = %s;", (pass_hash, self.force_id,))
            return c.rowcount

    @staticmethod
    def change_password(user_id, data):
        jsonschema.validate(data, PersonChangePasswordSchemaInputsPOST)

        old_password = data['old_password']
        new_password = data['new_password']

        with db.cursor() as c:
            c.execute("SELECT passhash FROM persons WHERE user_id = %s;", (user_id,))
            res = c.fetchone()
            if not res:
                log.info("No such user")
                return 0
            old_passhash, = res
            if not Auth.is_password_valid(old_password, old_passhash):
                log.info("Old password does not match")
                return 0

            new_passhash = Auth.password_hash(new_password)
            c.execute("UPDATE persons SET passhash = %s WHERE user_id = %s;", (new_passhash, user_id,))
            return c.rowcount

    @staticmethod
    def delete(user_id):
        with db.cursor() as c:
            c.execute("DELETE FROM users WHERE id = %s and user_type = 'person';", (user_id,))  # record from persons will be removed automatically (cascade)
            return c.rowcount

    @staticmethod
    def get(user_id):
        with db.cursor() as c:
            c.execute('SELECT user_id, name, email, username, timezone, email_confirmed FROM persons WHERE user_id = %s;', (user_id,))
            res = c.fetchone()
            if not res:
                return None
            user_id, name, email, username, timezone, email_confirmed = res
        return {
            'user_id': user_id,
            'name': name,
            'email': email,
            'username': username,
            'timezone': timezone,
            'email_confirmed': email_confirmed,
        }


class PersonCredentials(object):
    def __init__(self, username, password):
        self.username = username
        self.password = password

    @classmethod
    def forge_from_input(cls, json_data):
        jsonschema.validate(json_data, PersonCredentialSchemaInputs)

        username = json_data['username']
        password = json_data['password']
        return cls(username, password)

    def check_user_login(self):
        with db.cursor() as c:
            c.execute("SELECT user_id, passhash FROM persons WHERE username = %s AND email_confirmed = TRUE AND passhash IS NOT NULL;", (self.username,))
            res = c.fetchone()
            if not res:
                return None
            user_id, passhash = res
            if Auth.is_password_valid(self.password, passhash):
                return user_id
            return None


class Entity(object):
    def __init__(self, name, entity_type, parent, details, account_id, protocols, force_id=None):
        self.name = name
        self.entity_type = entity_type
        self.parent = parent
        self.details = json.dumps(details)
        self.account_id = account_id
        self.protocols = protocols
        self.force_id = force_id

    @classmethod
    def forge_from_input(cls, json_data, account_id, force_id=None):
        jsonschema.validate(json_data, EntitySchemaInputs)

        name = json_data['name']
        entity_type = json_data['entity_type']
        parent = json_data.get('parent', None)
        details = json_data['details']
        protocols = json_data.get('protocols', {})
        Entity.validate_protocols(protocols, account_id)
        return cls(name, entity_type, parent, details, account_id, protocols, force_id=force_id)

    @staticmethod
    def validate_protocols(protocols, account_id):
        # For each of the protocols, make sure that the credential and all of the sensors indeed have
        # the correct protocol and account.
        #
        #   protocols = {
        #     'snmp': {
        #       'credential': credential_id,
        #       'bot': bot_id,
        #       'sensors': [sensor1_id, sensor2_id],
        #     },
        #   }
        with db.cursor() as c:
            for protocol in protocols:
                credential_id = protocols[protocol]['credential']
                c.execute('SELECT id FROM credentials WHERE id = %s AND account = %s AND protocol = %s;', (credential_id, account_id, protocol,))
                res = c.fetchone()
                if not res:
                    raise ValidationError("Invalid credential for this account/protocol combination: {}".format(credential_id))

                # validate that bot is either an account bot or a systemwide bot:
                user_id = protocols[protocol]['bot']
                bot = Bot.get(user_id, account_id)  # check if this is an account bot (for this account)
                if not bot:
                    bot = Bot.get(user_id, None)  # check if this is a systemwide bot
                    if not bot:
                        raise ValidationError("Invalid bot for this account: {}".format(user_id))
                if bot['protocol'] != protocol:
                    raise ValidationError("Invalid bot for this protocol: {}".format(user_id))

                for sensor_info in protocols[protocol].get('sensors', []):
                    c.execute('SELECT id FROM sensors WHERE id = %s AND account = %s AND protocol = %s;', (sensor_info['sensor'], account_id, protocol,))
                    res = c.fetchone()
                    if not res:
                        raise ValidationError("Invalid sensor for this account/protocol combination: {}".format(sensor_info['sensor']))

    @staticmethod
    def get_list(account_id):
        with db.cursor() as c, db.cursor() as c2, db.cursor() as c3:
            ret = []
            c.execute('SELECT id, name, entity_type, parent, details FROM entities WHERE account = %s ORDER BY id ASC;', (account_id,))
            for entity_id, name, entity_type, parent, details in c:

                # get protocols and sensors too: (when we are accessing /entities/, we will follow up with separate entity details requests anyway)
                protocols = {}
                c2.execute('SELECT c.id, c.protocol FROM entities_credentials ec, credentials c WHERE ec.entity = %s AND ec.credential = c.id AND c.account = %s;', (entity_id, account_id))
                for credential_id, protocol in c2:
                    protocols[protocol] = {
                        'credential': credential_id,
                        'sensors': [],
                    }
                    c3.execute('SELECT b.user_id FROM entities_bots eb, bots b WHERE eb.entity = %s AND eb.bot = b.user_id AND b.protocol = %s;', (entity_id, protocol))
                    bot_res = c3.fetchone()
                    protocols[protocol]['bot'] = bot_res[0] if bot_res else None

                c2.execute('SELECT s.id, s.protocol, es.interval FROM entities_sensors es, sensors s WHERE es.entity = %s AND es.sensor = s.id AND s.account = %s;', (entity_id, account_id))
                for sensor_id, protocol, interval in c2:
                    if protocol not in protocols:
                        continue  # this might happen, depending on how we implement POST, PUT and DELETE methods... better safe than sorry.
                    protocols[protocol]['sensors'].append({
                        'sensor': sensor_id,
                        'interval': interval,
                    })

                ret.append({
                    'id': entity_id,
                    'name': name,
                    'entity_type': entity_type,
                    'parent': parent,
                    'details': details,
                    'protocols': protocols,
                })
            return ret

    def insert(self):
        with db.cursor() as c:
            c.execute("INSERT INTO entities (account, name, entity_type, parent, details) VALUES (%s, %s, %s, %s, %s) RETURNING id;", (self.account_id, self.name, self.entity_type, self.parent, self.details,))
            entity_id, = c.fetchone()

            Entity.set_protocols(c, entity_id, self.protocols, clear_existing=False)
            return entity_id

    @staticmethod
    def set_protocols(db_cursor, entity_id, protocols, clear_existing=True):
        # db_cursor: we would like to perform these changes inside the same DB transaction
        if clear_existing:
            db_cursor.execute("DELETE FROM entities_credentials WHERE entity = %s;", (entity_id,))
            db_cursor.execute("DELETE FROM entities_bots WHERE entity = %s;", (entity_id,))
            db_cursor.execute("DELETE FROM entities_sensors WHERE entity = %s;", (entity_id,))

        for protocol in protocols:
            credential_id = protocols[protocol]['credential']
            db_cursor.execute("INSERT INTO entities_credentials (entity, credential) VALUES (%s, %s);", (entity_id, credential_id,))
            bot_id = protocols[protocol].get('bot', None)
            if bot_id:
                db_cursor.execute("INSERT INTO entities_bots (entity, bot) VALUES (%s, %s);", (entity_id, bot_id,))
            for sensor_info in protocols[protocol].get('sensors', []):
                db_cursor.execute("INSERT INTO entities_sensors (entity, sensor, interval) VALUES (%s, %s, %s);", (entity_id, sensor_info['sensor'], sensor_info['interval'],))

    @staticmethod
    def get(entity_id, account_id):
        with db.cursor() as c, db.cursor() as c2:
            c.execute('SELECT name, entity_type, parent, details FROM entities WHERE id = %s AND account = %s;', (entity_id, account_id))
            res = c.fetchone()
            if not res:
                return None
            name, entity_type, parent, details = res

            protocols = {}
            c.execute('SELECT c.id, c.protocol FROM entities_credentials ec, credentials c WHERE ec.entity = %s AND ec.credential = c.id AND c.account = %s;', (entity_id, account_id))
            for credential_id, protocol in c:
                protocols[protocol] = {
                    'credential': credential_id,
                    'sensors': [],
                }
                c2.execute('SELECT b.user_id FROM entities_bots eb, bots b WHERE eb.entity = %s AND eb.bot = b.user_id AND b.protocol = %s;', (entity_id, protocol))
                bot_res = c2.fetchone()
                protocols[protocol]['bot'] = bot_res[0] if bot_res else None

            c.execute('SELECT s.id, s.protocol, es.interval FROM entities_sensors es, sensors s WHERE es.entity = %s AND es.sensor = s.id AND s.account = %s;', (entity_id, account_id))
            for sensor_id, protocol, interval in c:
                if protocol not in protocols:
                    continue  # this might happen, depending on how we implement POST, PUT and DELETE methods... better safe than sorry.
                protocols[protocol]['sensors'].append({
                    'sensor': sensor_id,
                    'interval': interval,
                })

        return {
            'id': int(entity_id),
            'name': name,
            'entity_type': entity_type,
            'parent': parent,
            'details': details,
            'protocols': protocols,
            #   'protocols': {
            #       'snmp': {
            #           'credential': credential_id,
            #           'bot': bot_id,  # or None
            #           'sensors': [
            #             { 'id': sensor_id1, 'name': sensor_name1 },
            #           ],
            #       },
            #   }
        }

    def update(self):
        if self.force_id is None:
            return 0
        with db.cursor() as c:
            c.execute("UPDATE entities SET name = %s, entity_type = %s, details = %s WHERE id = %s AND account = %s;", (self.name, self.entity_type, self.details, self.force_id, self.account_id,))
            was_updated = c.rowcount
            if was_updated:
                Entity.set_protocols(c, self.force_id, self.protocols, clear_existing=True)
            return was_updated

    @staticmethod
    def delete(entity_id, account_id):
        with db.cursor() as c:
            c.execute("DELETE FROM entities WHERE id = %s AND account = %s;", (entity_id, account_id,))
            return c.rowcount


class Credential(object):
    def __init__(self, name, protocol, details, account_id, force_id=None):
        self.name = name
        self.protocol = protocol
        self.details = json.dumps(details)
        self.account_id = account_id
        self.force_id = force_id

    @classmethod
    def forge_from_input(cls, json_data, account_id, force_id=None):
        jsonschema.validate(json_data, CredentialSchemaInputs)

        name = json_data['name']
        protocol = json_data.get('protocol', None)
        details = json_data.get('details', None)
        return cls(name, protocol, details, account_id, force_id=force_id)

    @staticmethod
    def get_list(account_id):
        with db.cursor() as c:
            ret = []
            c.execute('SELECT id, name, protocol, details FROM credentials WHERE account = %s ORDER BY id ASC;', (account_id,))
            for credential_id, name, protocol, details in c:
                ret.append({
                    'id': credential_id,
                    'name': name,
                    'protocol': protocol,
                    'details': details,
                })
            return ret

    def insert(self):
        with db.cursor() as c:
            c.execute("INSERT INTO credentials (account, name, protocol, details) VALUES (%s, %s, %s, %s) RETURNING id;", (self.account_id, self.name, self.protocol, self.details,))
            credential_id, = c.fetchone()
            return credential_id

    @staticmethod
    def get(credential_id, account_id):
        with db.cursor() as c:
            c.execute('SELECT name, protocol, details FROM credentials WHERE id = %s AND account = %s;', (credential_id, account_id))
            res = c.fetchone()
            if not res:
                return None
            name, protocol, details = res
        return {
            'id': int(credential_id),
            'name': name,
            'protocol': protocol,
            'details': details,
        }

    def update(self):
        if self.force_id is None:
            return 0
        with db.cursor() as c:
            c.execute("UPDATE credentials SET name = %s, protocol = %s, details = %s WHERE id = %s AND account = %s;", (self.name, self.protocol, self.details, self.force_id, self.account_id,))
            return c.rowcount

    @staticmethod
    def delete(credential_id, account_id):
        with db.cursor() as c:
            c.execute("DELETE FROM credentials WHERE id = %s AND account = %s;", (credential_id, account_id,))
            return c.rowcount


class Sensor(object):
    def __init__(self, name, protocol, default_interval, details, account_id, force_id=None):
        self.name = name
        self.protocol = protocol
        self.default_interval = default_interval
        self.details = json.dumps(details)
        self.account_id = account_id
        self.force_id = force_id

    @classmethod
    def forge_from_input(cls, json_data, account_id, force_id=None):
        jsonschema.validate(json_data, SensorSchemaInputs)

        name = json_data['name']
        protocol = json_data.get('protocol', None)
        default_interval = json_data.get('default_interval', None)
        details = json_data.get('details', None)
        return cls(name, protocol, default_interval, details, account_id, force_id=force_id)

    @staticmethod
    def get_list(account_id):
        with db.cursor() as c:
            ret = []
            c.execute('SELECT id, name, protocol, default_interval, details FROM sensors WHERE account = %s ORDER BY id ASC;', (account_id,))
            for record_id, name, protocol, default_interval, details in c:
                ret.append({
                    'id': record_id,
                    'name': name,
                    'protocol': protocol,
                    'default_interval': default_interval,
                    'details': details,
                })
            return ret

    def insert(self):
        with db.cursor() as c:
            c.execute("INSERT INTO sensors (account, name, protocol, default_interval, details) VALUES (%s, %s, %s, %s, %s) RETURNING id;",
                (self.account_id, self.name, self.protocol, self.default_interval, self.details,))
            record_id, = c.fetchone()
            return record_id

    @staticmethod
    def get(record_id, account_id):
        with db.cursor() as c:
            c.execute('SELECT name, protocol, default_interval, details FROM sensors WHERE id = %s AND account = %s;', (record_id, account_id))
            res = c.fetchone()
            if not res:
                return None
            name, protocol, default_interval, details = res
        return {
            'id': int(record_id),
            'name': name,
            'protocol': protocol,
            'default_interval': default_interval,
            'details': details,
        }

    def update(self):
        if self.force_id is None:
            return 0
        with db.cursor() as c:
            c.execute("UPDATE sensors SET name = %s, protocol = %s, default_interval = %s, details = %s WHERE id = %s AND account = %s;",
                (self.name, self.protocol, self.default_interval, self.details, self.force_id, self.account_id,))
            return c.rowcount

    @staticmethod
    def delete(record_id, account_id):
        with db.cursor() as c:
            c.execute("DELETE FROM sensors WHERE id = %s AND account = %s;", (record_id, account_id,))
            return c.rowcount


class WidgetPlugin(object):
    MAX_TAR_GZ_SIZE = 10 * (1024 ** 2)

    def __init__(self, label, icon, is_header_widget, repo_url, version, widget_js, form_js):
        self.label = label
        self.icon = icon
        self.is_header_widget = is_header_widget
        self.repo_url = repo_url
        self.version = version
        self.widget_js = widget_js
        self.form_js = form_js

    @classmethod
    def forge_from_url(cls, github_repo_url):
        """
            Download .tar.gz file from an URL, decode it, validate manifest.json and widget.js
            and construct + return an object representing a widget plugin.
        """
        github_repo_url = github_repo_url.rstrip('/')

        # find the tag of the latest release:
        latest_release_url = f"{github_repo_url}/releases/latest"
        r = requests.head(latest_release_url, allow_redirects=False)
        r.raise_for_status()
        location = r.headers["location"]
        version = location.split("/")[-1]

        # download the archive of the latest release:
        url = f"{github_repo_url}/releases/download/{version}/widgetplugin.tar.gz"
        r = requests.get(url, timeout=5, stream=True, allow_redirects=True)
        r.raise_for_status()
        content = r.raw.read(cls.MAX_TAR_GZ_SIZE + 1, decode_content=True)
        if len(content) > cls.MAX_TAR_GZ_SIZE:
            raise ValidationError(f'The file is too big (limit is {int(cls.MAX_TAR_GZ_SIZE / (1024**2))} MB)')
        f = io.BytesIO(content)
        tar = tarfile.open(fileobj=f, mode='r:gz')

        # extract and parse manifest.json:
        manifest_json = tar.extractfile("manifest.json")
        if not manifest_json:
            raise ValidationError("Missing manifest.json in .tar.gz file")
        try:
            manifest = json.loads(manifest_json.read())
        except Exception as ex:
            raise ValidationError(f"Error loading manifest.json: {str(ex)}")
        jsonschema.validate(manifest, WidgetPluginManifestSchemaInputs)

        # extract widget.js:
        widget_js_file = tar.extractfile("widget.js")
        if not widget_js_file:
            raise ValidationError("Missing widget.js in .tar.gz file")
        widget_js = widget_js_file.read().decode('utf-8')

        form_js_file = tar.extractfile("form.js")
        if not form_js_file:
            raise ValidationError("Missing form.js in .tar.gz file")
        form_js = form_js_file.read().decode('utf-8')

        # construct and return a WidgetPlugin object:
        label = manifest['label']
        icon = manifest['icon']
        is_header_widget = manifest['is_header_widget']
        return cls(label, icon, is_header_widget, github_repo_url, version, widget_js, form_js)

    @staticmethod
    def get_list():
        with db.cursor() as c:
            ret = []
            c.execute('SELECT id, label, icon, is_header_widget, repo_url, version FROM widget_plugins ORDER BY label ASC;')
            for record_id, label, icon, is_header_widget, repo_url, version in c:
                ret.append({
                    'id': int(record_id),
                    'label': label,
                    'icon': icon,
                    'is_header_widget': is_header_widget,
                    'repo_url': repo_url,
                    'version': version,
                })
            return ret

    def insert(self):
        with db.cursor() as c:
            c.execute("INSERT INTO widget_plugins (label, icon, is_header_widget, repo_url, version, widget_js, form_js) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id;",
                (self.label, self.icon, self.is_header_widget, self.repo_url, self.version, self.widget_js, self.form_js,))
            record_id, = c.fetchone()
            return record_id

    @staticmethod
    def get(record_id):
        with db.cursor() as c:
            c.execute('SELECT label, icon, is_header_widget, repo_url, version, widget_js, form_js FROM widget_plugins WHERE id = %s;', (record_id,))
            res = c.fetchone()
            if not res:
                return None
            label, icon, is_header_widget, repo_url, version, widget_js, form_js = res
        return {
            'id': int(record_id),
            'label': label,
            'icon': icon,
            'is_header_widget': is_header_widget,
            'repo_url': repo_url,
            'version': version,
            'widget_js': widget_js,
            'form_js': form_js,
        }

    def update(self):
        with db.cursor() as c:
            c.execute("UPDATE widget_plugins SET label = %s, icon = %s, is_header_widget = %s, version = %s, widget_js = %s, form_js = %s WHERE repo_url = %s;",
                (self.label, self.icon, self.is_header_widget, self.version, self.widget_js, self.form_js, self.repo_url,))
            return c.rowcount

    @staticmethod
    def delete(record_id):
        with db.cursor() as c:
            c.execute("DELETE FROM widget_plugins WHERE id = %s;", (record_id,))
            return c.rowcount

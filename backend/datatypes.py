import calendar
from collections import defaultdict
from functools import lru_cache
import json
import math
import os
import re

import dns
import jsonschema
from slugify import slugify
import quart as flask

from utils import log, rowcount
from validators import (
    DashboardInputs, WidgetSchemaInputs, WidgetsPositionsSchemaInputs, PersonSchemaInputsPOST,
    PersonSchemaInputsPUT, PersonCredentialSchemaInputs, AccountSchemaInputs, PermissionSchemaInputs,
    AccountBotSchemaInputs, BotSchemaInputs, EntitySchemaInputs, CredentialSchemaInputs,
    SensorSchemaInputs, PersonChangePasswordSchemaInputsPOST, PathSchemaInputs
)
from auth import Auth


# Lru_cache is currently disabled so that we can avoid strange caching issues when developing. We might enable it later though.
def clear_all_lru_cache():
    # when testing, it is important to clear memoization cache in between runs, or the results will be... interesting.
    # Dashboard.get_id.cache_clear()
    # Path._get_path_id_from_db.cache_clear()
    # PathFilter._find_matching_paths_for_filter.cache_clear()
    pass


class ValidationError(Exception):
    pass


class AccessDeniedError(Exception):
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
    _regex = re.compile(r'^([a-zA-Z0-9_-]|([%]2e))+([.]([a-zA-Z0-9_-]|([%]2e))+)*$')

class Path(object):

    def __init__(self, path, account_id, force_id=None):
        self.path = str(PathInputValue(path))
        self.account_id = account_id
        self.force_id = force_id

    @classmethod
    async def forge_from_path(cls, path, account_id, ensure_in_db=True):
        path_id = None
        if ensure_in_db:
            path_id = await Path._get_path_id_from_db(account_id, path=path)
        return cls(path, account_id, path_id)

    @classmethod
    def forge_from_input(cls, json_data, account_id, force_id=None):
        jsonschema.validate(json_data, PathSchemaInputs)

        path = json_data['path']
        return cls(path, account_id, force_id=force_id)

    @staticmethod
    # @lru_cache(maxsize=256)
    async def _get_path_id_from_db(account_id, path):
        async with flask.current_app.pool.acquire() as c:
            path_cleaned = path.strip()
            res = await c.fetchrow('SELECT id FROM paths WHERE account = $1 AND path=$2;', int(account_id), path_cleaned)
            if not res:
                res = await c.fetchrow('INSERT INTO paths (account, path) VALUES ($1, $2) RETURNING id;', int(account_id), path_cleaned)
            path_id = res[0]
            return path_id

    @staticmethod
    async def get(path_id, account_id):
        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow('SELECT path FROM paths WHERE account = $1 AND id = $2;', account_id, path_id)
            if not res:
                return None
            path = res[0]

        return {
            'path': path,
        }

    async def update(self):
        if self.force_id is None:
            return 0
        async with flask.current_app.pool.acquire() as c:
            rowcount_str = await c.execute("UPDATE paths SET path = $1 WHERE id = $2 AND account = $3;", self.path, self.force_id, self.account_id)
            return rowcount(rowcount_str)

    @staticmethod
    async def delete(path_id, account_id):
        async with flask.current_app.pool.acquire() as c:
            # delete just the path, "ON DELETE CASCADE" takes care of removing values:
            rowcount_str = await c.execute("DELETE FROM paths WHERE id = $1 AND account = $2;", path_id, account_id)
            return rowcount(rowcount_str)


class PathFilter(_RegexValidatedInputValue):
    _regex = re.compile(r'^([a-zA-Z0-9_-]+|[*?])([.]([a-zA-Z0-9_-]+|[*?]))*$')

    @staticmethod
    async def find_matching_paths(account_id, path_filter, limit=200, allow_trailing_chars=False):
        pf_regex = PathFilter._regex_from_filter(path_filter, allow_trailing_chars)
        async with flask.current_app.pool.acquire() as c:
            res = await c.fetch('SELECT id, path FROM paths WHERE account = $1 AND path ~ $2 ORDER BY path LIMIT $3;', account_id, pf_regex, limit + 1)
            found_paths = [{
                "id": r[0],
                "path": r[1],
            } for r in res]
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
        is_valid = self.is_valid(str(v))
        if strict_check and is_valid is None:
            raise ValidationError("Could not validate email: {}".format(str(v)))
        self.v = str(v)

    @classmethod
    def is_valid(cls, v):
        """
            Returns False if validation failed (invalid format or MX DNS record
            not available), None if DNS timed out, True otherwise.
        """
        if '@' not in v:
            return False
        domain = v.rsplit('@', 1)[-1]
        try:
            dns_records = dns.resolver.query(domain, 'MX', lifetime=10.0)
            return len(dns_records) > 0
        except dns.exception.Timeout:
            log.warning("Could not validate email address due to DNS timeout!")
            return None
        except:
            return False

    def __str__(self):
        return self.v


class Measurement(object):
    AGGR_FACTOR = 3
    MAX_AGGR_LEVEL = 6  # 0 == one point per 1h; 1 == 1 point per 3h; ...; 6 == one point per ~month
    MAX_DATAPOINTS_RETURNED = 100000

    @classmethod
    async def save_values_data_to_db(cls, account_id, put_data):

        # convert data to appropriate form:
        payload = []
        for x in put_data:
            path = await Path.forge_from_path(x['p'], account_id, ensure_in_db=True)
            payload.append((path.force_id, str(Timestamp(x['t'])), str(MeasuredValue(x['v'])),))

        async with flask.current_app.pool.acquire() as c:
            # https://stackoverflow.com/a/34529505/593487
            await c.executemany('''
                INSERT INTO
                    measurements (path, ts, value)
                VALUES ($1, $2, $3)
                ON CONFLICT (path, ts) DO
                UPDATE SET value=excluded.value;
            ''', payload)

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
    async def fetch_data(cls, account_id, paths, aggr_level, t_froms, t_to, should_sort_asc, max_records):
        # t_froms: an array of t_from, one for each path (because the subsequent fetchings usually request a different t_from for each path)
        paths_data = {}
        sort_order = 'ASC' if should_sort_asc else 'DESC'  # PgSQL doesn't allow sort order to be parametrized
        async with flask.current_app.pool.acquire() as c:
            for p, t_from in zip(paths, t_froms):
                str_p = str(p)
                path_data = []
                path_id = await Path._get_path_id_from_db(account_id, str_p)

                # trick: fetch one result more than is allowed (by MAX_DATAPOINTS_RETURNED) so that we know that the result set is not complete and where the client should continue from
                if aggr_level is None:  # fetch raw data
                    rows = await c.fetch('SELECT ts, value FROM measurements WHERE path = $1 AND ts >= $2 AND ts <= $3 ORDER BY ts ' + sort_order + ' LIMIT $4;', path_id, float(t_from), float(t_to), max_records + 1)
                    for ts, value in rows:
                        path_data.append({'t': float(ts), 'v': float(value)})
                else:  # fetch aggregated data
                    aggr_interval_s = 3600 * (cls.AGGR_FACTOR ** aggr_level)
                    rows = await c.fetch(f"""
                        SELECT
                            FLOOR(ts / {aggr_interval_s}),
                            PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY value),
                            MIN(value),
                            MAX(value)
                        FROM
                            measurements
                        WHERE
                            path = $1 AND
                            FLOOR(ts / {aggr_interval_s}) >= $2 AND
                            FLOOR(ts / {aggr_interval_s}) <= $3
                        GROUP BY
                            FLOOR(ts / {aggr_interval_s})
                        ORDER BY
                            FLOOR(ts / {aggr_interval_s}) {sort_order}
                    """, path_id, math.floor(float(t_from) / aggr_interval_s), math.floor(float(t_to) / aggr_interval_s))
                    # await c.fetch('SELECT tsmed, vavg, vmin, vmax FROM aggregations WHERE path = $1 AND level = $2 AND tsmed >= $3 AND tsmed < $4 ORDER BY tsmed ' + sort_order + ' LIMIT $5;', path_id, aggr_level, float(t_from), float(t_to), max_records + 1,)
                    for ts, vavg, vmin, vmax in rows:
                        path_data.append({'t': float(ts) * aggr_interval_s + aggr_interval_s / 2, 'v': float(vavg), 'minv': float(vmin), 'maxv': float(vmax)})

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
    async def fetch_topn(cls, account_id, path_filter, ts_to, max_results):
        pf_regex = PathFilter._regex_from_filter(path_filter, allow_trailing_chars=False)
        async with flask.current_app.pool.acquire() as c:
            rows = await c.fetch(
                # correct, but slow:
                # """
                # SELECT m.ts, p.path, m.value
                # FROM paths p, measurements m
                # WHERE
                #     p.path ~ $1  AND
                #     p.id = m.path AND
                #     m.ts <= $2
                # ORDER BY m.ts desc, m.value DESC
                # LIMIT $3
                """
                    SELECT m.ts, p.path, m.value
                    FROM paths p, measurements m
                    WHERE
                        p.path ~ $1 AND
                        p.id = m.path AND
                        m.ts = (
                            SELECT max(m2.ts) FROM measurements m2 WHERE m2.path = p.id AND m2.ts <= $2
                        )
                    ORDER BY m.ts DESC, m.value DESC
                    LIMIT $3
                """, pf_regex, float(ts_to), max_results
            )

            found_ts = None
            topn = []
            for ts, path, value in rows:
                if found_ts is None:
                    found_ts = ts
                elif found_ts != ts:
                    break  # only use those records which have the same timestamp as the first one
                topn.append({'p': path, 'v': float(value)})

            if not found_ts:
                return ts_to, 0, []

            # find the sum of all values at that timestamp so we can display percentages:
            row = await c.fetchrow("SELECT SUM(m.value) FROM paths p, measurements m WHERE p.path ~ $1  AND p.id = m.path AND m.ts = $2", pf_regex, found_ts)
            total, = row
            return found_ts, total, topn


    @classmethod
    async def get_oldest_measurement_time(cls, account_id, paths):
        path_ids = []
        for p in paths:
            path_ids.append(await Path._get_path_id_from_db(account_id, str(p)))
        async with flask.current_app.pool.acquire() as c:
            # This used to be:
            #   res = await c.fetchrow('SELECT MIN(ts) FROM measurements WHERE path IN $1;', path_ids)
            # Apparently while this works with psycopg2, it is not a PostgreSQL syntax:
            #   https://magicstack.github.io/asyncpg/current/faq.html#why-do-i-get-postgressyntaxerror-when-using-expression-in-1
            res = await c.fetchrow('SELECT MIN(ts) FROM measurements WHERE path = any($1::int[]);', path_ids)
            if not res:
                return None
            return res[0]


class Widget(object):

    def __init__(self, dashboard_id, widget_type, title, content, widget_id, position_p):
        self.dashboard_id = dashboard_id
        self.widget_type = widget_type
        self.title = title
        self.content = content
        self.widget_id = widget_id
        self.position_p = position_p

    @classmethod
    async def forge_from_input(cls, account_id, dashboard_slug, json_data, widget_id=None):
        jsonschema.validate(json_data, WidgetSchemaInputs)

        widget_type = json_data['type']
        title = json_data['title']
        position_p = json_data.get('p', 'default')
        content = json_data['content']
        # users reference the dashboards by its slug, but we need to know its ID:
        dashboard_id = await Dashboard.get_id(account_id, dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        if widget_id is not None and not await Widget._check_exists(widget_id):
            raise ValidationError("Unknown widget id")

        return cls(dashboard_id, widget_type, title, content, widget_id, position_p)

    @staticmethod
    async def set_positions(account_id, dashboard_slug, json_data):
        dashboard_id = await Dashboard.get_id(account_id, dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        jsonschema.validate(json_data, WidgetsPositionsSchemaInputs)

        async with flask.current_app.pool.acquire() as c:
            widgets_positions_tuples = [(pos['x'], pos['y'], pos['w'], pos['h'], pos['p'], dashboard_id, pos['widget_id'],) for pos in json_data]
            await c.executemany("""
                UPDATE widgets
                SET
                    position_x = $1,
                    position_y = $2,
                    position_w = $3,
                    position_h = $4,
                    position_p = $5
                WHERE dashboard = $6 AND id = $7;
            """, widgets_positions_tuples)


    @staticmethod
    async def _check_exists(widget_id):
        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow('SELECT id FROM widgets WHERE id = $1;', widget_id)
            if res:
                return True
            return False

    async def insert(self):
        async with flask.current_app.pool.acquire() as c:
            # we will position the new widget below each of the known widgets, which means that we set
            # its position to: x=0, y=max(y + h), w=12, h=8
            res = await c.fetchrow('SELECT MAX(position_y + position_h) FROM widgets WHERE dashboard = $1 and position_p = $2;', self.dashboard_id, self.position_p)
            position_y = res[0] if res and res[0] else 0

            res = await c.fetchrow("INSERT INTO widgets (dashboard, type, title, position_x, position_y, position_w, position_h, position_p, content) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id;",
                      self.dashboard_id, self.widget_type, self.title, 0, position_y, 12, 10, self.position_p, self.content)
            widget_id = res[0]
            return widget_id

    async def update(self):
        async with flask.current_app.pool.acquire() as c:
            res = await c.execute("UPDATE widgets SET type = $1, title = $2, position_p = $3, content = $4  WHERE id = $5 and dashboard = $6;", self.widget_type, self.title, self.position_p, self.content, self.widget_id, self.dashboard_id)
            if not rowcount(res):
                return 0
            return 1

    @staticmethod
    async def delete(account_id, dashboard_slug, widget_id):
        dashboard_id = await Dashboard.get_id(account_id, dashboard_slug)
        async with flask.current_app.pool.acquire() as c:
            res = await c.execute("DELETE FROM widgets WHERE id = $1 and dashboard = $2;", widget_id, dashboard_id)
            return rowcount(res)

    @staticmethod
    async def get_list(account_id, dashboard_slug, paths_limit=200):
        dashboard_id = await Dashboard.get_id(account_id, dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        async with flask.current_app.pool.acquire() as c:
            res = await c.fetch('SELECT id, type, title, position_x, position_y, position_w, position_h, position_p, content FROM widgets WHERE dashboard = $1 ORDER BY position_y, position_x;', dashboard_id)
            ret = []
            for widget_id, widget_type, title, position_x, position_y, position_w, position_h, position_p, content in res:
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
    async def get(account_id, dashboard_slug, widget_id, paths_limit=200):
        dashboard_id = await Dashboard.get_id(account_id, dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow('SELECT type, title, position_x, position_y, position_w, position_h, position_p, content FROM widgets WHERE id = $1 and dashboard = $2;', widget_id, dashboard_id)
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
    async def forge_from_input(cls, account_id, json_data, force_slug=None):
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
                slug = await cls._suggest_new_slug(account_id, name)
        return cls(account_id, name, slug)

    @classmethod
    async def _suggest_new_slug(cls, account_id, name):
        # Find a suitable slug from name, appending numbers for as long as it takes to find a non-existing slug.
        # This is probably not 100% race-condition safe, but it doesn't matter - unique contraint is on DB level,
        # and this is just a nicety from us.
        postfix_nr = 1
        while True:
            slug = slugify(name[:40]) + ('' if postfix_nr == 1 else '-{}'.format(postfix_nr))
            if await Dashboard.get_id(account_id, slug) is None:
                return slug  # we have found a slug which doesn't exist yet, use it
            postfix_nr += 1

    async def insert(self):
        async with flask.current_app.pool.acquire() as c:
            await c.execute("INSERT INTO dashboards (name, account, slug) VALUES ($1, $2, $3);", self.name, self.account_id, self.slug)
            # we must invalidate get_id()'s lru_cache, otherwise it will keep returning None instead of new ID:
            # Dashboard.get_id.cache_clear()

    async def update(self):
        async with flask.current_app.pool.acquire() as c:
            res = await c.execute("UPDATE dashboards SET name = $1 WHERE account = $2 AND slug = $3;", self.name, self.account_id, self.slug)
            return rowcount(res)

    @staticmethod
    async def delete(account_id, slug):
        async with flask.current_app.pool.acquire() as c:
            res = await c.execute("DELETE FROM dashboards WHERE account = $1 AND slug = $2;", account_id, slug)
            # we must invalidate get_id()'s lru_cache, otherwise it will keep returning the old ID instead of None:
            # Dashboard.get_id.cache_clear()
            return rowcount(res)

    @staticmethod
    async def get_list(account_id):
        async with flask.current_app.pool.acquire() as c:
            ret = []
            res = await c.fetch('SELECT name, slug FROM dashboards WHERE account = $1 ORDER BY name;', account_id)
            for name, slug in res:
                ret.append({'name': name, 'slug': slug})
            return ret

    @staticmethod
    async def get(account_id, slug):
        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow('SELECT name FROM dashboards WHERE account = $1 AND slug = $2;', account_id, slug)
            if not res:
                return None
            name = res[0]

        widgets = await Widget.get_list(account_id, slug)
        return {
            'name': name,
            'slug': slug,
            'widgets': widgets,
        }

    @staticmethod
    # @lru_cache(maxsize=256)
    async def get_id(account_id, slug):
        """ This is a *cached* function which returns ID based on dashboard slug. Make sure
            to invalidate lru_cache whenever one of the existing slug <-> ID relationships
            changes in any way (delete, insert). """
        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow('SELECT id FROM dashboards WHERE account = $1 AND slug = $2;', account_id, slug)
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

    async def insert(self, create_first_records=True):
        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow("INSERT INTO accounts (name) VALUES ($1) RETURNING id;", self.name)
            account_id = res[0]

            # to help users, we create first records like ping credential and sensor:
            if create_first_records:
                credential_details = {"n_packets": "3", "sleep_packets": "1.0", "timeout": "1.0", "retry": "0"}
                cred = Credential("Default ICMP ping credential (3 packets)", 'ping', credential_details, account_id)
                await cred.insert()

                s = Sensor("Default ICMP ping sensor", 'ping', 60, {}, account_id)
                await s.insert()

                # SNMP "public" credential and a few sensors for good measure:
                credential_details = {"version": "snmpv2c", "snmpv12_community": "public"}
                cred = Credential("Default SNMP credential (SNMPv2c, 'public')", 'snmp', credential_details, account_id)
                await cred.insert()

                # https://www.alvestrand.no/objectid/1.3.6.1.2.1.2.2.1.html
                s_if_in_octets_details = {"oids": [{"oid": "1.3.6.1.2.1.2.2.1.2", "fetch_method": "walk"}, {"oid": "1.3.6.1.2.1.2.2.1.10", "fetch_method": "walk"}], "expression": "$2", "output_path": "if.in-octets.{$index}.{$1}"}
                s = Sensor("Traffic IN [bps]", 'snmp', 60, s_if_in_octets_details, account_id)
                await s.insert()
                s_if_out_octets_details = {"oids": [{"oid": "1.3.6.1.2.1.2.2.1.2", "fetch_method": "walk"}, {"oid": "1.3.6.1.2.1.2.2.1.16", "fetch_method": "walk"}], "expression": "$2", "output_path": "if.out-octets.{$index}.{$1}"}
                s = Sensor("Traffic OUT [bps]", 'snmp', 60, s_if_out_octets_details, account_id)
                await s.insert()

                s_lmsensors_temp_details = {"oids": [{"oid": "1.3.6.1.4.1.2021.13.16.2.1.2", "fetch_method": "walk"}, {"oid": "1.3.6.1.4.1.2021.13.16.2.1.3", "fetch_method": "walk"}], "expression": "$2 / 1000.0", "output_path": "lmsensors.temp.{$index}.{$1}"}
                s = Sensor("Linux lmsensors - temperature [°C]", 'snmp', 60, s_lmsensors_temp_details, account_id)
                await s.insert()

            return account_id

    async def update(self):
        if self.force_id is None:
            return 0
        async with flask.current_app.pool.acquire() as c:
            res = await c.execute("UPDATE accounts SET name = $1 WHERE id = $2;", self.name, self.force_id)
            return rowcount(res)

    @staticmethod
    async def get_list(user_id=None):
        async with flask.current_app.pool.acquire() as c:
            ret = []
            if user_id is None:
                res = await c.fetch('SELECT id, name FROM accounts ORDER BY name;')
            else:
                # get the list of accounts that this user has the permission to access: (GET)
                # - get user's permissions, then:
                #   - find a permission that grants access to all accounts, or
                #   - find specific accounts that users has GET permission for
                can_access_all_accounts = False
                specific_accounts = []
                for permission in await Permission.get_list(user_id):
                    # we are only interested in GET methods: (or None)
                    if permission['resource_prefix'] is None or permission['resource_prefix'] == 'accounts':
                        can_access_all_accounts = True
                        break
                    m = Account.RESOURCE_ACCOUNTS_REGEX.match(permission['resource_prefix'])
                    if m:
                        specific_accounts.append(int(m.group(1)))

                if can_access_all_accounts:
                    res = await c.fetch('SELECT id, name FROM accounts ORDER BY name;')
                elif specific_accounts:
                    res = await c.fetch('SELECT id, name FROM accounts WHERE id = any($1::int[]) ORDER BY name;', tuple(specific_accounts))
                else:
                    res = []

            for account_id, name in res:
                ret.append({'id': account_id, 'name': name})
            return ret

    @staticmethod
    async def get(account_id):
        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow('SELECT name FROM accounts WHERE id = $1;', account_id)
            if not res:
                return None
            name = res[0]
            return {
                'id': account_id,
                'name': name,
            }


class Permission(object):
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
    async def get_list(user_id):
        async with flask.current_app.pool.acquire() as c:
            ret = []
            res = await c.fetch('SELECT id, user_id, resource_prefix, methods FROM permissions WHERE user_id = $1 ORDER BY resource_prefix, id;', user_id)
            for permission_id, user_id, resource_prefix, methods in res:
                ret.append({'id': permission_id, 'resource_prefix': resource_prefix, 'methods': methods})
            return ret

    async def insert(self, granting_user_id, skip_checks=False):
        if not skip_checks:
            # make sure user is not granting permissions to themselves:
            if int(granting_user_id) == int(self.user_id):
                raise AccessDeniedError("Can't grant permissions to yourself")
            # make sure that authenticated user's permissions are a superset of the ones that they wish to grant:
            granting_user_permissions = await Permission.get_list(granting_user_id)
            if not Permission.can_grant_permission(granting_user_permissions, self.resource_prefix, self.methods):
                raise AccessDeniedError("Can't grant permission you don't have")

        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow("INSERT INTO permissions (user_id, resource_prefix, methods) VALUES ($1, $2, $3) RETURNING id;", self.user_id, self.resource_prefix, self.methods)
            account_id = res[0]
            return account_id

    @staticmethod
    async def has_all_permissions(user_permissions, target_user_id):
        """ Does the user have all the permissions that some other (target) user has? """
        target_permissions = await Permission.get_list(target_user_id)
        for target_permission in target_permissions:
            if not Permission.can_grant_permission(user_permissions, target_permission['resource_prefix'], target_permission['methods']):
                return False
        return True

    @staticmethod
    async def is_access_allowed(user_id, resource, method):
        if method == 'HEAD':
            method = 'GET'  # access for HEAD is the same as for GET
        async with flask.current_app.pool.acquire() as c:
            # with resource_prefix, make sure that it either matches the urls exactly, or that the url continues with '/' + anything (not just anything)
            res = await c.fetchrow('SELECT id FROM permissions WHERE ' + \
                '(user_id = $1) AND ' + \
                "(resource_prefix IS NULL OR resource_prefix = $2 OR $3 LIKE resource_prefix || '/%%') AND " + \
                '(methods IS NULL OR $4 = ANY(methods));',
                user_id, resource, resource, method)
            if res:
                return True
            else:
                return False

    @staticmethod
    async def delete(permission_id, user_id, granting_user_id):
        # make sure user is not removing their own permission:
        if int(granting_user_id) == int(user_id):
            raise AccessDeniedError("Can't grant permissions to yourself")
        async with flask.current_app.pool.acquire() as c:
            res = await c.execute('DELETE FROM permissions WHERE id = $1 AND user_id = $2;', permission_id, user_id)
            return rowcount(res)


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
    async def get(user_id):
        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow('SELECT user_type FROM users WHERE id = $1;', user_id)
            if not res:
                return None
            user_type, = res
            # get the underlying record, either a person or a bot:
            record = None
            if user_type == 'bot':
                bot_tied_to_account = await Bot.get_tied_to_account(user_id)
                if bot_tied_to_account:
                    record = await Bot.get(user_id, bot_tied_to_account)
                else:
                    record = await Bot.get(user_id, None)
            elif user_type == 'person':
                record = await Person.get(user_id)
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
    async def get_list(force_account=None):
        async with flask.current_app.pool.acquire() as c:
            ret = []
            if force_account is None:
                # return systemwide bots:
                # Note: in hindsight, it would probably make sense to have a field "account" in a bots
                # table, instead of having a separate users_account table. This SELECT finds those
                # rows that *don't* have a corresponding entry in users_accounts:
                res = await c.fetch('SELECT b.user_id, b.name, b.protocol, b.insert_time, b.last_login ' +
                          'FROM bots AS b LEFT JOIN users_accounts AS ua ON b.user_id = ua.user_id ' +
                          'WHERE ua.account IS NULL ORDER BY b.insert_time DESC;')
            else:
                # return bots tied to a specific account:
                res = await c.fetch('SELECT b.user_id, b.name, b.protocol, b.insert_time, b.last_login ' +
                          'FROM bots AS b INNER JOIN users_accounts AS ua ON b.user_id = ua.user_id ' +
                          'WHERE ua.account = $1 ORDER BY b.insert_time DESC;', force_account)
            for user_id, name, protocol, insert_time, last_login in res:
                ret.append({
                    'id': user_id,
                    'name': name,
                    'protocol': protocol,
                    'tied_to_account': force_account,
                    'insert_time': calendar.timegm(insert_time.timetuple()),
                    'last_login': None if last_login is None else calendar.timegm(last_login.timetuple()),
                })
            return ret

    async def insert(self):
        async with flask.current_app.pool.acquire() as c:
            user_id, = await c.fetchrow("INSERT INTO users (user_type) VALUES ('bot') RETURNING id;")
            bot_token, = await c.fetchrow("INSERT INTO bots (user_id, name, protocol) VALUES ($1, $2, $3) RETURNING token;", user_id, self.name, self.protocol)
            if self.force_account:
                await c.execute("INSERT INTO users_accounts (user_id, account, config) VALUES ($1, $2, $3);", user_id, self.force_account, self.config)
            return user_id, bot_token

    async def update(self):
        if self.force_id is None:
            return 0
        async with flask.current_app.pool.acquire() as c:
            if self.force_account is not None:
                if self.force_account != await Bot.get_tied_to_account(self.force_id):
                    return 0

            res = await c.execute("UPDATE bots SET name = $1, protocol = $2 WHERE user_id = $3;", self.name, self.protocol, int(self.force_id))
            if not rowcount(res):
                return 0
            # if account id is known, we must update config information in users_accounts table:
            if self.force_account:
                await c.execute("UPDATE users_accounts SET config = $1 WHERE user_id = $2 and account = $3;", self.config, int(self.force_id), self.force_account)
            return 1

    @staticmethod
    async def delete(user_id, force_account=None):
        async with flask.current_app.pool.acquire() as c:
            if force_account is not None:
                if force_account != await Bot.get_tied_to_account(user_id):
                    return 0
            res = await c.execute("DELETE FROM users WHERE id = $1 AND user_type = 'bot';", int(user_id))  # record from bots will be removed automatically (cascade)
            return rowcount(res)

    @staticmethod
    async def get(user_id, tied_to_account=None):
        async with flask.current_app.pool.acquire() as c:
            if tied_to_account:
                res = await c.fetchrow('SELECT b.name, b.protocol, ua.config, b.insert_time, b.last_login ' +
                          'FROM bots AS b INNER JOIN users_accounts AS ua ON b.user_id = ua.user_id ' +
                          'WHERE ua.account = $1 AND b.user_id = $2;', tied_to_account, int(user_id))
            else:
                res = await c.fetchrow('SELECT b.name, b.protocol, NULL, b.insert_time, b.last_login ' +
                          'FROM bots AS b LEFT JOIN users_accounts AS ua ON b.user_id = ua.user_id ' +
                          'WHERE ua.account IS NULL AND b.user_id = $1;', int(user_id))
            if not res:
                return None
            name, protocol, config, insert_time, last_login = res
        return {
            'id': int(user_id),
            'name': name,
            'protocol': protocol,
            'tied_to_account': tied_to_account,
            'config': None if config is None else json.loads(config),
            'insert_time': calendar.timegm(insert_time.timetuple()),
            'last_login': None if last_login is None else calendar.timegm(last_login.timetuple()),
        }

    @staticmethod
    async def get_token(user_id, tied_to_account=None):
        """ Token is a bit special - we only return it upon special request, because endpoints need
            to make sure that requesting user has all the permissions necessary.
        """
        async with flask.current_app.pool.acquire() as c:
            if tied_to_account:
                res = await c.fetchrow('SELECT b.token ' +
                          'FROM bots AS b INNER JOIN users_accounts AS ua ON b.user_id = ua.user_id ' +
                          'WHERE ua.account = $1 AND b.user_id = $2;', tied_to_account, user_id)
            else:
                res = await c.fetchrow('SELECT b.token ' +
                          'FROM bots AS b LEFT JOIN users_accounts AS ua ON b.user_id = ua.user_id ' +
                          'WHERE ua.account IS NULL AND b.user_id = $1;', user_id)
            if not res:
                return None
            token, = res
        return token

    @staticmethod
    async def get_tied_to_account(user_id):
        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow('SELECT account FROM users_accounts WHERE user_id = $1;', int(user_id))
            if not res:
                return None
            account_id, = res
        return account_id

    @staticmethod
    async def authenticate_token(bot_token_unclean):
        try:
            bot_token = str(BotToken(bot_token_unclean))
        except:
            log.info("Invalid bot token format")
            return None
        # authenticate against DB:
        async with flask.current_app.pool.acquire() as c:
            # instead of just SELECTing the value, update last_login too: (if bot_token is correct of course)
            # await c.execute("SELECT user_id FROM bots WHERE token = $1;", bot_token)
            res = await c.fetchrow("UPDATE bots SET last_login = CURRENT_TIMESTAMP WHERE token = $1 RETURNING user_id;", bot_token)
            if not res:
                log.info("No such bot token")
                return None
            user_id, = res
            return user_id

    @staticmethod
    async def ensure_default_systemwide_bots_exist():
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
            bot_id, bot_token = await bot.insert()
            with open(BOT_TOKEN_FILENAME, 'wt') as f:
                f.write(str(bot_token))
            # assign permissions for this bot to work with any account, any method:
            permission = Permission(bot_id, 'accounts', None)
            await permission.insert(None, skip_checks=True)


class Person(object):
    def __init__(self, name, email, username, password, force_id=None):
        self.name = name
        self.email = EmailAddress(email, strict_check=False)
        self.username = username
        self.password = password
        self.force_id = force_id

    @classmethod
    def forge_from_input(cls, json_data, force_id=None):
        if force_id is None:
            jsonschema.validate(json_data, PersonSchemaInputsPOST)
        else:
            jsonschema.validate(json_data, PersonSchemaInputsPUT)

        name = json_data.get('name', None)
        email = json_data.get('email', None)
        username = json_data.get('username', None)
        password = json_data.get('password', None)
        return cls(name, email, username, password, force_id)

    @staticmethod
    async def get_list():
        async with flask.current_app.pool.acquire() as c:
            ret = []
            res = await c.fetch('SELECT user_id, name, email, username FROM persons ORDER BY username ASC;')
            for user_id, name, email, username in res:
                ret.append({
                    'user_id': user_id,
                    'name': name,
                    'email': email,
                    'username': username,
                })
            return ret

    async def insert(self):
        async with flask.current_app.pool.acquire() as c:
            user_id, = await c.fetchrow("INSERT INTO users (user_type) VALUES ('person') RETURNING id;")
            pass_hash = Auth.password_hash(self.password)
            await c.execute("INSERT INTO persons (user_id, name, email, username, passhash) VALUES ($1, $2, $3, $4, $5);", user_id, self.name, str(self.email), self.username, pass_hash)
            return user_id

    async def update(self):
        if self.force_id is None:
            raise ValidationError("Invalid user id")  # this should never happen
        async with flask.current_app.pool.acquire() as c:
            if self.name:
                res = await c.execute("UPDATE persons SET name = $1 WHERE user_id = $2;", self.name, self.force_id)
            if self.username:
                res = await c.execute("UPDATE persons SET username = $1 WHERE user_id = $2;", self.username, self.force_id)
            if self.email:
                res = await c.execute("UPDATE persons SET email = $1 WHERE user_id = $2;", str(self.email), self.force_id)
            # changing password is disabled here - it is only allowed through change_password(), which requests the old password too.
            # if self.password:
            #     pass_hash = Auth.password_hash(self.password)
            #     await c.execute("UPDATE persons SET passhash = $1 WHERE user_id = $2;", pass_hash, self.force_id)
            return rowcount(res)

    @staticmethod
    async def change_password(user_id, data):
        jsonschema.validate(data, PersonChangePasswordSchemaInputsPOST)

        old_password = data['old_password']
        new_password = data['new_password']

        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow("SELECT passhash FROM persons WHERE user_id = $1;", user_id)
            if not res:
                log.info("No such user")
                return 0
            old_passhash, = res
            if not Auth.is_password_valid(old_password, old_passhash):
                log.info("Old password does not match")
                return 0

            new_passhash = Auth.password_hash(new_password)
            res = await c.execute("UPDATE persons SET passhash = $1 WHERE user_id = $2;", new_passhash, user_id)
            return rowcount(res)

    @staticmethod
    async def delete(user_id):
        async with flask.current_app.pool.acquire() as c:
            res = await c.execute("DELETE FROM users WHERE id = $1 and user_type = 'person';", user_id)  # record from persons will be removed automatically (cascade)
            return rowcount(res)

    @staticmethod
    async def get(user_id):
        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow('SELECT user_id, name, email, username FROM persons WHERE user_id = $1;', user_id)
            if not res:
                return None
            user_id, name, email, username = res
        return {
            'user_id': user_id,
            'name': name,
            'email': email,
            'username': username,
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

    async def check_user_login(self):
        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow("SELECT user_id, passhash FROM persons WHERE username = $1;", self.username)
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
    async def validate_protocols(protocols, account_id):
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
        async with flask.current_app.pool.acquire() as c:
            for protocol in protocols:
                credential_id = protocols[protocol]['credential']
                res = await c.fetchrow('SELECT id FROM credentials WHERE id = $1 AND account = $2 AND protocol = $3;', credential_id, account_id, protocol)
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
                    res = await c.fetchrow('SELECT id FROM sensors WHERE id = $1 AND account = $2 AND protocol = $3;', sensor_info['sensor'], account_id, protocol)
                    if not res:
                        raise ValidationError("Invalid sensor for this account/protocol combination: {}".format(sensor_info['sensor']))

    @staticmethod
    async def get_list(account_id):
        async with flask.current_app.pool.acquire() as c, flask.current_app.pool.acquire() as c2, flask.current_app.pool.acquire() as c3:
            ret = []
            res = await c.fetch('SELECT id, name, entity_type, parent, details FROM entities WHERE account = $1 ORDER BY id ASC;', account_id)
            for entity_id, name, entity_type, parent, details in res:

                # get protocols and sensors too: (when we are accessing /entities/, we will follow up with separate entity details requests anyway)
                protocols = {}
                res2 = await c2.fetch('SELECT c.id, c.protocol FROM entities_credentials ec, credentials c WHERE ec.entity = $1 AND ec.credential = c.id AND c.account = $2;', entity_id, account_id)
                for credential_id, protocol in res2:
                    protocols[protocol] = {
                        'credential': credential_id,
                        'sensors': [],
                    }
                    bot_res = await c3.fetchrow('SELECT b.user_id FROM entities_bots eb, bots b WHERE eb.entity = $1 AND eb.bot = b.user_id AND b.protocol = $2;', entity_id, protocol)
                    protocols[protocol]['bot'] = bot_res[0] if bot_res else None

                res2 = await c2.fetch('SELECT s.id, s.protocol, es.interval FROM entities_sensors es, sensors s WHERE es.entity = $1 AND es.sensor = s.id AND s.account = $2;', entity_id, account_id)
                for sensor_id, protocol, interval in res2:
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

    async def insert(self):
        async with flask.current_app.pool.acquire() as c:
            entity_id, = await c.fetchrow("INSERT INTO entities (account, name, entity_type, parent, details) VALUES ($1, $2, $3, $4, $5) RETURNING id;", self.account_id, self.name, self.entity_type, self.parent, self.details)

            Entity.set_protocols(c, entity_id, self.protocols, clear_existing=False)
            return entity_id

    @staticmethod
    async def set_protocols(c, entity_id, protocols, clear_existing=True):
        # c: we would like to perform these changes inside the same DB transaction
        if clear_existing:
            await c.execute("DELETE FROM entities_credentials WHERE entity = $1;", entity_id)
            await c.execute("DELETE FROM entities_bots WHERE entity = $1;", entity_id)
            await c.execute("DELETE FROM entities_sensors WHERE entity = $1;", entity_id)

        for protocol in protocols:
            credential_id = protocols[protocol]['credential']
            await c.execute("INSERT INTO entities_credentials (entity, credential) VALUES ($1, $2);", entity_id, credential_id)
            bot_id = protocols[protocol].get('bot', None)
            if bot_id:
                await c.execute("INSERT INTO entities_bots (entity, bot) VALUES ($1, $2);", entity_id, bot_id)
            for sensor_info in protocols[protocol].get('sensors', []):
                await c.execute("INSERT INTO entities_sensors (entity, sensor, interval) VALUES ($1, $2, $3);", entity_id, sensor_info['sensor'], sensor_info['interval'])

    @staticmethod
    async def get(entity_id, account_id):
        async with flask.current_app.pool.acquire() as c, flask.current_app.pool.acquire() as c2:
            res = await c.fetchrow('SELECT name, entity_type, parent, details FROM entities WHERE id = $1 AND account = $2;', entity_id, account_id)
            if not res:
                return None
            name, entity_type, parent, details = res

            protocols = {}
            res = await c.fetch('SELECT c.id, c.protocol FROM entities_credentials ec, credentials c WHERE ec.entity = $1 AND ec.credential = c.id AND c.account = $2;', entity_id, account_id)
            for credential_id, protocol in res:
                protocols[protocol] = {
                    'credential': credential_id,
                    'sensors': [],
                }
                bot_res = c2.fetchrow('SELECT b.user_id FROM entities_bots eb, bots b WHERE eb.entity = $1 AND eb.bot = b.user_id AND b.protocol = $2;', entity_id, protocol)
                protocols[protocol]['bot'] = bot_res[0] if bot_res else None

            res = await c.fetch('SELECT s.id, s.protocol, es.interval FROM entities_sensors es, sensors s WHERE es.entity = $1 AND es.sensor = s.id AND s.account = $2;', entity_id, account_id)
            for sensor_id, protocol, interval in res:
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

    async def update(self):
        if self.force_id is None:
            return 0
        async with flask.current_app.pool.acquire() as c:
            res = await c.execute("UPDATE entities SET name = $1, entity_type = $2, details = $3 WHERE id = $4 AND account = $5;", self.name, self.entity_type, self.details, self.force_id, self.account_id)
            was_updated = rowcount(res)
            if was_updated:
                Entity.set_protocols(c, self.force_id, self.protocols, clear_existing=True)
            return was_updated

    @staticmethod
    async def delete(entity_id, account_id):
        async with flask.current_app.pool.acquire() as c:
            res = await c.execute("DELETE FROM entities WHERE id = $1 AND account = $2;", entity_id, account_id)
            return rowcount(res)


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
    async def get_list(account_id):
        async with flask.current_app.pool.acquire() as c:
            ret = []
            res = await c.fetch('SELECT id, name, protocol, details FROM credentials WHERE account = $1 ORDER BY id ASC;', account_id)
            for credential_id, name, protocol, details in res:
                ret.append({
                    'id': credential_id,
                    'name': name,
                    'protocol': protocol,
                    'details': details,
                })
            return ret

    async def insert(self):
        async with flask.current_app.pool.acquire() as c:
            credential_id, = await c.fetchrow("INSERT INTO credentials (account, name, protocol, details) VALUES ($1, $2, $3, $4) RETURNING id;", self.account_id, self.name, self.protocol, self.details)
            return credential_id

    @staticmethod
    async def get(credential_id, account_id):
        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow('SELECT name, protocol, details FROM credentials WHERE id = $1 AND account = $2;', credential_id, account_id)
            if not res:
                return None
            name, protocol, details = res
        return {
            'id': int(credential_id),
            'name': name,
            'protocol': protocol,
            'details': details,
        }

    async def update(self):
        if self.force_id is None:
            return 0
        async with flask.current_app.pool.acquire() as c:
            res = await c.execute("UPDATE credentials SET name = $1, protocol = $2, details = $3 WHERE id = $4 AND account = $5;", self.name, self.protocol, self.details, self.force_id, self.account_id)
            return rowcount(res)

    @staticmethod
    async def delete(credential_id, account_id):
        async with flask.current_app.pool.acquire() as c:
            res = await c.execute("DELETE FROM credentials WHERE id = $1 AND account = $2;", credential_id, account_id)
            return rowcount(res)


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
    async def get_list(account_id):
        async with flask.current_app.pool.acquire() as c:
            ret = []
            res = await c.fetch('SELECT id, name, protocol, default_interval, details FROM sensors WHERE account = $1 ORDER BY id ASC;', account_id)
            for record_id, name, protocol, default_interval, details in res:
                ret.append({
                    'id': record_id,
                    'name': name,
                    'protocol': protocol,
                    'default_interval': default_interval,
                    'details': details,
                })
            return ret

    async def insert(self):
        async with flask.current_app.pool.acquire() as c:
            record_id, = await c.fetchrow("INSERT INTO sensors (account, name, protocol, default_interval, details) VALUES ($1, $2, $3, $4, $5) RETURNING id;",
                self.account_id, self.name, self.protocol, self.default_interval, self.details)
            return record_id

    @staticmethod
    async def get(record_id, account_id):
        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow('SELECT name, protocol, default_interval, details FROM sensors WHERE id = $1 AND account = $2;', record_id, account_id)
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

    async def update(self):
        if self.force_id is None:
            return 0
        async with flask.current_app.pool.acquire() as c:
            res = await c.execute("UPDATE sensors SET name = $1, protocol = $2, default_interval = $3, details = $4 WHERE id = $5 AND account = $6;",
                self.name, self.protocol, self.default_interval, self.details, self.force_id, self.account_id)
            return rowcount(res)

    @staticmethod
    async def delete(credential_id, account_id):
        async with flask.current_app.pool.acquire() as c:
            res = await c.execute("DELETE FROM sensors WHERE id = $1 AND account = $2;", credential_id, account_id)
            return rowcount(res)

from collections import defaultdict
from functools import lru_cache
import math
import psycopg2.extras
import re
from slugify import slugify

from utils import db, log, ADMIN_ACCOUNT_ID
from validators import DashboardInputs, DashboardSchemaInputs, WidgetSchemaInputs, BotSchemaInputs, ValuesInputs


class ValidationError(Exception):
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

class Path(_RegexValidatedInputValue):
    _regex = re.compile(r'^([a-zA-Z0-9_-]+)([.][a-zA-Z0-9_-]+)*$')

    def __init__(self, v, ensure_in_db=False):
        super().__init__(v)
        if ensure_in_db:
            self.path_id = Path._get_path_id_from_db(path=self.v)

    @staticmethod
    @lru_cache(maxsize=256)
    def _get_path_id_from_db(path):
        with db.cursor() as c:
            path_cleaned = path.strip()
            c.execute('SELECT id FROM paths WHERE path=%s;', (path_cleaned,))
            res = c.fetchone()
            if not res:
                c.execute('INSERT INTO paths (path) VALUES (%s) RETURNING id;', (path_cleaned,))
                res = c.fetchone()
            path_id = res[0]
            return path_id

    @staticmethod
    def get_all_paths():
        with db.cursor() as c:
            c.execute('SELECT path FROM paths ORDER BY path;')
            for path, in c:
                yield(path)

    @classmethod
    def delete(cls, path):
        with db.cursor() as c:
            # delete just the path, "ON DELETE CASCADE" takes care of removing values and aggregations:
            c.execute('DELETE FROM paths WHERE path = %s;', (str(path),))
            return c.rowcount


class PathFilter(_RegexValidatedInputValue):
    _regex = re.compile(r'^([a-zA-Z0-9_-]+|[*?])([.]([a-zA-Z0-9_-]+|[*?]))*$')

    @staticmethod
    def find_matching_paths(path_filters, limit=200, allow_trailing_chars=False):
        all_found_paths = set()
        was_limit_reached = False
        for pf in path_filters:
            found_paths, was_limit_reached = PathFilter._find_matching_paths_for_filter(pf, limit, allow_trailing_chars)  # we could ask for `limit - len(found)` - but then lru_cache wouldn't make sense
            all_found_paths |= found_paths
            if was_limit_reached or len(all_found_paths) > limit:
                # always return only up to a limit elements:
                return list(all_found_paths)[:limit], True

        return list(all_found_paths), False

    @staticmethod
    @lru_cache(maxsize=1024)
    def _find_matching_paths_for_filter(path_filter, total_limit, allow_trailing_chars=False):
        found_paths = set()
        pf_regex = PathFilter._regex_from_filter(path_filter, allow_trailing_chars)
        with db.cursor() as c:
            c.execute('SELECT path FROM paths WHERE path ~ %s ORDER BY path LIMIT %s;', (pf_regex, total_limit + 1,))
            for res in c:
                if len(found_paths) >= total_limit:  # we have found one element over the limit - we don't add it, but we know it exists
                    return found_paths, True
                found_paths.add(res[0])
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


class MeasuredValue(_RegexValidatedInputValue):
    _regex = re.compile(r'^[0-9]+([.][0-9]+)?$')


class Aggregation(object):
    FACTOR = 3
    MAX_AGGR_LEVEL = 6  # 6 == one point per month

    def __init__(self, level=0):
        self.level = level
        self._interval_size = 3600 * (self.FACTOR ** self.level)
        self._dirty_intervals = defaultdict(set)
        if Aggregation.MAX_AGGR_LEVEL > level:
            self._parent_aggr = Aggregation(level + 1)
        else:
            self._parent_aggr = None

    def mark_timestamp_as_dirty(self, path_id, ts):
        self._dirty_intervals[path_id].add(math.floor(float(ts)) // self._interval_size)

    def fix_aggregations(self):
        try:
            with db.cursor() as c:
                for p_id in self._dirty_intervals:
                    for h in self._dirty_intervals[p_id]:
                        tsh = h * self._interval_size
                        tsh_med = tsh + self._interval_size / 2
                        if self.level == 0:
                            c.execute("""
                                INSERT INTO
                                    aggregations (path, level, tsmed, vmin, vmax, vavg)
                                    SELECT %s, %s, %s, MIN(value), MAX(value), AVG(value) FROM measurements WHERE path = %s AND ts >= %s AND ts < %s
                                ON CONFLICT (path, level, tsmed) DO UPDATE SET
                                    vmin=excluded.vmin, vmax=excluded.vmax, vavg=excluded.vavg""",
                                (p_id, self.level, tsh + 1800, p_id, tsh, tsh + 3600,))
                        else:
                            c.execute("""
                                INSERT INTO
                                    aggregations (path, level, tsmed, vmin, vmax, vavg)
                                    SELECT %s, %s, %s, MIN(vmin), MAX(vmax), AVG(vavg) FROM aggregations WHERE path = %s AND level = %s AND tsmed >= %s AND tsmed < %s
                                ON CONFLICT (path, level, tsmed) DO UPDATE SET
                                    vmin=excluded.vmin, vmax=excluded.vmax, vavg=excluded.vavg""",
                                (p_id, self.level, tsh_med, p_id, self.level - 1, tsh, tsh + self._interval_size,))
                        if self._parent_aggr:
                            self._parent_aggr.mark_timestamp_as_dirty(p_id, tsh_med)
        finally:
            if self._parent_aggr:
                self._parent_aggr.fix_aggregations()

    @classmethod
    def times_aligned_to_aggr(cls, times, aggr_level):
        if not aggr_level:
            return True
        interval_size = 3600 * (cls.FACTOR ** aggr_level)
        for t in times:
            if int(t) % interval_size != 0:
                return False
        return True


class Measurement(object):

    MAX_DATAPOINTS_RETURNED = 100000

    def __init__(self, path, ts, value):
        self.path = Path(path)
        self.ts = Timestamp(ts)
        self.value = MeasuredValue(value)

    @classmethod
    def save_values_data_to_db(cls, put_data, update_on_conflict=True):

        aggr = Aggregation()
        try:
            # to use execute_values, we need an iterator which will feed our data:
            def _get_data(put_data, aggr):
                for x in put_data:
                    ts_str = str(Timestamp(x['t']))
                    path = Path(x['p'], ensure_in_db=True)
                    # while we are traversing our data, we might as well mark the dirty aggregation blocks:
                    aggr.mark_timestamp_as_dirty(path.path_id, ts_str)
                    yield (path.path_id, ts_str, str(MeasuredValue(x['v'])),)
            data_iterator = _get_data(put_data, aggr)

            with db.cursor() as c:
                # https://stackoverflow.com/a/34529505/593487
                if update_on_conflict:
                    psycopg2.extras.execute_values(c, "INSERT INTO measurements (path, ts, value) VALUES %s ON CONFLICT (path, ts) DO UPDATE SET value=excluded.value", data_iterator, "(%s, %s, %s)", page_size=100)
                else:
                    psycopg2.extras.execute_values(c, "INSERT INTO measurements (path, ts, value) VALUES %s", data_iterator, "(%s, %s, %s)", page_size=100)
        finally:
            aggr.fix_aggregations()

    @classmethod
    def get_suggested_aggr_level(cls, t_from, t_to, max_points=100):
        aggr_level = cls._get_aggr_level(max_points, math.ceil((float(t_to) - float(t_from))/3600.0))
        if aggr_level < 0:
            return None
        else:
            return aggr_level

    @classmethod
    def _get_aggr_level(cls, max_points, n_hours):
        for l in range(-1, Aggregation.MAX_AGGR_LEVEL):
            if max_points >= n_hours / (3**l):
                return l
        return Aggregation.MAX_AGGR_LEVEL

    @classmethod
    def fetch_data(cls, paths, aggr_level, t_froms, t_to, should_sort_asc, max_records):
        # t_froms: an array of t_from, one for each path (because the subsequent fetchings usually request a different t_from for each path)
        paths_data = {}
        sort_order = 'ASC' if should_sort_asc else 'DESC'  # PgSQL doesn't allow sort order to be parametrized
        with db.cursor() as c:
            for p, t_from in zip(paths, t_froms):
                str_p = str(p)
                path_data = []
                path_id = Path._get_path_id_from_db(str_p)

                # trick: fetch one result more than is allowed (by MAX_DATAPOINTS_RETURNED) so that we know that the result set is not complete and where the client should continue from
                if aggr_level is None:  # fetch raw data
                    c.execute('SELECT ts, value FROM measurements WHERE path = %s AND ts >= %s AND ts < %s ORDER BY ts ' + sort_order + ' LIMIT %s;', (path_id, float(t_from), float(t_to), max_records + 1,))
                    for ts, value in c:
                        path_data.append({'t': float(ts), 'v': float(value)})
                else:  # fetch aggregated data
                    c.execute('SELECT tsmed, vavg, vmin, vmax FROM aggregations WHERE path = %s AND level = %s AND tsmed >= %s AND tsmed < %s ORDER BY tsmed ' + sort_order + ' LIMIT %s;', (path_id, aggr_level, float(t_from), float(t_to), max_records + 1,))
                    for ts, vavg, vmin, vmax in c:
                        path_data.append({'t': float(ts), 'v': float(vavg), 'minv': float(vmin), 'maxv': float(vmax)})

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
    def get_oldest_measurement_time(cls, paths):
        path_ids = tuple(Path._get_path_id_from_db(str(p)) for p in paths)
        with db.cursor() as c:
            c.execute('SELECT MIN(ts) FROM measurements WHERE path IN %s;', (path_ids,))
            res = c.fetchone()
            if not res:
                return None
            return res[0]

    def save(self):
        with db.cursor() as c:
            c.execute('INSERT INTO measurements (path, ts, value) VALUES (%s, %s, %s);', (str(self.path), str(self.ts), str(self.value)))


class Widget(object):

    def __init__(self, dashboard_id, widget_type, title, content, widget_id):
        self.dashboard_id = dashboard_id
        self.widget_type = widget_type
        self.title = title
        self.content = content
        self.widget_id = widget_id

    @classmethod
    def forge_from_input(cls, flask_request, dashboard_slug, widget_id=None):
        inputs = WidgetSchemaInputs(flask_request)
        if not inputs.validate():
            raise ValidationError(inputs.errors[0])

        data = flask_request.get_json()

        widget_type = data['type']
        title = data['title']
        content = data['content']
        # users reference the dashboards by its slug, but we need to know its ID:
        dashboard_id = Dashboard.get_id(dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        if widget_id is not None and not Widget._check_exists(widget_id):
            raise ValidationError("Unknown widget id")

        return cls(dashboard_id, widget_type, title, content, widget_id)

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
            c.execute("INSERT INTO widgets (dashboard, type, title, content) VALUES (%s, %s, %s, %s) RETURNING id;", (self.dashboard_id, self.widget_type, self.title, self.content,))
            widget_id = c.fetchone()[0]
            return widget_id

    def update(self):
        with db.cursor() as c:
            c.execute("UPDATE widgets SET type = %s, title = %s, content = %s  WHERE id = %s and dashboard = %s;", (self.widget_type, self.title, self.content, self.widget_id, self.dashboard_id,))
            rowcount = c.rowcount
            if not rowcount:
                return 0
            return rowcount

    @staticmethod
    def delete(dashboard_slug, widget_id):
        dashboard_id = Dashboard.get_id(dashboard_slug)
        with db.cursor() as c:
            c.execute("DELETE FROM widgets WHERE id = %s and dashboard = %s;", (widget_id, dashboard_id,))
            return c.rowcount

    @staticmethod
    def get_list(dashboard_slug, paths_limit=200):
        dashboard_id = Dashboard.get_id(dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        with db.cursor() as c, db.cursor() as c2:
            c.execute('SELECT id, type, title, content FROM widgets WHERE dashboard = %s ORDER BY id;', (dashboard_id,))
            ret = []
            for widget_id, widget_type, title, content in c:
                # c2.execute('SELECT path_filter, renaming, unit, metric_prefix FROM charts_content WHERE chart = %s ORDER BY id;', (widget_id,))
                # content = []
                # for path_filter, renaming, unit, metric_prefix in c2:
                #     paths, paths_limit_reached = PathFilter.find_matching_paths([path_filter], limit=paths_limit)
                #     content.append({
                #         'path_filter': path_filter,
                #         'renaming': renaming,
                #         'unit': unit,
                #         'metric_prefix': metric_prefix,
                #         'paths': paths,
                #         'paths_limit_reached': paths_limit_reached,
                #     })
                ret.append({
                    'id': widget_id,
                    'type': widget_type,
                    'title': title,
                    'content': content,
                })
            return ret

    @staticmethod
    def get(dashboard_slug, widget_id, paths_limit=200):
        dashboard_id = Dashboard.get_id(dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        with db.cursor() as c, db.cursor() as c2:
            c.execute('SELECT type, title, content FROM widgets WHERE id = %s and dashboard = %s;', (widget_id, dashboard_id,))
            res = c.fetchone()
            if not res:
                return None

            # c2.execute('SELECT path_filter, renaming, unit, metric_prefix FROM charts_content WHERE chart = %s ORDER BY id;', (widget_id,))
            # content = []
            # for path_filter, renaming, unit, metric_prefix in c2:
            #     paths, paths_limit_reached = PathFilter.find_matching_paths([path_filter], limit=paths_limit)
            #     content.append({
            #         'path_filter': path_filter,
            #         'renaming': renaming,
            #         'unit': unit,
            #         'metric_prefix': metric_prefix,
            #         'paths': paths,
            #         'paths_limit_reached': paths_limit_reached,
            #     })
            return {
                'id': widget_id,
                'type': res[0],
                'title': res[1],
                'content': res[2],
            }


class Dashboard(object):

    def __init__(self, name, slug):
        self.name = name
        self.slug = slug

    @classmethod
    def forge_from_input(cls, flask_request, force_slug=None):
        """ This function validates input and returns an object which can be used for inserting or updating. """
        for inputs in [DashboardSchemaInputs(flask_request), DashboardInputs(flask_request)]:
            if not inputs.validate():
                raise ValidationError(inputs.errors[0])

        data = flask_request.get_json()
        name = data['name']
        slug = data.get('slug')
        if force_slug:  # when updating existing record, we want to supply slug through query parameters, not through JSON
            if slug:
                raise ValidationError("Field 'slug' shouldn't be specified in JSON body")
            slug = force_slug
        else:
            if not slug:
                slug = cls._suggest_new_slug(name)
        return cls(name, slug)

    @classmethod
    def _suggest_new_slug(cls, name):
        # Find a suitable slug from name, appending numbers for as long as it takes to find a non-existing slug.
        # This is probably not 100% race-condition safe, but it doesn't matter - unique contraint is on DB level,
        # and this is just a nicety from us.
        postfix_nr = 1
        while True:
            slug = slugify(name) + ('' if postfix_nr == 1 else '-{}'.format(postfix_nr))
            if Dashboard.get_id(slug) is None:
                return slug  # we have found a slug which doesn't exist yet, use it
            postfix_nr += 1

    def insert(self):
        with db.cursor() as c:
            c.execute("INSERT INTO dashboards (name, slug) VALUES (%s, %s);", (self.name, self.slug,))
            # we must invalidate get_id()'s lru_cache, otherwise it will keep returning None instead of new ID:
            Dashboard.get_id.cache_clear()

    def update(self):
        with db.cursor() as c:
            c.execute("UPDATE dashboards SET name = %s WHERE slug = %s;", (self.name, self.slug,))
            return c.rowcount

    @staticmethod
    def delete(slug):
        with db.cursor() as c:
            c.execute("DELETE FROM dashboards WHERE slug = %s;", (slug,))
            # we must invalidate get_id()'s lru_cache, otherwise it will keep returning the old ID instead of None:
            Dashboard.get_id.cache_clear()
            return c.rowcount

    @staticmethod
    def get_list():
        with db.cursor() as c:
            ret = []
            c.execute('SELECT name, slug FROM dashboards ORDER BY name;')
            for name, slug in c:
                ret.append({'name': name, 'slug': slug})
            return ret

    @staticmethod
    def get(slug):
        with db.cursor() as c:
            c.execute('SELECT name FROM dashboards WHERE slug = %s;', (slug,))
            res = c.fetchone()
            if not res:
                return None
            name = res[0]

        widgets = Widget.get_list(slug)
        return {
            'name': name,
            'slug': slug,
            'widgets': widgets,
        }

    @staticmethod
    @lru_cache(maxsize=256)
    def get_id(slug):
        """ This is a *cached* function which returns ID based on dashboard slug. Make sure
            to invalidate lru_cache whenever one of the existing slug <-> ID relationships
            changes in any way (delete, insert). """
        with db.cursor() as c:
            c.execute('SELECT id FROM dashboards WHERE slug = %s;', (slug,))
            res = c.fetchone()
            if not res:
                return None
            return res[0]


class Bot(object):

    def __init__(self, account_id, name):
        self.account_id = account_id
        self.name = name

    @classmethod
    def forge_from_input(cls, flask_request):
        inputs = BotSchemaInputs(flask_request)
        if not inputs.validate():
            raise ValidationError(inputs.errors[0])
        data = flask_request.get_json()

        name = data['name']
        account_id = ADMIN_ACCOUNT_ID
        return cls(account_id, name)

    def insert(self):
        log.info("db is: {}".format(db))
        with db.cursor() as c:
            c.execute("INSERT INTO bots (account, name) VALUES (%s, %s) RETURNING id, token;", (self.account_id, self.name,))
            bot_id, bot_token = c.fetchone()
            return bot_id, bot_token

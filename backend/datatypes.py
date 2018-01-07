from collections import defaultdict
from functools import lru_cache
import math
import psycopg2.extras
import re
from slugify import slugify

from utils import db, log
from validators import DashboardInputs, DashboardSchemaInputs, ChartSchemaInputs, ValuesInputs


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
    _regex = re.compile(r'^([a-z0-9_-]+)([.][a-z0-9_-]+)*$')

    def __init__(self, v, ensure_in_db=False):
        super().__init__(v)
        if ensure_in_db:
            self.path_id = Path._get_path_id_from_db(path=self.v)

    @staticmethod
    @lru_cache(maxsize=256)
    def _get_path_id_from_db(path):
        with db.cursor() as c:
            path_cleaned = path.strip().lower()
            c.execute('SELECT id FROM paths WHERE path=%s;', (path_cleaned,))
            res = c.fetchone()
            if not res:
                c.execute('INSERT INTO paths (path) VALUES (%s) RETURNING id;', (path_cleaned,))
                res = c.fetchone()
            path_id = res[0]
            return path_id


class PathFilter(_RegexValidatedInputValue):
    _regex = re.compile(r'^(([a-z0-9_-]+)|([*?]))([.](([a-z0-9_-]+)|([*?])))*$')

    @staticmethod
    def find_matching_paths(path_filters, limit=200):
        all_found_paths = set()
        was_limit_reached = False
        for pf in path_filters:
            found_paths, was_limit_reached = PathFilter._find_matching_paths_for_filter(pf, limit)  # we could ask for `limit - len(found)` - but then lru_cache wouldn't make sense
            all_found_paths |= found_paths
            if was_limit_reached or len(all_found_paths) > limit:
                # always return only up to a limit elements:
                return list(all_found_paths)[:limit], True

        return list(all_found_paths), False

    @staticmethod
    @lru_cache(maxsize=1024)
    def _find_matching_paths_for_filter(path_filter, total_limit):
        # if path filter is just a path (no wildcards in it), we just return it:
        if '*' not in path_filter and '?' not in path_filter:
            return set((path_filter,)), False

        found_paths = set()
        pf_regex = PathFilter._regex_from_filter(path_filter)
        with db.cursor() as c:
            c.execute('SELECT path FROM paths WHERE path ~ %s LIMIT %s;', (pf_regex, total_limit + 1,))
            for path in c:
                if len(found_paths) >= total_limit:  # we have found one element over the limit - we don't add it, but we know it exists
                    return found_paths, True
                found_paths.add(path)
        return found_paths, False

    @staticmethod
    def _regex_from_filter(path_filter_str):
        """ Prepares regex for asking Postgres from supplied path filter string. """
        # - replace all "." with "[.]"
        # - replace all "*" with ".*"
        # - replace all "?" with "[^.]+"
        # - add ^ and $
        path_filter_str = path_filter_str.replace(".", "[.]")
        path_filter_str = path_filter_str.replace("*", ".+")
        path_filter_str = path_filter_str.replace("?", "[^.]+")
        path_filter_str = "^{}$".format(path_filter_str)
        return path_filter_str


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


class Measurement(object):

    MAX_DATAPOINTS_RETURNED = 500

    def __init__(self, path, ts, value):
        self.path = Path(path)
        self.ts = Timestamp(ts)
        self.value = MeasuredValue(value)

    # @classmethod
    # def save_posted_data_to_db(cls, posted_data):
    #     with db.cursor() as c:
    #         f = IteratorFile(("{}\t{}\t{}".format(str(Path(x['p'])), str(Timestamp(x['t'])), str(MeasuredValue(x['v']))) for x in posted_data))
    #         c.copy_from(f, 'measurements', columns=('path', 'ts', 'value'))

    @classmethod
    def save_put_data_to_db(cls, put_data):

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
                psycopg2.extras.execute_values(c, "INSERT INTO measurements (path, ts, value) VALUES %s ON CONFLICT (path, ts) DO UPDATE SET value=excluded.value", data_iterator, "(%s, %s, %s)", page_size=100)
        finally:
            aggr.fix_aggregations()

    @classmethod
    def get_suggested_aggr_level(cls, paths, t_from, t_to, max_points=100):
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
    def fetch_data(cls, paths, aggr_level, t_from, t_to):
        paths_data = {}
        with db.cursor() as c:
            for p in paths:
                str_p = str(p)
                path_data = []
                path_id = Path._get_path_id_from_db(str_p)

                # trick: fetch one result more than is allowed (by MAX_DATAPOINTS_RETURNED) so that we know that the result set is not complete and where the client should continue from
                if aggr_level is None:  # fetch raw data
                    c.execute('SELECT ts, value FROM measurements WHERE path = %s AND ts >= %s AND ts <= %s LIMIT %s;', (path_id, float(t_from), float(t_to), Measurement.MAX_DATAPOINTS_RETURNED + 1,))
                    for ts, value in c:
                        path_data.append({'t': float(ts), 'v': float(value)})
                else:  # fetch aggregated data
                    c.execute('SELECT tsmed, vavg, vmin, vmax FROM aggregations WHERE path = %s AND level = %s AND tsmed >= %s AND tsmed <= %s LIMIT %s;', (path_id, aggr_level, float(t_from), float(t_to), Measurement.MAX_DATAPOINTS_RETURNED + 1,))
                    for ts, vavg, vmin, vmax in c:
                        path_data.append({'t': float(ts), 'v': [float(vavg), float(vmin), float(vmax)]})

                # if we have one result too many, eliminate it and set "next_data_point" field:
                if len(path_data) > Measurement.MAX_DATAPOINTS_RETURNED:
                    paths_data[str_p] = {
                        'next_data_point': path_data[Measurement.MAX_DATAPOINTS_RETURNED]['t'],
                        'data': path_data[:Measurement.MAX_DATAPOINTS_RETURNED],
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


class Chart(object):

    def __init__(self, dashboard_id, name, path_filters, chart_id):
        self.dashboard_id = dashboard_id
        self.name = name
        self.path_filters = path_filters
        self.chart_id = chart_id

    @classmethod
    def forge_from_input(cls, flask_request, dashboard_slug, chart_id=None):
        # It turns out that validating lists is not trivial with flask-inputs and WTForms. Also, this
        # validation is getting to be a nuisance, so we need to replace it in future. But for now let's
        # check only schema and we'll validate data types below:
        inputs = ChartSchemaInputs(flask_request)
        if not inputs.validate():
            raise ValidationError(inputs.errors[0])

        data = flask_request.get_json()

        # jsonschema already makes sure that there is exactly one key in each content dict, and
        # that this key is "path_filter", so we must just check it for validity by creating
        # PathFilter() instances:
        path_filters = [PathFilter(x['path_filter']) for x in data.get('content', [])]

        name = data['name']
        # users reference the dashboards by its slug, but we need to know its ID:
        dashboard_id = Dashboard.get_id(dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        if chart_id is not None and not Chart._check_exists(chart_id):
            raise ValidationError("Unknown chart id")

        return cls(dashboard_id, name, path_filters, chart_id)

    @staticmethod
    def _check_exists(chart_id):
        with db.cursor() as c:
            c.execute('SELECT id FROM charts WHERE id = %s;', (chart_id,))
            res = c.fetchone()
            if res:
                return True
            return False

    def insert(self):
        with db.cursor() as c:
            path_filters_text = ",".join(map(str, self.path_filters))
            c.execute("INSERT INTO charts (dashboard, name, path_filters) VALUES (%s, %s, %s);", (self.dashboard_id, self.name, path_filters_text,))

    def update(self):
        with db.cursor() as c:
            path_filters_text = ",".join(map(str, self.path_filters))
            c.execute("UPDATE charts SET name = %s, path_filters = %s WHERE id = %s and dashboard = %s;", (self.name, path_filters_text, self.chart_id, self.dashboard_id,))
            return c.rowcount

    @staticmethod
    def delete(dashboard_slug, chart_id):
        dashboard_id = Dashboard.get_id(dashboard_slug)
        with db.cursor() as c:
            c.execute("DELETE FROM charts WHERE id = %s and dashboard = %s;", (chart_id, dashboard_id,))
            return c.rowcount

    @staticmethod
    def get_list(dashboard_slug, paths_limit=200):
        dashboard_id = Dashboard.get_id(dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        with db.cursor() as c:
            c.execute('SELECT id, name, path_filters FROM charts WHERE dashboard = %s ORDER BY id;', (dashboard_id,))
            ret = []
            for chart_id, name, path_filters in c:
                path_filters = path_filters.split(",") if path_filters else []  # if empty string, return empty list
                paths, paths_limit_reached = PathFilter.find_matching_paths(path_filters, limit=paths_limit)
                ret.append({
                    'id': chart_id,
                    'name': name,
                    'path_filters': path_filters,
                    'paths': paths,
                    'paths_limit_reached': paths_limit_reached,
                })
            return ret

    @staticmethod
    def get(dashboard_slug, chart_id, paths_limit=200):
        dashboard_id = Dashboard.get_id(dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        with db.cursor() as c:
            c.execute('SELECT name, path_filters FROM charts WHERE id = %s and dashboard = %s;', (chart_id, dashboard_id,))
            res = c.fetchone()
            if not res:
                return None
            path_filters = res[1].split(",") if res[1] else []
            paths, paths_limit_reached = PathFilter.find_matching_paths(path_filters, limit=paths_limit)
            return {
                'id': chart_id,
                'name': res[0],
                'path_filters': path_filters,  # if empty string, return empty list
                'paths': paths,
                'paths_limit_reached': paths_limit_reached,
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

        charts = Chart.get_list(slug)
        return {
            'name': name,
            'slug': slug,
            'charts': charts,
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

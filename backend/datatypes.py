from collections import defaultdict
from functools import lru_cache
import json
import math
import psycopg2.extras
import re
import time

from utils import db, log


class _RegexValidatedInputValue(object):
    """ Helper parent class; allows easy creation of classes which validate their input with a regular expression. """
    _regex = None

    def __init__(self, v):
        if not self.is_valid(str(v)):
            raise Exception("Invalid {} format: {}".format(self.__class__.__name__, v))
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
    def get_data(cls, paths, max_points, t_from=None, t_to=None):
        """
        {
            aggregation_level: <AggregationLevel>,  // -1: raw data, >=0: 3^L hours are aggregated in a single data point
            pagination_timestamp: <LastTimestamp>,  // if not null, use LastTimestamp as TimestampFrom to fetch another batch of data
            data: {
                <Path0>: [
                    { t: <Timestamp>, v: [<Value>, <MinValue>, <MaxValue>] }  // if data was aggregated
                    { t: <Timestamp>, v: <Value> }  // if raw data was returned
                ],
                ...
            }
        }
        """
        if t_from is None:
            t_from = cls._get_oldest_measurement_time(paths)
        if t_to is None:
            t_to = Timestamp(time.time())
        aggr_level = cls._get_aggr_level(max_points, math.ceil((float(t_to) - float(t_from))/3600.0))
        if aggr_level < 0:
            data = cls._fetch_raw_data(paths, t_from, t_to)
        else:
            data = cls._fetch_aggr_data(paths, aggr_level, t_from, t_to)
        return json.dumps({
            'aggregation_level': aggr_level,
            'data': data,
        })

    @classmethod
    def _get_aggr_level(cls, max_points, n_hours):
        for l in range(-1, Aggregation.MAX_AGGR_LEVEL):
            if max_points >= n_hours / (3**l):
                return l
        return Aggregation.MAX_AGGR_LEVEL

    @classmethod
    def _fetch_raw_data(cls, paths, t_from, t_to):
        data = {}
        with db.cursor() as c:
            for p in paths:
                data[str(p)] = []
                path_id = Path._get_path_id_from_db(str(p))
                c.execute('SELECT ts, value FROM measurements WHERE path = %s AND ts >= %s AND ts <= %s;', (path_id, float(t_from), float(t_to),))
                for ts, value in c:
                    data[str(p)].append({'t': float(ts), 'v': float(value)})
        return data

    @classmethod
    def _fetch_aggr_data(cls, paths, aggr_level, t_from, t_to):
        data = {}
        with db.cursor() as c:
            for p in paths:
                data[str(p)] = []
                path_id = Path._get_path_id_from_db(str(p))
                c.execute('SELECT tsmed, vavg, vmin, vmax FROM aggregations WHERE path = %s AND level = %s AND tsmed >= %s AND tsmed <= %s;', (path_id, aggr_level, float(t_from), float(t_to),))
                for ts, vavg, vmin, vmax in c:
                    data[str(p)].append({'t': float(ts), 'v': [float(vavg), float(vmin), float(vmax)]})
        return data

    @classmethod
    def _get_oldest_measurement_time(cls, paths):
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

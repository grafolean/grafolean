import re
from utils import db, log
from iter_file import IteratorFile
import psycopg2.extras


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


class Timestamp(_RegexValidatedInputValue):
    _regex = re.compile(r'^[1-9][0-9]{1,9}([.][0-9]{1,6})?$')


class MeasuredValue(_RegexValidatedInputValue):
    _regex = re.compile(r'^[0-9]+([.][0-9]+)?$')


class Aggregation(object):
    FACTOR = 3

    def __init__(self, level, up_to_level=None):
        self.level = level
        self._interval_size = 3600 * (self.FACTOR ** self.level)
        self._dirty_intervals = set()
        if up_to_level and up_to_level > level:
            self._parent_aggr = Aggregation(level + 1, up_to_level)
        else:
            self._parent_aggr = None

    def mark_timestamp_as_dirty(self, ts):
        self._dirty_intervals.add(int(ts) // self._interval_size)

    def fix_aggregations(self):
        try:
            with db.cursor() as c:
                for h in self._dirty_intervals:
                    tsh = h * self._interval_size
                    tsh_med = tsh + self._interval_size / 2
                    if self.level == 0:
                        c.execute("""
                            INSERT INTO
                                aggregations (level, tsmed, vmin, vmax, vavg)
                                SELECT %s, %s, MIN(value), MAX(value), AVG(value) FROM measurements WHERE ts >= %s and ts < %s
                            ON CONFLICT (level, tsmed) DO UPDATE SET
                                vmin=excluded.vmin, vmax=excluded.vmax, vavg=excluded.vavg""",
                            (self.level, tsh + 1800, tsh, tsh + 3600,))
                    else:
                        c.execute("""
                            INSERT INTO
                                aggregations (level, tsmed, vmin, vmax, vavg)
                                SELECT %s, %s, MIN(vmin), MAX(vmax), AVG(vavg) FROM aggregations WHERE level = %s and tsmed >= %s and tsmed < %s
                            ON CONFLICT (level, tsmed) DO UPDATE SET
                                vmin=excluded.vmin, vmax=excluded.vmax, vavg=excluded.vavg""",
                            (self.level, tsh_med, self.level - 1, tsh, tsh + self._interval_size,))
                    if self._parent_aggr:
                        self._parent_aggr.mark_timestamp_as_dirty(tsh_med)
        finally:
            if self._parent_aggr:
                self._parent_aggr.fix_aggregations()


class Measurement(object):
    def __init__(self, path, ts, value):
        self.path = Path(path)
        self.ts = Timestamp(ts)
        self.value = MeasuredValue(value)

    @classmethod
    def save_posted_data_to_db(cls, posted_data):
        with db.cursor() as c:
            f = IteratorFile(("{}\t{}\t{}".format(str(Path(x['p'])), str(Timestamp(x['t'])), str(MeasuredValue(x['v']))) for x in posted_data))
            c.copy_from(f, 'measurements', columns=('path', 'ts', 'value'))

    @classmethod
    def save_put_data_to_db(cls, put_data):

        aggr = Aggregation(0, up_to_level=6)
        try:
            # to use execute_values, we need an iterator which will feed our data:
            def _get_data(put_data, aggr):
                for x in put_data:
                    ts_str = str(Timestamp(x['t']))
                    # while we are traversing our data, we might as well mark the dirty aggregation blocks:
                    aggr.mark_timestamp_as_dirty(ts_str)
                    yield (str(Path(x['p'])), ts_str, str(MeasuredValue(x['v'])),)
            data_iterator = _get_data(put_data, aggr)

            with db.cursor() as c:
                # https://stackoverflow.com/a/34529505/593487
                psycopg2.extras.execute_values(c, "INSERT INTO measurements (path, ts, value) VALUES %s ON CONFLICT (path, ts) DO UPDATE SET value=excluded.value", data_iterator, "(%s, %s, %s)", page_size=100)
        finally:
            aggr.fix_aggregations()

    def save(self):
        with db.cursor() as c:
            c.execute('INSERT INTO measurements (path, ts, value) VALUES (%s, %s, %s);', (str(self.path), str(self.ts), str(self.value)))

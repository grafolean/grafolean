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
        def _get_data(put_data):
            for x in put_data:
                yield (str(Path(x['p'])), str(Timestamp(x['t'])), str(MeasuredValue(x['v'])),)
        data_iterator = _get_data(put_data)

        with db.cursor() as c:
            # https://stackoverflow.com/a/34529505/593487
            psycopg2.extras.execute_values(c, "INSERT INTO MEASUREMENTS (path, ts, value) VALUES %s ON CONFLICT (path, ts) DO UPDATE SET value=excluded.value", data_iterator, "(%s, %s, %s)", page_size=100)

    def save(self):
        with db.cursor() as c:
            c.execute('INSERT INTO measurements (path, ts, value) VALUES (%s, %s, %s);', (str(self.path), str(self.ts), str(self.value)))

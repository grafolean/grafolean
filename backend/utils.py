from colors import color
import logging
import psycopg2
import psycopg2.extras
import sys

logging.basicConfig(format='%(asctime)s | %(levelname)s | %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S', level=logging.DEBUG)
logging.addLevelName(logging.DEBUG, color("DBG", 7))
logging.addLevelName(logging.INFO, "INF")
logging.addLevelName(logging.WARNING, color('WRN', fg='red'))
logging.addLevelName(logging.ERROR, color('ERR', bg='red'))
log = logging.getLogger("{}.{}".format(__name__, "base"))


host, dbname, user, password = ('localhost', 'moonthor', 'admin', 'admin')
db = psycopg2.connect("dbname='{}' user='{}' host='{}' password='{}'".format(dbname, user, host, password))
db.autocommit = True

###########################
#   DB schema migration   #
###########################

def migrate_if_needed():
    with db.cursor() as c:
        try:
            c.execute('SELECT schema_version FROM runtime_data;')
            res = c.fetchone()
            existing_schema_version = res[0]
        except psycopg2.ProgrammingError:
            db.rollback()
            existing_schema_version = 0

    try_migrating_to = existing_schema_version + 1
    while True:
        method_name = 'migration_step_{}'.format(try_migrating_to)
        if not hasattr(sys.modules[__name__], method_name):
            break
        log.info("Migrating DB schema to {}".format(try_migrating_to))
        method_to_call = getattr(sys.modules[__name__], method_name)
        method_to_call()
        # automatically upgrade schema version if there is no exception:
        with db.cursor() as c:
            c.execute('UPDATE runtime_data SET schema_version = %s;', (try_migrating_to,))
        try_migrating_to += 1


def migration_step_1():
    with db.cursor() as c:
        c.execute('CREATE TABLE runtime_data (schema_version SMALLSERIAL NOT NULL);')
        c.execute('INSERT INTO runtime_data (schema_version) VALUES (1);')

        # TEXT: variable unlimited length (VARCHAR seems to be the same - no limit)
        # NUMERIC(precision, scale): The precision is the total number of digits, while scale is the number of digits in the fraction part
        # NUMERIC: numeric values of any precision and scale can be stored, up to the implementation limit on precision. A column of this kind will not coerce input values to any particular scale.
        c.execute('CREATE TABLE measurements (path TEXT, ts NUMERIC(13, 3), value NUMERIC);')

def migration_step_2():
    with db.cursor() as c:
        # let's allow microsecond precision - python's time.time() seems to think it is needed, so who are we to argue? :)
        c.execute('ALTER TABLE measurements ALTER ts TYPE NUMERIC(16, 6);')

def migration_step_3():
    with db.cursor() as c:
        c.execute('CREATE UNIQUE INDEX measurements_path_ts ON measurements (path, ts);')

def migration_step_4():
    with db.cursor() as c:
        #c.execute('CREATE DOMAIN AGGR_LEVEL AS SMALLINT CHECK (VALUE >= 0 AND VALUE <= 6)')  # 6: one point for every month
        c.execute('CREATE TABLE aggregations (level SMALLINT, tsmed INTEGER, vmin NUMERIC, vmax NUMERIC, vavg NUMERIC);')
        c.execute('CREATE UNIQUE INDEX aggregations_level_tsmed ON aggregations (level, tsmed);')

def migration_step_5():
    with db.cursor() as c:
        c.execute('CREATE INDEX measurements_ts ON measurements (ts);')

def migration_step_6():
    with db.cursor() as c:
        # let's allow microsecond precision - python's time.time() seems to think it is needed, so who are we to argue? :)
        c.execute('ALTER TABLE aggregations ADD path TEXT;')
        c.execute('DROP INDEX aggregations_level_tsmed;')
        c.execute('CREATE UNIQUE INDEX aggregations_path_level_tsmed ON aggregations (path, level, tsmed);')


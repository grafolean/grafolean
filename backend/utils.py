from colors import color
import logging
import os
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


host, dbname, user, password = (
    os.environ.get('DB_HOST', 'localhost'),
    os.environ.get('DB_DATABASE', 'moonthor'),
    os.environ.get('DB_USERNAME', 'admin'),
    os.environ.get('DB_PASSWORD', 'admin')
)
try:
    log.info("Connecting to {} / {} / {}", host, dbname, user)
    db = psycopg2.connect(
        host=host,
        database=dbname,
        user=user,
        password=password,
        connect_timeout=10
    )
    db.autocommit = True
except:
    db = None

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

        c.execute('CREATE TABLE paths (id SERIAL NOT NULL PRIMARY KEY, path TEXT);')
        c.execute('CREATE UNIQUE INDEX paths_path ON paths (path);')

        c.execute('CREATE TABLE measurements (path INTEGER NOT NULL REFERENCES paths(id), ts NUMERIC(16, 6), value NUMERIC);')
        c.execute('CREATE UNIQUE INDEX measurements_path_ts ON measurements (path, ts);')
        # c.execute('CREATE INDEX measurements_ts ON measurements (ts);')

        c.execute('CREATE DOMAIN AGGR_LEVEL AS SMALLINT CHECK (VALUE >= 0 AND VALUE <= 6);')  # 6: one point for about every month
        c.execute('CREATE TABLE aggregations (path INTEGER NOT NULL REFERENCES paths(id), level AGGR_LEVEL, tsmed INTEGER, vmin NUMERIC, vmax NUMERIC, vavg NUMERIC);')
        c.execute('CREATE UNIQUE INDEX aggregations_path_level_tsmed ON aggregations (path, level, tsmed);')

def migration_step_2():
    with db.cursor() as c:
        #c.execute('DROP TABLE charts;')
        #c.execute('DROP TABLE dashboards;')
        c.execute('CREATE TABLE dashboards (id SERIAL NOT NULL PRIMARY KEY, name TEXT NOT NULL, slug VARCHAR(50) NOT NULL);')
        c.execute('CREATE UNIQUE INDEX dashboards_slug ON dashboards (slug);')
        # yes, I know Postgres has arrays - but there is no advantage in using them (instead of comma-separated text) for path_filters, and it makes
        # code more understandable and portable:
        c.execute('CREATE TABLE charts (id SERIAL NOT NULL PRIMARY KEY, dashboard INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE, name TEXT NOT NULL, path_filters TEXT);')

def migration_step_3():
    with db.cursor() as c:
        # reapply 'on delete cascade' part of last sql sentence if needed:
        c.execute('ALTER TABLE charts DROP CONSTRAINT charts_dashboard_fkey;')
        c.execute('ALTER TABLE charts ADD CONSTRAINT charts_dashboard_fkey FOREIGN KEY (dashboard) REFERENCES dashboards(id) ON DELETE CASCADE;')
        # move path_filters to new table:
        c.execute('CREATE TABLE charts_content (id SERIAL NOT NULL PRIMARY KEY, chart INTEGER NOT NULL REFERENCES charts(id) ON DELETE CASCADE, path_filter TEXT NOT NULL, unit TEXT, metric_prefix TEXT);')
        c.execute('SELECT id, path_filters FROM charts;')
        results = list(c)
        for chart_id, path_filters in results:
            pfs = path_filters.split(',')
            for pf in pfs:
                c.execute("INSERT INTO charts_content (chart, path_filter) VALUES (%s, %s);", (chart_id, pf,))
        c.execute('ALTER TABLE charts DROP path_filters;')

def migration_step_4():
    with db.cursor() as c:
        c.execute("ALTER TABLE charts_content ADD COLUMN renaming TEXT NOT NULL default '';")

def migration_step_5():
    with db.cursor() as c:
        c.execute('CREATE TABLE widgets (id SERIAL NOT NULL PRIMARY KEY, dashboard INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE, type VARCHAR(50), title TEXT NOT NULL, content TEXT NOT NULL);')

def migration_step_6():
    with db.cursor() as c:
        # reapply 'on delete cascade' part of last sql sentence if needed:
        c.execute('ALTER TABLE measurements DROP CONSTRAINT IF EXISTS measurements_path_fkey;')
        c.execute('ALTER TABLE measurements ADD CONSTRAINT measurements_path_fkey FOREIGN KEY (path) REFERENCES paths(id) ON DELETE CASCADE;')
        c.execute('ALTER TABLE aggregations DROP CONSTRAINT IF EXISTS aggregations_path_fkey;')
        c.execute('ALTER TABLE aggregations ADD CONSTRAINT aggregations_path_fkey FOREIGN KEY (path) REFERENCES paths(id) ON DELETE CASCADE;')

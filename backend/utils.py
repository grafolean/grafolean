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

# currently, we only work with a single account:
ADMIN_ACCOUNT_ID = 1

db = None

def db_connect():
    global db
    host, dbname, user, password, connect_timeout = (
        os.environ.get('DB_HOST', 'localhost'),
        os.environ.get('DB_DATABASE', 'moonthor'),
        os.environ.get('DB_USERNAME', 'admin'),
        os.environ.get('DB_PASSWORD', 'admin'),
        int(os.environ.get('DB_CONNECT_TIMEOUT', '10'))
    )
    try:
        log.info("Connecting to database, host: [{}], db: [{}], user: [{}]".format(host, dbname, user))
        db = psycopg2.connect(
            host=host,
            database=dbname,
            user=user,
            password=password,
            connect_timeout=connect_timeout
        )
        db.autocommit = True
    except:
        db = None
        log.error("DB connection failed")

db_connect()

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
        log.info("Migrating DB schema from {} to {}".format(existing_schema_version, try_migrating_to))
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

        ID_FIELD = 'id SERIAL NOT NULL PRIMARY KEY'
        ACCOUNT_ID_FIELD = 'account INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE'

        c.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')  # needed for UUID filed type
        c.execute("CREATE TYPE HTTP_METHOD AS ENUM('GET','POST','PUT','DELETE');")

        c.execute("CREATE TABLE accounts ({id}, name TEXT NOT NULL UNIQUE, enabled BOOLEAN NOT NULL DEFAULT TRUE);".format(id=ID_FIELD))
        c.execute('CREATE TABLE users ({id}, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, passhash TEXT NOT NULL);'.format(id=ID_FIELD))
        c.execute('CREATE TABLE bots ({id}, {account}, token UUID DEFAULT uuid_generate_v4(), name TEXT NOT NULL);'.format(id=ID_FIELD, account=ACCOUNT_ID_FIELD))
        c.execute('CREATE TABLE private_jwt_keys ({id}, key TEXT NOT NULL, use_until NUMERIC(10) NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) + 3600);'.format(id=ID_FIELD))
        c.execute('CREATE TABLE permissions ({id}, username TEXT NULL REFERENCES users(username) ON DELETE CASCADE, url_prefix TEXT NULL, methods HTTP_METHOD[] NULL);'.format(id=ID_FIELD))

        c.execute('CREATE TABLE paths ({id}, {account}, path TEXT);'.format(id=ID_FIELD, account=ACCOUNT_ID_FIELD))
        c.execute('CREATE UNIQUE INDEX paths_path ON paths (account, path);')

        c.execute('CREATE TABLE measurements (path INTEGER NOT NULL REFERENCES paths(id) ON DELETE CASCADE, ts NUMERIC(16, 6), value NUMERIC);')
        c.execute('CREATE UNIQUE INDEX measurements_path_ts ON measurements (path, ts);')

        c.execute('CREATE DOMAIN AGGR_LEVEL AS SMALLINT CHECK (VALUE >= 0 AND VALUE <= 6);')  # 6: one point for about every month
        c.execute('CREATE TABLE aggregations (path INTEGER NOT NULL REFERENCES paths(id) ON DELETE CASCADE, level AGGR_LEVEL, tsmed INTEGER, vmin NUMERIC, vmax NUMERIC, vavg NUMERIC);')
        c.execute('CREATE UNIQUE INDEX aggregations_path_level_tsmed ON aggregations (path, level, tsmed);')

        c.execute('CREATE TABLE dashboards ({id}, {account}, name TEXT NOT NULL, slug VARCHAR(50) NOT NULL);'.format(id=ID_FIELD, account=ACCOUNT_ID_FIELD))
        c.execute('CREATE UNIQUE INDEX dashboards_slug ON dashboards (account, slug);')
        # yes, I know Postgres has arrays - but there is no advantage in using them (instead of comma-separated text) for path_filters, and it makes
        # code more understandable and portable:
        # c.execute('CREATE TABLE charts ({id}, dashboard INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE, name TEXT NOT NULL);'.format(id=ID_FIELD))
        # c.execute("CREATE TABLE charts_content ({id}, chart INTEGER NOT NULL REFERENCES charts(id) ON DELETE CASCADE, path_filter TEXT NOT NULL, unit TEXT, metric_prefix TEXT, renaming TEXT NOT NULL DEFAULT '');".format(id=ID_FIELD))

        c.execute('CREATE TABLE widgets ({id}, dashboard INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE, type VARCHAR(50), title TEXT NOT NULL, content TEXT NOT NULL);'.format(id=ID_FIELD))


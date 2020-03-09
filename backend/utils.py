from colors import color
from contextlib import contextmanager
import logging
import os
import sys
import copy
import json
import psycopg2
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

logging.basicConfig(format='%(asctime)s | %(levelname)s | %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S', level=logging.DEBUG)
logging.addLevelName(logging.DEBUG, color("DBG", 7))
logging.addLevelName(logging.INFO, "INF")
logging.addLevelName(logging.WARNING, color('WRN', fg='red'))
logging.addLevelName(logging.ERROR, color('ERR', bg='red'))
log = logging.getLogger("{}.{}".format(__name__, "base"))


db_pool = None


# https://medium.com/@thegavrikstory/manage-raw-database-connection-pool-in-flask-b11e50cbad3
@contextmanager
def get_db_connection():
    global db_pool
    try:
        conn = db_pool.getconn()
        conn.autocommit = True
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        yield conn
    finally:
        db_pool.putconn(conn)


@contextmanager
def get_db_cursor(commit=False):
    with get_db_connection() as connection:
      cursor = connection.cursor()
      try:
          yield cursor
          if commit:
              connection.commit()
      finally:
          cursor.close()


def db_connect():
    global db_pool
    host, dbname, user, password, connect_timeout = (
        os.environ.get('DB_HOST', 'localhost'),
        os.environ.get('DB_DATABASE', 'grafolean'),
        os.environ.get('DB_USERNAME', 'admin'),
        os.environ.get('DB_PASSWORD', 'admin'),
        int(os.environ.get('DB_CONNECT_TIMEOUT', '10'))
    )
    try:
        log.info("Connecting to database, host: [{}], db: [{}], user: [{}]".format(host, dbname, user))
        db_pool = ThreadedConnectionPool(1, 20,
                              database=dbname,
                              user=user,
                              password=password,
                              host=host,
                              port=5432,
                              connect_timeout=connect_timeout)
    except:
        db_pool = None
        log.error("DB connection failed")

db_connect()

# This class is only needed until we replace all db.cursor() calls with get_db_cursor()
class ThinDBWrapper(object):
    @staticmethod
    def cursor():
        return get_db_cursor()
db = ThinDBWrapper


###########################
#   DB schema migration   #
###########################

def get_existing_schema_version():
    existing_schema_version = 0
    with db.cursor() as c:
        try:
            c.execute('SELECT schema_version FROM runtime_data;')
            res = c.fetchone()
            existing_schema_version = res[0]
        except psycopg2.ProgrammingError:
            pass
    return existing_schema_version


def _get_migration_method(next_migration_version):
    method_name = 'migration_step_{}'.format(next_migration_version)
    return method_name if hasattr(sys.modules[__name__], method_name) else None


def is_migration_needed():
    existing_schema_version = get_existing_schema_version()
    return _get_migration_method(existing_schema_version + 1) is not None


def migrate_if_needed():
    existing_schema_version = get_existing_schema_version()
    try_migrating_to = existing_schema_version + 1
    while True:
        method_name = _get_migration_method(try_migrating_to)
        if method_name is None:
            break
        log.info("Migrating DB schema from {} to {}".format(existing_schema_version, try_migrating_to))
        method_to_call = getattr(sys.modules[__name__], method_name)
        method_to_call()
        # automatically upgrade schema version if there is no exception:
        with db.cursor() as c:
            c.execute('UPDATE runtime_data SET schema_version = %s;', (try_migrating_to,))
        try_migrating_to += 1
    if try_migrating_to == existing_schema_version + 1:
        return False  # migration wasn't meeded
    else:
        return True


def migration_step_1():
    with db.cursor() as c:
        c.execute('CREATE TABLE runtime_data (schema_version SMALLSERIAL NOT NULL);')
        c.execute('INSERT INTO runtime_data (schema_version) VALUES (1);')

        ID_FIELD = 'id SERIAL NOT NULL PRIMARY KEY'
        ACCOUNT_ID_FIELD = 'account INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE'

        c.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')  # needed for UUID filed type
        c.execute("CREATE TYPE HTTP_METHOD AS ENUM('GET','POST','PUT','DELETE');")
        c.execute("CREATE TYPE USER_TYPE AS ENUM('bot', 'person');")

        c.execute("CREATE TABLE accounts ({id}, name TEXT NOT NULL UNIQUE, enabled BOOLEAN NOT NULL DEFAULT TRUE);".format(id=ID_FIELD))
        # ideally, we would want to limit `persons` and `bots` to only reference records in `users` with appropriate user_type, but I couldn't find a nice way to do that
        c.execute("CREATE TABLE users ({id}, user_type USER_TYPE);".format(id=ID_FIELD))
        USER_ID_FIELD = 'user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE'
        c.execute('CREATE TABLE persons ({user_id}, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, username TEXT NOT NULL UNIQUE, passhash TEXT NOT NULL);'.format(user_id=USER_ID_FIELD))
        c.execute('CREATE TABLE bots ({user_id}, name TEXT NOT NULL, token UUID DEFAULT uuid_generate_v4(), insert_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);'.format(user_id=USER_ID_FIELD, account=ACCOUNT_ID_FIELD))
        c.execute('CREATE TABLE private_jwt_keys ({id}, key TEXT NOT NULL, use_until NUMERIC(10) NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) + 3600);'.format(id=ID_FIELD))
        c.execute('CREATE TABLE permissions ({id}, user_id INTEGER NULL REFERENCES users(id) ON DELETE CASCADE, url_prefix TEXT NULL, methods HTTP_METHOD[] NULL);'.format(id=ID_FIELD))

        c.execute('CREATE TABLE paths ({id}, {account}, path TEXT);'.format(id=ID_FIELD, account=ACCOUNT_ID_FIELD))
        c.execute('CREATE UNIQUE INDEX paths_path ON paths (account, path);')

        c.execute('CREATE TABLE measurements (path INTEGER NOT NULL REFERENCES paths(id) ON DELETE CASCADE, ts NUMERIC(16, 6) NOT NULL, value NUMERIC NOT NULL);')
        c.execute('CREATE UNIQUE INDEX measurements_path_ts ON measurements (path, ts);')

        c.execute('CREATE DOMAIN AGGR_LEVEL AS SMALLINT CHECK (VALUE >= 0 AND VALUE <= 6);')  # 6: one point for about every month
        c.execute('CREATE TABLE aggregations (path INTEGER NOT NULL REFERENCES paths(id) ON DELETE CASCADE, level AGGR_LEVEL, tsmed INTEGER, vmin NUMERIC NOT NULL, vmax NUMERIC NOT NULL, vavg NUMERIC NOT NULL);')
        c.execute('CREATE UNIQUE INDEX aggregations_path_level_tsmed ON aggregations (path, level, tsmed);')

        c.execute('CREATE TABLE dashboards ({id}, {account}, name TEXT NOT NULL, slug VARCHAR(50) NOT NULL);'.format(id=ID_FIELD, account=ACCOUNT_ID_FIELD))
        c.execute('CREATE UNIQUE INDEX dashboards_slug ON dashboards (account, slug);')
        # yes, I know Postgres has arrays - but there is no advantage in using them (instead of comma-separated text) for path_filters, and it makes
        # code more understandable and portable:
        # c.execute('CREATE TABLE charts ({id}, dashboard INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE, name TEXT NOT NULL);'.format(id=ID_FIELD))
        # c.execute("CREATE TABLE charts_content ({id}, chart INTEGER NOT NULL REFERENCES charts(id) ON DELETE CASCADE, path_filter TEXT NOT NULL, unit TEXT, metric_prefix TEXT, renaming TEXT NOT NULL DEFAULT '');".format(id=ID_FIELD))

        c.execute('CREATE TABLE widgets ({id}, dashboard INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE, type VARCHAR(50), title TEXT NOT NULL, content TEXT NOT NULL);'.format(id=ID_FIELD))

def migration_step_2():
    with db.cursor() as c:
        c.execute('ALTER TABLE permissions RENAME COLUMN url_prefix TO resource_prefix;')

def _construct_plsql_randid_function(table_name):
    """
        Constructs a string definition of a PLSQL function that can be used to return a unique random ID on
        a specified table.

        Postgres doesn't allow us to supply table name as paramater because execution plan is made in advance. To avoid
        this problem we construct N similar functions with hardcoded table names (one for each table).
        There is a possible workaround which involves executing dynamic statements:
          https://www.postgresql.org/docs/current/plpgsql-statements.html#PLPGSQL-STATEMENTS-EXECUTING-DYN

        The implemented solution seems easier and is possibly more efficient, however this is not an informed decision,
        so it might be necessary to revisit it in the future.
    """

    return """
        CREATE OR REPLACE FUNCTION randid_{table_name}() RETURNS integer AS $$
        DECLARE
            maxId constant bigint := 2147483647;
            randomId bigint;
            offsetBy bigint;
            candidateId bigint;
        BEGIN
            -- Plan: get a random ID, check it against existing records and return it if free. If it
            -- already exists, increment offset until you find an ID that is free, and return it. If
            -- no IDs are available, raise an exception.

            -- try to find an initial random number in range 1..maxId:
            randomId := floor(random() * maxId) + 1;

            FOR offsetBy IN 0..maxId - 1 LOOP
                -- check if it exists:
                candidateId := ((randomId + offsetBy) % maxId) + 1;
                PERFORM id FROM {table_name} WHERE id = candidateId;
                IF NOT FOUND THEN
                    -- there was no match, we can use this id:
                    RETURN candidateId;
                END IF;
            END LOOP;

            RAISE EXCEPTION 'No free IDs left in table {table_name}.';
        END;

        $$ LANGUAGE plpgsql;
    """.format(table_name=table_name)

def migration_step_3():
    with db.cursor() as c:
        TABLES_WITH_RANDOM_IDS = [
            'accounts',
            'users',
            'private_jwt_keys',
            'permissions',
            'paths',
            'dashboards',
            'widgets',
        ]
        for table_name in TABLES_WITH_RANDOM_IDS:
            c.execute(_construct_plsql_randid_function(table_name))
            c.execute('ALTER TABLE {table_name} ALTER COLUMN id SET DATA TYPE integer, ALTER COLUMN id SET DEFAULT randid_{table_name}()'.format(table_name=table_name))

def migration_step_4():
    """ Removes the UNIQUE constraint on accounts.name. We need to identify the constraint first and then remove it. """
    with db.cursor() as c:
        c.execute("SELECT conname FROM pg_constraint WHERE conrelid = 'accounts'::regclass AND contype = 'u';")
        constraint_name, = c.fetchone()
        c.execute("ALTER TABLE accounts DROP CONSTRAINT {};".format(constraint_name))

def migration_step_5():
    """ Bots can be either system-wide or tied to a specific account. """
    with db.cursor() as c:
        ACCOUNT_ID_FIELD_NULLABLE = 'account INTEGER DEFAULT NULL REFERENCES accounts(id) ON DELETE CASCADE'
        c.execute("ALTER TABLE bots ADD COLUMN {account};".format(account=ACCOUNT_ID_FIELD_NULLABLE))

def migration_step_6():
    """ Permissions are now always tied to a specific user. """
    with db.cursor() as c:
        c.execute("ALTER TABLE permissions ALTER COLUMN user_id SET NOT NULL;")

def migration_step_7():
    """ Try a different way: users and bots may be tied to a set of accounts (users via invites, bots by being created inside the accounts). """
    ID_FIELD = 'id INTEGER NOT NULL PRIMARY KEY DEFAULT randid_{table_name}()'.format(table_name='users_accounts')
    ACCOUNT_ID_FIELD = 'account INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE'
    USER_ID_FIELD = 'user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE'
    with db.cursor() as c:
        c.execute(_construct_plsql_randid_function('users_accounts'))
        c.execute('CREATE TABLE users_accounts ({id}, {user_id}, {account});'.format(id=ID_FIELD, user_id=USER_ID_FIELD, account=ACCOUNT_ID_FIELD))
        c.execute('CREATE UNIQUE INDEX users_accounts_account ON users_accounts (user_id, account);')

        c.execute("ALTER TABLE bots DROP COLUMN account;")  # no need to convert data, it wasn't used anywhere

def migration_step_8():
    """ Bots can have their type and configuration saved to DB. """
    with db.cursor() as c:
        c.execute("ALTER TABLE bots ADD COLUMN bot_type TEXT DEFAULT NULL;")
        c.execute("ALTER TABLE users_accounts ADD COLUMN config JSON DEFAULT NULL;")

def migration_step_9():
    """ Add monitored entities (devices, web pages, services,...). """
    ID_FIELD = 'id INTEGER NOT NULL PRIMARY KEY DEFAULT randid_{table_name}()'.format(table_name='entities')
    ACCOUNT_ID_FIELD = 'account INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE'
    with db.cursor() as c:
        c.execute(_construct_plsql_randid_function('entities'))
        c.execute('CREATE TABLE entities ({id}, {account}, name TEXT NOT NULL, entity_type TEXT NOT NULL, details JSON NOT NULL);'.format(id=ID_FIELD, account=ACCOUNT_ID_FIELD))
        c.execute('CREATE UNIQUE INDEX entities_name ON entities (account, name);')

def migration_step_10():
    """ Add credentials. """
    ID_FIELD = 'id INTEGER NOT NULL PRIMARY KEY DEFAULT randid_{table_name}()'.format(table_name='credentials')
    ACCOUNT_ID_FIELD = 'account INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE'
    with db.cursor() as c:
        c.execute(_construct_plsql_randid_function('credentials'))
        c.execute('CREATE TABLE credentials ({id}, {account}, name TEXT NOT NULL, credentials_type TEXT NOT NULL, details JSON NOT NULL);'.format(id=ID_FIELD, account=ACCOUNT_ID_FIELD))
        c.execute('CREATE UNIQUE INDEX credentials_name ON credentials (account, name);')

def migration_step_11():
    """ Add sensors, rename *_type fields to protocol. """
    ID_FIELD = 'id INTEGER NOT NULL PRIMARY KEY DEFAULT randid_{table_name}()'.format(table_name='sensors')
    ACCOUNT_ID_FIELD = 'account INTEGER NULL REFERENCES accounts(id) ON DELETE CASCADE'
    with db.cursor() as c:
        c.execute(_construct_plsql_randid_function('sensors'))
        c.execute('CREATE TABLE sensors ({id}, {account}, name TEXT NOT NULL, protocol TEXT NOT NULL, details JSON NOT NULL);'.format(id=ID_FIELD, account=ACCOUNT_ID_FIELD))
        c.execute('CREATE UNIQUE INDEX sensors_name ON sensors (account, name);')

        c.execute('ALTER TABLE bots RENAME COLUMN bot_type TO protocol;')
        c.execute('ALTER TABLE credentials RENAME COLUMN credentials_type TO protocol;')

def migration_step_12():
    """ Tie credentials and sensors to entities. """
    ENTITY_ID_FIELD = 'entity INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE'
    CREDENTIAL_ID_FIELD = 'credential INTEGER NOT NULL REFERENCES credentials(id) ON DELETE CASCADE'
    SENSOR_ID_FIELD = 'sensor INTEGER NOT NULL REFERENCES sensors(id) ON DELETE CASCADE'
    with db.cursor() as c:
        c.execute('CREATE TABLE entities_sensors ({entity}, {sensor});'.format(entity=ENTITY_ID_FIELD, sensor=SENSOR_ID_FIELD))
        c.execute('CREATE UNIQUE INDEX entities_sensors_entity_sensor ON entities_sensors (entity, sensor);')
        c.execute('CREATE TABLE entities_credentials ({entity}, {credential});'.format(entity=ENTITY_ID_FIELD, credential=CREDENTIAL_ID_FIELD))
        # there can be many records with the same entity id, but the referenced credentials must have different protocols
        # until we figure out how to constrain that on DB level (or what a better schema design would be) we will need to
        # be more careful on app level

def migration_step_13():
    """ Sensors should have a default interval (if they are pull, or NULL if they are push), and it
        should  be possible to override this when selecting a sensor for entity.
    """
    with db.cursor() as c:
        c.execute('ALTER TABLE sensors ADD COLUMN default_interval INTEGER NULL;')  # NULL: no interval (push), otherwise interval in seconds
        c.execute('ALTER TABLE entities_sensors ADD COLUMN interval INTEGER NULL;')  # NULL: use sensors::default_interval, otherwise interval in seconds

def migration_step_14():
    """ SNMP sensors have a field 'output_path' which was treated differently depending on whether SNMP WALK
        was used or not. After this upgrade users are expected to use '{$index}' to explicitly compose the
        output path. This migration fixes old path expressions to prevent any change in behaviour of existing sensors.
    """
    with db.cursor() as c, db.cursor() as c2:
        c.execute("SELECT id, details FROM sensors WHERE protocol = 'snmp';")
        # note: with JSON fields we get the parsed object from SELECTs, but must use a json string with UPDATEs and INSERTs
        for sensor_id, details in c:
            is_snmp_walk_present = any([o['fetch_method'] == 'walk' for o in details['oids']])
            if not is_snmp_walk_present:
                continue  # nothing to do here
            new_details = copy.deepcopy(details)
            new_details['output_path'] = details['output_path'] + '.{$index}'
            c2.execute("UPDATE sensors SET details = %s WHERE id = %s;", (json.dumps(new_details), sensor_id,))

def migration_step_15():
    """ Bots should save a time of last successful authentication.
    """
    with db.cursor() as c:
        c.execute('ALTER TABLE bots ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL;')

def migration_step_16():
    """ Entities can have a specific bot selected for each of the protocols. """
    ENTITY_ID_FIELD = 'entity INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE'
    BOT_ID_FIELD = 'bot INTEGER NOT NULL REFERENCES bots(user_id) ON DELETE CASCADE'
    with db.cursor() as c:
        c.execute('CREATE TABLE entities_bots ({entity}, {bot});'.format(entity=ENTITY_ID_FIELD, bot=BOT_ID_FIELD))

def migration_step_17():
    """ Widgets need to remember their position (order) on screen. """
    with db.cursor() as c, db.cursor() as c2:
        c.execute('ALTER TABLE widgets ADD COLUMN position INTEGER DEFAULT NULL;')

        # for every dashboard, update the positions of its widgets so that they are ascending:
        position = 0
        last_dashboard_id = None
        c.execute('SELECT dashboard, id FROM widgets ORDER BY dashboard ASC, id ASC')
        for dashboard_id, widget_id in c:
            if dashboard_id != last_dashboard_id:
                position = 0
                last_dashboard_id = dashboard_id
            c2.execute('UPDATE widgets SET position = %s WHERE id = %s', (position, widget_id,))
            position += 1

def migration_step_18():
    """ Widgets' position on screen is more than just sort order - widgets have width/height and x/y position. """
    with db.cursor() as c, db.cursor() as c2, db.cursor() as c3:
        DEFAULT_HEIGHT = 10
        N_COLUMNS = 12

        c.execute('ALTER TABLE widgets ADD COLUMN position_x SMALLINT NOT NULL DEFAULT 0;')
        c.execute('ALTER TABLE widgets ADD COLUMN position_y SMALLINT DEFAULT NULL;')  # we will set it to NOT NULL once we update the values
        c.execute(f'CREATE DOMAIN WIDGETS_WIDTH AS SMALLINT CHECK (VALUE >= 0 AND VALUE <= {N_COLUMNS});')
        c.execute(f'ALTER TABLE widgets ADD COLUMN position_w WIDGETS_WIDTH DEFAULT {N_COLUMNS};')
        c.execute(f'ALTER TABLE widgets ADD COLUMN position_h SMALLINT DEFAULT {DEFAULT_HEIGHT};')

        c.execute('SELECT DISTINCT(dashboard) FROM widgets;')
        for dashboard_id, in c:
            position_y = 0
            c2.execute('SELECT id FROM widgets WHERE dashboard = %s ORDER BY position;', (dashboard_id,))
            for widget_id, in c2:
                c3.execute('UPDATE widgets SET position_y = %s WHERE id = %s', (position_y, widget_id,))
                position_y += DEFAULT_HEIGHT

        c.execute('ALTER TABLE widgets ALTER COLUMN position_y SET NOT NULL;')
        c.execute('ALTER TABLE widgets DROP COLUMN position;')

def migration_step_19():
    """ Widgets need to remember the dashboard page they are on. """
    with db.cursor() as c:
        c.execute("ALTER TABLE widgets ADD COLUMN position_p VARCHAR(20) NOT NULL DEFAULT 'default';")

def migration_step_20():
    """ No need to aggregate values, we use indexes on values instead. """
    with db.cursor() as c:

        # We try to create indexes, but if we fail, user can create them manually and we need to be able to skip this step entirely:
        #   CREATE INDEX CONCURRENTLY aggregations_path_aggr0_value ON measurements (path, FLOOR(ts / 3600), value);
        #   CREATE INDEX CONCURRENTLY aggregations_path_aggr1_value ON measurements (path, FLOOR(ts / 10800), value);
        #   CREATE INDEX CONCURRENTLY aggregations_path_aggr2_value ON measurements (path, FLOOR(ts / 32400), value);
        #   CREATE INDEX CONCURRENTLY aggregations_path_aggr3_value ON measurements (path, FLOOR(ts / 97200), value);
        #   CREATE INDEX CONCURRENTLY aggregations_path_aggr4_value ON measurements (path, FLOOR(ts / 291600), value);
        #   CREATE INDEX CONCURRENTLY aggregations_path_aggr5_value ON measurements (path, FLOOR(ts / 874800), value);
        #   CREATE INDEX CONCURRENTLY aggregations_path_aggr6_value ON measurements (path, FLOOR(ts / 2624400), value);

        c.execute("DROP TABLE IF EXISTS aggregations;")
        c.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS aggregations_path_aggr0_value ON measurements (path, FLOOR(ts / {3600 * (3**0)}), value);")
        c.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS aggregations_path_aggr1_value ON measurements (path, FLOOR(ts / {3600 * (3**1)}), value);")
        c.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS aggregations_path_aggr2_value ON measurements (path, FLOOR(ts / {3600 * (3**2)}), value);")
        c.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS aggregations_path_aggr3_value ON measurements (path, FLOOR(ts / {3600 * (3**3)}), value);")
        c.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS aggregations_path_aggr4_value ON measurements (path, FLOOR(ts / {3600 * (3**4)}), value);")
        c.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS aggregations_path_aggr5_value ON measurements (path, FLOOR(ts / {3600 * (3**5)}), value);")
        c.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS aggregations_path_aggr6_value ON measurements (path, FLOOR(ts / {3600 * (3**6)}), value);")

def migration_step_21():
    """ Index for regex searching on paths. """
    with db.cursor() as c:
        c.execute("CREATE EXTENSION IF NOT EXISTS PG_TRGM;")
        c.execute("CREATE INDEX IF NOT EXISTS paths_path_idx ON paths USING GIN (path GIN_TRGM_OPS);")

def migration_step_22():
    """ Allow entities to have parent-child relations (device -> interfaces). """
    with db.cursor() as c:
        c.execute("ALTER TABLE entities ADD COLUMN parent INTEGER DEFAULT NULL REFERENCES entities(id) ON DELETE CASCADE")

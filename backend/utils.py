from colors import color
from contextlib import contextmanager
import logging
import os
import sys
import copy
import json
import quart as flask
import asyncpg

logging.basicConfig(format='%(asctime)s | %(levelname)s | %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S', level=logging.DEBUG)
logging.addLevelName(logging.DEBUG, color("DBG", 7))
logging.addLevelName(logging.INFO, "INF")
logging.addLevelName(logging.WARNING, color('WRN', fg='red'))
logging.addLevelName(logging.ERROR, color('ERR', bg='red'))
log = logging.getLogger("{}.{}".format(__name__, "base"))


def rowcount(execute_message):
    """
    Asyncpg's execute returns a string which contains rowcount:
      https://github.com/MagicStack/asyncpg/issues/311

    The tag can be parsed like this:
    The command tag. This is usually a single word that identifies which SQL command was completed.
        - INSERT: "INSERT oid rows" - rows is the number of rows inserted. oid used to be the object ID
            of the inserted row if rows was 1 and the target table had OIDs, but OIDs system columns are
            not supported anymore; therefore oid is always 0.
        - DELETE: "DELETE rows" - rows is the number of rows deleted.
        - UPDATE: "UPDATE rows" - rows is the number of rows updated.
        - SELECT or CREATE TABLE AS: "SELECT rows" - rows is the number of rows retrieved
        - MOVE: "MOVE rows" - rows is the number of rows the cursor's position has been changed by
        - FETCH: "FETCH rows" - rows is the number of rows that have been retrieved from the cursor
        - COPY: "COPY rows" - rows is the number of rows copied
    We could simply take the last part (always rows according to this docs), but - something could get added,
    while the order of these first parts will (probably) never change.
    """
    parts = execute_message.split(" ")
    if parts[0] == "INSERT":
        return int(parts[2])
    else:
        return int(parts[1])


###########################
#   DB schema migration   #
###########################

async def get_existing_schema_version():
    existing_schema_version = 0
    async with flask.current_app.pool.acquire() as c:
        try:
            res = await c.fetchrow('SELECT schema_version FROM runtime_data;')
            if not res:
                return 0
            existing_schema_version = res[0]
        except asyncpg.exceptions.UndefinedTableError:
            pass
    return existing_schema_version


def _get_migration_method(next_migration_version):
    method_name = 'migration_step_{}'.format(next_migration_version)
    return method_name if hasattr(sys.modules[__name__], method_name) else None


async def is_migration_needed():
    existing_schema_version = await get_existing_schema_version()
    return _get_migration_method(existing_schema_version + 1) is not None


async def migrate_if_needed():
    existing_schema_version = await get_existing_schema_version()
    try_migrating_to = existing_schema_version + 1
    while True:
        method_name = _get_migration_method(try_migrating_to)
        if method_name is None:
            break
        log.info("Migrating DB schema from {} to {}".format(existing_schema_version, try_migrating_to))
        method_to_call = getattr(sys.modules[__name__], method_name)
        await method_to_call()
        # automatically upgrade schema version if there is no exception:
        async with flask.current_app.pool.acquire() as c:
            await c.execute('UPDATE runtime_data SET schema_version = $1;', try_migrating_to)
        try_migrating_to += 1
    if try_migrating_to == existing_schema_version + 1:
        return False  # migration wasn't meeded
    else:
        return True


async def migration_step_1():
    async with flask.current_app.pool.acquire() as c:
        await c.execute('CREATE TABLE runtime_data (schema_version SMALLSERIAL NOT NULL);')
        await c.execute('INSERT INTO runtime_data (schema_version) VALUES (1);')

        ID_FIELD = 'id SERIAL NOT NULL PRIMARY KEY'
        ACCOUNT_ID_FIELD = 'account INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE'

        await c.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')  # needed for UUID filed type
        await c.execute("CREATE TYPE HTTP_METHOD AS ENUM('GET','POST','PUT','DELETE');")
        await c.execute("CREATE TYPE USER_TYPE AS ENUM('bot', 'person');")

        await c.execute("CREATE TABLE accounts ({id}, name TEXT NOT NULL UNIQUE, enabled BOOLEAN NOT NULL DEFAULT TRUE);".format(id=ID_FIELD))
        # ideally, we would want to limit `persons` and `bots` to only reference records in `users` with appropriate user_type, but I couldn't find a nice way to do that
        await c.execute("CREATE TABLE users ({id}, user_type USER_TYPE);".format(id=ID_FIELD))
        USER_ID_FIELD = 'user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE'
        await c.execute('CREATE TABLE persons ({user_id}, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, username TEXT NOT NULL UNIQUE, passhash TEXT NOT NULL);'.format(user_id=USER_ID_FIELD))
        await c.execute('CREATE TABLE bots ({user_id}, name TEXT NOT NULL, token UUID DEFAULT uuid_generate_v4(), insert_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);'.format(user_id=USER_ID_FIELD, account=ACCOUNT_ID_FIELD))
        await c.execute('CREATE TABLE private_jwt_keys ({id}, key TEXT NOT NULL, use_until NUMERIC(10) NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) + 3600);'.format(id=ID_FIELD))
        await c.execute('CREATE TABLE permissions ({id}, user_id INTEGER NULL REFERENCES users(id) ON DELETE CASCADE, url_prefix TEXT NULL, methods HTTP_METHOD[] NULL);'.format(id=ID_FIELD))

        await c.execute('CREATE TABLE paths ({id}, {account}, path TEXT);'.format(id=ID_FIELD, account=ACCOUNT_ID_FIELD))
        await c.execute('CREATE UNIQUE INDEX paths_path ON paths (account, path);')

        await c.execute('CREATE TABLE measurements (path INTEGER NOT NULL REFERENCES paths(id) ON DELETE CASCADE, ts NUMERIC(16, 6) NOT NULL, value NUMERIC NOT NULL);')
        await c.execute('CREATE UNIQUE INDEX measurements_path_ts ON measurements (path, ts);')

        await c.execute('CREATE DOMAIN AGGR_LEVEL AS SMALLINT CHECK (VALUE >= 0 AND VALUE <= 6);')  # 6: one point for about every month
        await c.execute('CREATE TABLE aggregations (path INTEGER NOT NULL REFERENCES paths(id) ON DELETE CASCADE, level AGGR_LEVEL, tsmed INTEGER, vmin NUMERIC NOT NULL, vmax NUMERIC NOT NULL, vavg NUMERIC NOT NULL);')
        await c.execute('CREATE UNIQUE INDEX aggregations_path_level_tsmed ON aggregations (path, level, tsmed);')

        await c.execute('CREATE TABLE dashboards ({id}, {account}, name TEXT NOT NULL, slug VARCHAR(50) NOT NULL);'.format(id=ID_FIELD, account=ACCOUNT_ID_FIELD))
        await c.execute('CREATE UNIQUE INDEX dashboards_slug ON dashboards (account, slug);')
        # yes, I know Postgres has arrays - but there is no advantage in using them (instead of comma-separated text) for path_filters, and it makes
        # code more understandable and portable:
        # await c.execute('CREATE TABLE charts ({id}, dashboard INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE, name TEXT NOT NULL);'.format(id=ID_FIELD))
        # await c.execute("CREATE TABLE charts_content ({id}, chart INTEGER NOT NULL REFERENCES charts(id) ON DELETE CASCADE, path_filter TEXT NOT NULL, unit TEXT, metric_prefix TEXT, renaming TEXT NOT NULL DEFAULT '');".format(id=ID_FIELD))

        await c.execute('CREATE TABLE widgets ({id}, dashboard INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE, type VARCHAR(50), title TEXT NOT NULL, content TEXT NOT NULL);'.format(id=ID_FIELD))

async def migration_step_2():
    async with flask.current_app.pool.acquire() as c:
        await c.execute('ALTER TABLE permissions RENAME COLUMN url_prefix TO resource_prefix;')

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

async def migration_step_3():
    async with flask.current_app.pool.acquire() as c:
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
            await c.execute(_construct_plsql_randid_function(table_name))
            await c.execute('ALTER TABLE {table_name} ALTER COLUMN id SET DATA TYPE integer, ALTER COLUMN id SET DEFAULT randid_{table_name}()'.format(table_name=table_name))

async def migration_step_4():
    """ Removes the UNIQUE constraint on accounts.name. We need to identify the constraint first and then remove it. """
    async with flask.current_app.pool.acquire() as c:
        constraint_name, = await c.fetchrow("SELECT conname FROM pg_constraint WHERE conrelid = 'accounts'::regclass AND contype = 'u';")
        await c.execute("ALTER TABLE accounts DROP CONSTRAINT {};".format(constraint_name))

async def migration_step_5():
    """ Bots can be either system-wide or tied to a specific account. """
    async with flask.current_app.pool.acquire() as c:
        ACCOUNT_ID_FIELD_NULLABLE = 'account INTEGER DEFAULT NULL REFERENCES accounts(id) ON DELETE CASCADE'
        await c.execute("ALTER TABLE bots ADD COLUMN {account};".format(account=ACCOUNT_ID_FIELD_NULLABLE))

async def migration_step_6():
    """ Permissions are now always tied to a specific user. """
    async with flask.current_app.pool.acquire() as c:
        await c.execute("ALTER TABLE permissions ALTER COLUMN user_id SET NOT NULL;")

async def migration_step_7():
    """ Try a different way: users and bots may be tied to a set of accounts (users via invites, bots by being created inside the accounts). """
    ID_FIELD = 'id INTEGER NOT NULL PRIMARY KEY DEFAULT randid_{table_name}()'.format(table_name='users_accounts')
    ACCOUNT_ID_FIELD = 'account INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE'
    USER_ID_FIELD = 'user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE'
    async with flask.current_app.pool.acquire() as c:
        await c.execute(_construct_plsql_randid_function('users_accounts'))
        await c.execute('CREATE TABLE users_accounts ({id}, {user_id}, {account});'.format(id=ID_FIELD, user_id=USER_ID_FIELD, account=ACCOUNT_ID_FIELD))
        await c.execute('CREATE UNIQUE INDEX users_accounts_account ON users_accounts (user_id, account);')

        await c.execute("ALTER TABLE bots DROP COLUMN account;")  # no need to convert data, it wasn't used anywhere

async def migration_step_8():
    """ Bots can have their type and configuration saved to DB. """
    async with flask.current_app.pool.acquire() as c:
        await c.execute("ALTER TABLE bots ADD COLUMN bot_type TEXT DEFAULT NULL;")
        await c.execute("ALTER TABLE users_accounts ADD COLUMN config JSON DEFAULT NULL;")

async def migration_step_9():
    """ Add monitored entities (devices, web pages, services,...). """
    ID_FIELD = 'id INTEGER NOT NULL PRIMARY KEY DEFAULT randid_{table_name}()'.format(table_name='entities')
    ACCOUNT_ID_FIELD = 'account INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE'
    async with flask.current_app.pool.acquire() as c:
        await c.execute(_construct_plsql_randid_function('entities'))
        await c.execute('CREATE TABLE entities ({id}, {account}, name TEXT NOT NULL, entity_type TEXT NOT NULL, details JSON NOT NULL);'.format(id=ID_FIELD, account=ACCOUNT_ID_FIELD))
        await c.execute('CREATE UNIQUE INDEX entities_name ON entities (account, name);')

async def migration_step_10():
    """ Add credentials. """
    ID_FIELD = 'id INTEGER NOT NULL PRIMARY KEY DEFAULT randid_{table_name}()'.format(table_name='credentials')
    ACCOUNT_ID_FIELD = 'account INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE'
    async with flask.current_app.pool.acquire() as c:
        await c.execute(_construct_plsql_randid_function('credentials'))
        await c.execute('CREATE TABLE credentials ({id}, {account}, name TEXT NOT NULL, credentials_type TEXT NOT NULL, details JSON NOT NULL);'.format(id=ID_FIELD, account=ACCOUNT_ID_FIELD))
        await c.execute('CREATE UNIQUE INDEX credentials_name ON credentials (account, name);')

async def migration_step_11():
    """ Add sensors, rename *_type fields to protocol. """
    ID_FIELD = 'id INTEGER NOT NULL PRIMARY KEY DEFAULT randid_{table_name}()'.format(table_name='sensors')
    ACCOUNT_ID_FIELD = 'account INTEGER NULL REFERENCES accounts(id) ON DELETE CASCADE'
    async with flask.current_app.pool.acquire() as c:
        await c.execute(_construct_plsql_randid_function('sensors'))
        await c.execute('CREATE TABLE sensors ({id}, {account}, name TEXT NOT NULL, protocol TEXT NOT NULL, details JSON NOT NULL);'.format(id=ID_FIELD, account=ACCOUNT_ID_FIELD))
        await c.execute('CREATE UNIQUE INDEX sensors_name ON sensors (account, name);')

        await c.execute('ALTER TABLE bots RENAME COLUMN bot_type TO protocol;')
        await c.execute('ALTER TABLE credentials RENAME COLUMN credentials_type TO protocol;')

async def migration_step_12():
    """ Tie credentials and sensors to entities. """
    ENTITY_ID_FIELD = 'entity INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE'
    CREDENTIAL_ID_FIELD = 'credential INTEGER NOT NULL REFERENCES credentials(id) ON DELETE CASCADE'
    SENSOR_ID_FIELD = 'sensor INTEGER NOT NULL REFERENCES sensors(id) ON DELETE CASCADE'
    async with flask.current_app.pool.acquire() as c:
        await c.execute('CREATE TABLE entities_sensors ({entity}, {sensor});'.format(entity=ENTITY_ID_FIELD, sensor=SENSOR_ID_FIELD))
        await c.execute('CREATE UNIQUE INDEX entities_sensors_entity_sensor ON entities_sensors (entity, sensor);')
        await c.execute('CREATE TABLE entities_credentials ({entity}, {credential});'.format(entity=ENTITY_ID_FIELD, credential=CREDENTIAL_ID_FIELD))
        # there can be many records with the same entity id, but the referenced credentials must have different protocols
        # until we figure out how to constrain that on DB level (or what a better schema design would be) we will need to
        # be more careful on app level

async def migration_step_13():
    """ Sensors should have a default interval (if they are pull, or NULL if they are push), and it
        should  be possible to override this when selecting a sensor for entity.
    """
    async with flask.current_app.pool.acquire() as c:
        await c.execute('ALTER TABLE sensors ADD COLUMN default_interval INTEGER NULL;')  # NULL: no interval (push), otherwise interval in seconds
        await c.execute('ALTER TABLE entities_sensors ADD COLUMN interval INTEGER NULL;')  # NULL: use sensors::default_interval, otherwise interval in seconds

async def migration_step_14():
    """ SNMP sensors have a field 'output_path' which was treated differently depending on whether SNMP WALK
        was used or not. After this upgrade users are expected to use '{$index}' to explicitly compose the
        output path. This migration fixes old path expressions to prevent any change in behaviour of existing sensors.
    """
    async with flask.current_app.pool.acquire() as c, flask.current_app.pool.acquire() as c2:
        res = await c.fetch("SELECT id, details FROM sensors WHERE protocol = 'snmp';")
        # note: with JSON fields we get the parsed object from SELECTs, but must use a json string with UPDATEs and INSERTs
        for sensor_id, details in res:
            is_snmp_walk_present = any([o['fetch_method'] == 'walk' for o in details['oids']])
            if not is_snmp_walk_present:
                continue  # nothing to do here
            new_details = copy.deepcopy(details)
            new_details['output_path'] = details['output_path'] + '.{$index}'
            await c2.execute("UPDATE sensors SET details = $1 WHERE id = $2;", json.dumps(new_details), sensor_id)

async def migration_step_15():
    """ Bots should save a time of last successful authentication.
    """
    async with flask.current_app.pool.acquire() as c:
        await c.execute('ALTER TABLE bots ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL;')

async def migration_step_16():
    """ Entities can have a specific bot selected for each of the protocols. """
    ENTITY_ID_FIELD = 'entity INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE'
    BOT_ID_FIELD = 'bot INTEGER NOT NULL REFERENCES bots(user_id) ON DELETE CASCADE'
    async with flask.current_app.pool.acquire() as c:
        await c.execute('CREATE TABLE entities_bots ({entity}, {bot});'.format(entity=ENTITY_ID_FIELD, bot=BOT_ID_FIELD))

async def migration_step_17():
    """ Widgets need to remember their position (order) on screen. """
    async with flask.current_app.pool.acquire() as c, flask.current_app.pool.acquire() as c2:
        await c.execute('ALTER TABLE widgets ADD COLUMN position INTEGER DEFAULT NULL;')

        # for every dashboard, update the positions of its widgets so that they are ascending:
        position = 0
        last_dashboard_id = None
        res = await c.fetch('SELECT dashboard, id FROM widgets ORDER BY dashboard ASC, id ASC')
        for dashboard_id, widget_id in res:
            if dashboard_id != last_dashboard_id:
                position = 0
                last_dashboard_id = dashboard_id
            await c2.execute('UPDATE widgets SET position = $1 WHERE id = $2', position, widget_id)
            position += 1

async def migration_step_18():
    """ Widgets' position on screen is more than just sort order - widgets have width/height and x/y position. """
    async with flask.current_app.pool.acquire() as c, flask.current_app.pool.acquire() as c2, flask.current_app.pool.acquire() as c3:
        DEFAULT_HEIGHT = 10
        N_COLUMNS = 12

        await c.execute('ALTER TABLE widgets ADD COLUMN position_x SMALLINT NOT NULL DEFAULT 0;')
        await c.execute('ALTER TABLE widgets ADD COLUMN position_y SMALLINT DEFAULT NULL;')  # we will set it to NOT NULL once we update the values
        await c.execute(f'CREATE DOMAIN WIDGETS_WIDTH AS SMALLINT CHECK (VALUE >= 0 AND VALUE <= {N_COLUMNS});')
        await c.execute(f'ALTER TABLE widgets ADD COLUMN position_w WIDGETS_WIDTH DEFAULT {N_COLUMNS};')
        await c.execute(f'ALTER TABLE widgets ADD COLUMN position_h SMALLINT DEFAULT {DEFAULT_HEIGHT};')

        res = await c.fetch('SELECT DISTINCT(dashboard) FROM widgets;')
        for dashboard_id, in res:
            position_y = 0
            res2 = await c2.fetch('SELECT id FROM widgets WHERE dashboard = $1 ORDER BY position;', dashboard_id)
            for widget_id, in res2:
                await c3.execute('UPDATE widgets SET position_y = $1 WHERE id = $2', position_y, widget_id)
                position_y += DEFAULT_HEIGHT

        await c.execute('ALTER TABLE widgets ALTER COLUMN position_y SET NOT NULL;')
        await c.execute('ALTER TABLE widgets DROP COLUMN position;')

async def migration_step_19():
    """ Widgets need to remember the dashboard page they are on. """
    async with flask.current_app.pool.acquire() as c:
        await c.execute("ALTER TABLE widgets ADD COLUMN position_p VARCHAR(20) NOT NULL DEFAULT 'default';")

async def migration_step_20():
    """ No need to aggregate values, we use indexes on values instead. """
    async with flask.current_app.pool.acquire() as c:

        # We try to create indexes, but if we fail, user can create them manually and we need to be able to skip this step entirely:
        #   CREATE INDEX CONCURRENTLY aggregations_path_aggr0_value ON measurements (path, FLOOR(ts / 3600), value);
        #   CREATE INDEX CONCURRENTLY aggregations_path_aggr1_value ON measurements (path, FLOOR(ts / 10800), value);
        #   CREATE INDEX CONCURRENTLY aggregations_path_aggr2_value ON measurements (path, FLOOR(ts / 32400), value);
        #   CREATE INDEX CONCURRENTLY aggregations_path_aggr3_value ON measurements (path, FLOOR(ts / 97200), value);
        #   CREATE INDEX CONCURRENTLY aggregations_path_aggr4_value ON measurements (path, FLOOR(ts / 291600), value);
        #   CREATE INDEX CONCURRENTLY aggregations_path_aggr5_value ON measurements (path, FLOOR(ts / 874800), value);
        #   CREATE INDEX CONCURRENTLY aggregations_path_aggr6_value ON measurements (path, FLOOR(ts / 2624400), value);

        await c.execute("DROP TABLE IF EXISTS aggregations;")
        await c.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS aggregations_path_aggr0_value ON measurements (path, FLOOR(ts / {3600 * (3**0)}), value);")
        await c.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS aggregations_path_aggr1_value ON measurements (path, FLOOR(ts / {3600 * (3**1)}), value);")
        await c.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS aggregations_path_aggr2_value ON measurements (path, FLOOR(ts / {3600 * (3**2)}), value);")
        await c.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS aggregations_path_aggr3_value ON measurements (path, FLOOR(ts / {3600 * (3**3)}), value);")
        await c.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS aggregations_path_aggr4_value ON measurements (path, FLOOR(ts / {3600 * (3**4)}), value);")
        await c.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS aggregations_path_aggr5_value ON measurements (path, FLOOR(ts / {3600 * (3**5)}), value);")
        await c.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS aggregations_path_aggr6_value ON measurements (path, FLOOR(ts / {3600 * (3**6)}), value);")

async def migration_step_21():
    """ Index for regex searching on paths. """
    async with flask.current_app.pool.acquire() as c:
        await c.execute("CREATE EXTENSION IF NOT EXISTS PG_TRGM;")
        await c.execute("CREATE INDEX IF NOT EXISTS paths_path_idx ON paths USING GIN (path GIN_TRGM_OPS);")

async def migration_step_22():
    """ Allow entities to have parent-child relations (device -> interfaces). """
    async with flask.current_app.pool.acquire() as c:
        await c.execute("ALTER TABLE entities ADD COLUMN parent INTEGER DEFAULT NULL REFERENCES entities(id) ON DELETE CASCADE")

async def migration_step_23():
    """ Entities might no longer have a unique name. """
    async with flask.current_app.pool.acquire() as c:
        await c.execute('DROP INDEX IF EXISTS entities_name;')

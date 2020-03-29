from collections import namedtuple
import json
import os
import re
import sys

import pytest

# since we are running our own environment for testing (use `docker-compose up -d` and
# `docker-compose down`), we need to setup env vars accordingly:
os.environ['DB_HOST'] = 'localhost'  # we expose to port 5432 on host (== localhost)
os.environ['DB_DATABASE'] = 'pytest'
os.environ['DB_USERNAME'] = 'pytest'
os.environ['DB_PASSWORD'] = 'pytest'
os.environ['MQTT_HOSTNAME'] = 'localhost'
os.environ['MQTT_PORT'] = '1883'

VALID_FRONTEND_ORIGINS = [
    'https://example.org:1234',
    'http://localhost:3000',
    'http://LOCALHOST:2000',
]
VALID_FRONTEND_ORIGINS_LOWERCASED = [x.lower() for x in VALID_FRONTEND_ORIGINS]
os.environ['GRAFOLEAN_CORS_DOMAINS'] = ",".join(VALID_FRONTEND_ORIGINS)


sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from grafolean import app
from api.common import SuperuserJWTToken
from utils import db, migrate_if_needed, log
from auth import JWT
from datatypes import clear_all_lru_cache


USERNAME_ADMIN = 'admin'
PASSWORD_ADMIN = 'asdf123'
USERNAME_USER1 = 'user1'
PASSWORD_USER1 = '321abc'
FIRST_ACCOUNT_NAME = 'First account'
BOT_NAME1 = 'My Bot 1'


def delete_all_from_db():
    # initialize DB:
    with db.cursor() as c:
        c.execute("SELECT tablename, schemaname FROM pg_tables WHERE schemaname = 'public';")
        results = list(c)
        log.info(results)
        for tablename,_ in results:
            sql = "DROP TABLE IF EXISTS {} CASCADE;".format(tablename)
            log.info(sql)
            c.execute(sql)
        for sql in [
            "DROP DOMAIN IF EXISTS AGGR_LEVEL;",
            "DROP TYPE IF EXISTS HTTP_METHOD;",
            "DROP TYPE IF EXISTS USER_TYPE;",
            "DROP TYPE IF EXISTS WIDGETS_WIDTH;",
        ]:
            log.info(sql)
            c.execute(sql)
    # don't forget to clear memoization cache:
    clear_all_lru_cache()
    SuperuserJWTToken.clear_cache()


@pytest.fixture
def app_client():
    delete_all_from_db()
    migrate_if_needed()
    app.testing = True
    return app.test_client()

@pytest.fixture
def app_client_db_not_migrated():
    delete_all_from_db()
    app.testing = True
    return app.test_client()

@pytest.fixture
def superuser_jwt_token():
    return SuperuserJWTToken.get_valid_token('pytest')

@pytest.fixture
async def first_admin_id(app_client):
    data = { 'name': 'First User - Admin', 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN, 'email': 'admin@grafolean.com' }
    r = await app_client.post('/api/admin/first', json=data)
    assert r.status_code == 201
    admin_id = json.loads(await r.get_data())['id']
    return int(admin_id)

@pytest.fixture
async def admin_authorization_header(app_client, first_admin_id):
    data = { 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN }
    r = await app_client.post('/api/auth/login', json=data)
    assert r.status_code == 200
    auth_header = dict(r.headers).get('X-JWT-Token', None)
    assert re.match(r'^Bearer [0-9]+[:].+$', auth_header)
    return auth_header

@pytest.fixture
def account_id_factory(app_client, admin_authorization_header):
    """
        Usage:
            def test_123(account_id_factory):
                acc1, acc2 = await account_id_factory("First account", "Second account")
                ...
        Idea comes from: https://github.com/pytest-dev/pytest/issues/2703#issue-251382665
        However, we needed to get rid of generators for async.
    """
    async def gen(*account_names):
        result = []
        for account_name in account_names:
            data = { 'name': account_name }
            r = await app_client.post('/api/admin/accounts', json=data, headers={'Authorization': admin_authorization_header})
            assert r.status_code == 201
            account_id = json.loads(await r.get_data())['id']
            result.append(account_id)
        return result
    return gen

@pytest.fixture
async def account_id(app_client, account_id_factory):
    """
        Generate just a single account_id (because this is what we want in most of the tests).
    """
    account_id, = await account_id_factory(FIRST_ACCOUNT_NAME)
    return account_id

@pytest.fixture
async def bot_factory(app_client, admin_authorization_header):
    """
        Generate a bot with the specified name and protocol, return its id (user_id) and token.
    """
    async def gen(name, protocol):
        data = { 'name': name, 'protocol': protocol }
        r = await app_client.post('/api/bots', json=data, headers={'Authorization': admin_authorization_header})
        assert r.status_code == 201, r.data
        j = json.loads(await r.get_data())
        bot_id = j['id']
        r = await app_client.get('/api/bots/{}/token'.format(bot_id), headers={'Authorization': admin_authorization_header})
        assert r.status_code == 200, r.data
        j = json.loads(await r.get_data())
        bot_token = j['token']
        return bot_id, bot_token
    return gen

@pytest.fixture
async def bot_data(bot_factory):
    user_id, bot_token = bot_factory('Bot 1', None)
    return {'id': user_id, 'token': bot_token}

@pytest.fixture
async def bot_id(bot_data):
    return bot_data['id']

@pytest.fixture
async def bot_token(bot_data):
    return bot_data['token']

@pytest.fixture
async def account_credentials_factory(app_client, admin_authorization_header, account_id):
    async def gen(*credential_data):
        for protocol, name in credential_data:
            data = { 'name': name, 'protocol': protocol, 'details': {} }
            r = await app_client.post('/api/accounts/{}/credentials'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
            assert r.status_code == 201
            credential_id = json.loads(await r.get_data())['id']
            yield credential_id
    yield gen

@pytest.fixture
async def account_sensors_factory(app_client, admin_authorization_header, account_id):
    async def gen(*sensor_data):
        for protocol, name, interval in sensor_data:
            data = { 'name': name, 'protocol': protocol, 'default_interval': interval, 'details': {} }
            r = await app_client.post('/api/accounts/{}/sensors'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
            assert r.status_code == 201
            sensor_id = json.loads(await r.get_data())['id']
            yield sensor_id
    yield gen

@pytest.fixture
async def person_id(app_client, admin_authorization_header):
    data = { 'name': 'User 1', 'username': USERNAME_USER1, 'password': PASSWORD_USER1, 'email': 'user1@grafolean.com' }
    r = await app_client.post('/api/persons', json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201
    user_id = json.loads(await r.get_data())['id']
    return user_id

@pytest.fixture
async def person_authorization_header(app_client, admin_authorization_header, person_id):
    data = { 'username': USERNAME_USER1, 'password': PASSWORD_USER1 }
    r = await app_client.post('/api/auth/login', json=data)
    assert r.status_code == 200
    auth_header = dict(r.headers).get('X-JWT-Token', None)
    assert re.match(r'^Bearer [0-9]+[:].+$', auth_header)
    return auth_header

@pytest.fixture
def mqtt_client_factory():
    """
        Factory fixture for generating mqtt clients, based on jwt connection tokens.
    """
    mqtt_clients = []
    def gen(*jwt_tokens):
        for i, jwt_token in enumerate(jwt_tokens):
            finished_connecting = False
            def on_connect(client, userdata, flags, rc):
                nonlocal finished_connecting
                finished_connecting = True
                assert rc == 0

            mqtt_client = paho.Client("pytest-{}".format(i))
            mqtt_client.username_pw_set(jwt_token, password='not.used')
            mqtt_client.on_connect = on_connect
            mqtt_client.connect(os.environ.get('MQTT_HOSTNAME'), port=int(os.environ.get('MQTT_PORT')))
            mqtt_client.loop_start()
            # wait until connect finishes:
            for _ in range(30):
                if finished_connecting == True:
                    break
                time.sleep(0.1)
            assert finished_connecting == True

            yield mqtt_client
            mqtt_clients.append(mqtt_client)

    yield gen

    # cleanup:
    for mqtt_client in mqtt_clients:
        mqtt_client.disconnect()
        mqtt_client.loop_stop()


MqttMessage = namedtuple('MqttMessage', 'topic payload')

from collections import namedtuple
import json
import multiprocessing
import os
import pytest
import re
import time

import paho.mqtt.client as paho


# since we are running our own environment for testing (use `docker-compose up -d` and
# `docker-compose down`), we need to setup env vars accordingly:
os.environ['DB_HOST'] = 'localhost'  # we expose to port 5432 on host (== localhost)
os.environ['DB_DATABASE'] = 'pytest'
os.environ['DB_USERNAME'] = 'pytest'
os.environ['DB_PASSWORD'] = 'pytest'
os.environ['MQTT_HOSTNAME'] = 'localhost'
os.environ['MQTT_PORT'] = '1883'

# we need to setup this env var before importing `app` so we can later test CORS headers:
VALID_FRONTEND_ORIGINS = [
    'https://example.org:1234',
    'http://localhost:3000',
    'http://LOCALHOST:2000',
]
VALID_FRONTEND_ORIGINS_LOWERCASED = [x.lower() for x in VALID_FRONTEND_ORIGINS]
os.environ['GRAFOLEAN_CORS_DOMAINS'] = ",".join(VALID_FRONTEND_ORIGINS)


from grafolean import app
from api.common import SuperuserJWTToken
from utils import db, migrate_if_needed, log
from auth import JWT
from datatypes import clear_all_lru_cache


USERNAME_ADMIN = 'admin'
PASSWORD_ADMIN = 'asdf123'
EMAIL_ADMIN = 'admin@grafolean.com'
USERNAME_USER1 = 'user1'
PASSWORD_USER1 = '321abc'
EMAIL_USER1 = 'user1@grafolean.com'
FIRST_ACCOUNT_NAME = 'First account'
BOT_NAME1 = 'My Bot 1'


def _delete_all_from_db():
    # initialize DB:
    with db.cursor() as c:
        for aggr_level in range(0, 7):
            c.execute(f'DROP VIEW IF EXISTS measurements_aggr_{aggr_level} CASCADE')
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
    _delete_all_from_db()
    migrate_if_needed()
    app.testing = True
    app.config.update(
        MAIL_SERVER = 'smtp.grafolean.com',
        MAIL_PORT = 587,
        MAIL_USE_TLS = True,
        MAIL_USERNAME = 'noreply@grafolean.com',
        MAIL_PASSWORD = '',
        TESTING = True,
    )
    return app.test_client()


@pytest.fixture
def app_client_db_not_migrated():
    _delete_all_from_db()
    app.testing = True
    return app.test_client()


@pytest.fixture
def first_admin_id(app_client):
    data = { 'name': 'First User - Admin', 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN, 'email': EMAIL_ADMIN }
    r = app_client.post('/api/admin/first', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 201
    admin_id = json.loads(r.data.decode('utf-8'))['id']
    return int(admin_id)


@pytest.fixture
def admin_authorization_header(app_client, first_admin_id):
    data = { 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN }
    r = app_client.post('/api/auth/login', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 200
    auth_header = dict(r.headers).get('X-JWT-Token', None)
    assert re.match(r'^Bearer [0-9]+[:].+$', auth_header)
    return auth_header


@pytest.fixture
def account_id_factory(app_client, admin_authorization_header):
    """
        Usage:
            def test_123(account_id_factory):
                acc1, acc2 = account_id_factory("First account", "Second account")
                ...
        https://github.com/pytest-dev/pytest/issues/2703#issue-251382665
    """
    def gen(*account_names):
        for account_name in account_names:
            data = { 'name': account_name }
            r = app_client.post('/api/admin/accounts', data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
            assert r.status_code == 201
            account_id = json.loads(r.data.decode('utf-8'))['id']
            yield account_id
    yield gen


@pytest.fixture
def account_id(account_id_factory):
    """
        Generate just a single account_id (because this is what we want in most of the tests).
    """
    account_id, = account_id_factory(FIRST_ACCOUNT_NAME)
    return account_id


@pytest.fixture
def bot_factory(app_client, admin_authorization_header):
    """
        Generate a bot with the specified name and protocol, return its id (user_id) and token.
    """
    def gen(name, protocol):
        data = { 'name': name, 'protocol': protocol }
        r = app_client.post('/api/bots', data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
        assert r.status_code == 201, r.data
        j = json.loads(r.data.decode('utf-8'))
        bot_id = j['id']
        r = app_client.get('/api/bots/{}/token'.format(bot_id), headers={'Authorization': admin_authorization_header})
        assert r.status_code == 200, r.data
        j = json.loads(r.data.decode('utf-8'))
        bot_token = j['token']
        return bot_id, bot_token
    return gen


@pytest.fixture
def bot_data(bot_factory):
    user_id, bot_token = bot_factory('Bot 1', None)
    return {'id': user_id, 'token': bot_token}


@pytest.fixture
def bot_id(bot_data):
    return bot_data['id']


@pytest.fixture
def bot_token(bot_data):
    return bot_data['token']


@pytest.fixture
def account_credentials_factory(app_client, admin_authorization_header, account_id):
    def gen(*credential_data):
        for protocol, name in credential_data:
            data = { 'name': name, 'protocol': protocol, 'details': {} }
            r = app_client.post('/api/accounts/{}/credentials'.format(account_id), data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
            assert r.status_code == 201
            credential_id = json.loads(r.data.decode('utf-8'))['id']
            yield credential_id
    yield gen


@pytest.fixture
def account_sensors_factory(app_client, admin_authorization_header, account_id):
    def gen(*sensor_data):
        for protocol, name, interval in sensor_data:
            data = { 'name': name, 'protocol': protocol, 'default_interval': interval, 'details': {} }
            r = app_client.post('/api/accounts/{}/sensors'.format(account_id), data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
            assert r.status_code == 201
            sensor_id = json.loads(r.data.decode('utf-8'))['id']
            yield sensor_id
    yield gen


@pytest.fixture
def person_id(app_client, admin_authorization_header):
    data = { 'name': 'User 1', 'username': USERNAME_USER1, 'password': PASSWORD_USER1, 'email': EMAIL_USER1 }
    r = app_client.post('/api/persons', data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201
    user_id = json.loads(r.data.decode('utf-8'))['id']
    return user_id


@pytest.fixture
def person_authorization_header(app_client, admin_authorization_header, person_id):
    data = { 'username': USERNAME_USER1, 'password': PASSWORD_USER1 }
    r = app_client.post('/api/auth/login', data=json.dumps(data), content_type='application/json')
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


@pytest.fixture
def mqtt_message_queue_factory(app_client, mqtt_client_factory):
    queues = []
    def gen(*subscription_info):
        jwt_tokens = [si[0] for si in subscription_info]
        topics = [si[1] for si in subscription_info]
        mqtt_clients = list(mqtt_client_factory(*jwt_tokens))
        queues = [multiprocessing.Queue() for _ in mqtt_clients]
        for i, mqtt_client in enumerate(mqtt_clients):
            # we must use closure here so that `on_message` has access to the correct queue:
            def on_message_closure(q):
                def on_message(client, userdata, message):
                    try:
                        m = MqttMessage(message.topic, message.payload)
                        q.put(m)
                    except:
                        log.exception("Error putting mqtt message to queue!")
                return on_message

            subscribed = False
            def on_subscribe(client, userdata, mid, granted_qos):
                nonlocal subscribed
                subscribed = True

            mqtt_client.on_message = on_message_closure(queues[i])
            mqtt_client.on_subscribe = on_subscribe
            mqtt_client.subscribe(topics[i])
            for _ in range(30):
                if subscribed == True:
                    break
                time.sleep(0.1)
            assert subscribed == True
            yield queues[i]

    yield gen
    for q in queues:
        q.close()
        q.join_thread()


@pytest.fixture
def mqtt_messages(app_client, mqtt_message_queue_factory):
    # a shorthand if you only need to listen to mqtt queue, on all messages, as superuser:
    superuser_jwt_token = SuperuserJWTToken.get_valid_token('pytest')
    message_queue, = mqtt_message_queue_factory((superuser_jwt_token, '#'))
    return message_queue


def mqtt_wait_for_message(message_queue, topics, timeout=2):
    while True:
        message = message_queue.get(timeout=timeout)
        if message.topic in topics:
            return message
        else:
            continue
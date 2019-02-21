#!/usr/bin/python3
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from collections import namedtuple
import json
import multiprocessing
import paho.mqtt.client as paho
import pytest
from pprint import pprint
import time

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

from grafolean import app, AdminJWTToken
from utils import db, migrate_if_needed, log
from auth import JWT
from datatypes import clear_all_lru_cache


USERNAME_ADMIN = 'admin'
PASSWORD_ADMIN = 'asdf123'
USERNAME_USER1 = 'user1'
PASSWORD_USER1 = '321abc'
EXPECTED_FIRST_ADMIN_ID = 1
EXPECTED_BOT_ID = 2


def _delete_all_from_db():
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
        ]:
            log.info(sql)
            c.execute(sql)
    # don't forget to clear memoization cache:
    clear_all_lru_cache()
    AdminJWTToken.clear_cache()

def setup_module():
    pass

def teardown_module():
    _delete_all_from_db()

@pytest.fixture
def app_client():
    _delete_all_from_db()
    migrate_if_needed()
    app.testing = True
    return app.test_client()

@pytest.fixture
def app_client_db_not_migrated():
    _delete_all_from_db()
    app.testing = True
    return app.test_client()

@pytest.fixture
def first_admin_exists(app_client):
    data = { 'name': 'First User - Admin', 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN, 'email': 'admin@example.com' }
    r = app_client.post('/api/admin/first', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 201
    admin_id = json.loads(r.data.decode('utf-8'))['id']
    assert int(admin_id) == EXPECTED_FIRST_ADMIN_ID
    return True

@pytest.fixture
def admin_authorization_header(app_client, first_admin_exists):
    data = { 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN }
    r = app_client.post('/api/auth/login', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 200
    auth_header = dict(r.headers).get('X-JWT-Token', None)
    assert auth_header[:9] == 'Bearer 1:'
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
    account_id, = account_id_factory('First account')
    return account_id

@pytest.fixture
def bot_token(app_client, admin_authorization_header):
    data = { 'name': 'Bot 1' }
    r = app_client.post('/api/admin/bots', data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201
    j = json.loads(r.data.decode('utf-8'))
    assert j['id'] == EXPECTED_BOT_ID
    return j['token']

@pytest.fixture
def person_id(app_client, admin_authorization_header):
    data = { 'name': 'User 1', 'username': USERNAME_USER1, 'password': PASSWORD_USER1, 'email': 'user1@example.com' }
    r = app_client.post('/api/admin/persons', data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201
    user_id = json.loads(r.data.decode('utf-8'))['id']
    return user_id

@pytest.fixture
def person_authorization_header(app_client, admin_authorization_header, person_id):
    data = { 'username': USERNAME_USER1, 'password': PASSWORD_USER1 }
    r = app_client.post('/api/auth/login', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 200
    auth_header = dict(r.headers).get('X-JWT-Token', None)
    assert auth_header[:9] == 'Bearer 1:'
    return auth_header

MqttMessage = namedtuple('MqttMessage', 'topic payload')
@pytest.fixture
def mqtt_messages(app_client):
    # this fixture allows us to listen for mqtt messages and assert that they are being published properly:
    received_messages = multiprocessing.Queue()
    def on_message(client, userdata, message):
        print("Pytest received MQTT message: {}".format(message))
        nonlocal received_messages
        received_messages.put(MqttMessage(message.topic, message.payload))

    finished_connecting = False
    connected = False
    def on_connect(client, userdata, flags, rc):
        nonlocal finished_connecting
        nonlocal connected
        finished_connecting = True
        if rc == 0:
            connected = True
            print("Pytest connected to broker")
        else:
            print("Pytest mqtt connection failed")

    mqtt_client = paho.Client("pytest")
    admin_jwt_token = AdminJWTToken.get_valid_token('pytest')
    mqtt_client.username_pw_set(admin_jwt_token, password='not.used')
    mqtt_client.on_message = on_message
    mqtt_client.on_connect = on_connect
    mqtt_client.connect(os.environ.get('MQTT_HOSTNAME'), port=int(os.environ.get('MQTT_PORT')))
    mqtt_client.loop_start()
    # wait until connect finishes:
    for _ in range(100):
        if finished_connecting == True:
            break
        time.sleep(0.1)
    assert connected == True

    mqtt_client.subscribe('#')

    yield received_messages

    # cleanup:
    mqtt_client.disconnect()
    mqtt_client.loop_stop()

###################################################

def test_values_put_get_simple(app_client, admin_authorization_header, account_id):
    """
        Put a value, get a value.
    """
    data = [{'p': 'qqqq.wwww', 't': 1234567890.123456, 'v': 111.22}]
    r = app_client.put('/api/accounts/{}/values/'.format(account_id), data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    r = app_client.get('/api/accounts/{}/values/?p=qqqq.wwww&t0=1234567890&t1=1234567891&a=no'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        'paths': {
            'qqqq.wwww': {
                'next_data_point': None,
                'data': [
                    {'t': 1234567890.123456, 'v': 111.22 }
                ]
            }
        }
    }
    actual = json.loads(r.data.decode('utf-8'))
    assert expected == actual
    # remove entry: !!! not implemented
    # r = app_client.delete('/api/accounts/{}/values/?p=qqqq.wwww&t0=1234567890&t1=1234567891'.format(account_id), headers={'Authorization': admin_authorization_header})
    # assert r.status_code == 200

def test_values_put_get_none(app_client, admin_authorization_header, account_id):
    """
        Put a None instead of a value, make sure it is rejected.
    """
    data = [{'p': 'qqqq.wwww', 't': 1234567890.123456, 'v': None}]
    r = app_client.put('/api/accounts/{}/values/'.format(account_id), data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 400

@pytest.mark.parametrize("value_str,value_float", [
    ['0.000701', 0.000701],
    ['7.01e-04', 0.000701],
    ['7.01e-4', 0.000701],
    ['"0.000701"', 0.000701],
    ['"7.01e-04"', 0.000701],
    ['0.0007010001234567', 0.0007010001234567],
    ['0.0000701', 0.0000701],
])
def test_values_put_get_all_formats(app_client, admin_authorization_header, account_id, value_str, value_float):
    """
        Put a value, get a value. This time as scientific notation and as string.
    """
    json_body = '[{{ "p": "qqqq.wwww", "t": 1234567890.123456, "v": {} }}]'.format(value_str)
    r = app_client.put('/api/accounts/{}/values/'.format(account_id), data=json_body, content_type='application/json', headers={'Authorization': admin_authorization_header})
    print(r.data.decode('utf-8'))
    assert r.status_code == 200
    r = app_client.get('/api/accounts/{}/values/?p=qqqq.wwww&t0=1234567890&t1=1234567891&a=no'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        'paths': {
            'qqqq.wwww': {
                'next_data_point': None,
                'data': [
                    {'t': 1234567890.123456, 'v': value_float }
                ]
            }
        }
    }
    actual = json.loads(r.data.decode('utf-8'))
    assert expected == actual

def test_values_put_get_noaggrparam_redirect(app_client, admin_authorization_header, account_id):
    """
        Try to get values without aggr param, get redirected.
    """
    t_from = 1330000000
    t_to = 1330000000 + 100*15*60 + 1
    url = '/api/accounts/{}/values/?p=aaaa.bbbb&t0={}&t1={}&max=10'.format(account_id, t_from, t_to)
    r = app_client.get(url, headers={'Authorization': admin_authorization_header})

    assert r.status_code == 301

    redirect_location = None
    for header, value in r.headers:
        if header == 'Location':
            redirect_location = value
    assert redirect_location[-len(url)-5:] == url + '&a=no'

def test_values_put_get_sort_limit(app_client, admin_authorization_header, account_id):
    """
        Try to get values without aggr param, get redirected.
    """
    TEST_PATH = 'test.values.put.few.sort.limit'
    data = [
        {'p': TEST_PATH, 't': 1330002000 + 160, 'v': 100},
        {'p': TEST_PATH, 't': 1330002000 + 360, 'v': 120},
        {'p': TEST_PATH, 't': 1330002000 + 560, 'v': 140},
        {'p': TEST_PATH, 't': 1330002000 + 760, 'v': 160},
    ]
    app_client.put('/api/accounts/{}/values/'.format(account_id), data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})

    url = '/api/accounts/{}/values/?p={}&a=no&sort=desc&limit=2'.format(account_id, TEST_PATH)
    r = app_client.get(url, headers={'Authorization': admin_authorization_header})

    expected = {
        'paths': {
            TEST_PATH: {
                'next_data_point': 1330002000 + 360,
                'data': [
                    {'t': 1330002000.0 + 760.0, 'v': 160},
                    {'t': 1330002000.0 + 560.0, 'v': 140},
                ],
            },
        },
    }

    assert r.status_code == 200
    actual = json.loads(r.data.decode('utf-8'))
    #pprint(actual)
    assert expected == actual

def test_values_put_few_get_aggr(app_client, admin_authorization_header, account_id):
    """
        Put a few values, get aggregated value.
    """
    TEST_PATH = 'test.values.put.few.get.aggr'
    data = [
        {'p': TEST_PATH, 't': 1330002000 + 160, 'v': 100},
        {'p': TEST_PATH, 't': 1330002000 + 360, 'v': 120},
        {'p': TEST_PATH, 't': 1330002000 + 560, 'v': 140},
        {'p': TEST_PATH, 't': 1330002000 + 760, 'v': 160},
    ]

    app_client.put('/api/accounts/{}/values/'.format(account_id), data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
    t_from = 1330002000  # aggr level 0 - every 1 hour
    t_to = t_from + 1*3600
    url = '/api/accounts/{}/values/?p={}&t0={}&t1={}&a=0'.format(account_id, TEST_PATH, t_from, t_to)
    r = app_client.get(url, headers={'Authorization': admin_authorization_header})

    expected = {
        'paths': {
            TEST_PATH: {
                'next_data_point': None,
                'data': [
                    {'t': 1330002000.0 + 1800.0, 'v': 130.0, 'minv': 100., 'maxv': 160. },
                ],
            },
        },
    }

    assert r.status_code == 200
    actual = json.loads(r.data.decode('utf-8'))
    # pprint(actual)
    assert expected == actual

#@pytest.mark.skip(reason="removing aggregated data is not implemented, so this test fails when repeated! Otherwise it works with fresh DB.")
def test_values_put_many_get_aggr(app_client, admin_authorization_header, account_id):
    """
        Put many values, get aggregated value. Delete path and values.
    """
    try:
        TEST_PATH = 'test.values.put.many.get.aggr'
        t_from = 1330000000 - 1330000000 % (27*3600)  # aggr level 3 - every 3 hours
        t_to = t_from + 27 * 3600
        data = [{'p': TEST_PATH, 't': t_from + 1 + i*5, 'v': 111 + i} for i in range(0, 100)]
        #pprint(data)
        #import pprint
        #pprint.pprint(data)
        # expected = {'aggregation_level': 1, 'data': {'aaaa.bbbb': [
        #     {'t': 1234567890.123456, 'v': 111.22}
        # ]}}

        app_client.put('/api/accounts/{}/values/'.format(account_id), data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
        #print(t_from, t_to)
        url = '/api/accounts/{}/values/?p={}&t0={}&t1={}&max=10&a=3'.format(account_id, TEST_PATH, t_from, t_to)
        r = app_client.get(url, headers={'Authorization': admin_authorization_header})

        expected = {
            'paths': {
                TEST_PATH: {
                    'next_data_point': None,
                    'data': [
                        {'t': t_from + 27 * 3600. / 2., 'v': 111. + (99. / 2.), 'minv': 111., 'maxv': 111. + 99. }
                    ]
                }
            }
        }

        assert r.status_code == 200
        actual = json.loads(r.data.decode('utf-8'))
        #pprint(actual)
        assert expected == actual
    finally:
        r = app_client.delete('/api/accounts/{}/paths/?p={}'.format(account_id, TEST_PATH), headers={'Authorization': admin_authorization_header})
        assert r.status_code == 200

def test_paths_delete_need_auth(app_client, admin_authorization_header, account_id):
    TEST_PATH = 'test.values.put.many.get.aggr'
    r = app_client.delete('/api/accounts/{}/paths/?p={}'.format(account_id, TEST_PATH))
    assert r.status_code == 401
    r = app_client.delete('/api/accounts/{}/paths/?p={}'.format(account_id, TEST_PATH), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 404  # because path is not found, of course

def test_dashboards_widgets_post_get(app_client, admin_authorization_header, account_id, mqtt_messages):
    """
        Create a dashboard, get a dashboard, create a widget, get a widget. Delete the dashboard, get 404.
    """
    DASHBOARD = 'dashboard1'
    try:
        assert mqtt_messages.empty()

        WIDGET = 'chart1'
        data = {'name': DASHBOARD + ' name', 'slug': DASHBOARD}
        r = app_client.post('/api/accounts/{}/dashboards/'.format(account_id), data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
        assert r.status_code == 201
        # check mqtt messages:
        mqtt_message = mqtt_messages.get(timeout=10.0)
        assert mqtt_message.topic == 'changed/accounts/{}/dashboards'.format(account_id)
        assert mqtt_messages.empty()

        r = app_client.get('/api/accounts/{}/dashboards/{}'.format(account_id, DASHBOARD), headers={'Authorization': admin_authorization_header})
        expected = {
            'name': DASHBOARD + ' name',
            'slug': DASHBOARD,
            'widgets': [],
        }
        actual = json.loads(r.data.decode('utf-8'))
        assert expected == actual

        # create widget:
        widget_post_data = {
            'type': 'chart',
            'title': WIDGET + ' name',
            'content': json.dumps([
                {
                    'path_filter': 'do.not.match.*',
                    'renaming': 'to.rename',
                    'unit': 'µ',
                    'metric_prefix': 'm',
                }
            ])
        }
        r = app_client.post('/api/accounts/{}/dashboards/{}/widgets/'.format(account_id, DASHBOARD), data=json.dumps(widget_post_data), content_type='application/json', headers={'Authorization': admin_authorization_header})
        assert r.status_code == 201
        widget_id = json.loads(r.data.decode('utf-8'))['id']

        r = app_client.get('/api/accounts/{}/dashboards/{}/widgets/'.format(account_id, DASHBOARD), headers={'Authorization': admin_authorization_header})
        actual = json.loads(r.data.decode('utf-8'))
        widget_post_data['id'] = widget_id
        expected = {
            'list': [
                widget_post_data,
            ]
        }
        assert r.status_code == 200
        assert expected == actual

        # update widget:
        widget_post_data = {
            'type': 'chart',
            'title': WIDGET + ' name2',
            'content': json.dumps([
                {
                    'path_filter': 'do.not.match2.*',
                    'renaming': 'to.rename2',
                    'unit': 'µ2',
                    'metric_prefix': '',
                }
            ])
        }
        r = app_client.put('/api/accounts/{}/dashboards/{}/widgets/{}'.format(account_id, DASHBOARD, widget_id), data=json.dumps(widget_post_data), content_type='application/json', headers={'Authorization': admin_authorization_header})
        assert r.status_code == 204

        # make sure it was updated:
        r = app_client.get('/api/accounts/{}/dashboards/{}/widgets/'.format(account_id, DASHBOARD), headers={'Authorization': admin_authorization_header})
        actual = json.loads(r.data.decode('utf-8'))
        widget_post_data['id'] = widget_id
        expected = {
            'list': [
                widget_post_data,
            ]
        }
        assert r.status_code == 200
        assert expected == actual

        # get a single widget:
        r = app_client.get('/api/accounts/{}/dashboards/{}/widgets/{}/'.format(account_id, DASHBOARD, widget_id), headers={'Authorization': admin_authorization_header})
        actual = json.loads(r.data.decode('utf-8'))
        expected = widget_post_data
        assert r.status_code == 200
        assert expected == actual

        # delete dashboard:
        r = app_client.delete('/api/accounts/{}/dashboards/{}'.format(account_id, DASHBOARD), headers={'Authorization': admin_authorization_header})
        assert r.status_code == 200
        r = app_client.get('/api/accounts/{}/dashboards/{}'.format(account_id, DASHBOARD), headers={'Authorization': admin_authorization_header})
        assert r.status_code == 404

    except:
        # if something went wrong, delete dashboard so the next run can succeed:
        app_client.delete('/api/accounts/{}/dashboards/{}'.format(account_id, DASHBOARD))
        raise

def test_values_put_paths_get(app_client, admin_authorization_header, account_id):
    """
        Put values, get paths.
    """
    PATH = 'test.values.put.paths.get.aaaa.bbbb.cccc'
    data = [{'p': PATH, 't': 1234567890.123456, 'v': 111.22}]
    r = app_client.put('/api/accounts/{}/values/'.format(account_id), data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200

    r = app_client.get('/api/accounts/{}/paths/?filter=test.values.put.paths.get.*'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        'paths': {
            'test.values.put.paths.get.*': [
                PATH,
            ],
        },
        'limit_reached': False,
    }
    actual = json.loads(r.data.decode('utf-8'))
    assert expected == actual

    r = app_client.get('/api/accounts/{}/paths/?filter=test.*&failover_trailing=false'.format(account_id), headers={'Authorization': admin_authorization_header})
    actual = json.loads(r.data.decode('utf-8'))
    assert PATH in actual['paths']['test.*']

    r = app_client.get('/api/accounts/{}/paths/?filter=test.&failover_trailing=false'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 400
    r = app_client.get('/api/accounts/{}/paths/?filter=test.'.format(account_id), headers={'Authorization': admin_authorization_header})  # same - failover_trailing=false is default option
    assert r.status_code == 400

    for prefix in ['t', 'te', 'tes', 'test', 'test.', 'test.v']:
        r = app_client.get('/api/accounts/{}/paths/?filter={}&failover_trailing=true'.format(account_id, prefix), headers={'Authorization': admin_authorization_header})
        actual = json.loads(r.data.decode('utf-8'))
        assert actual['paths'] == {}
        assert PATH in actual['paths_with_trailing'][prefix]
        for path in actual['paths_with_trailing'][prefix]:
           assert path[:len(prefix)] == prefix

    r = app_client.get('/api/accounts/{}/paths/?filter=test.*,test.values.*'.format(account_id), headers={'Authorization': admin_authorization_header})
    actual = json.loads(r.data.decode('utf-8'))
    assert PATH in actual['paths']['test.*']
    assert PATH in actual['paths']['test.values.*']

def test_accounts(app_client):
    """
        Create first admin, login, make sure you get X-JWT-Token. Try to create another first admin, fail.
    """
    data = { 'name': 'First User - Admin', 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN, 'email': 'test@example.com' }
    r = app_client.post('/api/admin/first', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 201
    admin_id = json.loads(r.data.decode('utf-8'))['id']
    assert int(admin_id) == EXPECTED_FIRST_ADMIN_ID

    # next fails:
    data = { 'name': 'Second User', 'username': 'aaa', 'password': 'bbb', 'email': 'test2@example.com' }
    r = app_client.post('/api/admin/first', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 401

    # invalid login:
    data = { 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN + 'nooot' }
    r = app_client.post('/api/auth/login', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 401

    # valid login:
    data = { 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN }
    r = app_client.post('/api/auth/login', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 200
    admin_authorization_header = dict(r.headers).get('X-JWT-Token', None)
    assert admin_authorization_header[:9] == 'Bearer 1:'

    # now request some resource without auth:
    r = app_client.get('/api/admin/accounts')
    assert r.status_code == 401
    # request resource with valid auth:
    r = app_client.get('/api/admin/accounts', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200


def test_jwt_expiry_refresh(app_client, first_admin_exists):
    """
        Login, get X-JWT-Token which expired before 1s, make sure you get 401 on resource request,
        hit /auth/refrest, make sure the new token works
        WARNING: depends on test_accounts() being run first
    """
    # fake the expiry:
    original_jwt_token_valid_for = JWT.TOKEN_VALID_FOR
    JWT.TOKEN_VALID_FOR = -1

    # valid login, but get the expired token:
    data = { 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN }
    r = app_client.post('/api/auth/login', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 200
    admin_authorization_header = dict(r.headers).get('X-JWT-Token', None)
    assert admin_authorization_header[:9] == 'Bearer 1:'

    # you got the (expired) token, reset the expiry timediff:
    JWT.TOKEN_VALID_FOR = original_jwt_token_valid_for

    # request resource - access denied because token has expired:
    r = app_client.get('/api/admin/accounts', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 401

    r = app_client.post('/api/auth/refresh', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    new_admin_authorization_header = dict(r.headers).get('X-JWT-Token', None)
    assert new_admin_authorization_header[:7] == 'Bearer '
    assert new_admin_authorization_header[8:9] == ':'

    # successful access, no refresh with the new token:
    r = app_client.get('/api/admin/accounts', headers={'Authorization': new_admin_authorization_header})
    assert r.status_code == 200


def test_jwt_total_expiry(app_client, first_admin_exists):
    """
        Login, get X-JWT-Token which expired before 1s, read the new token from header, check it
        WARNING: depends on test_accounts() being run first
    """

    # fake the expiry:
    original_jwt_token_valid_for = JWT.TOKEN_VALID_FOR
    JWT.TOKEN_VALID_FOR = -JWT.TOKEN_CAN_BE_REFRESHED_FOR - 1  # the token will be too old to even refresh it

    # valid login, but get the expired token:
    data = { 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN }
    r = app_client.post('/api/auth/login', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 200
    admin_authorization_header = dict(r.headers).get('X-JWT-Token', None)
    assert admin_authorization_header[:9] == 'Bearer 1:'

    # you got the (expired) token, reset the expiry timediff:
    JWT.TOKEN_VALID_FOR = original_jwt_token_valid_for

    # request resource - it should not work because leeway is past:
    r = app_client.get('/api/admin/accounts', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 401

    # refresh also fails because the token is too old:
    r = app_client.post('/api/auth/refresh', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 401

def test_permissions_post_get(app_client, admin_authorization_header):
    """
        Fetch permissions, should only have default permission for first admin, post and get, should be there
    """
    r = app_client.get('/api/admin/permissions', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = json.loads(r.data.decode('utf-8'))
    expected = {
        'list': [
            {
                'id': 1,
                'user_id': EXPECTED_FIRST_ADMIN_ID,
                'url_prefix': None,
                'methods': None,
            },
        ],
    }
    assert actual == expected

    data = {
        'user_id': EXPECTED_FIRST_ADMIN_ID,
        'url_prefix': 'accounts/1/',
        'methods': [ 'GET', 'POST' ],
    }
    r = app_client.post('/api/admin/permissions', data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201
    actual = json.loads(r.data.decode('utf-8'))
    assert actual['id'] == 2

    r = app_client.get('/api/admin/permissions', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = json.loads(r.data.decode('utf-8'))
    assert len(actual['list']) == 2
    new_record = [x for x in actual['list'] if x['id'] == 2][0]
    assert new_record == {
        'id': 2,
        'user_id': data['user_id'],
        'url_prefix': data['url_prefix'].rstrip('/'),
        'methods': '{GET,POST}',
    }

def test_bots_crud(app_client, admin_authorization_header):
    """
        Create a bot, make sure it is in the list.
    """
    time_before_insert = time.time()
    data = { 'name': 'Bot 1' }
    r = app_client.post('/api/admin/bots', data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201
    j = json.loads(r.data.decode('utf-8'))
    bot_id = j['id']
    token = j['token']

    r = app_client.get('/api/admin/bots', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = json.loads(r.data.decode('utf-8'))
    now = time.time()
    assert int(time_before_insert) <= int(actual['list'][0]['insert_time'])
    assert int(actual['list'][0]['insert_time']) <= int(now)
    expected = {
        'list': [
            {
                'id': bot_id,
                'name': data['name'],
                'token': token,
                'insert_time': actual['list'][0]['insert_time'],
            },
        ],
    }
    assert actual == expected

    # individual GET:
    r = app_client.get('/api/admin/bots/{}'.format(bot_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = json.loads(r.data.decode('utf-8'))
    expected = expected['list'][0]
    assert actual == expected

    # PUT:
    data = { 'name': 'Bot 1 - altered' }
    r = app_client.put('/api/admin/bots/{}'.format(bot_id), data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204
    r = app_client.get('/api/admin/bots/{}'.format(bot_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = json.loads(r.data.decode('utf-8'))
    assert actual['name'] == 'Bot 1 - altered'

    # DELETE:
    r = app_client.delete('/api/admin/bots/{}'.format(bot_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    r = app_client.get('/api/admin/bots/{}'.format(bot_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 404
    r = app_client.get('/api/admin/bots', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = json.loads(r.data.decode('utf-8'))
    expected = {
        'list': [],
    }
    assert actual == expected

def test_bots_token(app_client, admin_authorization_header, bot_token, account_id):
    """
        Assign permissions to a bot (created via fixture), put values with it.
    """
    data = {
        'user_id': EXPECTED_BOT_ID,
        'url_prefix': 'accounts/{}/values/'.format(account_id),
        'methods': [ 'POST' ],
    }
    r = app_client.post('/api/admin/permissions', data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201

    data = [{'p': 'qqqq.wwww', 't': 1234567890.123456, 'v': 111.22}]
    r = app_client.put('/api/accounts/{}/values/?b={}'.format(account_id, bot_token), data=json.dumps(data), content_type='application/json')
    assert r.status_code == 401
    data = [{'p': 'qqqq.wwww', 'v': 111.22}]
    r = app_client.post('/api/accounts/{}/values/?b={}'.format(account_id, bot_token), data=json.dumps(data), content_type='application/json')
    assert r.status_code == 200
    r = app_client.get('/api/accounts/{}/values/?p=qqqq.wwww&t0=1234567890&t1=1234567891&a=no&b={}'.format(account_id, bot_token))
    assert r.status_code == 401


def test_auth_grant_permission(app_client, admin_authorization_header, person_id, person_authorization_header, account_id):
    """
        - user can't access anything (test with a few endpoints)
        - admin assigns permissions to user, check that appropriate endpoints work
    """
    r = app_client.get('/api/accounts/{}/paths'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 401

    # grant a permission:
    data = {
        'user_id': person_id,
        'url_prefix': 'accounts/{}'.format(account_id),
        'methods': [ 'GET' ],  # but only GET
    }
    r = app_client.post('/api/admin/permissions', data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201

    # try again:
    r = app_client.get('/api/accounts/{}/paths'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 200
    # but DELETE is denied:
    r = app_client.delete('/api/accounts/{}/paths'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 401  # it would have been 4xx anyway, but it must be denied before that


def test_auth_trailing_slash_not_needed(app_client, admin_authorization_header, person_id, person_authorization_header, account_id):
    """
        If url_prefix is set to 'asdf/ghij', it should match:
          - asdf/ghij
          - asdf/ghij/whatever
        But not:
          - asdf/ghijklm
        Also, the effect of `asdf/ghij/` should be the same as `asdf/ghij` (it should match URL `asdf/ghij` without trailing slash too).
    """
    r = app_client.get('/api/accounts/{}'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 401
    r = app_client.get('/api/accounts/{}/'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 401
    r = app_client.get('/api/accounts/{}1'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 401

    # we want to test that both versions (with an without trailing slash) of url_prefix perform the same:
    for url_prefix in ['accounts/{}'.format(account_id), 'accounts/{}/'.format(account_id)]:
        # grant a permission:
        data = {
            'user_id': person_id,
            'url_prefix': url_prefix,
            'methods': None,
        }
        r = app_client.post('/api/admin/permissions', data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
        assert r.status_code == 201
        permission_id = json.loads(r.data.decode('utf-8'))['id']  # remember permission ID for later, so you can remove it

        # try again:
        r = app_client.get('/api/accounts/{}'.format(account_id), headers={'Authorization': person_authorization_header})
        assert r.status_code == 200
        r = app_client.get('/api/accounts/{}/'.format(account_id), headers={'Authorization': person_authorization_header})
        assert r.status_code == 200
        r = app_client.get('/api/accounts/{}1'.format(account_id), headers={'Authorization': person_authorization_header})
        assert r.status_code == 401  # stays denied

        # then clean up:
        r = app_client.delete('/api/admin/permissions/{}'.format(permission_id), headers={'Authorization': admin_authorization_header})
        assert r.status_code == 200

def test_auth_fails_unknown_key(app_client):
    jwt_token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxLCJzZXNzaW9uX2lkIjoiZjkyMjEzYmYxODFlN2VmYmYwODg0MzgwMGU3MjI1ZDc3ZjBkZTY4NjI5ZDdkZjE3ODhkZjViZjQ1NjJlYWY1ZiIsImV4cCI6MTU0MDIyNjA4NX0.rsznt_Ja_RV9vizJbio6dDnaaBVKay1T0qq2uVLjTas'
    faulty_authorization_header = 'Bearer 315:' + jwt_token
    r = app_client.get('/api/admin/permissions', headers={'Authorization': faulty_authorization_header})
    assert r.status_code == 401


def test_options(app_client):
    r = app_client.options('/api/admin/first')
    assert r.status_code == 200
    assert dict(r.headers).get('Allow', '').split(",") == ['OPTIONS', 'POST']
    # we didn't set the Origin header, so CORS headers should not be set:
    assert dict(r.headers).get('Access-Control-Allow-Origin', None) is None
    assert dict(r.headers).get('Access-Control-Allow-Headers', None) is None
    assert dict(r.headers).get('Access-Control-Allow-Methods', None) is None
    assert dict(r.headers).get('Access-Control-Expose-Headers', None) is None
    assert dict(r.headers).get('Access-Control-Max-Age', None) is None

    r = app_client.options('/api/admin/first', headers={'Origin': 'https://invalid.example.org'})
    assert r.status_code == 200
    # our Origin header is not whitelisted, so CORS headers should not be set:
    assert dict(r.headers).get('Access-Control-Allow-Origin', None) is None
    assert dict(r.headers).get('Access-Control-Allow-Headers', None) is None
    assert dict(r.headers).get('Access-Control-Allow-Methods', None) is None
    assert dict(r.headers).get('Access-Control-Expose-Headers', None) is None
    assert dict(r.headers).get('Access-Control-Max-Age', None) is None

    for origin in VALID_FRONTEND_ORIGINS_LOWERCASED:
        r = app_client.options('/api/admin/first', headers={'Origin': origin})
        assert r.status_code == 200
        assert dict(r.headers).get('Access-Control-Allow-Origin', None) == origin  # our Origin header is whitelisted
        assert dict(r.headers).get('Access-Control-Allow-Headers', None) == 'Content-Type, Authorization'
        assert dict(r.headers).get('Access-Control-Allow-Methods', None) == 'GET, POST, DELETE, PUT, OPTIONS'
        assert dict(r.headers).get('Access-Control-Expose-Headers', None) == 'X-JWT-Token'
        assert dict(r.headers).get('Access-Control-Max-Age', None) == '3600'

def test_cors_get_post_protection(app_client):
    r = app_client.get('/api/status/sitemap', headers={'Origin': 'https://invalid.example.org'})
    assert r.status_code == 403
    r = app_client.post('/api/admin/migratedb', headers={'Origin': 'https://invalid.example.org'})
    assert r.status_code == 403

def test_status_info_cors(app_client_db_not_migrated):
    r = app_client_db_not_migrated.get('/api/status/info')
    assert r.status_code == 200
    assert dict(r.headers).get('Access-Control-Allow-Origin', None) == '*'  # exception for this path

def test_status_info_before_migration(app_client_db_not_migrated):
    r = app_client_db_not_migrated.get('/api/status/info')
    assert r.status_code == 200
    expected = {
        'alive': True,
        'db_migration_needed': True,
        'db_version': 0,
        'user_exists': None,
        'cors_domains': VALID_FRONTEND_ORIGINS_LOWERCASED,
    }
    actual = json.loads(r.data.decode('utf-8'))
    assert expected == actual

    r = app_client_db_not_migrated.post('/api/admin/migratedb')
    assert r.status_code == 204

    r = app_client_db_not_migrated.get('/api/status/info')
    assert r.status_code == 200
    actual = json.loads(r.data.decode('utf-8'))
    expected = {
        'alive': True,
        'db_migration_needed': False,
        'db_version': actual['db_version'],  # we don't care about this
        'user_exists': False,
        'cors_domains': VALID_FRONTEND_ORIGINS_LOWERCASED,
    }
    assert expected == actual


def test_status_info_before_first(app_client):
    r = app_client.get('/api/status/info')
    assert r.status_code == 200
    actual = json.loads(r.data.decode('utf-8'))
    expected = {
        'alive': True,
        'db_migration_needed': False,
        'db_version': actual['db_version'],  # we don't care about this
        'user_exists': False,
        'cors_domains': VALID_FRONTEND_ORIGINS_LOWERCASED,
    }
    assert expected == actual

def test_status_info_after_first(app_client, first_admin_exists):
    r = app_client.get('/api/status/info')
    assert r.status_code == 200
    actual = json.loads(r.data.decode('utf-8'))
    expected = {
        'alive': True,
        'db_migration_needed': False,
        'db_version': actual['db_version'],  # we don't care about this
        'user_exists': True,
        'cors_domains': VALID_FRONTEND_ORIGINS_LOWERCASED,
    }
    assert expected == actual

def test_sitemap(app_client):
    r = app_client.get('/api/status/sitemap')
    assert r.status_code == 200
    expected_entry = {
        "url": "/api/status/sitemap",
        "methods": [
            "GET",
            "HEAD",
            "OPTIONS",
        ],
    }
    actual = json.loads(r.data.decode('utf-8'))
    assert expected_entry in actual

def test_head_method(app_client, admin_authorization_header, account_id):
    r = app_client.head('/api/accounts/{}/dashboards'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200

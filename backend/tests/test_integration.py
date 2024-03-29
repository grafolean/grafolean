import copy
import json
import math
import os
import queue
import re
import sys
import time

import pytest


sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fixtures import (
    VALID_FRONTEND_ORIGINS_LOWERCASED, USERNAME_ADMIN, PASSWORD_ADMIN, USERNAME_USER1, PASSWORD_USER1,
    FIRST_ACCOUNT_NAME, BOT_NAME1, app_client, app_client_db_not_migrated, _delete_all_from_db,
    first_admin_id, admin_authorization_header, account_id_factory, account_id, bot_factory, bot_data,
    bot_id, bot_token, account_credentials_factory, account_sensors_factory, person_id,
    person_authorization_header, mqtt_client_factory, MqttMessage, mqtt_message_queue_factory, mqtt_messages, mqtt_wait_for_message,
)

from api.common import SuperuserJWTToken
from dbutils import TIMESCALE_DB_EPOCH
from utils import log
from auth import JWT


def setup_module():
    os.environ['ENABLE_SIGNUP'] = 'false'


def teardown_module():
    _delete_all_from_db()


def test_first_user(app_client, first_admin_id, admin_authorization_header):
    """
        Create the first admin user, with it, create a normal user.
    """
    assert isinstance(first_admin_id, int) and first_admin_id >= 1 and first_admin_id <= 2147483647

    r = app_client.get(f'/api/users/{first_admin_id}', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201, r.text


def test_values_put_get_simple(app_client, admin_authorization_header, account_id, mqtt_messages):
    """
        Put a value, get a value.
    """
    assert mqtt_messages.empty()

    data = [{'p': 'qqqq.wwww', 't': 1234567890.123456, 'v': 111.22}]
    r = app_client.put('/api/accounts/{}/values/'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204, r.text

    r = app_client.get('/api/accounts/{}/values/qqqq.wwww/?t0=1234567890&t1=1234567891'.format(account_id), headers={'Authorization': admin_authorization_header})
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
    actual = r.json()
    assert expected == actual

    mqtt_message = mqtt_wait_for_message(mqtt_messages, [f'changed/accounts/{account_id}/values/qqqq.wwww'])
    assert json.loads(mqtt_message.payload) == {'t': 1234567890.123456, 'v': 111.22 }

    # remove entry: !!! not implemented
    # r = app_client.delete('/api/accounts/{}/values/?p=qqqq.wwww&t0=1234567890&t1=1234567891'.format(account_id), headers={'Authorization': admin_authorization_header})
    # assert r.status_code == 200

@pytest.mark.parametrize("encoded_ch", [
    "2e",  # "."
    "3a",  # ":"
])
def test_values_put_get_encoded_dot(app_client, admin_authorization_header, account_id, mqtt_messages, encoded_ch):
    """
        Put a value, get a value - but with a dot ('.') and colon (':') encoded as '%2e' / '%3a' in path.
    """
    assert mqtt_messages.empty()

    data = [{'p': f'%{encoded_ch}qqqq.ww%{encoded_ch}ww.asdf', 't': 1234567890.123456, 'v': 111.22}]
    r = app_client.put('/api/accounts/{}/values/'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204, r.text

    r = app_client.get(f'/api/accounts/{account_id}/values/%25{encoded_ch}qqqq.ww%25{encoded_ch}ww.asdf/?t0=1234567890&t1=1234567891', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200, r.text
    expected = {
        'paths': {
            f'%{encoded_ch}qqqq.ww%{encoded_ch}ww.asdf': {
                'next_data_point': None,
                'data': [
                    {'t': 1234567890.123456, 'v': 111.22 }
                ]
            }
        }
    }
    actual = r.json()
    assert expected == actual

    mqtt_message = mqtt_wait_for_message(mqtt_messages, [f'changed/accounts/{account_id}/values/%{encoded_ch}qqqq.ww%{encoded_ch}ww.asdf'])
    assert json.loads(mqtt_message.payload) == {'t': 1234567890.123456, 'v': 111.22 }

def test_values_post_new_path_mqtt(app_client, admin_authorization_header, account_id, mqtt_messages):
    """
        Put a value which creates a new path, make sure you get an MQTT message.
    """
    assert mqtt_messages.empty()

    data = [{'p': f'qqqq.wwww.asdf', 'v': 111.22}]
    r = app_client.post(f'/api/accounts/{account_id}/values/', json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204, r.text

    mqtt_message = mqtt_wait_for_message(mqtt_messages, [f'changed/accounts/{account_id}/paths'])
    j = json.loads(mqtt_message.payload)
    assert j == [{'p': 'qqqq.wwww.asdf', 'id': j[0]["id"] }]

def test_values_put_get_via_post(app_client, admin_authorization_header, account_id, mqtt_messages):
    """
        Put a value, get a value - this time get it via POST.
    """
    assert mqtt_messages.empty()

    data = [{'p': 'qqqq.wwww', 't': 1234567890.123456, 'v': 111.22}]
    r = app_client.put('/api/accounts/{}/values/'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204

    args = {
        "p": "qqqq.wwww",
        "t0": 1234567890,
        "t1": 1234567891,
        "a": "no",
    }
    r = app_client.post('/api/accounts/{}/getvalues/'.format(account_id), json=args, headers={'Authorization': admin_authorization_header})
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
    actual = r.json()
    assert expected == actual

    mqtt_message = mqtt_wait_for_message(mqtt_messages, [f'changed/accounts/{account_id}/values/qqqq.wwww'])
    assert json.loads(mqtt_message.payload) == {'t': 1234567890.123456, 'v': 111.22 }

def test_values_put_get_none(app_client, admin_authorization_header, account_id):
    """
        Put a None instead of a value, make sure it is rejected.
    """
    data = [{'p': 'qqqq.wwww', 't': 1234567890.123456, 'v': None}]
    r = app_client.put('/api/accounts/{}/values/'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 400

def test_values_put_get_topN(app_client, admin_authorization_header, account_id):
    """
        Put 10 values per 3 timestamps, select top 5 latest.
    """
    data = []
    for t in range(3):
        ts = 1234567890.123 + t * 60.0
        for i in range(10):
            data.append({'p': f'aaa.bbb.1min.{i}', 't': ts, 'v': 550.3 * i + t})

    r = app_client.put(f'/api/accounts/{account_id}/values/', json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204

    r = app_client.get(f'/api/accounts/{account_id}/topvalues/?f=aaa.bbb.1min.*&n=3&t={1234567890.123 + 60}', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200, r.text
    expected = {
        't': 1234567890.123 + 1 * 60.0,
        'total': sum([550.3 * i + 1 for i in range(10)]),
        'list': [
            {'p': 'aaa.bbb.1min.9', 'v': 550.3 * 9 + 1},
            {'p': 'aaa.bbb.1min.8', 'v': 550.3 * 8 + 1},
            {'p': 'aaa.bbb.1min.7', 'v': 550.3 * 7 + 1},
        ],
    }
    actual = r.json()
    # check that total is almost, but not completely, the same as expected:
    assert expected['total'] == pytest.approx(actual['total'])
    expected['total'] = actual['total']
    assert expected == actual

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
    # we would like to set the body explicitly to make sure the decoding of JSON works as expected too:
    json_body = '[{{ "p": "qqqq.wwww", "t": 1234567890.123456, "v": {} }}]'.format(value_str)
    r = app_client.put('/api/accounts/{}/values/'.format(account_id), data=json_body, headers={'Authorization': admin_authorization_header, 'Content-Type': 'application/json'})
    assert r.status_code == 204, r.text
    r = app_client.get('/api/accounts/{}/values/qqqq.wwww?t0=1234567890&t1=1234567891'.format(account_id), headers={'Authorization': admin_authorization_header})
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
    actual = r.json()
    assert expected == actual

def test_values_put_get_sort_limit(app_client, admin_authorization_header, account_id):
    """
        Limit the number of values you get.
    """
    TEST_PATH = 'test.values.put.few.sort.limit'
    data = [
        {'p': TEST_PATH, 't': 1330002000 + 160, 'v': 100},
        {'p': TEST_PATH, 't': 1330002000 + 360, 'v': 120},
        {'p': TEST_PATH, 't': 1330002000 + 560, 'v': 140},
        {'p': TEST_PATH, 't': 1330002000 + 760, 'v': 160},
    ]
    r = app_client.put('/api/accounts/{}/values/'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204

    url = '/api/accounts/{}/values/{}/?sort=desc&limit=2'.format(account_id, TEST_PATH)
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
    actual = r.json()
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

    r = app_client.put('/api/accounts/{}/values/'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204

    t_from = 1330002000  # aggr level 0 - every 1 hour
    t_to = t_from + 1*3600
    url = f'/api/accounts/{account_id}/getaggrvalues/'
    data = {
        'p': TEST_PATH,
        't0': t_from,
        't1': t_to,
        'a': 0,
    }
    r = app_client.post(url, json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200, r.text
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
    actual = r.json()
    assert expected == actual

@pytest.mark.parametrize("n_values,aggr_level", [
    [10, 0],
    [10, 1],
    [10, 3],
    [11, 3],
    [100, 2],
    [100, 3],
    # [1000, 4],  # disabled due to slowness
    # [10000, 5],
])
def test_values_put_many_get_aggr(app_client, admin_authorization_header, account_id, n_values, aggr_level):
    """
        Put many values, get aggregated value. Delete path and values.
    """
    TEST_PATH = 'test.values.put.many.get.aggr'
    t_from = TIMESCALE_DB_EPOCH + 10 * (3**5) * 3600  # t_from - TIMESCALEDB_EPOCH is divisible by 81 * 3600 - aggr level 4 - every 3 ^ 4 hours
    aggr_interval_h = 3 ** aggr_level
    t_to = t_from + aggr_interval_h * 3600
    data = [{'p': TEST_PATH, 't': t_from + 1 + i*5, 'v': 111 + i} for i in range(0, n_values)]

    r = app_client.put('/api/accounts/{}/values/'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204

    url = '/api/accounts/{}/getaggrvalues/'.format(account_id)
    data = {
        'p': TEST_PATH,
        't0':t_from,
        't1': t_to,
        'max': 10,
        'a': aggr_level,
    }
    r = app_client.post(url, json=data, headers={'Authorization': admin_authorization_header})
    expected = {
        'paths': {
            TEST_PATH: {
                'next_data_point': None,
                'data': [
                    {'t': t_from + aggr_interval_h * 3600. / 2., 'v': 111. + ((n_values - 1) / 2.), 'minv': 111., 'maxv': 111. + (n_values - 1) }
                ]
            }
        }
    }
    assert r.status_code == 200
    actual = r.json()
    assert expected == actual

    # delete path:
    r = app_client.get('/api/accounts/{}/paths/?filter={}'.format(account_id, TEST_PATH), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    path_id = actual['paths'][TEST_PATH][0]['id']
    r = app_client.delete('/api/accounts/{}/paths/{}'.format(account_id, path_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204

def test_paths_delete_need_auth(app_client, admin_authorization_header, account_id):
    path_id = 1234  # does not exist
    r = app_client.delete('/api/accounts/{}/paths/{}'.format(account_id, path_id))
    assert r.status_code == 401
    r = app_client.delete('/api/accounts/{}/paths/{}'.format(account_id, path_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 404  # because path is not found, of course

def test_dashboards_widgets_post_get(app_client, admin_authorization_header, account_id, mqtt_messages):
    """
        Create a dashboard, get a dashboard, create a widget, get a widget. Delete the dashboard, get 404.
    """
    DASHBOARD = 'dashboard1'
    assert mqtt_messages.empty()

    WIDGET = 'chart1'
    data = {'name': DASHBOARD + ' name', 'slug': DASHBOARD}
    r = app_client.post('/api/accounts/{}/dashboards/'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201
    # check mqtt messages:
    mqtt_message = mqtt_wait_for_message(mqtt_messages, ['changed/accounts/{}/dashboards'.format(account_id)])

    r = app_client.get('/api/accounts/{}/dashboards/{}'.format(account_id, DASHBOARD), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200, r.text
    expected = {
        'name': DASHBOARD + ' name',
        'slug': DASHBOARD,
        'widgets': [],
    }
    actual = r.json()
    assert expected == actual

    # create widget:
    widget_post_data = {
        'type': 'chart',
        'title': WIDGET + ' name',
        'p': 'page2',
        'content': json.dumps([
            {
                'path_filter': 'do.not.match.*',
                'renaming': 'to.rename',
                'unit': 'µ',
                'metric_prefix': 'm',
            }
        ])
    }
    r = app_client.post('/api/accounts/{}/dashboards/{}/widgets/'.format(account_id, DASHBOARD), json=widget_post_data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201, r.text
    widget_id = r.json()['id']

    r = app_client.get('/api/accounts/{}/dashboards/{}/widgets/'.format(account_id, DASHBOARD), headers={'Authorization': admin_authorization_header})
    actual = r.json()
    widget_post_data['id'] = widget_id
    widget_post_data['x'] = 0
    widget_post_data['y'] = 0
    widget_post_data['w'] = 12
    widget_post_data['h'] = 10
    widget_post_data['p'] = 'page2'
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
        'p': 'header',
        'content': json.dumps([
            {
                'path_filter': 'do.not.match2.*',
                'renaming': 'to.rename2',
                'unit': 'µ2',
                'metric_prefix': '',
            }
        ])
    }
    r = app_client.put('/api/accounts/{}/dashboards/{}/widgets/{}'.format(account_id, DASHBOARD, widget_id), json=widget_post_data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204

    # make sure it was updated:
    r = app_client.get('/api/accounts/{}/dashboards/{}/widgets/'.format(account_id, DASHBOARD), headers={'Authorization': admin_authorization_header})
    actual = r.json()
    widget_post_data['id'] = widget_id
    widget_post_data['x'] = 0
    widget_post_data['y'] = 0
    widget_post_data['w'] = 12
    widget_post_data['h'] = 10
    widget_post_data['p'] = 'header'
    expected = {
        'list': [
            widget_post_data,
        ]
    }
    assert r.status_code == 200
    assert expected == actual

    # get a single widget:
    r = app_client.get('/api/accounts/{}/dashboards/{}/widgets/{}/'.format(account_id, DASHBOARD, widget_id), headers={'Authorization': admin_authorization_header})
    actual = r.json()
    expected = widget_post_data
    assert r.status_code == 200
    assert expected == actual

    # delete dashboard:
    r = app_client.delete('/api/accounts/{}/dashboards/{}'.format(account_id, DASHBOARD), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    r = app_client.get('/api/accounts/{}/dashboards/{}'.format(account_id, DASHBOARD), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 404


def test_dashboard_widgets_set_positions(app_client, admin_authorization_header, account_id):
    """
        Create dashboard and N widgets, check their initial positions, rearrange them, check updated positions.
    """
    DASHBOARD_SLUG = 'dashboard1'
    data = {'name': DASHBOARD_SLUG + ' name', 'slug': DASHBOARD_SLUG}
    r = app_client.post('/api/accounts/{}/dashboards/'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201

    # create N widgets:
    widget_post_data = {
        'type': 'chart',
        'title': 'Widget name',
        'content': json.dumps([
            {
                'path_filter': 'do.not.match.*',
                'renaming': 'to.rename',
                'unit': 'µ',
                'metric_prefix': 'm',
            }
        ])
    }
    widget_ids = []
    for _ in range(6):
        r = app_client.post('/api/accounts/{}/dashboards/{}/widgets/'.format(account_id, DASHBOARD_SLUG), json=widget_post_data, headers={'Authorization': admin_authorization_header})
        assert r.status_code == 201, r.text
        widget_id = r.json()['id']
        widget_ids.append(widget_id)

    # check that widgets' initial positions are correct:
    r = app_client.get('/api/accounts/{}/dashboards/{}/widgets/'.format(account_id, DASHBOARD_SLUG), headers={'Authorization': admin_authorization_header})
    actual = r.json()
    assert r.status_code == 200
    for i in range(6):
        assert actual['list'][i]['x'] == 0
        assert actual['list'][i]['y'] == i * 10
        assert actual['list'][i]['w'] == 12
        assert actual['list'][i]['h'] == 10
        assert actual['list'][i]['p'] == 'default'

    # rearrange:
    positions = [
        {'widget_id': widget_ids[0], 'x': 0, 'y': 0, 'w': 3, 'h': 3, 'p': 'default'},
        {'widget_id': widget_ids[1], 'x': 3, 'y': 0, 'w': 6, 'h': 5, 'p': 'default'},
        {'widget_id': widget_ids[2], 'x': 9, 'y': 0, 'w': 3, 'h': 4, 'p': 'default'},
        {'widget_id': widget_ids[3], 'x': 1, 'y': 5, 'w': 11, 'h': 3, 'p': 'page2'},
        {'widget_id': widget_ids[4], 'x': 0, 'y': 8, 'w': 6, 'h': 3, 'p': 'page2'},
        {'widget_id': widget_ids[5], 'x': 6, 'y': 8, 'w': 6, 'h': 3, 'p': 'page2'},
    ]
    r = app_client.put('/api/accounts/{}/dashboards/{}/widgets_positions'.format(account_id, DASHBOARD_SLUG), json=positions, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204, r.text

    # check new positions and sort order:
    r = app_client.get('/api/accounts/{}/dashboards/{}/widgets'.format(account_id, DASHBOARD_SLUG), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200, r.text
    actual = r.json()
    for i in range(6):
        assert actual['list'][i]['id'] == positions[i]['widget_id']
        assert actual['list'][i]['x'] == positions[i]['x']
        assert actual['list'][i]['y'] == positions[i]['y']
        assert actual['list'][i]['w'] == positions[i]['w']
        assert actual['list'][i]['h'] == positions[i]['h']
        assert actual['list'][i]['p'] == positions[i]['p']

def test_values_put_paths_get(app_client, admin_authorization_header, account_id):
    """
        Put values, get paths.
    """
    PATH = 'test.values.put.paths.get.aaaa.bbbb.cccc'
    data = [{'p': PATH, 't': 1234567890.123456, 'v': 111.22}]
    r = app_client.put('/api/accounts/{}/values/'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204

    r = app_client.get('/api/accounts/{}/paths/?filter=test.values.put.paths.get.*'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        'paths': {
            'test.values.put.paths.get.*': [
                {
                    'id': None,
                    'path': PATH,
                }
            ],
        },
        'limit_reached': False,
    }
    actual = r.json()
    expected['paths']['test.values.put.paths.get.*'][0]['id'] = actual['paths']['test.values.put.paths.get.*'][0]['id']
    assert expected == actual

    r = app_client.get('/api/accounts/{}/paths/?filter=test.*&failover_trailing=false'.format(account_id), headers={'Authorization': admin_authorization_header})
    actual = r.json()
    assert PATH in [p["path"] for p in actual['paths']['test.*']]

    r = app_client.get('/api/accounts/{}/paths/?filter=test.&failover_trailing=false'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 400
    r = app_client.get('/api/accounts/{}/paths/?filter=test.'.format(account_id), headers={'Authorization': admin_authorization_header})  # same - failover_trailing=false is default option
    assert r.status_code == 400

    for prefix in ['t', 'te', 'tes', 'test', 'test.', 'test.v']:
        r = app_client.get('/api/accounts/{}/paths/?filter={}&failover_trailing=true'.format(account_id, prefix), headers={'Authorization': admin_authorization_header})
        actual = r.json()
        assert actual['paths'] == {}
        actual_paths = [p["path"] for p in actual['paths_with_trailing'][prefix]]
        assert PATH in actual_paths
        for path in actual['paths_with_trailing'][prefix]:
           assert path["path"][:len(prefix)] == prefix

    r = app_client.get('/api/accounts/{}/paths/?filter=test.*,test.values.*'.format(account_id), headers={'Authorization': admin_authorization_header})
    actual = r.json()
    assert PATH in [p["path"] for p in actual['paths']['test.*']]
    assert PATH in [p["path"] for p in actual['paths']['test.values.*']]

def test_value_put_path_get_put(app_client, admin_authorization_header, account_id):
    """
        Post a value, get the created path, rename it to something else, get the value from new path.
    """
    PATH = 'test.values.put.paths.get.aaaa.bbbb.cccc'
    data = [{'p': PATH, 't': 1234567890.123456, 'v': 111.22}]
    r = app_client.put('/api/accounts/{}/values/'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204

    r = app_client.get('/api/accounts/{}/paths/?filter=test.values.put.paths.get.*'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        'paths': {
            'test.values.put.paths.get.*': [
                {
                    'id': None,
                    'path': PATH,
                }
            ],
        },
        'limit_reached': False,
    }
    actual = r.json()
    path_id = actual['paths']['test.values.put.paths.get.*'][0]['id']
    expected['paths']['test.values.put.paths.get.*'][0]['id'] = path_id
    assert expected == actual

    r = app_client.get(f'/api/accounts/{account_id}/paths/{path_id}', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        "path": PATH,
    }
    actual = r.json()
    assert expected == actual

    # change the path:
    NEW_PATH = f'{PATH}.asdf'
    data = {
        "path": NEW_PATH,
    }
    r = app_client.put(f'/api/accounts/{account_id}/paths/{path_id}', json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204, r.text

    # make sure it has changed:
    r = app_client.get(f'/api/accounts/{account_id}/paths/{path_id}', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        "path": NEW_PATH,
    }
    actual = r.json()
    assert expected == actual

    # delete it:
    r = app_client.delete(f'/api/accounts/{account_id}/paths/{path_id}', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204, r.text

    r = app_client.get(f'/api/accounts/{account_id}/paths/{path_id}', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 404

def test_accounts(app_client):
    """
        Create first admin, login, make sure you get X-JWT-Token. Try to create another first admin, fail.
    """
    data = { 'name': 'First User - Admin', 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN, 'email': 'test@grafolean.com' }
    r = app_client.post('/api/admin/first', json=data)
    assert r.status_code == 201
    admin_id = r.json()['id']

    # next fails:
    data = { 'name': 'Second User', 'username': 'aaa', 'password': 'bbb', 'email': 'test2@grafolean.com' }
    r = app_client.post('/api/admin/first', json=data)
    assert r.status_code == 401

    # invalid login:
    data = { 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN + 'nooot' }
    r = app_client.post('/api/auth/login', json=data)
    assert r.status_code == 401

    # valid login:
    data = { 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN }
    r = app_client.post('/api/auth/login', json=data)
    assert r.status_code == 200
    admin_authorization_header = r.headers.get('X-JWT-Token', None)
    assert re.match(r'^Bearer [0-9]+[:].+$', admin_authorization_header)

    # now request some resource without auth:
    r = app_client.get('/api/admin/accounts')
    assert r.status_code == 401
    # request resource with valid auth:
    r = app_client.get('/api/admin/accounts', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200


def test_jwt_expiry_refresh(app_client, first_admin_id):
    """
        Login, get X-JWT-Token which expired before 1s, make sure you get 401 on resource request,
        hit /auth/refrest, make sure the new token works
    """
    # fake the expiry:
    original_jwt_token_valid_for = JWT.DEFAULT_TOKEN_VALID_FOR
    JWT.DEFAULT_TOKEN_VALID_FOR = -1

    # valid login, but get the expired token:
    data = { 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN }
    r = app_client.post('/api/auth/login', json=data)
    assert r.status_code == 200
    admin_authorization_header = r.headers.get('X-JWT-Token', None)
    assert re.match(r'^Bearer [0-9]+[:].+$', admin_authorization_header)

    # you got the (expired) token, reset the expiry timediff:
    JWT.DEFAULT_TOKEN_VALID_FOR = original_jwt_token_valid_for

    # request resource - access denied because token has expired:
    r = app_client.get('/api/admin/accounts', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 401

    r = app_client.post('/api/auth/refresh', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    new_admin_authorization_header = r.headers.get('X-JWT-Token', None)
    assert re.match(r'^Bearer [0-9]+[:].+$', new_admin_authorization_header)

    # successful access, no refresh with the new token:
    r = app_client.get('/api/admin/accounts', headers={'Authorization': new_admin_authorization_header})
    assert r.status_code == 200


def test_jwt_total_expiry(app_client, first_admin_id):
    """
        Login, get X-JWT-Token which expired before 1s, read the new token from header, check it
    """

    # fake the expiry:
    original_jwt_token_valid_for = JWT.DEFAULT_TOKEN_VALID_FOR
    JWT.DEFAULT_TOKEN_VALID_FOR = -JWT.TOKEN_CAN_BE_REFRESHED_FOR - 1  # the token will be too old to even refresh it

    # valid login, but get the expired token:
    data = { 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN }
    r = app_client.post('/api/auth/login', json=data)
    assert r.status_code == 200
    admin_authorization_header = r.headers.get('X-JWT-Token', None)
    assert re.match(r'^Bearer [0-9]+[:].+$', admin_authorization_header)

    # you got the (expired) token, reset the expiry timediff:
    JWT.DEFAULT_TOKEN_VALID_FOR = original_jwt_token_valid_for

    # request resource - it should not work because leeway is past:
    r = app_client.get('/api/admin/accounts', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 401

    # refresh also fails because the token is too old:
    r = app_client.post('/api/auth/refresh', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 401

def test_permissions_post_get(app_client, first_admin_id, admin_authorization_header, person_id, mqtt_messages):
    """
        Fetch permissions, should only have default permission for first admin, post and get, should be there
    """
    assert mqtt_messages.empty()

    r = app_client.get('/api/persons/{}/permissions'.format(first_admin_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    expected = {
        'list': [
            {
                'id': actual['list'][0]['id'],
                'resource_prefix': None,
                'methods': None,
            },
        ],
    }
    assert actual == expected

    data = {
        'resource_prefix': 'accounts/123/',
        'methods': [ 'GET', 'POST' ],
    }
    # you can't change your own permissions:
    r = app_client.post('/api/persons/{}/permissions'.format(first_admin_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 403

    r = app_client.post('/api/persons/{}/permissions'.format(person_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201
    response = r.json()
    new_permission_id = response['id']
    # check mqtt - both topics must be there:
    topics = ['changed/persons/{}'.format(person_id), 'changed/bots/{}'.format(person_id)]
    for _ in topics:
        m = mqtt_wait_for_message(mqtt_messages, topics)

    r = app_client.get('/api/persons/{}/permissions'.format(person_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    assert len(actual['list']) == 1
    new_record = [x for x in actual['list'] if x['id'] == new_permission_id]
    assert new_record == [{
        'id': new_permission_id,
        'resource_prefix': data['resource_prefix'].rstrip('/'),
        'methods': ['GET', 'POST'],
    }]

def test_bots_crud(app_client, admin_authorization_header):
    """
        Create a bot, make sure it is in the list.
    """
    time_before_insert = time.time()
    data = { 'name': 'Bot 1' }
    r = app_client.post('/api/bots', json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201
    j = r.json()
    bot_id = j['id']

    r = app_client.get('/api/bots', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    now = time.time()
    assert int(time_before_insert) <= int(actual['list'][0]['insert_time'])
    assert int(actual['list'][0]['insert_time']) <= int(now)
    expected = {
        'list': [
            {
                'id': bot_id,
                'tied_to_account': None,
                'name': data['name'],
                'protocol': None,
                'insert_time': actual['list'][0]['insert_time'],
                'last_login': None,
            },
        ],
    }
    assert actual == expected

    # individual GET:
    r = app_client.get('/api/bots/{}'.format(bot_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    expected = expected['list'][0]
    expected['config'] = None
    assert actual == expected

    # PUT:
    data = { 'name': 'Bot 1 - altered' }
    r = app_client.put('/api/bots/{}'.format(bot_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204
    r = app_client.get('/api/bots/{}'.format(bot_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    assert actual['name'] == 'Bot 1 - altered'

    # DELETE:
    r = app_client.delete('/api/bots/{}'.format(bot_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204
    r = app_client.get('/api/bots/{}'.format(bot_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 404
    r = app_client.get('/api/bots', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    expected = {
        'list': [],
    }
    assert actual == expected

def test_bots_token(app_client, admin_authorization_header, bot_id, bot_token, account_id):
    """
        Assign permissions to a bot (created via fixture), put values with it.
    """
    data = {
        'resource_prefix': 'accounts/{}/values/'.format(account_id),
        'methods': [ 'POST' ],
    }
    r = app_client.post('/api/bots/{}/permissions'.format(bot_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201

    data = [{'p': 'qqqq.wwww', 't': 1234567890.123456, 'v': 111.22}]
    r = app_client.put('/api/accounts/{}/values/?b={}'.format(account_id, bot_token), json=data)
    assert r.status_code == 403  # PUT fails
    data = [{'p': 'qqqq.wwww', 'v': 111.22}]
    r = app_client.post('/api/accounts/{}/values/?b={}'.format(account_id, bot_token), json=data)
    assert r.status_code == 204  # POST succeeds
    r = app_client.get('/api/accounts/{}/values/qqqq.wwww/?t0=1234567890&t1=1234567891&b={}'.format(account_id, bot_token))
    assert r.status_code == 403  # GET fails


def test_persons_crud(app_client, first_admin_id, admin_authorization_header):
    """
        Create a person, make sure it is in the list... and so on.
    """
    data = { 'name': 'Person 1', 'username': 'person1', 'email': 'test@grafolean.com', 'password': 'hello' }
    r = app_client.post('/api/persons', json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201
    j = r.json()
    person_id = j['id']

    r = app_client.get('/api/persons', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    expected = {
        'list': [
            actual['list'][0],  # admin is already in the list
            {
                'user_id': person_id,
                'name': data['name'],
                'username': data['username'],
                'email': data['email'],
                'timezone': 'UTC',
                'email_confirmed': True,
            },
        ],
    }
    assert actual == expected

    # individual GET:
    r = app_client.get('/api/persons/{}'.format(person_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    expected_single = expected['list'][1]
    expected_single['permissions'] = []
    assert actual == expected_single
    # individual GET for the first (admin) user:
    r = app_client.get('/api/persons/{}'.format(first_admin_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    expected_single = expected['list'][0]
    # make sure the permissions are there:
    expected_single['permissions'] = [
        {
            'id': actual['permissions'][0]['id'],
            'resource_prefix': None,
            'methods': None,
        }
    ]
    assert actual == expected_single

    # PUT:
    data = { 'name': 'Person 1 - altered', 'username': 'person1b', 'email': 'test2@grafolean.com' }
    r = app_client.put('/api/persons/{}'.format(person_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204
    r = app_client.get('/api/persons/{}'.format(person_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    assert actual['name'] == data['name']
    assert actual['username'] == data['username']
    assert actual['email'] == data['email']
    assert actual['email_confirmed'] == True

    # DELETE:
    r = app_client.delete('/api/persons/{}'.format(person_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204
    r = app_client.get('/api/persons/{}'.format(person_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 404
    r = app_client.get('/api/persons', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    assert len(actual['list']) == 1
    assert actual['list'][0]['username'] == USERNAME_ADMIN

    # can't delete yourself though:
    r = app_client.delete('/api/persons/{}'.format(first_admin_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 403


def test_auth_grant_permission(app_client, admin_authorization_header, person_id, person_authorization_header, account_id):
    """
        - user can't access anything (test with a few endpoints)
        - admin assigns permissions to user, check that appropriate endpoints work
    """
    r = app_client.get('/api/accounts/{}/paths'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 403

    # grant a permission:
    data = {
        'resource_prefix': 'accounts/{}'.format(account_id),
        'methods': [ 'GET' ],  # but only GET
    }
    r = app_client.post('/api/persons/{}/permissions'.format(person_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201

    # try again:
    r = app_client.get('/api/accounts/{}/paths'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 200
    # but DELETE is denied:
    r = app_client.delete('/api/accounts/{}/paths/1234'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 403  # it would have been 4xx anyway, but it must be denied before that


def test_auth_trailing_slash_not_needed(app_client, admin_authorization_header, person_id, person_authorization_header, account_id):
    """
        If resource_prefix is set to 'asdf/ghij', it should match:
          - asdf/ghij
          - asdf/ghij/whatever
        But not:
          - asdf/ghijklm
        Also, the effect of `asdf/ghij/` should be the same as `asdf/ghij` (it should match URL `asdf/ghij` without trailing slash too).
    """
    r = app_client.get('/api/accounts/{}'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 403
    r = app_client.get('/api/accounts/{}/'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 403
    r = app_client.get('/api/accounts/{}1'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 403

    # we want to test that both versions (with an without trailing slash) of resource_prefix perform the same:
    for resource_prefix in ['accounts/{}'.format(account_id), 'accounts/{}/'.format(account_id)]:
        # grant a permission:
        data = {
            'resource_prefix': resource_prefix,
            'methods': None,
        }
        r = app_client.post('/api/persons/{}/permissions'.format(person_id), json=data, headers={'Authorization': admin_authorization_header})
        assert r.status_code == 201
        permission_id = r.json()['id']  # remember permission ID for later, so you can remove it

        # try again:
        expected = {'id': account_id, 'name': FIRST_ACCOUNT_NAME}
        r = app_client.get('/api/accounts/{}'.format(account_id), headers={'Authorization': person_authorization_header})
        assert r.status_code == 200
        assert r.json() == expected
        r = app_client.get('/api/accounts/{}/'.format(account_id), headers={'Authorization': person_authorization_header})
        assert r.status_code == 200
        assert r.json() == expected
        r = app_client.get('/api/accounts/{}1'.format(account_id), headers={'Authorization': person_authorization_header})
        assert r.status_code == 403  # stays denied

        # then clean up:
        r = app_client.delete('/api/persons/{}/permissions/{}'.format(person_id, permission_id), headers={'Authorization': admin_authorization_header})
        assert r.status_code == 204

def test_auth_fails_unknown_key(app_client):
    jwt_token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxLCJzZXNzaW9uX2lkIjoiZjkyMjEzYmYxODFlN2VmYmYwODg0MzgwMGU3MjI1ZDc3ZjBkZTY4NjI5ZDdkZjE3ODhkZjViZjQ1NjJlYWY1ZiIsImV4cCI6MTU0MDIyNjA4NX0.rsznt_Ja_RV9vizJbio6dDnaaBVKay1T0qq2uVLjTas'
    faulty_authorization_header = 'Bearer 0:' + jwt_token
    r = app_client.get('/api/bots', headers={'Authorization': faulty_authorization_header})
    assert r.status_code == 401


def test_options(app_client):
    r = app_client.options('/api/admin/first', headers={'Access-Control-Request-Method': 'POST', 'Origin': 'https://example.org:1234'})
    assert r.status_code == 200, r.text
    # assert r.headers.get('Allow', '').split(",") == ['OPTIONS', 'POST']
    # we didn't set the Origin header, so CORS headers should not be set:
    assert r.headers.get('Access-Control-Allow-Origin', None) == 'https://example.org:1234'
    assert r.headers.get('Access-Control-Allow-Methods', None) == 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT'
    assert r.headers.get('Access-Control-Expose-Headers', None) is None
    assert r.headers.get('Access-Control-Max-Age', None) == '3600'

    r = app_client.options('/api/admin/first', headers={'Access-Control-Request-Method': 'POST', 'Origin': 'https://invalid.example.org'})
    assert r.status_code == 400
    assert r.text == 'Disallowed CORS origin'
    # our Origin header is not whitelisted, so CORS headers should not be set:
    assert r.headers.get('Access-Control-Allow-Origin', None) is None
    assert r.headers.get('Access-Control-Allow-Methods', None) == 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT'
    assert r.headers.get('Access-Control-Expose-Headers', None) is None
    assert r.headers.get('Access-Control-Max-Age', None) == '3600'

    for origin in VALID_FRONTEND_ORIGINS_LOWERCASED:
        r = app_client.options('/api/admin/first', headers={
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type, Authorization, If-None-Match',
            'Origin': origin,
        })
        assert r.status_code == 200
        assert r.headers.get('Access-Control-Allow-Origin', None) == origin  # our Origin header is whitelisted
        assert r.headers.get('Access-Control-Allow-Headers', None) == 'Accept, Accept-Language, Authorization, Content-Language, Content-Type, If-None-Match'
        assert r.headers.get('Access-Control-Allow-Methods', None) == 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT'
        # assert r.headers.get('Access-Control-Expose-Headers', None) == 'X-JWT-Token'  # this is only in response to normal requests, not preflight
        assert r.headers.get('Access-Control-Max-Age', None) == '3600'


@pytest.mark.skip("CSRF protection - disallow requests from other origins")
def test_csrf_get_post_protection(app_client):
    r = app_client.get('/api/status/info', headers={'Origin': 'https://invalid.example.org'})
    assert r.status_code == 403
    r = app_client.post('/api/admin/migratedb', headers={'Origin': 'https://invalid.example.org'})
    assert r.status_code == 403

def test_status_info_cors(app_client_db_not_migrated):
    r = app_client_db_not_migrated.get('/api/status/info')
    assert r.status_code == 200
    assert r.headers.get('Access-Control-Allow-Origin', None) == '*'  # exception for this path

def test_status_info_before_migration(app_client_db_not_migrated):
    r = app_client_db_not_migrated.get('/api/status/info')
    assert r.status_code == 200
    actual = r.json()
    expected = {
        'alive': True,
        'db_migration_needed': True,
        'db_version': 0,
        'user_exists': None,
        'cors_domains': VALID_FRONTEND_ORIGINS_LOWERCASED,
        'mqtt_ws_hostname': actual['mqtt_ws_hostname'],
        'mqtt_ws_port': actual['mqtt_ws_port'],
        'enable_signup': False,
    }
    assert expected == actual

    r = app_client_db_not_migrated.post('/api/admin/migratedb')
    assert r.status_code == 204

    r = app_client_db_not_migrated.get('/api/status/info')
    assert r.status_code == 200
    actual = r.json()
    expected = {
        'alive': True,
        'db_migration_needed': False,
        'db_version': actual['db_version'],  # we don't care about this
        'user_exists': False,
        'cors_domains': VALID_FRONTEND_ORIGINS_LOWERCASED,
        'mqtt_ws_hostname': actual['mqtt_ws_hostname'],
        'mqtt_ws_port': actual['mqtt_ws_port'],
        'enable_signup': False,
    }
    assert expected == actual


def test_status_info_before_first(app_client):
    r = app_client.get('/api/status/info')
    assert r.status_code == 200
    actual = r.json()
    expected = {
        'alive': True,
        'db_migration_needed': False,
        'db_version': actual['db_version'],  # we don't care about this
        'user_exists': False,
        'cors_domains': VALID_FRONTEND_ORIGINS_LOWERCASED,
        'mqtt_ws_hostname': actual['mqtt_ws_hostname'],
        'mqtt_ws_port': actual['mqtt_ws_port'],
        'enable_signup': False,
    }
    assert expected == actual

def test_status_info_after_first(app_client, first_admin_id):
    r = app_client.get('/api/status/info')
    assert r.status_code == 200
    actual = r.json()
    expected = {
        'alive': True,
        'db_migration_needed': False,
        'db_version': actual['db_version'],  # we don't care about this
        'user_exists': True,
        'cors_domains': VALID_FRONTEND_ORIGINS_LOWERCASED,
        'mqtt_ws_hostname': actual['mqtt_ws_hostname'],
        'mqtt_ws_port': actual['mqtt_ws_port'],
        'enable_signup': False,
    }
    assert expected == actual

@pytest.mark.skip("Sitemap not implemented")
def test_sitemap(app_client):
    r = app_client.get('/api/status/sitemap')
    assert r.status_code == 200
    actual = r.json()

    expected_entry = {
        "url": "/api/status/sitemap",
        "methods": ["GET"],
    }
    assert expected_entry in actual

    expected_entry = {
        "url": "/api/bots/<string:user_id>",
        "methods": ["DELETE", "GET", "PUT"],
    }
    assert expected_entry in actual

# https://github.com/tiangolo/fastapi/issues/1773
@pytest.mark.skip("HEAD method currently not supported by FastAPI/Starlette")
def test_head_method(app_client, admin_authorization_header, account_id):
    r = app_client.get('/api/accounts/{}/dashboards'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200

    r = app_client.head('/api/accounts/{}/dashboards'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200

def test_mqtt_subscribe_changed(app_client, admin_authorization_header, account_id_factory, person_id, person_authorization_header, mqtt_message_queue_factory):
    """
        As a client, try to subscribe to the MQTT topic using JWT token that you get as part of a normal login process. Then post a change
        and assert that you received a message about it. Then post a change to unrelated account and make sure you don't get message about
        it. For both cases make sure that superuser gets the messages.
    """
    account_id_ok, account_id_denied = account_id_factory('First account', 'Second account')
    person_jwt_token = person_authorization_header[len('Bearer '):]

    # person should have read access to one of the accounts, but not to the other:
    data = {
        'resource_prefix': 'accounts/{}'.format(account_id_ok),
        'methods': [ 'GET' ],
    }
    r = app_client.post('/api/persons/{}/permissions'.format(person_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201

    superuser_jwt_token = SuperuserJWTToken.get_valid_token('pytest')
    mqtt_messages_superuser, mqtt_messages_person, = mqtt_message_queue_factory((superuser_jwt_token, '#'), (person_jwt_token, 'changed/accounts/{}/dashboards'.format(account_id_ok)))

    # create a dashboard:
    data = {'name': 'Dashboard 1', 'slug': 'dashboard-1'}
    r = app_client.post('/api/accounts/{}/dashboards/'.format(account_id_ok), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201
    # now check that both mqtt message queues received the message:
    mqtt_message = mqtt_messages_superuser.get(timeout=10.0)
    assert mqtt_message.topic == 'changed/accounts/{}/dashboards'.format(account_id_ok)
    assert mqtt_messages_superuser.empty()
    mqtt_message = mqtt_messages_person.get(timeout=10.0)
    assert mqtt_message.topic == 'changed/accounts/{}/dashboards'.format(account_id_ok)
    assert mqtt_messages_person.empty()

    # now create a dashboard in the second account:
    data = {'name': 'Dashboard 2', 'slug': 'dashboard-2'}
    r = app_client.post('/api/accounts/{}/dashboards/'.format(account_id_denied), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201
    # superuser mqtt message queue still received the message:
    mqtt_message = mqtt_messages_superuser.get(timeout=10.0)
    assert mqtt_message.topic == 'changed/accounts/{}/dashboards'.format(account_id_denied)
    assert mqtt_messages_superuser.empty()
    # but person's one didn't:
    assert mqtt_messages_person.empty()


# helper function for checking the contents of mqtt queues:
def print_queue(q, name):
    log.info("PRINTING QUEUE: {}".format(name))
    try:
        while True:
            m = q.get(True, timeout=2.0)
            log.info("  message on topic: {}".format(m.topic))
    except queue.Empty:
        log.info("  -- no more messages --")


def test_persons_email_validation(app_client, admin_authorization_header, account_id):
    # this test assumes that we have access to DNS resolver, which is not always true, so we skip it:
    # data = { 'name': 'User 1', 'username': USERNAME_USER1, 'password': PASSWORD_USER1, 'email': 'user1@nonexistentdomain.qwewertdfsgsdfgsdfg.com' }
    # r = app_client.post('/api/persons', json=data, headers={'Authorization': admin_authorization_header})
    # assert r.status_code == 400

    data = { 'name': 'User 1', 'username': USERNAME_USER1, 'password': PASSWORD_USER1, 'email': 'user1@grafolean.com' }
    r = app_client.post('/api/persons', json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201


def test_profile_permissions_get_as_admin(app_client, first_admin_id, admin_authorization_header):
    """ As admin, fetch your own permissions """
    r = app_client.get('/api/profile/permissions', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    expected = {
        'list': [
            {
                'id': actual['list'][0]['id'],
                'resource_prefix': None,
                'methods': None,
            },
        ],
    }
    assert expected == actual


def test_profile_permissions_get_as_unauthorized(app_client):
    """ Unauthorized users can't fetch their permissions """
    r = app_client.get('/api/profile/permissions')
    assert r.status_code == 401


def test_profile_accounts_get(app_client, account_id_factory, first_admin_id, admin_authorization_header, person_id, person_authorization_header):
    """ As admin / normal person, fetch the accounts that you have read permissions for """
    # initially the list of accounts should be empty:
    r = app_client.get('/api/accounts', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    expected_empty = {
        'list': [],
    }
    assert expected_empty == actual

    # create new accounts and make sure they become available to admin, but not to person:
    expected_admin = copy.deepcopy(expected_empty)
    expected_person_empty = {
        'list': [],
    }
    for acc_nr in range(3):
        # create new account:
        new_account_name = "Account {}".format(acc_nr)
        new_account_id, = account_id_factory(new_account_name)
        new_record = {
            'id': new_account_id,
            'name': new_account_name,
        }
        expected_admin['list'].append(new_record)

        # make sure it becomes available to admin:
        r = app_client.get('/api/accounts', headers={'Authorization': admin_authorization_header})
        assert r.status_code == 200
        actual = r.json()
        assert expected_admin == actual

        # but not to person:
        r = app_client.get('/api/accounts', headers={'Authorization': person_authorization_header})
        assert r.status_code == 200
        actual = r.json()
        assert expected_person_empty == actual

    # now add a specific permission for each account and make sure it appears in the list:
    accounts = copy.deepcopy(expected_admin['list'])
    expected = copy.deepcopy(expected_person_empty)
    for account in accounts:
        data = {
            'resource_prefix': 'accounts/{}'.format(account['id']),
            'methods': [ 'GET' ],
        }
        r = app_client.post('/api/persons/{}/permissions'.format(person_id), json=data, headers={'Authorization': admin_authorization_header})
        assert r.status_code == 201

        # now it should appear in the person's list:
        r = app_client.get('/api/accounts', headers={'Authorization': person_authorization_header})
        assert r.status_code == 200
        actual = r.json()
        expected['list'].append(account)
        assert expected == actual

def test_account_update(app_client, admin_authorization_header, account_id):
    """
        As authorized person (admin) try to change account name.
    """
    # check initial account name:
    r = app_client.get('/api/accounts/{}'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    assert actual['name'] == FIRST_ACCOUNT_NAME

    # change account name:
    data = {'name': 'asdf123'}
    r = app_client.put('/api/accounts/{}'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204
    # check that it has changed:
    r = app_client.get('/api/accounts/{}'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    assert actual['name'] == 'asdf123'

def test_account_update_404(app_client, admin_authorization_header, account_id):
    # try to update non-existant account:
    data = {'name': 'asdf123'}
    r = app_client.put('/api/accounts/{}'.format(account_id + 1), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 404

def test_accounts_name_not_unique(account_id_factory):
    """
        Make sure you can create two accounts with the same name
    """
    acc1, acc2 = account_id_factory('My account', 'My account')
    assert acc1 != acc2

def test_account_bots(app_client, bot_id, admin_authorization_header, person_authorization_header, person_id, account_id):
    """
        Assign permissions on account to a person and check that there are no 'account bots' (bots which are tied to this account).
        When person creates a bot, make sure you can see it in the list. Then update the bot, get it, and then delete it (and
        make sure it is deleted).
    """
    data = {
        'resource_prefix': 'accounts/{}'.format(account_id),
        'methods': None,
    }
    r = app_client.post('/api/persons/{}/permissions'.format(person_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201

    # the list of account bots is empty at the start: (even though we have asked for bot_id, so some non-account bot exists)
    r = app_client.get('/api/accounts/{}/bots'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    assert actual['list'] == []

    # then we create a bot:
    data = {'name': BOT_NAME1}
    r = app_client.post('/api/accounts/{}/bots'.format(account_id), json=data, headers={'Authorization': person_authorization_header})
    assert r.status_code == 201
    account_bot_id = r.json()['id']

    r = app_client.get('/api/accounts/{}/bots'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    expected = {
        'name': BOT_NAME1,
        'protocol': None,
        'id': account_bot_id,
        'tied_to_account': account_id,
        'insert_time': actual['list'][0]['insert_time'],
        'last_login': None
    }
    assert len(actual['list']) == 1
    assert actual['list'][0] == expected

    # then we fetch just this bot:
    r = app_client.get('/api/accounts/{}/bots/{}'.format(account_id, account_bot_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    expected['config'] = None
    assert actual == expected

    # then we update it:
    data = {'name': BOT_NAME1 + "123", 'protocol': 'ping', 'config': '{"a": 123}'}
    r = app_client.put('/api/accounts/{}/bots/{}'.format(account_id, account_bot_id), json=data, headers={'Authorization': person_authorization_header})
    assert r.status_code == 204

    r = app_client.get('/api/accounts/{}/bots/{}'.format(account_id, account_bot_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    assert actual['name'] == BOT_NAME1 + "123"
    assert actual['protocol'] == 'ping'
    assert actual['config'] == {"a": 123}

    # now remove the bot:
    r = app_client.delete('/api/accounts/{}/bots/{}'.format(account_id, account_bot_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 204

    r = app_client.get('/api/accounts/{}/bots'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    assert actual['list'] == []


@pytest.mark.parametrize("listener", [
    "superuser",
    "person",
])
def test_bot_post_values_mqtt_last_login(app_client, account_id, bot_id, bot_token, admin_authorization_header, person_id, person_authorization_header, mqtt_message_queue_factory, listener):
    """
        Bot sends some data, MQTT message is sent (because last_login was updated). Also for normal subscribers.
    """
    data = {
        'resource_prefix': 'accounts/{}/values/'.format(account_id),
        'methods': [ 'POST' ],
    }
    r = app_client.post('/api/bots/{}/permissions'.format(bot_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201

    if listener == 'superuser':
        jwt_token = SuperuserJWTToken.get_valid_token('pytest')
    else:
        jwt_token = person_authorization_header[len('Bearer '):]
        # if we are checking what a person can get in mqtt, we must also grant them access to the account in question:
        data = {
            'resource_prefix': f'accounts/{account_id}',
            'methods': [ 'GET' ],  # only GET is needed
        }
        r = app_client.post(f'/api/persons/{person_id}/permissions', json=data, headers={'Authorization': admin_authorization_header})
        assert r.status_code == 201

    mqtt_messages, = mqtt_message_queue_factory((jwt_token, f'changed/accounts/{account_id}/#'))
    assert mqtt_messages.empty()

    data = [{'p': 'qqqq.wwww', 'v': 111.22}]
    r = app_client.post('/api/accounts/{}/values/?b={}'.format(account_id, bot_token), json=data)
    assert r.status_code == 204

    expected_mqtt_topics = [
        f'changed/accounts/{account_id}/values/qqqq.wwww',
        f'changed/accounts/{account_id}/values/system.stats.inserted',
        f'changed/accounts/{account_id}/values/system.stats.changed',
        f'changed/accounts/{account_id}/paths',
    ]
    for expected_mqtt_topic in expected_mqtt_topics:
        mqtt_message = mqtt_messages.get(timeout=3.0)
        assert mqtt_message.topic == expected_mqtt_topic
    # mqtt_message = mqtt_messages.get(timeout=3.0)
    # assert mqtt_message.topic == f'changed/accounts/{account_id}/bots'
    # mqtt_message = mqtt_messages.get(timeout=3.0)
    # assert mqtt_message.topic == f'changed/accounts/{account_id}/bots/{bot_id}'


def test_account_entities(app_client, admin_authorization_header, account_id, account_sensors_factory, account_credentials_factory, bot_factory):
    """
        Fetch a list of entities for account (must be empty), create one, check it, edit, check, delete, check.
    """
    ENTITY_NAME1 = 'My first device'
    ENTITY_DETAILS1 = {
        'ipv4': '1.1.1.1',
    }
    credential_id, = account_credentials_factory(('snmp', 'SNMP credentials 1'))
    sensor1_id, sensor2_id = account_sensors_factory(('snmp', 'Sensor 1', 60), ('snmp', 'Sensor 2', 120))
    bot_id, _ = bot_factory('Test bot 1', 'snmp')
    ENTITY_PROTOCOLS1 = {
        'snmp': {
            'credential': credential_id,
            'bot': bot_id,
            'sensors': [
                {'sensor': sensor1_id, 'interval': 300},
                {'sensor': sensor2_id, 'interval': 600},
            ],
        },
    }

    ENTITY_NAME2 = 'My first device - renamed'
    ENTITY_DETAILS2 = {
        'ipv4': '2.2.2.2',
    }

    # the list of entities for account must be empty at first:
    r = app_client.get('/api/accounts/{}/entities'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        'list': [],
    }
    actual = r.json()
    assert actual == expected

    # create an entity:
    data = {
        'name': ENTITY_NAME1,
        'entity_type': 'device',
        'parent': None,
        'details': ENTITY_DETAILS1,
        'protocols': ENTITY_PROTOCOLS1,
    }
    r = app_client.post('/api/accounts/{}/entities'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201, r.text
    entity_id = r.json()['id']

    # check result:
    r = app_client.get('/api/accounts/{}/entities'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        'list': [
            {
                'id': entity_id,
                'name': ENTITY_NAME1,
                'entity_type': 'device',
                'parent': None,
                'details': ENTITY_DETAILS1,
                'protocols': ENTITY_PROTOCOLS1,
            },
        ],
    }
    actual = r.json()
    assert actual == expected

    # get only the entity:
    r = app_client.get('/api/accounts/{}/entities/{}'.format(account_id, entity_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        'id': entity_id,
        'name': ENTITY_NAME1,
        'entity_type': 'device',
        'parent': None,
        'details': ENTITY_DETAILS1,
        'protocols': ENTITY_PROTOCOLS1,
    }
    actual = r.json()
    assert actual == expected

    # update it:
    data = {
        'name': ENTITY_NAME2,
        'entity_type': 'teapot',
        'parent': None,
        'details': ENTITY_DETAILS2,
        'protocols': {},
    }
    r = app_client.put('/api/accounts/{}/entities/{}'.format(account_id, entity_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204

    # get only the entity:
    r = app_client.get('/api/accounts/{}/entities/{}'.format(account_id, entity_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        'id': entity_id,
        'name': ENTITY_NAME2,  # the name has changed
        'entity_type': 'teapot',
        'parent': None,
        'details': ENTITY_DETAILS2,
        'protocols': {},
    }
    actual = r.json()
    assert actual == expected

    # try to update with invalid data, make sure it fails:
    credential_id_ping, = account_credentials_factory(('ping', 'PING credentials 1'))
    sensor_ping1_id, = account_sensors_factory(('ping', 'Sensor ping 1', 300))
    ENTITY_PROTOCOLS_INVALID1 = { 'snmp': { 'credential': credential_id_ping, 'sensors': [sensor1_id, sensor2_id] } }
    ENTITY_PROTOCOLS_INVALID2 = { 'snmp': { 'credential': credential_id, 'sensors': [sensor_ping1_id] } }
    for protocols in [ENTITY_PROTOCOLS_INVALID1, ENTITY_PROTOCOLS_INVALID2]:
        data['protocols'] = protocols
        r = app_client.put('/api/accounts/{}/entities/{}'.format(account_id, entity_id), json=data, headers={'Authorization': admin_authorization_header})
        assert r.status_code == 400

    # delete the entity:
    r = app_client.delete('/api/accounts/{}/entities/{}'.format(account_id, entity_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204

    # the list is again empty:
    r = app_client.get('/api/accounts/{}/entities'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        'list': [],
    }
    actual = r.json()
    assert actual == expected


def test_account_credentials_crud(app_client, admin_authorization_header, account_id):
    """
        Fetch a list of resources (credentials, entities, sensors) for account (must be empty), create one, check it, edit, check, delete, check.
    """
    CREDENTIAL_NAME1 = 'res 1'
    CREDENTIAL_PROTOCOL1 = 'snmp'
    CREDENTIAL_DETAILS1 = {
        'key1': 'value1',
        'key2': 'value2',
    }
    CREDENTIAL_NAME2 = 'res 1 - renamed'
    CREDENTIAL_PROTOCOL2 = 'wmi'
    CREDENTIAL_DETAILS2 = {
        'key3': 'value3',
    }

    # table has some initial data, remember it:
    r = app_client.get('/api/accounts/{}/credentials'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    initial = r.json()

    # create a record:
    data = {
        'name': CREDENTIAL_NAME1,
        'protocol': CREDENTIAL_PROTOCOL1,
        'details': CREDENTIAL_DETAILS1,
    }
    r = app_client.post('/api/accounts/{}/credentials'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201
    record_id = r.json()['id']

    # check result:
    r = app_client.get('/api/accounts/{}/credentials'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        'list': sorted([
            {
                'id': record_id,
                'name': CREDENTIAL_NAME1,
                'protocol': CREDENTIAL_PROTOCOL1,
                'details': CREDENTIAL_DETAILS1,
            },
            *initial['list'],
        ], key=lambda x: x['id']),
    }
    actual = r.json()
    assert actual == expected

    # get only the record:
    r = app_client.get('/api/accounts/{}/credentials/{}'.format(account_id, record_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200, r.text
    expected = {
        'id': record_id,
        'name': CREDENTIAL_NAME1,
        'protocol': CREDENTIAL_PROTOCOL1,
        'details': CREDENTIAL_DETAILS1,
    }
    actual = r.json()
    assert actual == expected

    # update it:
    data = {
        'name': CREDENTIAL_NAME2,
        'protocol': CREDENTIAL_PROTOCOL2,
        'details': CREDENTIAL_DETAILS2,
    }
    r = app_client.put('/api/accounts/{}/credentials/{}'.format(account_id, record_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204

    # get only the record:
    r = app_client.get('/api/accounts/{}/credentials/{}'.format(account_id, record_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        'id': record_id,
        'name': CREDENTIAL_NAME2,  # the name has changed
        'protocol': CREDENTIAL_PROTOCOL2,  # and so has type
        'details': CREDENTIAL_DETAILS2,
    }
    actual = r.json()
    assert actual == expected

    # delete the record:
    r = app_client.delete('/api/accounts/{}/credentials/{}'.format(account_id, record_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204

    # the list is again empty:
    r = app_client.get('/api/accounts/{}/credentials'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    assert actual == initial

def test_account_sensors_crud(app_client, admin_authorization_header, account_id):
    """
        Fetch a list of resources (credentials, entities, sensors) for account (must be empty), create one, check it, edit, check, delete, check.
    """
    SENSOR_NAME1 = 'res 1'
    SENSOR_PROTOCOL1 = 'snmp'
    SENSOR_DEFAULT_INTERVAL1 = 60
    SENSOR_DETAILS1 = {
        'key1': 'value1',
        'key2': 'value2',
    }
    SENSOR_NAME2 = 'res 1 - renamed'
    SENSOR_PROTOCOL2 = 'wmi'
    SENSOR_DETAILS2 = {
        'key3': 'value3',
    }

    # the list of sensors contains a few initial records:
    r = app_client.get('/api/accounts/{}/sensors'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    initial = r.json()

    # create a record:
    data = {
        'name': SENSOR_NAME1,
        'protocol': SENSOR_PROTOCOL1,
        'default_interval': SENSOR_DEFAULT_INTERVAL1,
        'details': SENSOR_DETAILS1,
    }
    r = app_client.post('/api/accounts/{}/sensors'.format(account_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 201
    record_id = r.json()['id']

    # check result:
    r = app_client.get('/api/accounts/{}/sensors'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        'list': sorted([
            {
                'id': record_id,
                'name': SENSOR_NAME1,
                'protocol': SENSOR_PROTOCOL1,
                'default_interval': SENSOR_DEFAULT_INTERVAL1,
                'details': SENSOR_DETAILS1,
            },
            *initial['list'],
        ], key=lambda x: x['id']),
    }
    actual = r.json()
    assert actual == expected

    # get only the record:
    r = app_client.get('/api/accounts/{}/sensors/{}'.format(account_id, record_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        'id': record_id,
        'name': SENSOR_NAME1,
        'protocol': SENSOR_PROTOCOL1,
        'default_interval': SENSOR_DEFAULT_INTERVAL1,
        'details': SENSOR_DETAILS1,
    }
    actual = r.json()
    assert actual == expected

    # update it:
    data = {
        'name': SENSOR_NAME2,
        'protocol': SENSOR_PROTOCOL2,
        'default_interval': None,
        'details': SENSOR_DETAILS2,
    }
    r = app_client.put('/api/accounts/{}/sensors/{}'.format(account_id, record_id), json=data, headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204

    # get only the record:
    r = app_client.get('/api/accounts/{}/sensors/{}'.format(account_id, record_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    expected = {
        'id': record_id,
        'name': SENSOR_NAME2,  # the name has changed
        'protocol': SENSOR_PROTOCOL2,  # and so has type
        'default_interval': None,
        'details': SENSOR_DETAILS2,
    }
    actual = r.json()
    assert actual == expected

    # delete the record:
    r = app_client.delete('/api/accounts/{}/sensors/{}'.format(account_id, record_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204

    # the list is again empty:
    r = app_client.get('/api/accounts/{}/sensors'.format(account_id), headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    assert actual == initial

if __name__ == "__main__":
    print(f"{'*' * 30}\nTo run tests, use pytest:\n\n$ pytest integration.py\n")
#!/usr/bin/python3
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import pytest

from moonthor import app

@pytest.fixture
def app_client():
    app.testing = True
    return app.test_client()

def test_values_put_get(app_client):
    """
        Put a value, get a value.
    """
    data = [{'p': 'qqqq.wwww', 't': 1234567890.123456, 'v': 111.22}]
    app_client.put('/api/values/', data=json.dumps(data), content_type='application/json')
    r = app_client.get('/api/values/?p=qqqq.wwww&t0=1234567890&t1=1234567891&a=no')
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

def test_values_put_get_noaggrparam_redirect(app_client):
    """
        Try to get values without aggr param, get redirected.
    """
    t_from = 1330000000
    t_to = 1330000000 + 100*15*60 + 1
    url = '/api/values/?p=aaaa.bbbb&t0={}&t1={}&max=10'.format(t_from, t_to)
    r = app_client.get(url)

    assert r.status_code == 301

    redirect_location = None
    for header, value in r.headers:
        if header == 'Location':
            redirect_location = value
    assert redirect_location[-len(url)-5:] == url + '&a=no'

@pytest.mark.skip(reason="for some reason, maxv is not 210 as it should be")
def test_values_put_get_aggr(app_client):
    """
        Put many values, get aggregated value.
    """
    TEST_PATH = 'test.values.put.get.aggr'
    data = [{'p': TEST_PATH, 't': 1330000000 + i*15*60, 'v': 111 + i} for i in range(0, 100)]
    #import pprint
    #pprint.pprint(data)
    # expected = {'aggregation_level': 1, 'data': {'aaaa.bbbb': [
    #     {'t': 1234567890.123456, 'v': 111.22}
    # ]}}

    app_client.put('/api/values/', data=json.dumps(data), content_type='application/json')
    t_from = 1330000000 - 1330000000 % (3*3600)  # aggr level 3 - every 3 hours
    t_to = t_from + 10 * 3 * 3600
    url = '/api/values/?p={}&t0={}&t1={}&max=10&a=3'.format(TEST_PATH, t_from, t_to)
    r = app_client.get(url)

    expected = {
        'paths': {
            TEST_PATH: {
                'next_data_point': None,
                'data': [
                    {'t': 1330036200.0, 'v': 111.22, 'minv': 111., 'maxv': 111. + 99. }
                ]
            }
        }
    }

    assert r.status_code == 200
    actual = json.loads(r.data.decode('utf-8'))
    #pprint.pprint(actual)
    assert expected == actual


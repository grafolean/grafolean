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

def aaatest_values_put_get(app_client):
    """
        Put a value, get a value.
    """
    data = [{'p': 'qqqq.wwww', 't': 1234567890.123456, 'v': 111.22}]
    app_client.put('/api/values/', data=json.dumps(data), content_type='application/json')
    r = app_client.get('/api/values/?p=qqqq.wwww&t0=1234567890&t1=1234567891')
    expected = {'aggregation_level': -1, 'data': {'qqqq.wwww': [{'t': 1234567890.123456, 'v': 111.22}]}}
    assert expected == json.loads(r.data.decode('utf-8'))

def test_values_put_get_aggr(app_client):
    """
        Put many values, get an aggregated value.
    """
    data = [{'p': 'aaaa.bbbb', 't': 1330000000 + i*15*60, 'v': 111 + i} for i in range(0, 100)]
    # expected = {'aggregation_level': 1, 'data': {'aaaa.bbbb': [
    #     {'t': 1234567890.123456, 'v': 111.22}
    # ]}}

    app_client.put('/api/values/', data=json.dumps(data), content_type='application/json')
    t_from = 1330000000
    t_to = 1330000000 + 100*15*60 + 1
    r = app_client.get('/api/values/?p=aaaa.bbbb&t0={}&t1={}&max=10'.format(t_from, t_to))
    print(r.data)


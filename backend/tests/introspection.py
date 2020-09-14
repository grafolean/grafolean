import json
import math
import os
import re
import sys
import time

import pytest
import flask


sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fixtures import (
    app_client, _delete_all_from_db, admin_authorization_header, first_admin_id, account_id_factory, account_id,
)
from const import SYSTEM_PATH_INSERTED_COUNT


def setup_module():
    pass


def teardown_module():
    _delete_all_from_db()



##########
# Counts #
##########


def test_values_put_get_simple(app_client, admin_authorization_header, account_id):
    """
        Put a value. Stats counter goes up.
    """

    start_time = math.floor(time.time() / 60) * 60
    data = [{'p': 'qqqq.wwww', 't': 1234567890.123456, 'v': 111.22}]
    r = app_client.put('/api/accounts/{}/values/'.format(account_id), data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204, r.data
    end_time = math.ceil(time.time() / 60) * 60

    r = app_client.get(f'/api/accounts/{account_id}/values/{SYSTEM_PATH_INSERTED_COUNT}/?t0={start_time}&t1={end_time}', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200, r.data
    actual = json.loads(r.data.decode('utf-8'))
    actual_time = actual['paths'][SYSTEM_PATH_INSERTED_COUNT]['data'][0]['t']
    assert start_time <= actual_time <= end_time
    expected = {
        'paths': {
            SYSTEM_PATH_INSERTED_COUNT: {
                'next_data_point': None,
                'data': [
                    {
                        't': actual_time,  # we don't care about exact time
                        'v': 1.0,
                    }
                ]
            }
        }
    }
    assert expected == actual


    # now insert 2 more values, stats counter should increment by 2:
    data = [{'p': 'qqqq.wwww', 't': 1234567890.123456, 'v': 111.22}, {'p': 'qqqq.aaaa', 't': 1234567222, 'v': 333}]
    r = app_client.put('/api/accounts/{}/values/'.format(account_id), data=json.dumps(data), content_type='application/json', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 204, r.data

    r = app_client.get(f'/api/accounts/{account_id}/values/{SYSTEM_PATH_INSERTED_COUNT}/?t0={start_time}&t1={end_time}', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200, r.data
    actual = json.loads(r.data.decode('utf-8'))
    actual_time = actual['paths'][SYSTEM_PATH_INSERTED_COUNT]['data'][0]['t']
    assert start_time <= actual_time <= end_time
    # we are interested in total count, but we might be unlucky and it is saved in two minutes:
    actual_total_count = 0
    for data in actual['paths'][SYSTEM_PATH_INSERTED_COUNT]['data']:
        actual_total_count += data['v']
    expected_total_count = 3.0
    assert expected_total_count == actual_total_count

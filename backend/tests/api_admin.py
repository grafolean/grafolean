#!/usr/bin/python3
import json
import os
import sys
import pytest

from common import (
  delete_all_from_db,
  VALID_FRONTEND_ORIGINS_LOWERCASED,
  app_client,
  app_client_db_not_migrated,
  superuser_jwt_token,
)



def setup_module():
    pass

def teardown_module():
    delete_all_from_db()


def test_pytest():
  assert True == True


@pytest.mark.asyncio
async def test_status_info_cors(app_client_db_not_migrated):
    r = await app_client_db_not_migrated.get('/api/status/info')
    assert r.status_code == 200
    assert dict(r.headers).get('Access-Control-Allow-Origin', None) == '*'  # exception for this path


@pytest.mark.asyncio
async def test_mqtt_auth_plug_getuser(app_client, superuser_jwt_token):
    data = {}
    r = await app_client.post('/api/admin/mqtt-auth-plug/getuser', data=json.dumps(data), headers={'Authorization': f'Bearer {superuser_jwt_token}'})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_status_info_before_migration(app_client_db_not_migrated):
    r = await app_client_db_not_migrated.get('/api/status/info')
    assert r.status_code == 200
    actual = json.loads(await r.get_data())
    expected = {
        'alive': True,
        'db_migration_needed': True,
        'db_version': 0,
        'user_exists': None,
        'cors_domains': VALID_FRONTEND_ORIGINS_LOWERCASED,
        'mqtt_ws_hostname': actual['mqtt_ws_hostname'],
        'mqtt_ws_port': actual['mqtt_ws_port'],
    }
    assert expected == actual

    r = await app_client_db_not_migrated.post('/api/admin/migratedb')
    assert r.status_code == 204

    r = await app_client_db_not_migrated.get('/api/status/info')
    assert r.status_code == 200
    actual = json.loads(await r.get_data())
    expected = {
        'alive': True,
        'db_migration_needed': False,
        'db_version': actual['db_version'],  # we don't care about this
        'user_exists': False,
        'cors_domains': VALID_FRONTEND_ORIGINS_LOWERCASED,
        'mqtt_ws_hostname': actual['mqtt_ws_hostname'],
        'mqtt_ws_port': actual['mqtt_ws_port'],
    }
    assert expected == actual

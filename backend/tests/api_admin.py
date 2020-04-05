#!/usr/bin/python3
import json
import os
import sys
import pytest

from common import (
  delete_all_from_db,
  VALID_FRONTEND_ORIGINS_LOWERCASED,
  FIRST_ACCOUNT_NAME,
  app_client,
  app_client_db_not_migrated,
  superuser_jwt_token,
  first_admin_id,
  admin_authorization_header,
  person_id,
  person_authorization_header,
  account_id,
  account_id_factory,
)


def setup_module():
    pass



@pytest.mark.skip("Test temporarily disabled - problems making strict_slashes work")
@pytest.mark.asyncio
async def test_auth_trailing_slash_not_needed(app_client, admin_authorization_header, person_id, person_authorization_header, account_id):
    """
        If resource_prefix is set to 'asdf/ghij', it should match:
          - asdf/ghij
          - asdf/ghij/whatever
        But not:
          - asdf/ghijklm
        Also, the effect of `asdf/ghij/` should be the same as `asdf/ghij` (it should match URL `asdf/ghij` without trailing slash too).
    """
    r = await app_client.get('/api/accounts/{}'.format(account_id))
    assert r.status_code == 401
    r = await app_client.get('/api/accounts/{}/'.format(account_id))
    assert r.status_code == 401
    r = await app_client.get('/api/accounts/{}1'.format(account_id), headers={'Authorization': person_authorization_header})
    assert r.status_code == 401

    # we want to test that both versions (with an without trailing slash) of resource_prefix perform the same:
    for resource_prefix in ['accounts/{}'.format(account_id), 'accounts/{}/'.format(account_id)]:
        # grant a permission:
        data = {
            'resource_prefix': resource_prefix,
            'methods': None,
        }
        r = await app_client.post('/api/persons/{}/permissions'.format(person_id), json=data, headers={'Authorization': admin_authorization_header})
        assert r.status_code == 201
        permission_id = json.loads(await r.get_data())['id']  # remember permission ID for later, so you can remove it

        # try again:
        expected = {'id': account_id, 'name': FIRST_ACCOUNT_NAME}
        r = await app_client.get('/api/accounts/{}'.format(account_id), headers={'Authorization': person_authorization_header})
        assert r.status_code == 200
        assert json.loads(await r.get_data()) == expected
        r = await app_client.get('/api/accounts/{}/'.format(account_id), headers={'Authorization': person_authorization_header})
        assert r.status_code == 200
        assert json.loads(await r.get_data()) == expected
        r = await app_client.get('/api/accounts/{}1'.format(account_id), headers={'Authorization': person_authorization_header})
        assert r.status_code == 401  # stays denied

        # then clean up:
        r = await app_client.delete('/api/persons/{}/permissions/{}'.format(person_id, permission_id), headers={'Authorization': admin_authorization_header})
        assert r.status_code == 204


@pytest.mark.asyncio
async def test_auth_fails_unknown_key(app_client):
    jwt_token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxLCJzZXNzaW9uX2lkIjoiZjkyMjEzYmYxODFlN2VmYmYwODg0MzgwMGU3MjI1ZDc3ZjBkZTY4NjI5ZDdkZjE3ODhkZjViZjQ1NjJlYWY1ZiIsImV4cCI6MTU0MDIyNjA4NX0.rsznt_Ja_RV9vizJbio6dDnaaBVKay1T0qq2uVLjTas'
    faulty_authorization_header = 'Bearer 0:' + jwt_token
    r = await app_client.get('/api/bots', headers={'Authorization': faulty_authorization_header})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_options(app_client):
    r = await app_client.options('/api/admin/first')
    assert r.status_code == 200
    print(dir(r))
    assert dict(r.headers).get('Allow', '').split(",") == ['OPTIONS', 'POST']
    # we didn't set the Origin header, so CORS headers should not be set:
    assert dict(r.headers).get('Access-Control-Allow-Origin', None) is None
    assert dict(r.headers).get('Access-Control-Allow-Headers', None) is None
    assert dict(r.headers).get('Access-Control-Allow-Methods', None) is None
    assert dict(r.headers).get('Access-Control-Expose-Headers', None) is None
    assert dict(r.headers).get('Access-Control-Max-Age', None) is None

    r = await app_client.options('/api/admin/first', headers={'Origin': 'https://invalid.example.org'})
    assert r.status_code == 200
    # our Origin header is not whitelisted, so CORS headers should not be set:
    assert dict(r.headers).get('Access-Control-Allow-Origin', None) is None
    assert dict(r.headers).get('Access-Control-Allow-Headers', None) is None
    assert dict(r.headers).get('Access-Control-Allow-Methods', None) is None
    assert dict(r.headers).get('Access-Control-Expose-Headers', None) is None
    assert dict(r.headers).get('Access-Control-Max-Age', None) is None

    for origin in VALID_FRONTEND_ORIGINS_LOWERCASED:
        r = await app_client.options('/api/admin/first', headers={'Origin': origin})
        assert r.status_code == 200
        assert dict(r.headers).get('Access-Control-Allow-Origin', None) == origin  # our Origin header is whitelisted
        assert dict(r.headers).get('Access-Control-Allow-Headers', None) == 'Content-Type, Authorization'
        assert dict(r.headers).get('Access-Control-Allow-Methods', None) == 'GET, POST, DELETE, PUT, OPTIONS'
        assert dict(r.headers).get('Access-Control-Expose-Headers', None) == 'X-JWT-Token'
        assert dict(r.headers).get('Access-Control-Max-Age', None) == '3600'


@pytest.mark.asyncio
async def test_cors_get_post_protection(app_client):
    r = await app_client.get('/api/status/sitemap', headers={'Origin': 'https://invalid.example.org'})
    assert r.status_code == 403
    r = await app_client.post('/api/admin/migratedb', headers={'Origin': 'https://invalid.example.org'})
    assert r.status_code == 403


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
    r = await app_client.post('/api/admin/mqtt-auth-plug/getuser', data=json.dumps(data), headers={'Authorization': f'Bearer 12{superuser_jwt_token}'})
    assert r.status_code == 401


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


@pytest.mark.asyncio
async def test_status_info_before_first(app_client):
    r = await app_client.get('/api/status/info')
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


@pytest.mark.asyncio
async def test_status_info_after_first(app_client, first_admin_id):
    r = await app_client.get('/api/status/info')
    assert r.status_code == 200
    actual = json.loads(await r.get_data())
    expected = {
        'alive': True,
        'db_migration_needed': False,
        'db_version': actual['db_version'],  # we don't care about this
        'user_exists': True,
        'cors_domains': VALID_FRONTEND_ORIGINS_LOWERCASED,
        'mqtt_ws_hostname': actual['mqtt_ws_hostname'],
        'mqtt_ws_port': actual['mqtt_ws_port'],
    }
    assert expected == actual


@pytest.mark.asyncio
async def test_sitemap(app_client):
    r = await app_client.get('/api/status/sitemap')
    assert r.status_code == 200
    actual = json.loads(await r.get_data())

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

import json
import os
import pytest
import sys


sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fixtures import (
    app_client, _delete_all_from_db, admin_authorization_header, first_admin_id,
)


def setup_module():
    pass


def teardown_module():
    _delete_all_from_db()


def test_signup_new_unsuccessful(app_client, admin_authorization_header):
    """
        Make sure signing up fails if "agree" is not True or e-mail is invalid.
    """
    data = {
      'email': 'test@grafolean.com',
    }
    r = app_client.post('/api/persons/signup/new', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 400, r.data

    data = {
      'email': 'test@grafolean.com',
      'agree': 123,
    }
    r = app_client.post('/api/persons/signup/new', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 400, r.data

    data = {
      'email': 'test@grafolean.com',
      'agree': False,
    }
    r = app_client.post('/api/persons/signup/new', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 400, r.data

    data = {
      'email': 'some.invalid.email',
      'agree': True,
    }
    r = app_client.post('/api/persons/signup/new', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 400, r.data

    r = app_client.get('/api/persons/', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = json.loads(r.data.decode('utf-8'))
    assert len(actual['list']) == 1  # just admin


def test_signup_new_successful(app_client, admin_authorization_header):
    """
        Sign up as anonymous user, then as admin make sure that person exists and can't login.
    """
    r = app_client.get('/api/persons/', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = json.loads(r.data.decode('utf-8'))
    assert len(actual['list']) == 1  # just admin

    data = {
      'email': 'test@grafolean.com',
      'agree': True,
    }
    r = app_client.post('/api/persons/signup/new', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 204, r.data

    r = app_client.get('/api/persons/', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = json.loads(r.data.decode('utf-8'))
    assert len(actual['list']) == 2, str(actual)  # admin and new user

    data = { 'username': 'test@grafolean.com', 'password': '' }
    r = app_client.post('/api/auth/login', data=json.dumps(data), content_type='application/json')
    assert r.status_code == 401

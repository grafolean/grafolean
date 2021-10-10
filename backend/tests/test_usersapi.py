import json
import os
import re
import sys

import pytest


sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fixtures import (
    app_client, _delete_all_from_db, admin_authorization_header, first_admin_id, person_id, EMAIL_USER1, USERNAME_USER1,
    db, smtp_messages
)


def setup_module():
    os.environ['ENABLE_SIGNUP'] = 'true'
    os.environ['SIGNUP_DISALLOW_TOR'] = 'false'
    os.environ['MAIL_SERVER'] = '127.0.0.1'
    os.environ['MAIL_PORT'] = '22587'
    os.environ['MAIL_USE_TLS'] = 'false'
    os.environ['MAIL_USERNAME'] = ''  # testing smtpd does not support authentication
    os.environ['MAIL_PASSWORD'] = ''
    os.environ['MAIL_REPLY_TO'] = 'nouser@grafolean.com'


def teardown_module():
    _delete_all_from_db()


SOME_PASSWORD = 'ThisIsSomeVeryStrongPassword'


##########
# Signup #
##########


def test_signup_new_unsuccessful(app_client, admin_authorization_header):
    """
        Make sure signing up fails if "agree" is not True or e-mail is invalid.
    """
    data = {
        'email': 'test@grafolean.com',
    }
    r = app_client.post('/api/persons/signup/new', json=data)
    assert r.status_code == 400, r.text

    data = {
        'email': 'test@grafolean.com',
        'agree': 123,
    }
    r = app_client.post('/api/persons/signup/new', json=data)
    assert r.status_code == 400, r.text

    data = {
        'email': 'test@grafolean.com',
        'agree': False,
    }
    r = app_client.post('/api/persons/signup/new', json=data)
    assert r.status_code == 400, r.text

    data = {
        'email': 'some.invalid.email',
        'agree': True,
    }
    r = app_client.post('/api/persons/signup/new', json=data)
    assert r.status_code == 400, r.text

    r = app_client.get('/api/persons/', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    assert len(actual['list']) == 1  # just admin


def test_signup_new_successful(app_client, admin_authorization_header, smtp_messages):
    """
        Sign up as anonymous user, then as admin make sure that person exists and can't login.
    """

    r = app_client.get('/api/persons/', headers={'Authorization': admin_authorization_header})
    assert r.status_code == 200
    actual = r.json()
    assert len(actual['list']) == 1  # just admin

    # when we start the signup process, an e-mail is sent, which we intercept here and parse the
    # user_id and confirm_pin paramaters from it:
    user_id = None
    confirm_pin = None
    data = {
        'email': 'test@grafolean.com',
        'agree': True,
    }
    r = app_client.post('/api/persons/signup/new', json=data)
    assert r.status_code == 204, r.text

    mail_from, mail_recepients, mail_body = smtp_messages.get(timeout=1)
    assert mail_from == 'nouser@grafolean.com'
    assert mail_recepients == ['test@grafolean.com']
    m = re.search(r'/signup/confirm/([0-9]+)/([0-9a-f]{8})', mail_body)
    assert m
    user_id = int(m.group(1))
    confirm_pin = m.group(2)
    invalid_confirm_pin = '1234aaaa' if confirm_pin != '1234aaaa' else '4321bbbb'

    # we just want to know if the pin is correct, so that we can ask user for a new password:
    data = {
        'user_id': user_id,
        'confirm_pin': confirm_pin,
    }
    r = app_client.post(f'/api/persons/signup/validatepin', json=data)
    assert r.status_code == 204, r.text

    # invalid pin would not succeed:
    data = {
        'user_id': user_id,
        'confirm_pin': invalid_confirm_pin,
    }
    r = app_client.post(f'/api/persons/signup/validatepin', json=data)
    assert r.status_code == 400, r.text

    # up until now, we still can't login:
    data = { 'username': 'test@grafolean.com', 'password': '' }
    r = app_client.post('/api/auth/login', json=data)
    assert r.status_code == 401

    # complete the signup process by setting the new password:
    # with invalid pin it won't work:
    data = {
        'user_id': user_id,
        'confirm_pin': invalid_confirm_pin,
        'password': SOME_PASSWORD,
    }
    r = app_client.post(f'/api/persons/signup/complete', json=data)
    assert r.status_code == 400, r.text

    # with valid pin it works:
    data = {
        'user_id': user_id,
        'confirm_pin': confirm_pin,
        'password': SOME_PASSWORD,
    }
    r = app_client.post(f'/api/persons/signup/complete', json=data)
    assert r.status_code == 204, r.text

    # and we can't repeat it - the second time it fails:
    data = {
        'user_id': user_id,
        'confirm_pin': confirm_pin,
        'password': SOME_PASSWORD,
    }
    r = app_client.post(f'/api/persons/signup/complete', json=data)
    assert r.status_code == 400, r.text

    # finally, we can login successfully:
    data = { 'username': 'test@grafolean.com', 'password': SOME_PASSWORD }
    r = app_client.post('/api/auth/login', json=data)
    assert r.status_code == 200
    authorization_header = r.headers.get('X-JWT-Token', None)
    assert re.match(r'^Bearer [0-9]+[:].+$', authorization_header)

    # and we have access to our account:
    r = app_client.get('/api/accounts', headers={'Authorization': authorization_header})
    assert r.status_code == 200
    actual = r.json()
    assert len(actual['list']) == 1


###################
# Forgot password #
###################


@pytest.mark.skip("TBD!")
def test_forgot_password(app_client, person_id):
    """
        Make sure that /api/persons/forgot endpoint rejects invalid e-mail addresses, and that it ignores valid but nonexistent
        addresses, and that it sends an e-mail message to valid & presend addresses.
    """
    with app_client:  # we need to keep app context alive so that we can inspect the sent e-mail
        data = {
            'email': 'this.is.not.a.valid.email',
        }
        r = app_client.post('/api/persons/forgot', json=data)
        assert r.status_code == 400, r.text
        assert not hasattr(flask.g, 'outbox')

    with app_client:
        data = {
            'email': 'not.exists@example.org',
        }
        r = app_client.post('/api/persons/forgot', json=data)
        assert r.status_code == 400, r.text
        assert not hasattr(flask.g, 'outbox')

    with app_client:
        data = {
            'email': EMAIL_USER1,
        }
        r = app_client.post('/api/persons/forgot', json=data)
        assert r.status_code == 204, r.text
        assert len(flask.g.outbox) == 1
        mail_message = flask.g.outbox[0]
        m = re.search(r'/forgot/([0-9]+)/([0-9a-f]{8})', mail_message.body)
        assert m
        user_id = int(m.group(1))
        confirm_pin = m.group(2)
        invalid_confirm_pin = '1234aaaa' if confirm_pin != '1234aaaa' else '4321bbbb'

    # try to reset password:
    # with invalid pin it won't work:
    data = {
        'user_id': user_id,
        'confirm_pin': invalid_confirm_pin,
        'password': SOME_PASSWORD,
    }
    r = app_client.post(f'/api/persons/forgot/reset', json=data)
    assert r.status_code == 400, r.text

    # with valid, but expired pin it won't work:
    with db.cursor() as c:
        c.execute("UPDATE persons SET confirm_until = confirm_until - 4000;")
        data = {
            'user_id': user_id,
            'confirm_pin': confirm_pin,
            'password': SOME_PASSWORD,
        }
        r = app_client.post(f'/api/persons/forgot/reset', json=data)
        assert r.status_code == 400, r.text
        # revert the change back:
        c.execute("UPDATE persons SET confirm_until = confirm_until + 4000;")

    # with a valid pin it works:
    data = {
        'user_id': user_id,
        'confirm_pin': confirm_pin,
        'password': SOME_PASSWORD,
    }
    r = app_client.post(f'/api/persons/forgot/reset', json=data)
    assert r.status_code == 204, r.text

    # and we can't repeat it - the second time it fails:
    data = {
        'user_id': user_id,
        'confirm_pin': confirm_pin,
        'password': SOME_PASSWORD,
    }
    r = app_client.post(f'/api/persons/forgot/reset', json=data)
    assert r.status_code == 400, r.text

    # finally, we can login successfully:
    data = { 'username': USERNAME_USER1, 'password': SOME_PASSWORD }
    r = app_client.post('/api/auth/login', json=data)
    assert r.status_code == 200

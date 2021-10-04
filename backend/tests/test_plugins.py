import os
import sys

import pytest


sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fixtures import (
    app_client, _delete_all_from_db
)


def setup_module():
    pass


def teardown_module():
    _delete_all_from_db()


def test_plugins_auth(app_client):
    """
        Make sure that downloading the plugin .js files does not need any authentication.
    """
    r = app_client.get('/api/plugins/widgets/123/widget.js')
    assert r.status_code == 404, r.text

    r = app_client.get('/api/plugins/widgets/123/form.js')
    assert r.status_code == 404, r.text

    r = app_client.get('/api/plugins/widgets')
    assert r.status_code == 200, r.text
    assert r.json() == {'list': []}

    r = app_client.post('/api/plugins/widgets')
    assert r.status_code == 401, r.text

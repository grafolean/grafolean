import json
import os
import sys

import pytest

# since we are running our own environment for testing (use `docker-compose up -d` and
# `docker-compose down`), we need to setup env vars accordingly:
os.environ['DB_HOST'] = 'localhost'  # we expose to port 5432 on host (== localhost)
os.environ['DB_DATABASE'] = 'pytest'
os.environ['DB_USERNAME'] = 'pytest'
os.environ['DB_PASSWORD'] = 'pytest'
os.environ['MQTT_HOSTNAME'] = 'localhost'
os.environ['MQTT_PORT'] = '1883'

VALID_FRONTEND_ORIGINS = [
    'https://example.org:1234',
    'http://localhost:3000',
    'http://LOCALHOST:2000',
]
VALID_FRONTEND_ORIGINS_LOWERCASED = [x.lower() for x in VALID_FRONTEND_ORIGINS]
os.environ['GRAFOLEAN_CORS_DOMAINS'] = ",".join(VALID_FRONTEND_ORIGINS)


sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from grafolean import app
from api.common import SuperuserJWTToken
from utils import db, migrate_if_needed, log
from auth import JWT
from datatypes import clear_all_lru_cache


USERNAME_ADMIN = 'admin'
PASSWORD_ADMIN = 'asdf123'
USERNAME_USER1 = 'user1'
PASSWORD_USER1 = '321abc'
FIRST_ACCOUNT_NAME = 'First account'
BOT_NAME1 = 'My Bot 1'


def delete_all_from_db():
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
            "DROP TYPE IF EXISTS WIDGETS_WIDTH;",
        ]:
            log.info(sql)
            c.execute(sql)
    # don't forget to clear memoization cache:
    clear_all_lru_cache()
    SuperuserJWTToken.clear_cache()


@pytest.fixture
def app_client():
    delete_all_from_db()
    migrate_if_needed()
    app.testing = True
    return app.test_client()

@pytest.fixture
def app_client_db_not_migrated():
    delete_all_from_db()
    app.testing = True
    return app.test_client()

@pytest.fixture
def superuser_jwt_token():
    return SuperuserJWTToken.get_valid_token('pytest')

@pytest.fixture
async def first_admin_id(app_client):
    data = { 'name': 'First User - Admin', 'username': USERNAME_ADMIN, 'password': PASSWORD_ADMIN, 'email': 'admin@grafolean.com' }
    r = await app_client.post('/api/admin/first', json=data)
    assert r.status_code == 201
    admin_id = json.loads(await r.get_data())['id']
    return int(admin_id)

from collections import defaultdict
import json
import os
import time

from fastapi import Response, Request
from fastapi.responses import JSONResponse
import psycopg2

from .fastapiutils import APIRouter
from datatypes import Auth
import dbutils
from utils import log
from .common import noauth, CORS_DOMAINS, MQTT_WS_HOSTNAME, MQTT_WS_PORT


status_api = APIRouter()


# --------------
# /status/ - system status information
# --------------


# Useful for determining status of backend (is it available, is the first user initialized,...)
@status_api.get('/api/status/info')
@noauth
def status_info_get():
    db_migration_needed = dbutils.is_migration_needed()
    result = {
        'alive': True,
        'db_migration_needed': db_migration_needed,
        'db_version': dbutils.get_existing_schema_version(),
        'user_exists': Auth.first_user_exists() if not db_migration_needed else None,
        'cors_domains': CORS_DOMAINS,
        'mqtt_ws_hostname': MQTT_WS_HOSTNAME,
        'mqtt_ws_port': MQTT_WS_PORT,
        'enable_signup': os.environ.get('ENABLE_SIGNUP', 'false').lower() in ['true', 'yes', 'on', '1'],
    }
    return JSONResponse(content=result, status_code=200)


# @status_api.get('/api/status/sitemap')
# @noauth
# def status_sitemap_get():
#     ignored_methods = set(['HEAD', 'OPTIONS'])
#     rules = defaultdict(set)
#     for rule in flask.current_app.url_map.iter_rules():
#         rules[str(rule)] |= rule.methods
#     result = [{ 'url': k, 'methods': sorted(list(v - ignored_methods))} for k, v in rules.items()]
#     return JSONResponse(content=result, status_code=200)


@status_api.post('/api/status/cspreport')
@noauth
async def status_cspreport(request: Request):
    log.error("CSP report received: {}".format(await request.body()))
    return Response(status_code=204)

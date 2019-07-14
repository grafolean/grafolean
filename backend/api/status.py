from collections import defaultdict
import flask
import json
import psycopg2
import time

from datatypes import Auth
import utils
from utils import log
from .common import noauth, CORS_DOMAINS, MQTT_WS_HOSTNAME, MQTT_WS_PORT


status_api = flask.Blueprint('status_api', __name__)


# --------------
# /status/ - system status information
# --------------


# Useful for determining status of backend (is it available, is the first user initialized,...)
@status_api.route('/info', methods=['GET'])
@noauth
def status_info_get():
    db_migration_needed = utils.is_migration_needed()
    result = {
        'alive': True,
        'db_migration_needed': db_migration_needed,
        'db_version': utils.get_existing_schema_version(),
        'user_exists': Auth.first_user_exists() if not db_migration_needed else None,
        'cors_domains': CORS_DOMAINS,
        'mqtt_ws_hostname': MQTT_WS_HOSTNAME,
        'mqtt_ws_port': MQTT_WS_PORT,
    }
    return json.dumps(result), 200


@status_api.route('/sitemap', methods=['GET'])
@noauth
def status_sitemap_get():
    ignored_methods = set(['HEAD', 'OPTIONS'])
    rules = defaultdict(set)
    for rule in flask.current_app.url_map.iter_rules():
        rules[str(rule)] |= rule.methods
    result = [{ 'url': k, 'methods': sorted(list(v - ignored_methods))} for k, v in rules.items()]
    return json.dumps(result), 200


@status_api.route('/cspreport', methods=['POST'])
@noauth
def status_cspreport():
    log.error("CSP report received: {}".format(flask.request.data))
    return '', 200

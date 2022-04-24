import json
import os
import time
import traceback

import paho.mqtt.publish as mqtt_publish

from auth import JWT
from utils import log, telemetry_send


MQTT_HOSTNAME = os.environ.get('MQTT_HOSTNAME')
MQTT_PORT = int(os.environ.get('MQTT_PORT', 1883))
MQTT_WS_HOSTNAME = os.environ.get('MQTT_WS_HOSTNAME', '')
MQTT_WS_PORT = os.environ.get('MQTT_WS_PORT', '')


CORS_DOMAINS = list(filter(len, os.environ.get('GRAFOLEAN_CORS_DOMAINS', '').lower().split(",")))




class SuperuserJWTToken(object):
    """
        SuperuserJWTToken is a workaround which allows us to post information (about changed resources) to MQTT. When we post such information,
        MQTT connects back to us (see /api/admin/mqtt-auth-plug/<check_type>/ API endpoint) to determine if we have the necessary permissions,
        and we check the validity of JWT token (and allow it).
    """
    jwt_tokens = {}
    valid_until = {}
    TOKEN_VALID_S = 1800

    @classmethod
    def get_valid_token(cls, superuser_identifier):
        if not cls.jwt_tokens.get(superuser_identifier) or time.time() > cls.valid_until.get(superuser_identifier, 0):
            log.info("Superuser auth token not available or expired, refreshing.")
            cls._refresh_token(superuser_identifier)
        return cls.jwt_tokens[superuser_identifier]

    @classmethod
    def _refresh_token(cls, superuser_identifier):
        data = {
            "superuser": superuser_identifier,
        }
        token_header, valid_until = JWT(data).encode_as_authorization_header(cls.TOKEN_VALID_S)
        cls.jwt_tokens[superuser_identifier] = token_header[len('Bearer '):]
        cls.valid_until[superuser_identifier] = valid_until

    @classmethod
    def clear_cache(cls):
        cls.jwt_tokens = {}
        cls.valid_until = {}


# This function publishes notifications via MQTT when the content of some GET endpoint might have changed. For example,
# when adding a dashboard this function is called with 'accounts/{}/dashboards' so that anyone interested in dashboards
# can re-issue GET to the same endpoint URL.
def mqtt_publish_changed(topics, payload='1'):
    topics_with_payloads = [(t, payload,) for t in topics]
    mqtt_publish_changed_multiple_payloads(topics_with_payloads)


def mqtt_publish_changed_multiple_payloads(topics_with_payloads):
    if not MQTT_HOSTNAME:
        log.warn("MQTT not connected, not publishing change")
        return
    superuserJwtToken = SuperuserJWTToken.get_valid_token('backend_changed_notif')

    # https://www.eclipse.org/paho/clients/python/docs/#id2
    try:
        msgs = [('changed/{}'.format(t), json.dumps(p), 1, False) for t, p, in topics_with_payloads]
        mqtt_publish.multiple(msgs, hostname=MQTT_HOSTNAME, port=MQTT_PORT, auth={"username": superuserJwtToken, "password": "not.used"})
    except Exception as ex:
        log.error(f"MQTT publishing: exception {''.join(traceback.format_exception(None, ex, ex.__traceback__))}")

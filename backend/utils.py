from colors import color
from enum import Enum
import json
import logging
import os

import requests


logging.basicConfig(format='%(asctime)s | %(levelname)s | %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S', level=logging.DEBUG)
logging.addLevelName(logging.DEBUG, color("DBG", 7))
logging.addLevelName(logging.INFO, "INF")
logging.addLevelName(logging.WARNING, color('WRN', fg='red'))
logging.addLevelName(logging.ERROR, color('ERR', bg='red'))
log = logging.getLogger("{}.{}".format(__name__, "base"))


# 'full', 'none', 'basic' (default)
TELEMETRY_LEVEL = os.environ.get('TELEMETRY', 'basic')


class TelemetryActions(Enum):
    BOOT = 'boot'
    MIGRATEDB = 'migratedb'


def is_telemetry_allowed(action):
    if action == TelemetryActions.BOOT:
        return TELEMETRY_LEVEL in ['basic', 'full']
    if action == TelemetryActions.MIGRATEDB:
        return TELEMETRY_LEVEL in ['full']
    return False


TELEMETRY_ACCOUNT = '1990041850'
TELEMETRY_BOT_TOKEN = '037cf5c0-20a9-4f2a-99b8-e07468a2b84b'
def telemetry_send(action):
    if not is_telemetry_allowed(action):
        return

    data = [
        {'p': f'telemetry.{action}', 'v': 1}
    ]
    try:
        r = requests.post(f'https://app.grafolean.com/api/accounts/{TELEMETRY_ACCOUNT}/values/?b={TELEMETRY_BOT_TOKEN}', data=json.dumps(data), content_type='application/json')
    except:
        log.exception(f"Telemetry sending is allowed, but failed (action '{action}')")


telemetry_send(TelemetryActions.BOOT)

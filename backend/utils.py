from colors import color
from enum import Enum
import json
import logging
import os

import requests


logging_level_str = os.environ.get('LOGGING_LEVEL', 'INFO').upper()
logging.basicConfig(format='%(asctime)s | %(levelname)s | %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S', level=logging_level_str)
logging.addLevelName(logging.DEBUG, color("DBG", 7))
logging.addLevelName(logging.INFO, "INF")
logging.addLevelName(logging.WARNING, color('WRN', fg='red'))
logging.addLevelName(logging.ERROR, color('ERR', bg='red'))
log = logging.getLogger("{}.{}".format(__name__, "base"))


# 'full', 'none', 'basic' (default)
TELEMETRY_LEVEL = os.environ.get('TELEMETRY', 'basic')


class TelemetryActions(Enum):
    BOOT = 'boot'  # sent from apply_env.sh
    MIGRATEDB = 'migratedb'

    def __str__(self):
        return str(self.value)


def is_telemetry_allowed(action):
    if action == TelemetryActions.BOOT:
        return TELEMETRY_LEVEL in ['basic', 'full']
    if action == TelemetryActions.MIGRATEDB:
        return TELEMETRY_LEVEL in ['full']
    return False


TELEMETRY_ACCOUNT = os.environ.get('TELEMETRY_ACCOUNT')
TELEMETRY_BOT_TOKEN = os.environ.get('TELEMETRY_BOT_TOKEN')
def telemetry_send(action):
    if not is_telemetry_allowed(action):
        return

    data = [
        {'p': f'telemetry.{action}', 'v': 1}
    ]
    try:
        log.debug(f"Telemetry: sending action '{action}'")
        r = requests.post(f'https://app.grafolean.com/api/accounts/{TELEMETRY_ACCOUNT}/values/?b={TELEMETRY_BOT_TOKEN}', json=data)
    except:
        log.exception(f"Telemetry sending is allowed, but failed (action '{action}')")


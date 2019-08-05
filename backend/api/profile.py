import flask
import json

from .common import auth_no_permissions
from datatypes import Account, Bot, Permission


profile_api = flask.Blueprint('profile_api', __name__)


# --------------
# /api/profile/ - user specific endpoints
# --------------


@profile_api.route('/permissions', methods=['GET'])
@auth_no_permissions
def profile_permissions():
    user_id = flask.g.grafolean_data['user_id']
    rec = Permission.get_list(user_id)
    return json.dumps({'list': rec}), 200


@profile_api.route('/accounts', methods=['GET'])
@auth_no_permissions
def profile_accounts():
    """
        Returns the list of accounts that this user (person or bot) has permission to access.
    """
    user_id = flask.g.grafolean_data['user_id']
    rec = Account.get_list(user_id)
    return json.dumps({
        'user_id': user_id,
        'list': rec,
    }), 200


@profile_api.route('/accounts/<int:account_id>/config/<string:protocol>', methods=['GET'])
@auth_no_permissions
def profile_account_bot_config_get(account_id, protocol):
    """
        Returns the configuration of a certain bot type (ping, snmp,...) for an account.
    """
    user_id = flask.g.grafolean_data['user_id']

    if not Bot.is_bot(user_id):
        return 'Only bots are allowed to access this endpoint', 400

    # !!! this information should be generated dynamically from the sensors
    res = []
    return json.dumps(res), 200

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


@profile_api.route('/accounts/<int:account_id>', methods=['GET'])
@auth_no_permissions
def profile_account_get(account_id):
    """
        Returns the configuration that is tied to a specified account for this user (bot).
    """
    user_id = flask.g.grafolean_data['user_id']

    res = {}
    if Bot.is_bot(user_id):
        bot_data = Bot.get(user_id, account_id)
        res["config"] = bot_data["config"]
    return json.dumps(res), 200

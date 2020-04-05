import quart as flask
import json

from .common import auth_no_permissions
from datatypes import Account, Bot, Permission, Person


profile_api = flask.Blueprint('profile_api', __name__)


# --------------
# /api/profile/ - user specific endpoints
# --------------


@profile_api.route('/', methods=['GET'])
@auth_no_permissions
async def profile():
    user_id = flask.g.grafolean_data['user_id']
    user_is_bot = flask.g.grafolean_data['user_is_bot']
    if user_is_bot:
        tied_to_account = await Bot.get_tied_to_account(user_id)
        return json.dumps({
            'user_id': user_id,
            'user_type': 'bot',
            'record': await Bot.get(user_id, tied_to_account=tied_to_account),
        }), 200
    else:
        return json.dumps({
            'user_id': user_id,
            'user_type': 'person',
            'record': await Person.get(user_id),
        }), 200


@profile_api.route('/permissions', methods=['GET'])
@auth_no_permissions
async def profile_permissions():
    user_id = flask.g.grafolean_data['user_id']
    rec = await Permission.get_list(user_id)
    return json.dumps({'list': rec}), 200

import flask
import json

from .common import auth_no_permissions
from datatypes import Account, Bot, Permission, Person


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


@profile_api.route('/person', methods=['GET'])
def profile_person():
    user_id = flask.g.grafolean_data['user_id']
    rec = Person.get(user_id)
    rec['permissions'] = Permission.get_list(user_id)
    return json.dumps(rec), 200

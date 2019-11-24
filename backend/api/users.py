import flask
import json

from .common import auth_no_permissions, mqtt_publish_changed
from datatypes import Account, Bot, Permission, Person


users_api = flask.Blueprint('users_api', __name__)


# --------------
# /api/users/, /api/persons/ and /api/bots/ - user management
# --------------


@users_api.route('/persons/<int:user_id>', methods=['GET'])
def person_get(user_id):
    rec = Person.get(user_id)
    rec['permissions'] = Permission.get_list(user_id)
    return json.dumps(rec), 200


@users_api.route('/persons/<int:user_id>', methods=['PUT'])
def person_put(user_id):
    person = Person.forge_from_input(flask.request, force_id=user_id)
    rowcount = person.update()
    if not rowcount:
        return "No such person", 404
    mqtt_publish_changed([
        'persons/{user_id}'.format(user_id=user_id),
        'bots/{user_id}'.format(user_id=user_id),
    ])
    return "", 204


@users_api.route('/persons/<int:user_id>/password', methods=['POST'])
def person_change_password(user_id):
    rowcount = Person.change_password(user_id, flask.request)
    if not rowcount:
        return "Change failed", 400
    return "", 204

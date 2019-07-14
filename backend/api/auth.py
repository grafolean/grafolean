import json
import secrets
import flask

from datatypes import Permission, PersonCredentials
from auth import JWT
from .common import noauth


auth_api = flask.Blueprint('auth_api', __name__)


# --------------
# /auth/ - authentication; might need different logging settings
# --------------


@auth_api.route('/login', methods=['POST'])
@noauth
def auth_login_post():
    credentials = PersonCredentials.forge_from_input(flask.request)
    user_id = credentials.check_user_login()
    if not user_id:
        return "Invalid credentials", 401

    session_data = {
        'user_id': user_id,
        'session_id': secrets.token_hex(32),
        'permissions': Permission.get_list(user_id),
    }
    response = flask.make_response(json.dumps(session_data), 200)
    response.headers['X-JWT-Token'], _ = JWT(session_data).encode_as_authorization_header()
    return response


@auth_api.route('/refresh', methods=['POST'])
@noauth
def auth_refresh_post():
    try:
        authorization_header = flask.request.headers.get('Authorization')
        if not authorization_header:
            return "Access denied", 401

        old_jwt = JWT.forge_from_authorization_header(authorization_header, allow_leeway=JWT.TOKEN_CAN_BE_REFRESHED_FOR)
        data = old_jwt.data.copy()
        new_jwt, _ = JWT(data).encode_as_authorization_header()

        response = flask.make_response(json.dumps(data), 200)
        response.headers['X-JWT-Token'] = new_jwt
        return response
    except:
        return "Access denied", 401

import flask
import json
import copy
import os
import socket
import psycopg2
from flask_mail import Message, Mail

from .common import noauth, auth_no_permissions, mqtt_publish_changed
import validators
from datatypes import Account, Bot, Permission, Person, AccessDeniedError, User


users_api = flask.Blueprint('users_api', __name__)


def users_apidoc_schemas():
    yield "BotPOST", validators.BotSchemaInputs
    yield "BotGET", {
        'type': 'object',
        'properties': {
            'id': {
                'type': 'integer',
                'description': "User id",
                'example': 123,
            },
            'name': {
                'type': 'string',
                'description': "Bot name",
                'example': 'My Bot',
            },
            'token': {
                'type': 'string',
                'format': 'uuid',
                'description': "Bot authentication token",
            },
            'insert_time': {
                'type': 'integer',
                'description': "Insert time (UNIX timestamp)",
                'example': 1234567890,
            },
        },
        'required': ['id', 'name', 'token', 'insert_time'],
    }

    personGETSchema = {
        'type': 'object',
        'properties': {
            'user_id': {
                'type': 'integer',
                'description': "User id",
                'example': 123,
            },
            'username': {
                'type': 'string',
                'description': "Username",
                'example': 'myusername',
            },
            'name': {
                'type': 'string',
                'description': "Name",
                'example': 'Grafo Lean',
            },
            'email': {
                'type': 'string',
                'format': 'email',
                'description': "someone@example.org",
            },
        },
    }
    yield "PersonGET", personGETSchema

    personGETWithPermissionsSchema = copy.deepcopy(personGETSchema)
    personGETWithPermissionsSchema['properties']['permissions'] = {
        'type': 'array',
        'items': validators.PermissionSchemaInputs,
    }
    yield "PersonGETWithPermissions", personGETWithPermissionsSchema
    yield "PersonPOST", validators.PersonSchemaInputsPOST
    yield "Permission", validators.PermissionSchemaInputs
    yield "PersonSignupNewPOST", validators.PersonSignupNewPOST
    yield "PersonSignupValidatePinPOST", validators.PersonSignupValidatePinPOST
    yield "PersonSignupCompletePOST", validators.PersonSignupCompletePOST
    yield "ForgotPasswordPOST", validators.ForgotPasswordPOST
    yield "ForgotPasswordResetPOST", validators.ForgotPasswordResetPOST


# --------------
# /api/users/, /api/persons/ and /api/bots/ - user management
# --------------


@users_api.route('/users/<int:user_id>', methods=['GET'])
def users_user_get(user_id):
    rec = User.get(user_id)
    if not rec:
        return "No such user", 404
    rec['permissions'] = Permission.get_list(user_id)
    return json.dumps(rec), 200


@users_api.route('/bots', methods=['GET', 'POST'])
def users_bots():
    """
        ---
        get:
          summary: Get systemwide bots
          tags:
            - Users
          description:
            Returns a list of all systemwide bots (bots which are not tied to a specific account). The list is returned in a single array (no pagination).
          responses:
            200:
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      list:
                        type: array
                        items:
                          "$ref": '#/definitions/BotGET'
        post:
          summary: Create a systemwide bot
          tags:
            - Users
          description:
            Creates a systemwide bot. By default, a created bot is without permissions, so they must be granted to it before it can do anything useful.

          parameters:
            - name: "body"
              in: body
              description: "Bot data"
              required: true
              schema:
                "$ref": '#/definitions/BotPOST'
          responses:
            201:
              content:
                application/json:
                  schema:
                    "$ref": '#/definitions/BotGET'
    """
    if flask.request.method in ['GET', 'HEAD']:
        rec = Bot.get_list()
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        bot = Bot.forge_from_input(flask.request.get_json())
        user_id, _ = bot.insert()
        rec = Bot.get(user_id, None)
        mqtt_publish_changed([
            'bots',
        ])
        return json.dumps(rec), 201


@users_api.route('/bots/<string:user_id>', methods=['GET', 'PUT', 'DELETE'])
def users_bot_crud(user_id):
    """
        ---
        get:
          summary: Get bot data
          tags:
            - Users
          description:
            Returns bot data.
          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: true
              schema:
                type: integer
          responses:
            200:
              content:
                application/json:
                  schema:
                    "$ref": '#/definitions/BotGET'
            404:
              description: No such bot
        put:
          summary: Update the bot
          tags:
            - Users
          description:
            Updates bot name. Note that all other fields are handled automatically (they can't be changed).
          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: true
              schema:
                type: integer
            - name: "body"
              in: body
              description: "Bot data"
              required: true
              schema:
                "$ref": '#/definitions/BotPOST'
          responses:
            204:
              description: Update successful
            404:
              description: No such bot
        delete:
          summary: Remove the bot
          tags:
            - Users
          description:
            Removes the bot. Also removes its permissions, if any.
          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: true
              schema:
                type: integer
          responses:
            204:
              description: Bot removed successfully
            403:
              description: Can't remove yourself
            404:
              description: No such bot
    """
    if flask.request.method in ['GET', 'HEAD']:
        rec = Bot.get(user_id, None)
        if not rec:
            return "No such bot", 404
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        bot = Bot.forge_from_input(flask.request.get_json(), force_id=user_id)
        rowcount = bot.update()
        if not rowcount:
            return "No such bot", 404
        mqtt_publish_changed([
            'bots/{user_id}'.format(user_id=user_id),
            'bots',
        ])
        return "", 204

    elif flask.request.method == 'DELETE':
        # bot should not be able to delete himself, otherwise they could lock themselves out:
        if int(flask.g.grafolean_data['user_id']) == int(user_id):
            return "Can't delete yourself", 403
        rowcount = Bot.delete(user_id)
        if not rowcount:
            return "No such bot", 404
        mqtt_publish_changed([
            'bots/{user_id}'.format(user_id=user_id),
            'bots',
        ])
        return "", 204


@users_api.route('/bots/<int:user_id>/token', methods=['GET'])
def users_bot_token_get(user_id):
    # make sure the user who is requesting to see the bot token has every permission that this token has, and
    # also that this user can add the bot:
    request_user_permissions = Permission.get_list(int(flask.g.grafolean_data['user_id']))
    if not Permission.has_all_permissions(request_user_permissions, user_id):
        return "Not enough permissions to see this bot's token", 401
    if not Permission.can_grant_permission(request_user_permissions, 'bots', 'POST'):
        return "Not enough permissions to see this bot's token - POST to /bots not allowed", 401
    token = Bot.get_token(user_id, None)
    if not token:
        return "No such bot", 404
    return {'token': token}, 200


@users_api.route('/persons', methods=['GET', 'POST'])
def users_persons():
    """
        ---
        get:
          summary: Get all persons
          tags:
            - Users
          description:
            Returns a list of all persons. The list is returned in a single array (no pagination).
          responses:
            200:
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      list:
                        type: array
                        items:
                          "$ref": '#/definitions/PersonGET'
        post:
          summary: Create a person account
          tags:
            - Users
          description:
            Creates a person account. By default (as any user) a person is without permissions, so they must be granted to it before it can do anything useful.
          parameters:
            - name: "body"
              in: body
              description: "Person data"
              required: true
              schema:
                "$ref": '#/definitions/PersonPOST'
          responses:
            201:
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
    """
    if flask.request.method in ['GET', 'HEAD']:
        rec = Person.get_list()
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        person = Person.forge_from_input(flask.request.get_json())
        user_id = person.insert()
        mqtt_publish_changed([
            'persons',
        ])
        return json.dumps({
            'id': user_id,
        }), 201


@users_api.route('/persons/<int:user_id>', methods=['GET', 'PUT', 'DELETE'])
def users_person_crud(user_id):
    """
        ---
        get:
          summary: Get person data
          tags:
            - Users
          description:
            Returns person data.
          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: true
              schema:
                type: integer
          responses:
            200:
              content:
                application/json:
                  schema:
                    "$ref": '#/definitions/PersonGETWithPermissions'
            404:
              description: No such person
        put:
          summary: Update the bot
          tags:
            - Users
          description:
            Updates person data.
          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: true
              schema:
                type: integer
            - name: "body"
              in: body
              description: "Person data"
              required: true
              schema:
                "$ref": '#/definitions/PersonPOST'
          responses:
            204:
              description: Update successful
            404:
              description: No such person
        delete:
          summary: Remove the person data
          tags:
            - Users
          description:
            Removes the person data. Also removes user's permissions, if any.
          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: true
              schema:
                type: integer
          responses:
            204:
              description: Person data removed successfully
            403:
              description: Can't remove yourself
            404:
              description: No such person
    """
    if flask.request.method in ['GET', 'HEAD']:
        rec = Person.get(user_id)
        if not rec:
            return "No such person", 404
        rec['permissions'] = Permission.get_list(user_id)
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        person = Person.forge_from_input(flask.request.get_json(), force_id=user_id)
        rowcount = person.update()
        if not rowcount:
            return "No such person", 404
        mqtt_publish_changed([
            'persons/{user_id}'.format(user_id=user_id),
            'persons',
        ])
        return "", 204

    elif flask.request.method == 'DELETE':
        # user should not be able to delete himself, otherwise they could lock themselves out:
        if int(flask.g.grafolean_data['user_id']) == int(user_id):
            return "Can't delete yourself", 403
        rowcount = Person.delete(user_id)
        if not rowcount:
            return "No such person", 404
        mqtt_publish_changed([
            'persons/{user_id}'.format(user_id=user_id),
            'persons',
        ])
        return "", 204


@users_api.route('/persons/<int:user_id>/password', methods=['POST'])
def users_person_change_password(user_id):
    rowcount = Person.change_password(user_id, flask.request.get_json())
    if not rowcount:
        return "Change failed", 400
    # no need to publish to mqtt - nobody cares
    return "", 204


@users_api.route('/users/<int:user_id>/permissions', methods=['GET', 'POST'])
@users_api.route('/bots/<int:user_id>/permissions', methods=['GET', 'POST'])
@users_api.route('/persons/<int:user_id>/permissions', methods=['GET', 'POST'])
def users_permissions_get_post(user_id):
    """
        ---
        get:
          summary: Get a list of all permissions granted to a specified user
          tags:
            - Users
          description:
            Returns a list of all permissions granted to the user. The list is returned in a single array (no pagination).


            Note that when comparing, resource prefix is checked either for equality (resource must match prefix), otherwise
            resource location must start with the prefix, followed by forward slash ('/'). In other words, allowing users
            access to 'accounts/123' does **not** grant them access to 'accounts/1234'.
          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: false
              schema:
                type: integer
          responses:
            200:
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      list:
                        type: array
                        items:
                          type: object
                          properties:
                            id:
                              type: integer
                              description: "Permission id"
                            resource_prefix:
                              type: string
                              nullable: true
                              description: "Resource prefix (e.g., 'admin/permissions' or 'accounts/123'); if null, this permission applies to any resource"
                            methods:
                              type: array
                              items:
                                type: string
                                enum:
                                  - "GET"
                                  - "POST"
                                  - "PUT"
                                  - "DELETE"
                              nullable: true
                              description: "List of HTTP methods allowed; if null, this permission applies to any method"
        post:
          summary: Grant permission to the user
          tags:
            - Users
          description:
            Grants a specified permission to the user. Permissions are defined with a combination of resource prefix and a list of methods.
            Since both persons and bots are users, this endpoint can be used for granting permissions to either of them.


            Note that when comparing, resource prefix is checked either for equality (resource must match prefix), otherwise
            resource location must start with the prefix, followed by forward slash ('/'). In other words, allowing users
            access to 'accounts/123' does **not** grant them access to 'accounts/1234'.


          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: false
              schema:
                type: integer
            - name: "body"
              in: body
              description: "Permission to be granted"
              required: true
              schema:
                "$ref": '#/definitions/Permission'
          responses:
            201:
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
                        description: "Permission id"
            400:
              description: Invalid parameters
            401:
              description: Not allowed to grant permissions
    """
    if flask.request.method in ['GET', 'HEAD']:
        rec = Permission.get_list(user_id=user_id)
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        granting_user_id = flask.g.grafolean_data['user_id']
        permission = Permission.forge_from_input(flask.request.get_json(), user_id)
        try:
            permission_id = permission.insert(granting_user_id)
            mqtt_publish_changed([
                'persons/{user_id}'.format(user_id=user_id),
                'bots/{user_id}'.format(user_id=user_id),
            ])
            return json.dumps({
                'id': permission_id,
            }), 201
        except AccessDeniedError as ex:
            return str(ex), 401
        except psycopg2.IntegrityError:
            return "Invalid parameters", 400


@users_api.route('/users/<int:user_id>/permissions/<int:permission_id>', methods=['DELETE'])
@users_api.route('/bots/<int:user_id>/permissions/<int:permission_id>', methods=['DELETE'])
@users_api.route('/persons/<int:user_id>/permissions/<int:permission_id>', methods=['DELETE'])
def users_permission_delete(permission_id, user_id):
    """
        ---
        delete:
          summary: Revoke permission
          tags:
            - Users
          description:
            Revokes a specific permission, as specified by permission id.
          parameters:
            - name: permission_id
              in: path
              description: "Permission id"
              required: true
              schema:
                type: integer
          responses:
            204:
              description: Permission removed successfully
            401:
              description: Not allowed to revoke this permission
            404:
              description: No such permission
    """
    granting_user_id = flask.g.grafolean_data['user_id']
    try:
        rowcount = Permission.delete(permission_id, user_id, granting_user_id)
    except AccessDeniedError as ex:
        return str(ex), 401
    if not rowcount:
        return "No such permission", 404
    mqtt_publish_changed([
        'persons/{user_id}'.format(user_id=user_id),
        'users/{user_id}'.format(user_id=user_id),
        'bots/{user_id}'.format(user_id=user_id),
    ])
    return "", 204


def _generate_signup_mail_message(name, email, frontend_origin, user_id, confirm_pin):
    return f'''\
Welcome, {name if name else email}!

Click on this link to complete the signup process:

{frontend_origin}/signup/confirm/{user_id}/{confirm_pin}

Grafolean lets you easily collect and visualize data. We're excited to have
you on board! Let us know if you need anything: info@grafolean.com

Grafolean Team

* If you don't know what this is about, and you didn't signup for anything,
please ignore this e-mail - there is nothing you need to do in this case.
Whoever has entered your e-mail address will not be able to complete their
registration.
'''


def _is_tor_exit_node(ipv4):
    ip_parts = ipv4.split('.')
    ip_parts.reverse()
    try:
        addr = socket.gethostbyname(f'{".".join(ip_parts)}.dnsel.torproject.org')
    except socket.gaierror:
        return False
    if addr.startswith('127.0.0') and addr != '127.0.0.1':
        return True
    return False


@users_api.route('/persons/signup/new', methods=['POST'])
@noauth
def users_person_signup_new():
    """
        ---
        post:
          summary: Allows a person to sign up (first step)
          tags:
            - Users
          description:
            Creates a new person (unconfirmed, with no access rights and without access to any account) and sends a welcome e-mail.
          parameters:
            - name: "body"
              in: body
              description: "Person data"
              required: true
              schema:
                "$ref": '#/definitions/PersonSignupNewPOST'
          responses:
            204:
              description: Request was accepted
            400:
              description: Invalid parameters
            403:
              description: Signup disabled
    """
    if os.environ.get('ENABLE_SIGNUP', 'false').lower() not in ['true', 'yes', 'on', '1']:
        return "Signup disabled", 403

    if os.environ.get('SIGNUP_DISALLOW_TOR', 'true').lower() in ['true', 'yes', 'on', '1']:
        # if user is coming from Tor exit node, disallow signup:
        client_ip = flask.request.environ.get('HTTP_X_FORWARDED_FOR', None)
        if not client_ip:
            return "Could not determine client IP", 403
        if _is_tor_exit_node(client_ip):
            return "Sorry, Tor exit nodes are not allowed to signup due to abuse", 403

    user_id, confirm_pin = Person.signup_new(flask.request.get_json())
    person_data = Person.get(user_id)

    mail_subject = "Welcome to Grafolean!"
    # unless explicitly set otherwise, assume that backend and frontend have the same origin:
    frontend_origin = os.environ.get('FRONTEND_ORIGIN', flask.request.url_root).rstrip('/')
    mail_body_text = _generate_signup_mail_message(person_data['name'], person_data['email'], frontend_origin, user_id, confirm_pin)

    msg = Message(mail_subject, sender="noreply@grafolean.com", recipients=[person_data['email']], body=mail_body_text)
    mail = Mail(flask.current_app)
    with mail.record_messages() as outbox:
        mail.send(msg)
        flask.g.outbox = outbox  # make sent messages accessible to tests

    return "", 204


@users_api.route('/persons/signup/validatepin', methods=['POST'])
@noauth
def users_person_signup_validatepin():
    """
        ---
        post:
          summary: Checks if confirmation pin is valid
          tags:
            - Users
          description:
            Checks if confirmation pin is valid (but doesn't complete the signup yet). This allows
            frontend to ask for a password before completing the signup process.
          parameters:
            - name: "body"
              in: body
              description: "Pin"
              required: true
              schema:
                "$ref": '#/definitions/PersonSignupValidatePinPOST'
          responses:
            204:
              description: Pin is valid
            400:
              description: Invalid parameters
            403:
              description: Signup disabled
    """
    if os.environ.get('ENABLE_SIGNUP', 'false').lower() not in ['true', 'yes', 'on', '1']:
        return "Signup disabled", 403

    confirm_pin_valid = Person.signup_pin_valid(flask.request.get_json())
    if confirm_pin_valid:
        return "", 204
    else:
        return "Invalid pin, invalid user id, or signup already completed", 400


@users_api.route('/persons/signup/complete', methods=['POST'])
@noauth
def users_person_signup_complete():
    """
        ---
        post:
          summary: Complete the signup process
          tags:
            - Users
          description:
            Completes the user's signup process by supplying a valid confirmation pin and a new password.
          parameters:
            - name: "body"
              in: body
              description: "Pin and password"
              required: true
              schema:
                "$ref": '#/definitions/PersonSignupCompletePOST'
          responses:
            204:
              description: Pin is valid
            400:
              description: Invalid parameters
            403:
              description: Signup disabled
    """
    if os.environ.get('ENABLE_SIGNUP', 'false').lower() not in ['true', 'yes', 'on', '1']:
        return "Signup disabled", 403

    status = Person.signup_complete(flask.request.get_json(), create_account=True)
    if status:
        return "", 204
    else:
        return "Invalid pin, invalid user id, or signup already completed", 400


def _generate_forgot_password_message(frontend_origin, user_id, confirm_pin):
    return f'''\
Hello,

We heard that you need a password reset. Click the link below and you will
be redirected to a page where you can set a new password:

{frontend_origin}/forgot/{user_id}/{confirm_pin}

This link expires in one hour.

Grafolean Team
'''


@users_api.route('/persons/forgot', methods=['POST'])
@noauth
def users_person_forgot_password():
    """
        ---
        post:
          summary: Sends an email with a reset password link
          tags:
            - Users
          description:
            If given an existing e-mail address, sends an e-mail message with a password reset link.
          parameters:
            - name: "body"
              in: body
              description: "E-mail address"
              required: true
              schema:
                "$ref": '#/definitions/ForgotPasswordPOST'
          responses:
            204:
              description: Request was accepted
            400:
              description: Invalid parameters
            500:
              description: Mail sending not setup
    """
    if not flask.current_app.config.get('MAIL_SERVER', None):
        return "Mail sending not setup", 500

    user_id, confirm_pin = Person.forgot_password(flask.request.get_json())
    if not user_id:
        return "Email does not correspond to any registered user", 400

    person_data = Person.get(user_id)
    mail_subject = "Grafolean password reset link"
    # unless explicitly set otherwise, assume that backend and frontend have the same origin:
    frontend_origin = os.environ.get('FRONTEND_ORIGIN', flask.request.url_root).rstrip('/')
    mail_body_text = _generate_forgot_password_message(frontend_origin, user_id, confirm_pin)

    msg = Message(mail_subject, sender="noreply@grafolean.com", recipients=[person_data['email']], body=mail_body_text)
    mail = Mail(flask.current_app)
    with mail.record_messages() as outbox:
        mail.send(msg)
        flask.g.outbox = outbox  # make sent messages accessible to tests

    return "", 204


@users_api.route('/persons/forgot/reset', methods=['POST'])
@noauth
def users_person_forgot_password_reset():
    """
        ---
        post:
          summary: Resets a forgotten password
          tags:
            - Users
          description:
            Resets person's password if person exists, confirmation pin is correct and less than 1 hour old and person account is confirmed.
          parameters:
            - name: "body"
              in: body
              description: "E-mail address"
              required: true
              schema:
                "$ref": '#/definitions/ForgotPasswordResetPOST'
          responses:
            204:
              description: Password was reset
            400:
              description: Invalid parameters
    """
    success = Person.forgot_password_reset(flask.request.get_json())
    if success:
        return "", 204
    else:
        return "Password could not be changed - expired / invalid pin or user does not exist", 400

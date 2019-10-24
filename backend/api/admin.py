import flask
import json
import psycopg2
import urllib.parse
import validators
import copy

from datatypes import AccessDeniedError, Account, Bot, Permission, Person
from auth import Auth, JWT, AuthFailedException
import utils
from utils import log
from .common import noauth, mqtt_publish_changed


admin_api = flask.Blueprint('admin_api', __name__)


def admin_apidoc_schemas():
    yield "BotPOST", validators.BotSchemaInputs.json[0].schema
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
        'items': validators.PermissionSchemaInputs.json[0].schema,
    }
    yield "PersonGETWithPermissions", personGETWithPermissionsSchema
    yield "PersonPOST", validators.PersonSchemaInputsPOST.json[0].schema
    yield "Permission", validators.PermissionSchemaInputs.json[0].schema


# --------------
# /admin/ - administration tools; can be locked to local access
# --------------

@admin_api.route('/migratedb', methods=['POST'])
@noauth
def admin_migratedb_post():
    """
        ---
        post:
          summary: Migrate database
          tags:
            - Admin
          description:
            Migrates database to latest schema version if needed.
          responses:
            204:
              description: Success
    """
    was_needed = utils.migrate_if_needed()
    if was_needed:
        mqtt_publish_changed(['status/info'])
    return '', 204


@admin_api.route('/first', methods=['POST'])
@noauth
def admin_first_post():
    """
        ---
        post:
          summary: Create first admin user
          tags:
            - Admin
          description:
            This endpoint helps with setting up a new installation. It allows us to set up just one initial
            admin access (with name, email and password). Later requests to the same endpoint will fail.
          parameters:
            - name: "body"
              in: body
              description: "First admin data and credentials"
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
                        description: "User id of created admin"
            401:
              description: System already initialized
    """
    if Auth.first_user_exists():
        return 'System already initialized', 401
    admin = Person.forge_from_input(flask.request)
    admin_id = admin.insert()
    # make it a superuser:
    permission = Permission(admin_id, None, None)
    permission.insert(None, skip_checks=True)
    mqtt_publish_changed(['status/info'])
    return json.dumps({
        'id': admin_id,
    }), 201


@admin_api.route('/mqtt-auth-plug/<string:check_type>', methods=['POST'])
@noauth
def admin_mqttauth_plug(check_type):
    """
        ---
        post:
          summary: Authorization for Mosquitto with mosquitto-auth-plug plugin
          tags:
            - Admin
          description:
            >
              If using MQTT (with mosquitto-auth-plug plugin), it should be configured
              to ask this endpoint about access rights via JWT tokens (Authorization header). The JWT token is supplied
              to MQTT by frontend via websockets through username (password is not used).
              See [mosquitto-auth-plug](https://github.com/jpmens/mosquitto-auth-plug) for more info.
          parameters:
            - name: check_type
              in: path
              description: "One of the 3 modes of calling this endpoint"
              required: true
              schema:
                type: "string"
                enum:
                  - "getuser"
                  - "superuser"
                  - "aclcheck"
            - name: Authorization
              in: header
              description: "JWT token (in other words: MQTT username)"
              schema:
                type: string
              required: true
          responses:
            200:
              description: Access allowed
            401:
              description: Access denied
    """
    # mqtt-auth-plug urlencodes JWT tokens, so we must decode them here:
    authorization_header = flask.request.headers.get('Authorization')
    authorization_header = urllib.parse.unquote(authorization_header, encoding='utf-8')
    # debugging:
    # if authorization_header == 'Bearer secret':
    #     log.info('--- secret account authenticated ---')
    #     return "", 200
    # log_received_jwt = JWT.forge_from_authorization_header(authorization_header, allow_leeway=3600*24*365*10)
    # log.info('mqtt-auth {}: {}, {}'.format(check_type.upper(), log_received_jwt.data, flask.request.form.to_dict()))
    try:
        if check_type == 'getuser':
            # we don't complicate about newly expired tokens here - if they are at all valid, browser will refresh them anyway.
            received_jwt = JWT.forge_from_authorization_header(authorization_header, allow_leeway=JWT.TOKEN_CAN_BE_REFRESHED_FOR)
            # jwt token was successfully decoded, so we can allow for the fact that this is a valid user - we'll still see about
            # access rights though (might be superuser, in which case everything goes, or it might be checked via aclcheck)
            return "", 200

        elif check_type == 'superuser':
            # we don't complicate about newly expired tokens here - if they are at all valid, browser will refresh them anyway.
            received_jwt = JWT.forge_from_authorization_header(authorization_header, allow_leeway=JWT.TOKEN_CAN_BE_REFRESHED_FOR)
            # is this our own attempt to publish something to MQTT, and the mosquitto auth plugin is asking us to authenticate ourselves?
            is_superuser = bool(received_jwt.data.get('superuser', False))
            if is_superuser:
                return "", 200

            log.info("Access denied (not a superuser)")
            return "Access denied", 401

        elif check_type == 'aclcheck':
            params = flask.request.form.to_dict()
            # When client connects, username is jwt token. However subscribing to topics doesn't necessarily reconnect so
            # fresh JWT token is not sent and we are getting the old one. This is OK though - if user kept the connection
            # we can assume that they would just keep refreshing the token. So we allow for some large leeway (10 years)
            received_jwt = JWT.forge_from_authorization_header(authorization_header, allow_leeway=3600*24*365*10)
            # superusers can do whatever they want to:
            is_superuser = bool(received_jwt.data.get('superuser', False))
            if is_superuser:
                return "", 200

            if params['topic'][:8] != 'changed/':
                log.info("Access denied (wrong topic)")
                return "Access denied", 401

            # check user's access rights:
            user_id = received_jwt.data['user_id']
            resource = params['topic'][8:]  # remove 'changed/' from the start of the topic to get the resource
            is_allowed = Permission.is_access_allowed(
                user_id=user_id,
                resource=resource,
                method='GET',  # users can only request read access (apart from backend, which is superuser anyway)
            )
            if is_allowed:
                return "", 200

            log.info("Access denied (permissions check failed for user '{}', url '{}', method 'GET')".format(user_id, resource))
            return "Access denied", 401

        return "Invalid endpoint", 404

    except AuthFailedException:
        log.info("Authentication failed")
        return "Access denied", 401
    except:
        log.exception("Exception while checking access rights")
        return "Access denied", 401


@admin_api.route('/bots', methods=['GET', 'POST'])
def admin_bots():
    """
        ---
        get:
          summary: Get all bots
          tags:
            - Admin
          description:
            Returns a list of all bots. The list is returned in a single array (no pagination).
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
          summary: Create a bot
          tags:
            - Admin
          description:
            Creates a bot. By default (as any user) a bot is without permissions, so they must be granted to it before it can do anything useful.

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
        bot = Bot.forge_from_input(flask.request)
        user_id, _ = bot.insert()
        rec = Bot.get(user_id)
        return json.dumps(rec), 201


@admin_api.route('/bots/<string:user_id>', methods=['GET', 'PUT', 'DELETE'])
def admin_bot_crud(user_id):
    """
        ---
        get:
          summary: Get bot data
          tags:
            - Admin
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
            - Admin
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
            - Admin
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
        rec = Bot.get(user_id)
        if not rec:
            return "No such bot", 404
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        bot = Bot.forge_from_input(flask.request, force_id=user_id)
        rowcount = bot.update()
        if not rowcount:
            return "No such bot", 404
        return "", 204

    elif flask.request.method == 'DELETE':
        # bot should not be able to delete himself, otherwise they could lock themselves out:
        if int(flask.g.grafolean_data['user_id']) == int(user_id):
            return "Can't delete yourself", 403
        rowcount = Bot.delete(user_id)
        if not rowcount:
            return "No such bot", 404
        return "", 204


@admin_api.route('/persons', methods=['GET', 'POST'])
def admin_persons():
    """
        ---
        get:
          summary: Get all persons
          tags:
            - Admin
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
            - Admin
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
        person = Person.forge_from_input(flask.request)
        user_id = person.insert()
        return json.dumps({
            'id': user_id,
        }), 201


@admin_api.route('/persons/<string:user_id>', methods=['GET', 'PUT', 'DELETE'])
def admin_person_crud(user_id):
    """
        ---
        get:
          summary: Get person data
          tags:
            - Admin
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
            - Admin
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
            - Admin
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
        person = Person.forge_from_input(flask.request, force_id=user_id)
        rowcount = person.update()
        if not rowcount:
            return "No such person", 404
        return "", 204

    elif flask.request.method == 'DELETE':
        # user should not be able to delete himself, otherwise they could lock themselves out:
        if int(flask.g.grafolean_data['user_id']) == int(user_id):
            return "Can't delete yourself", 403
        rowcount = Person.delete(user_id)
        if not rowcount:
            return "No such person", 404
        return "", 204


@admin_api.route('/users/<int:user_id>/permissions', methods=['GET', 'POST'])
@admin_api.route('/bots/<int:user_id>/permissions', methods=['GET', 'POST'])
@admin_api.route('/persons/<int:user_id>/permissions', methods=['GET', 'POST'])
def admin_permissions_get_post(user_id):
    """
        ---
        get:
          summary: Get a list of all permissions granted to a specified user
          tags:
            - Admin
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
            - Admin
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
        permission = Permission.forge_from_input(flask.request, user_id)
        try:
            permission_id = permission.insert(granting_user_id)
            mqtt_publish_changed([
                'admin/persons/{user_id}'.format(user_id=user_id),
                'admin/bots/{user_id}'.format(user_id=user_id),
            ])
            return json.dumps({
                'id': permission_id,
            }), 201
        except AccessDeniedError as ex:
            return str(ex), 401
        except psycopg2.IntegrityError:
            return "Invalid parameters", 400


@admin_api.route('/users/<int:user_id>/permissions/<int:permission_id>', methods=['DELETE'])
@admin_api.route('/bots/<int:user_id>/permissions/<int:permission_id>', methods=['DELETE'])
@admin_api.route('/persons/<int:user_id>/permissions/<int:permission_id>', methods=['DELETE'])
def admin_permission_delete(permission_id, user_id):
    """
        ---
        delete:
          summary: Revoke permission
          tags:
            - Admin
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
        'admin/persons/{user_id}'.format(user_id=user_id),
        'admin/bots/{user_id}'.format(user_id=user_id),
    ])
    return "", 204


@admin_api.route('/accounts', methods=['GET', 'POST'])
def accounts_crud():
    if flask.request.method in ['GET', 'HEAD']:
        rec = Account.get_list()
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        account = Account.forge_from_input(flask.request)
        account_id = account.insert()
        return json.dumps({'name': account.name, 'id': account_id}), 201

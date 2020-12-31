import flask
import json
import urllib.parse

from .common import noauth, mqtt_publish_changed, send_telemetry_bg
from datatypes import Account, Permission, Person, Bot
from auth import Auth, JWT, AuthFailedException
import dbutils
from utils import log, TelemetryActions
import validators


admin_api = flask.Blueprint('admin_api', __name__)


def admin_apidoc_schemas():
    yield "AccountSchemaInputs", validators.AccountSchemaInputs


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
    was_needed = dbutils.migrate_if_needed()
    if was_needed:
        mqtt_publish_changed(['status/info'])
    send_telemetry_bg(TelemetryActions.MIGRATEDB)
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
            At the same time a systemwide (ICMP ping) bot is configured and its token shared via file with
            a grafolean-ping-bot Docker container (in default setup).
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
    admin = Person.forge_from_input(flask.request.get_json())
    admin_id = admin.insert()
    # make it a superuser:
    permission = Permission(admin_id, None, None)
    permission.insert(None, skip_checks=True)

    # Help users by including a systemwide ping bot in the package by default:
    Bot.ensure_default_systemwide_bots_exist()

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
              If using MQTT (with iegomez/mosquitto-go-auth plugin), it should be configured
              to ask this endpoint about access rights via JWT tokens (Authorization header). The JWT token is supplied
              to MQTT by frontend via websockets through username (password is not used).
              See [mosquitto-go-auth](https://github.com/iegomez/mosquitto-go-auth) for more info.
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


            # From https://github.com/iegomez/mosquitto-go-auth#acl-access-values:
            #     ACL access values: Mosquitto 1.5 introduced a new ACL access value, MOSQ_ACL_SUBSCRIBE, which is similar
            #     to the classic MOSQ_ACL_READ value but not quite the same:
            #
            #      *  MOSQ_ACL_SUBSCRIBE when a client is asking to subscribe to a topic string.
            #      *                     This differs from MOSQ_ACL_READ in that it allows you to
            #      *                     deny access to topic strings rather than by pattern. For
            #      *                     example, you may use MOSQ_ACL_SUBSCRIBE to deny
            #      *                     subscriptions to '#', but allow all topics in
            #      *                     MOSQ_ACL_READ. This allows clients to subscribe to any
            #      *                     topic they want, but not discover what topics are in use
            #      *                     on the server.
            #      *  MOSQ_ACL_READ      when a message is about to be sent to a client (i.e. whether
            #      *                     it can read that topic or not).
            #
            #     The main difference is that subscribe is checked at first, when a client connects and tells the broker it
            #     wants to subscribe to some topic, while read is checked when an actual message is being published to that
            #     topic, which makes it particular. So in practice you could deny general subscriptions such as # by returning
            #     false from the acl check when you receive MOSQ_ACL_SUBSCRIBE, but allow any particular one by returning true
            #     on MOSQ_ACL_READ. Please take this into consideration when designing your ACL records on every backend.

            # - from now on we only allow READ access, all other access levels are denied for non-superusers
            # - subscribing is only allowed for resources to which user has read access too
            requested_access = int(params['acc'])
            if requested_access not in [1, 4] :  # NONE = 0, READ = 1, WRITE = 2, SUBSCRIBE = 4
                instead_got = {0: "0/NONE", 2: "2/WRITE"}.get(requested_access, requested_access)
                log.info(f"Access denied (only 1/READ or 4/SUBSCRIBE allowed, requested access: {instead_got})")
                return "Access denied", 401

            # only 'changed/#' can actually be read by normal users:
            if params['topic'][:8] != 'changed/':
                log.info("Access denied (wrong topic)")
                return "Access denied", 401
            resource = params['topic'][8:]  # remove 'changed/' from the start of the topic to get the resource
            resource = resource.rstrip('/')

            # finally, make sure user has access rights:
            user_id = received_jwt.data['user_id']
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

    except AuthFailedException as ex:
        log.info(f"Authentication failed: {str(ex)}")
        return "Access denied", 401
    except:
        log.exception("Exception while checking access rights")
        return "Access denied", 401


@admin_api.route('/accounts', methods=['GET', 'POST'])
def accounts_crud():
    """
        ---
        get:
          summary: Get accounts
          tags:
            - Admin
          description:
            Returns a list of accounts that this user has the permission to access. The list is returned in a single array (no pagination).
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
                              description: "Account id"
                            name:
                              type: string
                              description: "Account name"
        post:
          summary: Create an account
          tags:
            - Admin
          description:
            Creates an account.
          parameters:
            - name: "body"
              in: body
              description: "Account data"
              required: true
              schema:
                "$ref": '#/definitions/AccountSchemaInputs'
          responses:
            201:
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
                        description: "Account id"
                      name:
                        type: string
                        description: "Account name"
    """
    if flask.request.method in ['GET', 'HEAD']:
        rec = Account.get_list()
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        account = Account.forge_from_input(flask.request.get_json())
        account_id = account.insert()
        return json.dumps({'name': account.name, 'id': account_id}), 201

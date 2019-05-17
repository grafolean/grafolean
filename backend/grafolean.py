#!/usr/bin/env python
from apispec import APISpec
from apispec_webframeworks.flask import FlaskPlugin
import atexit
from collections import defaultdict
from dotenv import load_dotenv
import flask
from functools import wraps
import json
import os
import paho.mqtt.publish as mqtt_publish
import psycopg2
import re
import secrets
import time
import urllib.parse
import validators
from werkzeug.exceptions import HTTPException

from datatypes import Measurement, Aggregation, Dashboard, Widget, Path, UnfinishedPathFilter, PathFilter, Timestamp, ValidationError, Person, Account, Permission, Bot, PersonCredentials, Person
import utils
from utils import log
from auth import Auth, JWT, AuthFailedException


app = flask.Flask(__name__, static_folder=None)
# since this is API, we don't care about trailing slashes - and we don't want redirects:
app.url_map.strict_slashes = False


try:
    # It turns out that supplying os.environ vars to a script running under uWSGI is not so trivial. The
    # easiest way is to simply write them to .env and load them here:
    dotenv_filename = os.path.join(app.root_path, '.env')
    load_dotenv(dotenv_filename)
except:
    pass


CORS_DOMAINS = list(filter(len, os.environ.get('GRAFOLEAN_CORS_DOMAINS', '').lower().split(",")))
MQTT_HOSTNAME = os.environ.get('MQTT_HOSTNAME')
MQTT_PORT = int(os.environ.get('MQTT_PORT', 1883))
MQTT_WS_HOSTNAME = os.environ.get('MQTT_WS_HOSTNAME', '')
MQTT_WS_PORT = os.environ.get('MQTT_WS_PORT', '')


class SuperuserJWTToken(object):
    """
        We distinguish between superuser and admin:
        - admin is a person who has unlimited access to resources
        - superuser is someone who is authenticated through a JWT token that has 'superuser' field set; it is only intended for internal use
    """
    jwt_tokens = {}
    valid_until = {}

    @classmethod
    def get_valid_token(cls, superuser_identifier):
        if not cls.jwt_tokens.get(superuser_identifier) or cls.valid_until.get(superuser_identifier, 0) < time.time() + 10.0:
            cls._refresh_token(superuser_identifier)
        return cls.jwt_tokens[superuser_identifier]

    @classmethod
    def _refresh_token(cls, superuser_identifier):
        data = {
            "superuser": superuser_identifier,
        }
        token_header, valid_until = JWT(data).encode_as_authorization_header()
        cls.jwt_tokens[superuser_identifier] = token_header[len('Bearer '):]
        cls.valid_until[superuser_identifier] = valid_until

    @classmethod
    def clear_cache(cls):
        cls.jwt_tokens = {}
        cls.valid_until = {}

# This function publishes notifications via MQTT when the content of some GET endpoint might have changed. For example,
# when adding a dashboard this function is called with 'accounts/{}/dashboards' so that anyone interested in dashboards
# can re-issue GET to the same endpoint URL.
def mqtt_publish_changed(topics, payload='1'):
    if not MQTT_HOSTNAME:
        log.debug("MQTT not connected, not publishing change of: [{}]".format(topics,))
        return
    log.debug("MQTT publishing change of: [{}]".format(topics,))
    # https://www.eclipse.org/paho/clients/python/docs/#id2
    msgs = [('changed/{}'.format(t), json.dumps(payload), 1, False) for t in topics]
    superuserJwtToken = SuperuserJWTToken.get_valid_token('backend_changed_notif')
    mqtt_publish.multiple(msgs, hostname=MQTT_HOSTNAME, port=MQTT_PORT, auth={"username": superuserJwtToken, "password": "not.used"})


@app.before_request
def before_request():

    # http://flask.pocoo.org/docs/1.0/api/#application-globals
    flask.g.grafolean_data = {}

    if not flask.request.endpoint in app.view_functions:
        # Calling /api/admin/migratedb with GET (instead of POST) is a common mistake, so it deserves a warning in the log:
        if flask.request.path == '/api/admin/migratedb' and flask.request.method == 'GET':
            log.warning("Did you want to use POST instead of GET?")
        return "Resource not found", 404

    # Browser might (if frontend and backend are not on the same origin) send a pre-flight OPTIONS request to get the
    # CORS settings. In this case 'Authorization' header will not be set, which could lead to 401 response, which browser
    # doesn't like. So let's just return 200 on all OPTIONS:
    if flask.request.method == 'OPTIONS':
        # we need to set 'Allow' header to notify caller which methods are available:
        methods = set()
        for rule in app.url_map.iter_rules():
            if flask.request.url_rule == rule:
                methods |= rule.methods
        response = flask.make_response('', 200)
        response.headers['Allow'] = ",".join(sorted(methods))
        return response

    if flask.request.method in ['GET', 'HEAD', 'POST']:
        # While it is true that CORS is client-side protection, the rules about preflights allow these 3 types of requests
        # to be sent to the server without OPTIONS preflight - which means that browser will learn about violation too late.
        # To combat this, we still check Origin header and explicitly deny non-whitelisted requests:
        origin_header = flask.request.headers.get('Origin', None)
        if origin_header:  # is it a cross-origin request?
            # still, we sometimes get origin header even if it is not a cross-origin request, so let's double check that we
            # indeed are doing CORS:
            if flask.request.url_root.rstrip('/') != origin_header:
                if origin_header not in CORS_DOMAINS and flask.request.path != '/api/status/info':  # this path is an exception
                    return 'CORS not allowed for this origin', 403

    if utils.db is None:
        utils.db_connect()
        if utils.db is None:
            # oops, DB error... we should return 5xx:
            return 'Service unavailable', 503

    view_func = app.view_functions[flask.request.endpoint]
    # unless we have explicitly used @noauth decorator, do authorization check here:
    if not hasattr(view_func, '_noauth'):
        try:
            user_id = None
            authorization_header = flask.request.headers.get('Authorization')
            query_params_bot_token = flask.request.args.get('b')
            if authorization_header is not None:
                received_jwt = JWT.forge_from_authorization_header(authorization_header, allow_leeway=0)
                flask.g.grafolean_data['jwt'] = received_jwt
                user_id = received_jwt.data['user_id']
            elif query_params_bot_token is not None:
                user_id = Bot.authenticate_token(query_params_bot_token)

            if user_id is None:
                log.exception("Authentication failed")
                return "Access denied", 401

            # check permissions:
            if not hasattr(view_func, '_auth_no_permissions'):
                resource = flask.request.path[len('/api/'):]
                is_allowed = Permission.is_access_allowed(
                    user_id = user_id,
                    resource = resource,
                    method = flask.request.method,
                )
                if not is_allowed:
                    log.info("Access denied (permissions check failed) {} {} {}".format(user_id, resource, flask.request.method))
                    return "Access denied", 401

            flask.g.grafolean_data['user_id'] = user_id
        except AuthFailedException:
            log.exception("Authentication failed")
            return "Access denied", 401
        except:
            log.exception("Exception while checking access rights")
            return "Could not validate access", 500

def _add_cors_headers(response):
    if flask.request.path == '/api/status/info':
        # we are nice to the frontend - we allow call to (only) this path, so that if CORS is misconfigured, frontend can advise on proper solution:
        allow_origin = '*'
    else:
        # allow cross-origin request if Origin matches env var:
        if not CORS_DOMAINS:
            # browser has set Origin header (so the request might be cross-domain or POST), but we don't allow CORS, so we don't set any header
            return
        origin_header = flask.request.headers.get('Origin', None)
        if not origin_header:
            # Origin header was not set in request, so there is no need to set CORS headers (browser apparently thinks this is the same domain)
            return
        if origin_header not in CORS_DOMAINS:
            # the protocol + domain (+ port) in Origin header doesn't match any of the specified domains, so we don't set any headers:
            return
        allow_origin = origin_header

    # domain in Origin header matches, return appropriate CORS headers:
    response.headers['Access-Control-Allow-Origin'] = allow_origin
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, PUT, OPTIONS'
    response.headers['Access-Control-Expose-Headers'] = 'X-JWT-Token'
    response.headers['Access-Control-Max-Age'] = '3600'  # https://damon.ghost.io/killing-cors-preflight-requests-on-a-react-spa/

@app.after_request
def after_request(response):
    _add_cors_headers(response)
    # don't you just hate it when curl output hijacks half of the line? Let's always add newline:
    response.set_data(response.get_data() + b"\n")
    #time.sleep(1.0)  # so we can see "loading" signs
    return response


@app.errorhandler(ValidationError)
def handle_invalid_usage(error):
    return 'Input validation failed: {}'.format(str(error)), 400


@app.errorhandler(Exception)
def handle_error(e):
    log.exception(e)
    code = 500
    if isinstance(e, HTTPException):
        code = e.code
    response = flask.make_response('Unknown exception: {}'.format(str(e)), code)
    _add_cors_headers(response)  # even if we fail, we should still add CORS headers, or browsers won't display real error status
    return response


def noauth(func):
    # This decorator puts a mark in *the route function* so that before_request can check for it, and decide not to
    # do authorization checks. It is a bit of a hack, but it works: https://stackoverflow.com/a/19575396/593487
    # The beauty of this approach is that every endpoint is defended *by default*.
    # WARNING: any further decorators must carry the attribute "_noauth" over to the wrapper.
    func._noauth = True
    return func


def auth_no_permissions(func):
    # Similar to noauth() decorator, except that it performs authentication, but doesn't deny access based on permissions.
    # This is useful for endpoint which should be accessible to all authenticated users (like /profile/*), but not to
    # unauthenticated.
    func._auth_no_permissions = True
    return func


# -----------------------------------------------------------------------
# Routes:
# -----------------------------------------------------------------------

# --------------
# /admin/ - administration tools; can be locked to local access
# --------------

@app.route('/api/admin/migratedb', methods=['POST'])
@noauth
def admin_migratedb_post():
    """
        ---
        post:
          summary: Migrate database
          tags:
            - admin
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


@app.route('/api/admin/first', methods=['POST'])
@noauth
def admin_first_post():
    """
        ---
        post:
          summary: Create first admin user
          tags:
            - admin
          description:
            This endpoint helps with setting up a new installation. It allows us to set up just one initial
            admin access (with name, email and password). Later requests to the same endpoint will fail.
          parameters:
            - name: "body"
              in: body
              description: "First admin data and credentials"
              required: true
              schema:
                "$ref": '#/components/schemas/PersonPOST'
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
    permission.insert()
    mqtt_publish_changed(['status/info'])
    return json.dumps({
        'id': admin_id,
    }), 201


@app.route('/api/admin/mqtt-auth-plug/<string:check_type>', methods=['POST'])
@noauth
def admin_mqttauth_plug(check_type):
    """
        ---
        post:
          summary: Authorization for Mosquitto with mosquitto-auth-plug plugin
          tags:
            - admin
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
                user_id = user_id,
                resource = resource,
                method = 'GET',  # users can only request read access (apart from backend, which is superuser anyway)
            )
            if is_allowed:
                return "", 200

            log.info("Access denied (permissions check failed for user '{}', url '{}', method 'GET')".format(user_id, resource))
            return "Access denied", 401

        return "Invalid endpoint", 404

    except AuthFailedException:
        log.exception("Authentication failed")
        return "Access denied", 401
    except:
        log.exception("Exception while checking access rights")
        return "Access denied", 401


@app.route('/api/admin/permissions', methods=['GET', 'POST'])
def admin_permissions_get_post():
    """
        ---
        get:
          summary: Get a list of all permissions granted to users
          tags:
            - admin
          description:
            Returns a list of all permissions granted to users. The list is returned in a single array (no pagination).


            Note that when comparing, resource prefix is checked either for equality (resource must match prefix), otherwise
            resource location must start with the prefix, followed by forward slash ('/'). In other words, allowing users
            access to 'accounts/123' does **not** grant them access to 'accounts/1234'.
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
                            user_id:
                              type: integer
                              nullable: true
                              description: "User id; if null, this permission is granted to any user"
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
          summary: Grant permission to user(s)
          tags:
            - admin
          description:
            Grants a specified permission to a single users or to all users. Permissions are defined with a combination of resource prefix and a list of methods.
            Since both persons and bots are users, this endpoint can be used for granting permissions to either of them.


            Note that when comparing, resource prefix is checked either for equality (resource must match prefix), otherwise
            resource location must start with the prefix, followed by forward slash ('/'). In other words, allowing users
            access to 'accounts/123' does **not** grant them access to 'accounts/1234'.


          parameters:
            - name: "body"
              in: body
              description: "Permission to be granted"
              required: true
              schema:
                "$ref": '#/components/schemas/Permission'
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
                      user_id:
                        type: integer
                        nullable: true
                        description: "User id; if null, this permission is granted to any user"
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
            400:
              description: Invalid parameters
    """
    if flask.request.method in ['GET', 'HEAD']:
        rec = Permission.get_list()
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        permission = Permission.forge_from_input(flask.request)
        try:
            permission_id = permission.insert()
            mqtt_publish_changed([
                f'admin/persons/{permission.user_id}',
                f'admin/bots/{permission.user_id}',
            ])
            return json.dumps({
                'user_id': permission.user_id,
                'resource_prefix': permission.resource_prefix,
                'methods': permission.methods,
                'id': permission_id,
            }), 201
        except psycopg2.IntegrityError:
            return "Invalid parameters", 400


@app.route('/api/admin/permissions/<string:permission_id>', methods=['DELETE'])
def admin_permission_delete(permission_id):
    """
        ---
        delete:
          summary: Revoke permission
          tags:
            - admin
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
            404:
              description: No such permission
    """
    rowcount, user_id = Permission.delete(permission_id)
    if not rowcount:
        return "No such permission", 404
    mqtt_publish_changed([
        f'admin/persons/{user_id}',
        f'admin/bots/{user_id}',
    ])
    return "", 204


@app.route('/api/admin/bots', methods=['GET', 'POST'])
def admin_bots():
    """
        ---
        get:
          summary: Get all bots
          tags:
            - admin
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
                          "$ref": '#/components/schemas/BotGET'
        post:
          summary: Create a bot
          tags:
            - admin
          description:
            Creates a bot. By default (as any user) a bot is without permissions, so they must be granted to it before it can do anything useful.

          parameters:
            - name: "body"
              in: body
              description: "Bot data"
              required: true
              schema:
                "$ref": '#/components/schemas/BotPOST'
          responses:
            201:
              content:
                application/json:
                  schema:
                    "$ref": '#/components/schemas/BotGET'
    """
    if flask.request.method in ['GET', 'HEAD']:
        rec = Bot.get_list()
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        bot = Bot.forge_from_input(flask.request)
        user_id, bot_token = bot.insert()
        rec = Bot.get(user_id)
        return json.dumps(rec), 201


@app.route('/api/admin/bots/<string:user_id>', methods=['GET', 'PUT', 'DELETE'])
def admin_bot_crud(user_id):
    """
        ---
        get:
          summary: Get bot data
          tags:
            - admin
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
                    "$ref": '#/components/schemas/BotGET'
            404:
              description: No such bot
        put:
          summary: Update the bot
          tags:
            - admin
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
                "$ref": '#/components/schemas/BotPOST'
          responses:
            204:
              description: Update successful
            404:
              description: No such bot
        delete:
          summary: Remove the bot
          tags:
            - admin
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


@app.route('/api/admin/persons', methods=['GET', 'POST'])
def admin_persons():
    """
        ---
        get:
          summary: Get all persons
          tags:
            - admin
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
                          "$ref": '#/components/schemas/PersonGET'
        post:
          summary: Create a person account
          tags:
            - admin
          description:
            Creates a person account. By default (as any user) a person is without permissions, so they must be granted to it before it can do anything useful.
          parameters:
            - name: "body"
              in: body
              description: "Person data"
              required: true
              schema:
                "$ref": '#/components/schemas/PersonPOST'
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


@app.route('/api/admin/persons/<string:user_id>', methods=['GET', 'PUT', 'DELETE'])
def admin_person_crud(user_id):
    """
        ---
        get:
          summary: Get person data
          tags:
            - admin
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
                    "$ref": '#/components/schemas/PersonGETWithPermissions'
            404:
              description: No such person
        put:
          summary: Update the bot
          tags:
            - admin
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
                "$ref": '#/components/schemas/PersonPOST'
          responses:
            204:
              description: Update successful
            404:
              description: No such person
        delete:
          summary: Remove the person data
          tags:
            - admin
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


# --------------
# /status/ - system status information
# --------------


# Useful for determining status of backend (is it available, is the first user initialized,...)
@app.route('/api/status/info', methods=['GET'])
@noauth
def status_info_get():
    db_migration_needed = utils.is_migration_needed()
    result = {
        'alive': True,
        'db_migration_needed': db_migration_needed,
        'db_version': utils.get_existing_schema_version(),
        'user_exists': Auth.first_user_exists() if not db_migration_needed else None,
        'cors_domains': CORS_DOMAINS,
        'mqtt_ws_hostname': MQTT_WS_HOSTNAME,
        'mqtt_ws_port': MQTT_WS_PORT,
    }
    return json.dumps(result), 200


@app.route('/api/status/sitemap', methods=['GET'])
@noauth
def status_sitemap_get():
    ignored_methods = set(['HEAD', 'OPTIONS'])
    rules = defaultdict(set)
    for rule in app.url_map.iter_rules():
        rules[str(rule)] |= rule.methods
    result = [{ 'url': k, 'methods': sorted(list(v - ignored_methods))} for k, v in rules.items()]
    return json.dumps(result), 200


@app.route('/api/status/cspreport', methods=['POST'])
@noauth
def status_cspreport():
    log.error("CSP report received: {}".format(flask.request.data))
    return '', 200


# --------------
# /profile/ - user specific endpoints
# --------------


@app.route('/api/profile/permissions', methods=['GET'])
@auth_no_permissions
def profile_permissions():
    user_id = flask.g.grafolean_data['user_id']
    rec = Permission.get_list(user_id)
    return json.dumps({'list': rec}), 200


@app.route('/api/profile/accounts', methods=['GET'])
@auth_no_permissions
def profile_accounts():
    user_id = flask.g.grafolean_data['user_id']
    rec = Account.get_list(user_id)
    return json.dumps({'list': rec}), 200


# --------------
# /auth/ - authentication; might need different logging settings
# --------------

@app.route('/api/auth/login', methods=['POST'])
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


@app.route('/api/auth/refresh', methods=['POST'])
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


@app.route('/api/admin/accounts', methods=['GET', 'POST'])
def accounts_crud():
    if flask.request.method in ['GET', 'HEAD']:
        rec = Account.get_list()
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        account = Account.forge_from_input(flask.request)
        try:
            account_id = account.insert()
            return json.dumps({'name': account.name, 'id': account_id}), 201
        except psycopg2.IntegrityError:
            return "Account with this name already exists", 400


@app.route('/api/accounts/<string:account_id>', methods=['GET', 'PUT'])
def account_crud(account_id):
    if flask.request.method in ['GET', 'HEAD']:
        rec = Account.get(account_id)
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        rec = Account.forge_from_input(flask.request, force_id=account_id)
        rowcount = rec.update()
        if not rowcount:
            return "No such account", 404
        mqtt_publish_changed([
            f'accounts/{account_id}',
        ])
        return "", 204


@app.route("/api/accounts/<string:account_id>/values", methods=['PUT'])
def values_put(account_id):
    data = flask.request.get_json()
    # let's just pretend our data is of correct form, otherwise Exception will be thrown and Flask will return error response:
    try:
        Measurement.save_values_data_to_db(account_id, data)
        for d in data:
            mqtt_publish_changed(['accounts/{}/values/{}'.format(account_id, d['p'])], { 'v': d['v'], 't': d['t'] })
    except psycopg2.IntegrityError:
        return "Invalid input format", 400
    return ""


@app.route("/api/accounts/<string:account_id>/values", methods=['POST'])
def values_post(account_id):
    # data comes from two sources, query params and JSON body. We use both and append timestamp to each
    # piece, then we use the same function as for PUT:
    data = []
    now = time.time()
    json_data = flask.request.get_json()
    if json_data:
        for x in json_data:
            if x.get('t'):
                return "Parameter 't' shouldn't be specified with POST", 400
        data = [{
                'p': x['p'],
                'v': x['v'],
                't': now,
                } for x in json_data]
    query_params_p = flask.request.args.get('p')
    if query_params_p:
        if flask.request.args.get('t'):
            return "Query parameter 't' shouldn't be specified with POST", 400
        data.append({
            'p': query_params_p,
            'v': flask.request.args.get('v'),
            't': now,
        })
    if not data:
        return "Missing data", 400

    # let's just pretend our data is of correct form, otherwise Exception will be thrown and Flask will return error response:
    Measurement.save_values_data_to_db(account_id, data)
    for d in data:
        mqtt_publish_changed(['accounts/{}/values/{}'.format(account_id, d['p'])], { 'v': d['v'], 't': d['t'] })
    return ""


@app.route("/api/accounts/<string:account_id>/values", methods=['GET'])
@app.route("/api/accounts/<string:account_id>/values/<string:path_input>", methods=['GET'])
def values_get(account_id, path_input=None):
    # validate and convert input parameters:
    if path_input:
        if "," in path_input:
            return "Only a single path is allowed as part of URL\n\n", 400
        paths_input = path_input
    else:
        paths_input = flask.request.args.get('p')
    if paths_input is None:
        return "Path(s) not specified\n\n", 400
    try:
        paths = [Path(account_id, p) for p in paths_input.split(',')]
    except:
        return "Path(s) not specified correctly\n\n", 400

    t_from_input = flask.request.args.get('t0')
    if t_from_input:
        t_froms = [Timestamp(t) for t in t_from_input.split(',')]
        if len(t_froms) == 1:
            t_froms = [t_froms[0] for _ in paths]
        elif len(t_froms) == len(paths):
            pass
        else:
            return "Number of t0 timestamps must be 1 or equal to number of paths\n\n", 400
    else:
        t_from = Measurement.get_oldest_measurement_time(account_id, paths)
        if not t_from:
            t_from = Timestamp(time.time())
        t_froms = [t_from for _ in paths]

    t_to_input = flask.request.args.get('t1')
    if t_to_input:
        t_to = Timestamp(t_to_input)
    else:
        t_to = Timestamp(time.time())

    aggr_level_input = flask.request.args.get('a')
    if not aggr_level_input:
        # suggest the aggr. level based on paths and time interval and redirect to it:
        suggested_aggr_level = Measurement.get_suggested_aggr_level(min(t_froms), t_to)
        if suggested_aggr_level is None:
            str_aggr_level = 'no'
        else:
            str_aggr_level = str(suggested_aggr_level)
        url = flask.request.url + ('&' if '?' in flask.request.url else '?') + 'a=' + str_aggr_level
        return flask.redirect(url, code=301)
    elif aggr_level_input == 'no':
        aggr_level = None
    else:
        try:
            aggr_level = int(aggr_level_input)
        except:
            return "Invalid parameter: a\n\n", 400
        if not (0 <= aggr_level <= 6):
            return "Invalid parameter a (should be 'no' or in range from 0 to 6).\n\n", 400

    sort_order_input = flask.request.args.get('sort', 'asc')
    try:
        sort_order = str(sort_order_input)
        if sort_order not in ['asc', 'desc']:
            return "Invalid parameter: sort (should be 'asc' or 'desc')\n\n", 400
        should_sort_asc = True if sort_order == 'asc' else False
    except:
        return "Invalid parameter: sort\n\n", 400

    max_records_input = flask.request.args.get('limit', Measurement.MAX_DATAPOINTS_RETURNED)
    try:
        max_records = int(max_records_input)
        if max_records > Measurement.MAX_DATAPOINTS_RETURNED:
            return "Invalid parameter: limit (max. value is {})\n\n".format(Measurement.MAX_DATAPOINTS_RETURNED), 400
    except:
        return "Invalid parameter: limit\n\n", 400

    if not Aggregation.times_aligned_to_aggr(t_froms, aggr_level):
        return "Starting date(s) is/are not aligned to aggregation level\n\n", 400
    if not Aggregation.times_aligned_to_aggr([t_to], aggr_level):
        return "End date is not aligned to aggregation level\n\n", 400

    # finally, return the data:
    paths_data = Measurement.fetch_data(account_id, paths, aggr_level, t_froms, t_to, should_sort_asc, max_records)
    return json.dumps({
        'paths': paths_data,
    }), 200


@app.route("/api/accounts/<string:account_id>/paths", methods=['GET'])
def paths_get(account_id):
    max_results_input = flask.request.args.get('limit')
    if not max_results_input:
        max_results = 10
    else:
        max_results = max(0, int(max_results_input))
    path_filters_input = flask.request.args.get('filter')
    failover_trailing = flask.request.args.get('failover_trailing', 'false').lower() == 'true'

    try:
        matching_paths = {}
        any_found = False
        any_limit_reached = False
        for path_filter_input in str(path_filters_input).split(','):
            pf = str(PathFilter(path_filter_input))
            matching_paths[pf], limit_reached = PathFilter.find_matching_paths(account_id, [pf], limit=max_results)
            any_found = len(matching_paths[pf]) > 0 or any_found
            any_limit_reached = any_limit_reached or limit_reached
    except ValidationError:
        if not failover_trailing:
            raise
        # looks like we don't have a valid filter, but that's ok - we allow trailing chars so it might fare better there
        matching_paths, any_limit_reached = {}, False

    ret = {
        'paths': matching_paths if any_found else {},
        'limit_reached': any_limit_reached,
    }

    if failover_trailing and not any_found:
        ret['paths_with_trailing'] = {}
        for path_filter_input in str(path_filters_input).split(','):
            upf = str(UnfinishedPathFilter(path_filter_input))
            ret['paths_with_trailing'][upf], limit_reached = UnfinishedPathFilter.find_matching_paths(account_id, [upf], limit=max_results, allow_trailing_chars=True)
            ret['limit_reached'] = ret['limit_reached'] or limit_reached

    return json.dumps(ret), 200

@app.route("/api/accounts/<string:account_id>/paths", methods=['DELETE'])
def path_delete(account_id):
    path_input = flask.request.args.get('p')
    if path_input is None:
        return "Missing parameter: p\n\n", 400

    try:
        path = Path(account_id, path_input)
    except:
        return "Invalid parameter: p\n\n", 400

    rowcount = Path.delete(account_id, str(path))
    if not rowcount:
        return "No such path", 404
    return "", 200

@app.route("/api/accounts/<string:account_id>/dashboards", methods=['GET', 'POST'])
def dashboards_crud(account_id):
    if flask.request.method in ['GET', 'HEAD']:
        rec = Dashboard.get_list(account_id)
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        dashboard = Dashboard.forge_from_input(account_id, flask.request)
        try:
            dashboard.insert()
        except psycopg2.IntegrityError:
            return "Dashboard with this slug already exists", 400
        mqtt_publish_changed([f'accounts/{account_id}/dashboards'])
        return json.dumps({'slug': dashboard.slug}), 201


@app.route("/api/accounts/<string:account_id>/dashboards/<string:dashboard_slug>", methods=['GET', 'PUT', 'DELETE'])
def dashboard_crud(account_id, dashboard_slug):
    if flask.request.method in ['GET', 'HEAD']:
        rec = Dashboard.get(account_id, slug=dashboard_slug)
        if not rec:
            return "No such dashboard", 404
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        dashboard = Dashboard.forge_from_input(account_id, flask.request, force_slug=dashboard_slug)
        rowcount = dashboard.update()
        if not rowcount:
            return "No such dashboard", 404
        mqtt_publish_changed([
            f'accounts/{account_id}/dashboards',
            f'accounts/{account_id}/dashboards/{dashboard_slug}',
        ])
        return "", 204

    elif flask.request.method == 'DELETE':
        rowcount = Dashboard.delete(account_id, dashboard_slug)
        if not rowcount:
            return "No such dashboard", 404
        mqtt_publish_changed([
            f'accounts/{account_id}/dashboards',
            f'accounts/{account_id}/dashboards/{dashboard_slug}',
        ])
        return "", 200


@app.route("/api/accounts/<string:account_id>/dashboards/<string:dashboard_slug>/widgets", methods=['GET', 'POST'])
def widgets_crud(account_id, dashboard_slug):
    if flask.request.method in ['GET', 'HEAD']:
        try:
            paths_limit = int(flask.request.args.get('paths_limit', 200))
        except:
            return "Invalid parameter: paths_limit\n\n", 400
        rec = Widget.get_list(account_id, dashboard_slug, paths_limit=paths_limit)
        return json.dumps({'list': rec}), 200
    elif flask.request.method == 'POST':
        widget = Widget.forge_from_input(account_id, dashboard_slug, flask.request)
        try:
            widget_id = widget.insert()
        except psycopg2.IntegrityError:
            return "Widget with this slug already exists", 400
        return json.dumps({'id': widget_id}), 201


@app.route("/api/accounts/<string:account_id>/dashboards/<string:dashboard_slug>/widgets/<string:widget_id>", methods=['GET', 'PUT', 'DELETE'])
def widget_crud(account_id, dashboard_slug, widget_id):
    try:
        widget_id = int(widget_id)
    except:
        raise ValidationError("Invalid widget id")

    if flask.request.method in ['GET', 'HEAD']:
        try:
            paths_limit = int(flask.request.args.get('paths_limit', 200))
        except:
            return "Invalid parameter: paths_limit\n\n", 400
        rec = Widget.get(account_id, dashboard_slug, widget_id, paths_limit=paths_limit)
        if not rec:
            return "No such widget", 404
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        widget = Widget.forge_from_input(account_id, dashboard_slug, flask.request, widget_id=widget_id)
        rowcount = widget.update()
        if not rowcount:
            return "No such widget", 404
        return "", 204

    elif flask.request.method == 'DELETE':
        rowcount = Widget.delete(account_id, dashboard_slug, widget_id)
        if not rowcount:
            return "No such widget", 404
        return "", 200


def generate_api_docs(filename):
    import copy
    apidoc = APISpec(
        title="Grafolean API",
        version="0.0.32",
        openapi_version="3.0.2",
        plugins=[FlaskPlugin()],
    )
    apidoc.components.schema("BotPOST", validators.BotSchemaInputs.json[0].schema)
    botGETSchema = {
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
    apidoc.components.schema("BotGET", botGETSchema)

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
    apidoc.components.schema("PersonGET", personGETSchema)

    personGETWithPermissionsSchema = copy.deepcopy(personGETSchema)
    personGETWithPermissionsSchema['properties']['permissions'] = {
        'type': 'array',
        'items': validators.PermissionSchemaInputs.json[0].schema,
    }
    apidoc.components.schema("PersonGETWithPermissions", personGETWithPermissionsSchema)
    apidoc.components.schema("PersonPOST", validators.PersonSchemaInputsPOST.json[0].schema)

    apidoc.components.schema("Permission", validators.PermissionSchemaInputs.json[0].schema)

    with app.test_request_context():
        for rule in app.url_map.iter_rules():
            view = app.view_functions.get(rule.endpoint)
            apidoc.path(view=view)

    with open(filename, 'w') as openapi_yaml_file:
        openapi_yaml_file.write(apidoc.to_yaml())


if __name__ == "__main__":

    # When docs are generated, they can be served via Swagger-UI:
    #  $ docker run -d --rm -p 9000:8080 --name swagger-ui -e SWAGGER_JSON=/api_docs/openapi.yaml -v /tmp/api_docs:/api_docs swaggerapi/swagger-ui
    # To change CSS one must replace /usr/share/nginx/html/swagger-ui.css.

    # Generate the docs:
    # generate_api_docs('/tmp/api_docs/openapi.yaml')

    log.info("Starting main")
    app.run()

#!/usr/bin/env python
import os
import sys
from dotenv import load_dotenv
import flask
from werkzeug.exceptions import HTTPException


app = flask.Flask(__name__, static_folder=None)


try:
    # It turns out that supplying os.environ vars to a script running under uWSGI is not so trivial. The
    # easiest way is to simply write them to .env and load them here:
    dotenv_filename = os.path.join(app.root_path, '.env')
    load_dotenv(dotenv_filename)
except:
    pass


from datatypes import ValidationError, Permission, Bot
import utils
from utils import log
from auth import JWT, AuthFailedException
from api import CORS_DOMAINS, accounts_api, admin_api, auth_api, profile_api, status_api, admin_apidoc_schemas, accounts_apidoc_schemas
import validators


# since this is API, we don't care about trailing slashes - and we don't want redirects:
app.url_map.strict_slashes = False
# register the blueprints for different api endpoints:
app.register_blueprint(admin_api, url_prefix='/api/admin')
app.register_blueprint(profile_api, url_prefix='/api/profile')
app.register_blueprint(accounts_api, url_prefix='/api/accounts')
app.register_blueprint(status_api, url_prefix='/api/status')
app.register_blueprint(auth_api, url_prefix='/api/auth')


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
                log.info("Authentication failed")
                return "Access denied", 401

            # check permissions:
            if not hasattr(view_func, '_auth_no_permissions'):
                resource = flask.request.path[len('/api/'):]
                is_allowed = Permission.is_access_allowed(
                    user_id=user_id,
                    resource=resource,
                    method=flask.request.method,
                )
                if not is_allowed:
                    log.info("Access denied (permissions check failed) {} {} {}".format(user_id, resource, flask.request.method))
                    return "Access denied", 401

            flask.g.grafolean_data['user_id'] = user_id
        except AuthFailedException:
            log.info("Authentication failed")
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
    content_type_header = flask.request.headers.get('Content-Type', None)
    str_error = str(error)
    if not content_type_header or content_type_header != 'application/json':
        str_error = "{} - maybe Content-Type header was not set to application/json?".format(str_error)
    return 'Input validation failed: {}'.format(str_error), 400


@app.errorhandler(Exception)
def handle_error(e):
    log.exception(e)
    code = 500
    if isinstance(e, HTTPException):
        code = e.code
    response = flask.make_response('Unknown exception: {}'.format(str(e)), code)
    _add_cors_headers(response)  # even if we fail, we should still add CORS headers, or browsers won't display real error status
    return response


def generate_api_docs(filename, api_version):
    """
        Generates swagger (openapi) yaml from routes' docstrings (using apispec library).
    """
    from apispec import APISpec
    from apispec_webframeworks.flask import FlaskPlugin

    apidoc = APISpec(
        title="Grafolean API",
        version=api_version,
        openapi_version="2.0",
        plugins=[FlaskPlugin()],
        info={
            "description":
                "Grafolean is designed API-first. Meaning, every functionality of the system is accessible through the API " \
                "described below. This allows integration with external systems so that (given the permissions) they too can " \
                "enter values, automatically modify entities, set up dashboards... Everything that can be done through frontend " \
                "can also be achieved through API, as frontend is just an UI which uses the API. "
        }
    )

    for schema_name, schema in admin_apidoc_schemas():
        apidoc.components.schema(schema_name, schema)
    for schema_name, schema in accounts_apidoc_schemas():
        apidoc.components.schema(schema_name, schema)

    with app.test_request_context():
        for rule in app.url_map.iter_rules():
            view = app.view_functions.get(rule.endpoint)
            apidoc.path(view=view)

    with open(filename, 'w') as openapi_yaml_file:
        openapi_yaml_file.write(apidoc.to_yaml())


def print_usage():
    print("""
    This is the Grafolean backend.

    Usage:

        grafolean.py
            *** DO NOT USE THIS IN PRODUCTION! ***
            Starts Grafolean backend in *DEVELOPMENT* mode. It is only useful
            for development purposes.

        grafolean.py generate-api-doc-yaml /path/to/output/file.yaml 1.0.0
            Auto-generates API documentation in Swagger/OpenAPI format and
            writes it to the specified output file. Last argument is
            API version.
    """)


if __name__ == "__main__":

    # When docs are generated, they can be served via Swagger-UI:
    #  $ docker run -d --rm -p 9000:8080 --name swagger-ui -e SWAGGER_JSON=/api_docs/openapi.yaml -v /tmp/api_docs:/api_docs swaggerapi/swagger-ui
    # To change CSS one must replace /usr/share/nginx/html/swagger-ui.css.

    if len(sys.argv) > 1:
        if len(sys.argv) == 4 and sys.argv[1] == 'generate-api-doc-yaml':
            _, _, output_filename, version = sys.argv
            generate_api_docs(output_filename, version)
            sys.exit(0)
        else:
            print_usage()
            sys.exit(1)

    log.info("Starting main")
    app.run()

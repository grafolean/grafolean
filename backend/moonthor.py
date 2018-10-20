#!/usr/bin/python3
import argparse
import flask
from flask_sockets import Sockets
from functools import wraps
import json
import psycopg2
import re
import secrets
import time

from datatypes import Measurement, Aggregation, Dashboard, Widget, Path, UnfinishedPathFilter, PathFilter, Timestamp, ValidationError, User, Account, Permission, Bot, Credentials
import utils
from auth import Auth, JWT


app = flask.Flask(__name__)
# since this is API, we don't care about trailing slashes - and we don't want redirects:
app.url_map.strict_slashes = False
sockets = Sockets(app)


@sockets.route('/echo')
def echo_socket(ws):
    while not ws.closed:
        message = ws.receive()
        if message:
            ws.send("You said: " + message)


@app.before_request
def before_request():

    # http://flask.pocoo.org/docs/1.0/api/#application-globals
    flask.g.moonthor_data = {}

    if not flask.request.endpoint in app.view_functions:
        return "Resource not found", 404

    # browser might (if frontend and backend are not on the same origin) send a pre-flight OPTIONS request to get the
    # CORS settings. In this case 'Authorization' header will not be set, which could lead to 401 response, which browser
    # doesn't like. So let's just return 200 on all OPTIONS:
    if flask.request.method == 'OPTIONS':
        return '', 200

    view_func = app.view_functions[flask.request.endpoint]
    # unless we have explicitly user @noauth decorator, do authorization check here:
    if not hasattr(view_func, '_exclude_from_auth'):
        try:
            print(flask.request.url_rule)
            authorization_header = flask.request.headers.get('Authorization')
            if not authorization_header:
                return "Access denied", 401

            flask.g.moonthor_data['jwt'] = JWT.forge_from_authorization_header(authorization_header, allow_leeway=False)
        except:
            return "Access denied", 401


    # temporary "security" measure until proper auth is done:
    # d3c302a9-f607-458f-aaa8-8ac16c4bd632
    # query_params_bot_token = flask.request.args.get('b')
    # _, account_id = Bot.authenticate_token(query_params_bot_token)
    # if not account_id:
    #     return "Invalid bot API token", 401

    if utils.db is None:
        utils.db_connect()
        if utils.db is None:
            # oops, DB error... we should return 500:
            return 'Service unavailable', 503


@app.after_request
def after_request(response):
    # allow cross-origin requests:
    # (we will probably want to limit this to our domain later on, or make it configurable4)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, PUT, OPTIONS'
    response.headers['Access-Control-Expose-Headers'] = 'X-JWT-Token'
    response.headers['Access-Control-Max-Age'] = '3600'  # https://damon.ghost.io/killing-cors-preflight-requests-on-a-react-spa/
    # don't you just hate it when curl output hijacks half of the line? Let's always add newline:
    response.set_data(response.get_data() + b"\n")
    #time.sleep(1.0)  # so we can see "loading" signs
    return response


@app.errorhandler(ValidationError)
def handle_invalid_usage(error):
    return str(error), 400

# TODO!!! bot login needs to be revisited
def needs_valid_bot_token(f):
    @wraps(f)
    def wrap(*args, **kwargs):
        query_params_bot_token = flask.request.args.get('b')
        _, account_id = Bot.authenticate_token(query_params_bot_token)
        if not account_id:
            return "Invalid bot API token", 401
        kwargs['account_id'] = account_id
        return f(*args, **kwargs)

    if hasattr(f, '_exclude_from_auth'):  # do not break @noauth
        wrap._exclude_from_auth = True
    return wrap


def noauth(func):
    # This decorator puts a mark in *the route function* so that before_request can check for it, and decide not to
    # do authorization checks. It is a bit of a hack, but it works: https://stackoverflow.com/a/19575396/593487
    # The beauty of this approach is that every endpoint is defended *by default*.
    # WARNING: any further decorators must carry the attribute "_exclude_from_auth" over to the wrapper.
    func._exclude_from_auth = True
    return func


def only_admin(f):
    @wraps(f)
    def wrap(*args, **kwargs):
        try:
            jwt = flask.g.moonthor_data['jwt']
            if int(jwt.data['user_id']) != 1:  # temporary measure - user with id === 1 is admin
                return "Access denied", 401
            return f(*args, **kwargs)
        except:
            return "Access denied", 401

    if hasattr(f, '_exclude_from_auth'):  # do not break @noauth
        wrap._exclude_from_auth = True
    return wrap


# -----------------------------------------------------------------------
# Routes:
# -----------------------------------------------------------------------

@app.route('/', defaults={'auth': False})
@noauth
def root():
    return 'OK'

# --------------
# /admin/ - administration tools; can be locked to local access
# --------------

@app.route('/api/admin/createtable', methods=['POST'])
@only_admin
def admin_createtable_post():
    utils.migrate_if_needed()
    return '', 204


# This endpoint helps with setting up a new installation. It allows us to set up just one
# admin access with name, email and password as selected. Later requests to the same endpoint
# will fail.
@app.route('/api/admin/first', methods=['POST'])
@noauth
def admin_first_post():
    if Auth.first_user_exists():
        return 'System already initialized', 401
    admin = User.forge_from_input(flask.request)
    admin_id = admin.insert()
    return json.dumps({
        'id': admin_id,
    }), 201


@app.route('/api/admin/permissions', methods=['GET', 'POST'])
@only_admin
def admin_permissions_crud():
    if flask.request.method == 'GET':
        rec = Permission.get_list()
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        permission = Permission.forge_from_input(flask.request)
        try:
            permission_id = permission.insert()
            return json.dumps({
                'username': permission.username,
                'url_prefix': permission.url_prefix,
                'methods': permission.methods,
                'id': permission_id,
            }), 201
        except psycopg2.IntegrityError:
            raise
            return "Account with this name already exists", 400


# --------------
# /auth/ - authentication; might need different logging settings
# --------------

@app.route('/api/auth/login', methods=['POST'])
@noauth
def auth_login_post():
    credentials = Credentials.forge_from_input(flask.request)
    user_id = credentials.check_user_login()
    if not user_id:
        return "Invalid credentials", 401

    session_data = {
        'user_id': user_id,
        'session_id': secrets.token_hex(32),
    }
    response = flask.make_response(json.dumps(session_data), 200)
    response.headers['X-JWT-Token'] = JWT(session_data).encode_as_authorization_header()
    return response


@app.route('/api/auth/refresh', methods=['POST'])
@noauth
def auth_refresh_post():
    try:
        authorization_header = flask.request.headers.get('Authorization')
        if not authorization_header:
            return "Access denied", 401

        old_jwt = JWT.forge_from_authorization_header(authorization_header, allow_leeway=True)
        data = old_jwt.data.copy()
        new_jwt = JWT(data).encode_as_authorization_header()

        response = flask.make_response(json.dumps(data), 200)
        response.headers['X-JWT-Token'] = new_jwt
        return response
    except:
        return "Access denied", 401


@app.route('/api/admin/accounts', methods=['GET', 'POST'])
@only_admin
def accounts_crud():
    if flask.request.method == 'GET':
        rec = Account.get_list()
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        account = Account.forge_from_input(flask.request)
        try:
            account_id = account.insert()
            return json.dumps({'name': account.name, 'id': account_id}), 201
        except psycopg2.IntegrityError:
            return "Account with this name already exists", 400


@app.route('/api/accounts/<string:account_id>/bots', methods=['POST'])
def bot_post(account_id):
    bot = Bot.forge_from_input(flask.request)
    bot_id, bot_token = bot.insert()
    return json.dumps({
        'id': bot_id,
        'token': bot_token,
    }), 201


@app.route("/api/accounts/<string:account_id>/values", methods=['PUT'])
@noauth
# @needs_valid_bot_token
def values_put(account_id):
    data = flask.request.get_json()
    # let's just pretend our data is of correct form, otherwise Exception will be thrown and Flash will return error response:
    Measurement.save_values_data_to_db(account_id, data)
    return ""


@app.route("/api/accounts/<string:account_id>/values", methods=['POST'])
@noauth
@needs_valid_bot_token
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

    # let's just pretend our data is of correct form, otherwise Exception will be thrown and Flash will return error response:
    Measurement.save_values_data_to_db(account_id, data)
    return ""


@app.route("/api/accounts/<string:account_id>/values", methods=['GET'])
def values_get(account_id):
    # validate and convert input parameters:
    paths_input = flask.request.args.get('p')
    if paths_input is None:
        return "Missing parameter: p\n\n", 400
    try:
        paths = [Path(account_id, p) for p in paths_input.split(',')]
    except:
        return "Invalid parameter: p\n\n", 400

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
    if flask.request.method == 'GET':
        rec = Dashboard.get_list(account_id)
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        dashboard = Dashboard.forge_from_input(account_id, flask.request)
        try:
            dashboard.insert()
        except psycopg2.IntegrityError:
            return "Dashboard with this slug already exists", 400
        return json.dumps({'slug': dashboard.slug}), 201


@app.route("/api/accounts/<string:account_id>/dashboards/<string:dashboard_slug>", methods=['GET', 'PUT', 'DELETE'])
def dashboard_crud(account_id, dashboard_slug):
    if flask.request.method == 'GET':
        rec = Dashboard.get(account_id, slug=dashboard_slug)
        if not rec:
            return "No such dashboard", 404
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        dashboard = Dashboard.forge_from_input(account_id, flask.request, force_slug=dashboard_slug)
        rowcount = dashboard.update()
        if not rowcount:
            return "No such dashboard", 404
        return "", 204

    elif flask.request.method == 'DELETE':
        rowcount = Dashboard.delete(account_id, dashboard_slug)
        if not rowcount:
            return "No such dashboard", 404
        return "", 200


@app.route("/api/accounts/<string:account_id>/dashboards/<string:dashboard_slug>/widgets", methods=['GET', 'POST'])
def widgets_crud(account_id, dashboard_slug):
    if flask.request.method == 'GET':
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

    if flask.request.method == 'GET':
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


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", type=str, choices=['migrate', 'serve'])
    args = parser.parse_args()

    if args.operation == 'migrate':
        utils.migrate_if_needed()
    elif args.operation == 'serve':
#        app.run()
        from gevent import pywsgi
        from geventwebsocket.handler import WebSocketHandler
        server = pywsgi.WSGIServer(('', 5000), app, handler_class=WebSocketHandler)
        server.serve_forever()
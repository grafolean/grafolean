import flask
import json
import time
import re
import psycopg2
import validators

from datatypes import (AccessDeniedError, Account, Aggregation, Bot, Dashboard, Entity, Credential, Sensor, Measurement,
    Path, PathInputValue, PathFilter, Permission, Timestamp, UnfinishedPathFilter, ValidationError, Widget
)
from .common import auth_no_permissions, mqtt_publish_changed


accounts_api = flask.Blueprint('accounts_api', __name__)


@accounts_api.before_request
def accounts_before_request():
    # If bot has successfully logged in (and retrieved the list of its accounts), we should
    # publish an MQTT message so that frontend can update 'Last login' field of the bot, and
    # show/hide notification badges based on it:
    if flask.g.grafolean_data['user_is_bot']:
        bot_id = flask.g.grafolean_data['user_id']
        m = re.match(r'^/api/accounts/([0-9]+)(/.*)?$', flask.request.path)
        if m:
            account_id = m.groups()[0]
            mqtt_publish_changed([
                'accounts/{account_id}/bots'.format(account_id=account_id),
                'accounts/{account_id}/bots/{bot_id}'.format(account_id=account_id, bot_id=bot_id),
            ])
        else:
            mqtt_publish_changed([
                'bots',
                'bots/{bot_id}'.format(bot_id=bot_id),
            ])


def accounts_apidoc_schemas():
    yield "AccountPOST", validators.AccountSchemaInputs.json[0].schema
    yield "AccountGET", {
        'type': 'object',
        'properties': {
            'id': {
                'type': 'integer',
                'description': "Account id",
                'example': 123,
            },
            'name': {
                'type': 'string',
                'description': "Account name",
                'example': 'My First Account',
            },
        },
        'required': ['id', 'name'],
    }
    yield "TopValuesGET", {
        'type': 'object',
        'properties': {
            't': {
                'type': ['number', 'null'],
                'description': "Measurements time (UNIX timestamp) - null if no results were found",
                'example': 1234567890.123456,
            },
            'total': {
                'type': ['number', 'null'],
                'description': "Sum of values for all paths that match the path filter (useful for calculating percentages)",
                'example': 1500.0,
            },
            'list': {
                'type': 'array',
                'description': "List of top N candidates",
                'items': {
                    'type': 'object',
                    'properties': {
                        'p': {
                            'type': 'string',
                            'description': "Path",
                            'example': 'entity.1.interface.12.my.path',
                        },
                        'v': {
                            'type': 'number',
                            'description': "Measurement value",
                            'example': 12.33,
                        },
                    }
                }
            },
        },
    }


# --------------
# /accounts/
# --------------

@accounts_api.route('/', methods=['GET'])
@auth_no_permissions
def accounts_root():
    """
        ---
        get:
          summary: Get all accounts this user has access to
          tags:
            - Accounts
          description:
            Returns the list of accounts that this user (person or bot) has permission to access. The list is returned in a single array (no pagination).
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
                          "$ref": '#/definitions/AccountGET'
    """
    user_id = flask.g.grafolean_data['user_id']
    accounts = Account.get_list(user_id)
    return json.dumps({'list': accounts}), 200


@accounts_api.route('/<int:account_id>', methods=['GET', 'PUT'])
def account_crud(account_id):
    """
        ---
        get:
          summary: Get an account
          tags:
            - Accounts
          description:
            Returns account data.
          parameters:
            - name: account_id
              in: path
              description: "Account id"
              required: true
              schema:
                type: integer
          responses:
            200:
              content:
                application/json:
                  schema:
                    "$ref": '#/definitions/AccountGET'
            404:
              description: No such account
        put:
          summary: Update the account
          tags:
            - Accounts
          description:
            Updates account name.
          parameters:
            - name: account_id
              in: path
              description: "Account id"
              required: true
              schema:
                type: integer
            - name: "body"
              in: body
              description: "Account data"
              required: true
              schema:
                "$ref": '#/definitions/AccountPOST'
          responses:
            204:
              description: Update successful
            404:
              description: No such account

    """
    if flask.request.method in ['GET', 'HEAD']:
        rec = Account.get(account_id)
        if not rec:
            return "No such account", 404
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        rec = Account.forge_from_input(flask.request, force_id=account_id)
        rowcount = rec.update()
        if not rowcount:
            return "No such account", 404
        mqtt_publish_changed([
            'accounts/{account_id}'.format(account_id=account_id),
        ])
        return "", 204


@accounts_api.route('/<int:account_id>/bots', methods=['GET', 'POST'])
def account_bots(account_id):
    if flask.request.method in ['GET', 'HEAD']:
        rec = Bot.get_list(account_id)
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        bot = Bot.forge_from_input(flask.request, force_account=account_id)
        user_id, _ = bot.insert()
        rec = Bot.get(user_id, account_id)
        mqtt_publish_changed([
            'accounts/{account_id}/bots'.format(account_id=account_id),
            'accounts/{account_id}/bots/{bot_id}'.format(account_id=account_id, bot_id=user_id),
        ])
        return json.dumps(rec), 201


@accounts_api.route('/<int:account_id>/bots/<string:user_id>', methods=['GET', 'PUT', 'DELETE'])
def account_bot_crud(account_id, user_id):
    if flask.request.method in ['GET', 'HEAD']:
        rec = Bot.get(user_id, account_id)
        if not rec:
            return "No such bot", 404
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        bot = Bot.forge_from_input(flask.request, force_account=account_id, force_id=user_id)
        rowcount = bot.update()
        if not rowcount:
            return "No such bot", 404

        mqtt_publish_changed([
            'accounts/{account_id}/bots'.format(account_id=account_id),
            'accounts/{account_id}/bots/{bot_id}'.format(account_id=account_id, bot_id=user_id),
        ])
        return "", 204

    elif flask.request.method == 'DELETE':
        # bot should not be able to delete himself, otherwise they could lock themselves out:
        if int(flask.g.grafolean_data['user_id']) == int(user_id):
            return "Can't delete yourself", 403
        rowcount = Bot.delete(user_id, force_account=account_id)
        if not rowcount:
            return "No such bot", 404
        mqtt_publish_changed([
            'accounts/{account_id}/bots'.format(account_id=account_id),
            'accounts/{account_id}/bots/{bot_id}'.format(account_id=account_id, bot_id=user_id),
        ])
        return "", 204


@accounts_api.route('/<int:account_id>/bots/<int:user_id>/token', methods=['GET'])
def account_bot_token_get(account_id, user_id):
    # make sure the user who is requesting to see the bot token has every permission that this token has, and
    # also that this user can add the bot:
    request_user_permissions = Permission.get_list(int(flask.g.grafolean_data['user_id']))
    if not Permission.has_all_permissions(request_user_permissions, user_id):
        return "Not enough permissions to see this bot's token", 401
    if not Permission.can_grant_permission(request_user_permissions, 'accounts/{}/bots'.format(account_id), 'POST'):
        return "Not enough permissions to see this bot's token - POST to accounts/:account_id/bots not allowed", 401
    token = Bot.get_token(user_id, account_id)
    if not token:
        return "No such bot", 404
    return {'token': token}, 200


@accounts_api.route('/<int:account_id>/entities', methods=['GET', 'POST'])
def account_entities(account_id):
    if flask.request.method in ['GET', 'HEAD']:
        rec = Entity.get_list(account_id)
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        entity = Entity.forge_from_input(flask.request, account_id)
        entity_id = entity.insert()
        rec = {'id': entity_id}
        mqtt_publish_changed([
            'accounts/{}/entities'.format(account_id),
        ])
        return json.dumps(rec), 201


@accounts_api.route('/<int:account_id>/entities/<string:entity_id>', methods=['GET', 'PUT', 'DELETE'])
def account_entity_crud(account_id, entity_id):
    if flask.request.method in ['GET', 'HEAD']:
        rec = Entity.get(entity_id, account_id)
        if not rec:
            return "No such entity", 404
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        entity = Entity.forge_from_input(flask.request, account_id, force_id=entity_id)
        rowcount = entity.update()
        if not rowcount:
            return "No such entity", 404
        mqtt_publish_changed([
            'accounts/{}/entities'.format(account_id),
            'accounts/{}/entities/{}'.format(account_id, entity_id),
        ])
        return "", 204

    elif flask.request.method == 'DELETE':
        rowcount = Entity.delete(entity_id, account_id)
        if not rowcount:
            return "No such entity", 404
        mqtt_publish_changed([
            'accounts/{}/entities'.format(account_id),
            'accounts/{}/entities/{}'.format(account_id, entity_id),
        ])
        return "", 204


@accounts_api.route('/<int:account_id>/credentials', methods=['GET', 'POST'])
def account_credentials(account_id):
    if flask.request.method in ['GET', 'HEAD']:
        rec = Credential.get_list(account_id)
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        credential = Credential.forge_from_input(flask.request, account_id)
        credential_id = credential.insert()
        rec = {'id': credential_id}
        mqtt_publish_changed([
            'accounts/{}/credentials'.format(account_id),
        ])
        return json.dumps(rec), 201


@accounts_api.route('/<int:account_id>/credentials/<string:credential_id>', methods=['GET', 'PUT', 'DELETE'])
def account_credential_crud(account_id, credential_id):
    if flask.request.method in ['GET', 'HEAD']:
        rec = Credential.get(credential_id, account_id)
        if not rec:
            return "No such credential", 404
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        credential = Credential.forge_from_input(flask.request, account_id, force_id=credential_id)
        rowcount = credential.update()
        if not rowcount:
            return "No such credential", 404
        mqtt_publish_changed([
            'accounts/{}/credentials'.format(account_id),
            'accounts/{}/credentials/{}'.format(account_id, credential_id),
        ])
        return "", 204

    elif flask.request.method == 'DELETE':
        rowcount = Credential.delete(credential_id, account_id)
        if not rowcount:
            return "No such credential", 404
        mqtt_publish_changed([
            'accounts/{}/credentials'.format(account_id),
            'accounts/{}/credentials/{}'.format(account_id, credential_id),
        ])
        return "", 204


@accounts_api.route('/<int:account_id>/sensors', methods=['GET', 'POST'])
def account_sensors(account_id):
    if flask.request.method in ['GET', 'HEAD']:
        rec = Sensor.get_list(account_id)
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        sensor = Sensor.forge_from_input(flask.request, account_id)
        sensor_id = sensor.insert()
        rec = {'id': sensor_id}
        mqtt_publish_changed([
            'accounts/{}/sensors'.format(account_id),
        ])
        return json.dumps(rec), 201


@accounts_api.route('/<int:account_id>/sensors/<string:sensor_id>', methods=['GET', 'PUT', 'DELETE'])
def account_sensor_crud(account_id, sensor_id):
    if flask.request.method in ['GET', 'HEAD']:
        rec = Sensor.get(sensor_id, account_id)
        if not rec:
            return "No such sensor", 404
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        sensor = Sensor.forge_from_input(flask.request, account_id, force_id=sensor_id)
        rowcount = sensor.update()
        if not rowcount:
            return "No such sensor", 404
        mqtt_publish_changed([
            'accounts/{}/sensors'.format(account_id),
            'accounts/{}/sensors/{}'.format(account_id, sensor_id),
        ])
        return "", 204

    elif flask.request.method == 'DELETE':
        rowcount = Sensor.delete(sensor_id, account_id)
        if not rowcount:
            return "No such sensor", 404
        mqtt_publish_changed([
            'accounts/{}/sensors'.format(account_id),
            'accounts/{}/sensors/{}'.format(account_id, sensor_id),
        ])
        return "", 204


@accounts_api.route('/<int:account_id>/bots/<string:user_id>/permissions', methods=['GET', 'POST'])
def account_bot_permissions(account_id, user_id):
    """
        Allows reading and assigning permissions to account bots (bots which are tied to a specific account).
    """
    # make sure the bot really belongs to the account:
    rec = Bot.get(user_id, account_id)
    if not rec:
        return "No such bot", 404

    if flask.request.method in ['GET', 'HEAD']:
        rec = Permission.get_list(user_id)
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        granting_user_id = flask.g.grafolean_data['user_id']
        permission = Permission.forge_from_input(flask.request, user_id)
        try:
            permission_id = permission.insert(granting_user_id)
            mqtt_publish_changed([
                'persons/{}'.format(permission.user_id),
                'bots/{}'.format(permission.user_id),
            ])
            return json.dumps({
                'user_id': permission.user_id,
                'resource_prefix': permission.resource_prefix,
                'methods': permission.methods,
                'id': permission_id,
            }), 201
        except AccessDeniedError as ex:
            return str(ex), 401
        except psycopg2.IntegrityError:
            return "Invalid parameters", 400


@accounts_api.route('/<int:account_id>/bots/<int:user_id>/permissions/<int:permission_id>', methods=['DELETE'])
def account_bot_permission_delete(account_id, user_id, permission_id):
    """ Revoke permission from account bot """
    # make sure the bot really belongs to the account:
    rec = Bot.get(user_id, account_id)
    if not rec:
        return "No such bot", 404

    granting_user_id = flask.g.grafolean_data['user_id']
    try:
        rowcount = Permission.delete(permission_id, user_id, granting_user_id)
    except AccessDeniedError as ex:
        return str(ex), 401
    if not rowcount:
        return "No such permission", 404
    mqtt_publish_changed([
        'persons/{user_id}'.format(user_id=user_id),
        'bots/{user_id}'.format(user_id=user_id),
    ])
    return "", 204


@accounts_api.route("/<int:account_id>/values", methods=['PUT'])
def values_put(account_id):
    data = flask.request.get_json()
    # let's just pretend our data is of correct form, otherwise Exception will be thrown and Flask will return error response:
    try:
        Measurement.save_values_data_to_db(account_id, data)
        for d in data:
            mqtt_publish_changed(['accounts/{}/values/{}'.format(account_id, d['p'])], { 'v': d['v'], 't': d['t'] })
    except psycopg2.IntegrityError:
        return "Invalid input format", 400
    return "", 204


@accounts_api.route("/<int:account_id>/values", methods=['POST'])
def values_post(account_id):
    # data comes from two sources, query params and JSON body. We use both and append timestamp to each
    # piece, then we use the same function as for PUT:
    data = []
    now = time.time()
    json_data = flask.request.get_json()
    query_params_p = flask.request.args.get('p')
    if json_data:
        for x in json_data:
            if x.get('t'):
                return "Parameter 't' shouldn't be specified with POST", 400
        data = [{
                'p': x['p'],
                'v': x['v'],
                't': now,
                } for x in json_data]
    elif query_params_p:
        if flask.request.args.get('t'):
            return "Query parameter 't' shouldn't be specified with POST", 400
        data.append({
            'p': query_params_p,
            'v': flask.request.args.get('v'),
            't': now,
        })
    else:
        return "Missing data", 400

    # let's just pretend our data is of correct form, otherwise Exception will be thrown and Flask will return error response:
    Measurement.save_values_data_to_db(account_id, data)
    for d in data:
        mqtt_publish_changed(['accounts/{}/values/{}'.format(account_id, d['p'])], { 'v': d['v'], 't': d['t'] })
    return ""


@accounts_api.route("/<int:account_id>/values", methods=['GET'])
@accounts_api.route("/<int:account_id>/getvalues", methods=['POST'])
@accounts_api.route("/<int:account_id>/values/<string:path_input>", methods=['GET'])
def values_get(account_id, path_input=None):
    # when we request data for too many paths at once, we run in trouble with URLs being too long. Using
    # POST is not ideal, but it works... We do however keep the interface as close to GET as possible, so
    # we use the same arguments:
    if flask.request.method == 'POST':
        args = flask.request.get_json()
    else:
        args = flask.request.args

    # validate and convert input parameters:
    if path_input:
        if "," in path_input:
            return "Only a single path is allowed as part of URL\n\n", 400
        paths_input = path_input
    else:
        paths_input = args.get('p')

    if paths_input is None:
        return "Path(s) not specified\n\n", 400
    try:
        paths = [Path(p, account_id).path for p in paths_input.split(',')]
    except:
        return "Path(s) not specified correctly\n\n", 400

    t_from_input = args.get('t0')
    if t_from_input:
        try:
            t_froms = [Timestamp(t) for t in str(t_from_input).split(',')]
            if len(t_froms) == 1:
                t_froms = [t_froms[0] for _ in paths]
            elif len(t_froms) == len(paths):
                pass
            else:
                return "Number of t0 timestamps must be 1 or equal to number of paths\n\n", 400
        except:
            return "Error parsing t0\n\n", 400
    else:
        t_from = Measurement.get_oldest_measurement_time(account_id, paths)
        if not t_from:
            t_from = Timestamp(time.time())
        t_froms = [t_from for _ in paths]

    t_to_input = args.get('t1')
    if t_to_input:
        try:
            t_to = Timestamp(t_to_input)
        except:
            return "Error parsing t1\n\n", 400
    else:
        t_to = Timestamp(time.time())

    aggr_level_input = str(args.get('a'))
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

    sort_order = str(args.get('sort', 'asc'))
    if sort_order not in ['asc', 'desc']:
        return "Invalid parameter: sort (should be 'asc' or 'desc')\n\n", 400
    should_sort_asc = True if sort_order == 'asc' else False

    try:
        max_records = int(args.get('limit', Measurement.MAX_DATAPOINTS_RETURNED))
        if max_records > Measurement.MAX_DATAPOINTS_RETURNED:
            return "Invalid parameter: limit (max. value is {})\n\n".format(Measurement.MAX_DATAPOINTS_RETURNED), 400
    except:
        return "Invalid parameter: limit\n\n", 400

    # finally, return the data:
    paths_data = Measurement.fetch_data(account_id, paths, aggr_level, t_froms, t_to, should_sort_asc, max_records)
    return json.dumps({
        'paths': paths_data,
    }), 200


@accounts_api.route("/<int:account_id>/topvalues", methods=['GET'])
def topvalues_get(account_id):
    """
        ---
        get:
          summary: Get highest N measurements for the latest timestamp before specified time
          tags:
            - Admin
          description:
            Finds the latest timestamp of any measurement that was recorded for any path that matches the path filter. Returns a list of highest `n`
            measurements (for the matching paths) that were taken at that timestamp. Note that timestamp must match exactly.

            It is possible to change the search for timestamp so that it is lower than some provided time (parameter `t`).
          parameters:
            - name: account_id
              in: path
              description: "Account id"
              required: true
              schema:
                type: integer
            - name: f
              in: query
              description: "Path filter (determines which paths are taken as candidates)"
              required: true
              schema:
                type: string
            - name: n
              in: query
              description: "Number of paths with highest measurements to return (default 5)"
              required: false
              schema:
                type: integer
                minimum: 1
            - name: t
              in: query
              description: "Search for candidates older than this timestamp (default: current timestamp)"
              required: false
              schema:
                type: number
          responses:
            200:
              content:
                application/json:
                  schema:
                    "$ref": '#/definitions/TopValuesGET'
    """
    max_results_input = flask.request.args.get('n')
    max_results = max(0, int(max_results_input)) if max_results_input else 5

    path_filter_input = flask.request.args.get('f')
    if not path_filter_input:
        return "Path filter not specified\n\n", 400
    try:
        pf = str(PathFilter(path_filter_input))
    except ValidationError:
        raise ValidationError("Invalid path filter")

    ts_to_input = flask.request.args.get('t', time.time())
    try:
        ts_to = Timestamp(ts_to_input)
    except ValidationError:
        raise ValidationError("Invalid parameter t")

    ts, total, topn = Measurement.fetch_topn(account_id, pf, ts_to, max_results)
    return json.dumps({
        't': float(ts),
        'total': float(total),
        'list': topn,
    }), 200


@accounts_api.route("/<int:account_id>/paths", methods=['GET'])
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
            matching_paths[pf], limit_reached = PathFilter.find_matching_paths(account_id, pf, limit=max_results)
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
            ret['paths_with_trailing'][upf], limit_reached = UnfinishedPathFilter.find_matching_paths(account_id, upf, limit=max_results, allow_trailing_chars=True)
            ret['limit_reached'] = ret['limit_reached'] or limit_reached

    return json.dumps(ret), 200


@accounts_api.route('/<int:account_id>/paths/<int:path_id>', methods=['GET', 'PUT', 'DELETE'])
def account_path_crud(account_id, path_id):
    if flask.request.method in ['GET', 'HEAD']:
        rec = Path.get(path_id, account_id)
        if not rec:
            return "No such path", 404
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        record = Path.forge_from_input(flask.request, account_id, force_id=path_id)
        rowcount = record.update()
        if not rowcount:
            return "No such path", 404
        return "", 204

    elif flask.request.method == 'DELETE':
        rowcount = Path.delete(path_id, account_id)
        if not rowcount:
            return "No such path", 404
        return "", 204


@accounts_api.route("/<int:account_id>/dashboards", methods=['GET', 'POST'])
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
        mqtt_publish_changed(['accounts/{}/dashboards'.format(account_id)])
        return json.dumps({'slug': dashboard.slug}), 201


@accounts_api.route("/<int:account_id>/dashboards/<string:dashboard_slug>", methods=['GET', 'PUT', 'DELETE'])
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
            'accounts/{}/dashboards'.format(account_id),
            'accounts/{}/dashboards/{}'.format(account_id, dashboard_slug),
        ])
        return "", 204

    elif flask.request.method == 'DELETE':
        rowcount = Dashboard.delete(account_id, dashboard_slug)
        if not rowcount:
            return "No such dashboard", 404
        mqtt_publish_changed([
            'accounts/{}/dashboards'.format(account_id),
            'accounts/{}/dashboards/{}'.format(account_id, dashboard_slug),
        ])
        return "", 200


@accounts_api.route("/<int:account_id>/dashboards/<string:dashboard_slug>/widgets", methods=['GET', 'POST'])
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
        except psycopg2.IntegrityError as ex:
            return "Error inserting widget" + str(ex), 400
        mqtt_publish_changed([
            f'accounts/{account_id}/dashboards/{dashboard_slug}',
        ])
        return json.dumps({'id': widget_id}), 201


@accounts_api.route("/<int:account_id>/dashboards/<string:dashboard_slug>/widgets/<string:widget_id>", methods=['GET', 'PUT', 'DELETE'])
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
        mqtt_publish_changed([
            f'accounts/{account_id}/dashboards/{dashboard_slug}',
        ])
        return "", 204

    elif flask.request.method == 'DELETE':
        rowcount = Widget.delete(account_id, dashboard_slug, widget_id)
        if not rowcount:
            return "No such widget", 404
        mqtt_publish_changed([
            f'accounts/{account_id}/dashboards/{dashboard_slug}',
        ])
        return "", 200


@accounts_api.route("/<int:account_id>/dashboards/<string:dashboard_slug>/widgets_positions/", methods=['PUT'])
def widgets_positions(account_id, dashboard_slug):
    Widget.set_positions(account_id, dashboard_slug, flask.request)
    mqtt_publish_changed([
        f'accounts/{account_id}/dashboards/{dashboard_slug}',
    ])
    return "", 204

import flask
import json
import psycopg2
import time

from datatypes import AccessDeniedError, Account, Aggregation, Bot, Dashboard, Measurement, Path, PathFilter, Permission, Timestamp, UnfinishedPathFilter, ValidationError, Widget
from .common import mqtt_publish_changed


accounts_api = flask.Blueprint('accounts_api', __name__)


# --------------
# /accounts/
# --------------

@accounts_api.route('/<string:account_id>', methods=['GET', 'PUT'])
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
            'accounts/{account_id}'.format(account_id=account_id),
        ])
        return "", 204


@accounts_api.route('/<string:account_id>/bots', methods=['GET', 'POST'])
def account_bots(account_id):
    if flask.request.method in ['GET', 'HEAD']:
        rec = Bot.get_list(account_id)
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        bot = Bot.forge_from_input(flask.request, force_account=account_id)
        user_id, _ = bot.insert()
        rec = Bot.get(user_id)
        return json.dumps(rec), 201


@accounts_api.route('/<string:account_id>/bots/<string:user_id>', methods=['GET', 'PUT', 'DELETE'])
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
        return "", 204

    elif flask.request.method == 'DELETE':
        # bot should not be able to delete himself, otherwise they could lock themselves out:
        if int(flask.g.grafolean_data['user_id']) == int(user_id):
            return "Can't delete yourself", 403
        rowcount = Bot.delete(user_id, force_account=account_id)
        if not rowcount:
            return "No such bot", 404
        return "", 204


@accounts_api.route('/<string:account_id>/bots/<string:user_id>/permissions', methods=['GET', 'POST'])
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
                'admin/persons/{}'.format(permission.user_id),
                'admin/bots/{}'.format(permission.user_id),
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
        'admin/persons/{user_id}'.format(user_id=user_id),
        'admin/bots/{user_id}'.format(user_id=user_id),
    ])
    return "", 204


@accounts_api.route("/<string:account_id>/values", methods=['PUT'])
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


@accounts_api.route("/<string:account_id>/values", methods=['POST'])
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


@accounts_api.route("/<string:account_id>/values", methods=['GET'])
@accounts_api.route("/<string:account_id>/values/<string:path_input>", methods=['GET'])
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


@accounts_api.route("/<string:account_id>/paths", methods=['GET'])
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

@accounts_api.route("/<string:account_id>/paths", methods=['DELETE'])
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

@accounts_api.route("/<string:account_id>/dashboards", methods=['GET', 'POST'])
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


@accounts_api.route("/<string:account_id>/dashboards/<string:dashboard_slug>", methods=['GET', 'PUT', 'DELETE'])
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


@accounts_api.route("/<string:account_id>/dashboards/<string:dashboard_slug>/widgets", methods=['GET', 'POST'])
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


@accounts_api.route("/<string:account_id>/dashboards/<string:dashboard_slug>/widgets/<string:widget_id>", methods=['GET', 'PUT', 'DELETE'])
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

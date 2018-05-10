#!/usr/bin/python3
import argparse
import flask
from flask_sockets import Sockets
import json
import psycopg2
import re
import time

from datatypes import Measurement, Dashboard, Chart, Path, UnfinishedPathFilter, Timestamp, ValidationError
import utils


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


@app.after_request
def after_request(response):
    # allow cross-origin requests:
    # (we will probably want to limit this to our domain later on, or make it configurable4)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, PUT, OPTIONS'
    # don't you just hate it when curl output hijacks half of the line? Let's always add newline:
    response.set_data(response.get_data() + b"\n")
    #time.sleep(1.0)  # so we can see "loading" signs
    return response


@app.errorhandler(ValidationError)
def handle_invalid_usage(error):
    return str(error), 400


@app.route("/api/values", methods=['PUT'])
def values_put():
    data = flask.request.get_json()
    # let's just pretend our data is of correct form, otherwise Exception will be thrown and Flash will return error response:
    Measurement.save_values_data_to_db(data)
    return ""


@app.route("/api/values", methods=['POST'])
def values_post():
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
    Measurement.save_values_data_to_db(data)
    return ""


@app.route("/api/values", methods=['GET'])
def values_get():
    # validate and convert input parameters:
    paths_input = flask.request.args.get('p')
    if paths_input is None:
        return "Missing parameter: p\n\n", 400
    try:
        paths = [Path(p) for p in paths_input.split(',')]
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
        t_from = Measurement.get_oldest_measurement_time(paths)
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

    # finally, return the data:
    paths_data = Measurement.fetch_data(paths, aggr_level, t_froms, t_to)
    return json.dumps({
        'paths': paths_data,
    }), 200


@app.route("/api/paths", methods=['GET'])
def paths_get():
    max_results_input = flask.request.args.get('limit')
    if not max_results_input:
        max_results = 10
    else:
        max_results = max(0, int(max_results_input))
    partial_filter_input = flask.request.args.get('filter')
    pf = UnfinishedPathFilter(partial_filter_input)
    matching_paths, limit_reached = UnfinishedPathFilter.find_matching_paths([str(pf)], limit=max_results, allow_trailing_chars=True)
    return json.dumps({'paths': list(matching_paths), 'limit_reached': limit_reached}), 200


@app.route("/api/dashboards", methods=['GET', 'POST'])
def dashboards_crud():
    if flask.request.method == 'GET':
        rec = Dashboard.get_list()
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        dashboard = Dashboard.forge_from_input(flask.request)
        try:
            dashboard.insert()
        except psycopg2.IntegrityError:
            return "Dashboard with this slug already exists", 400
        return json.dumps({'slug': dashboard.slug}), 201


@app.route("/api/dashboards/<string:dashboard_slug>", methods=['GET', 'PUT', 'DELETE'])
def dashboard_crud(dashboard_slug):
    if flask.request.method == 'GET':
        rec = Dashboard.get(slug=dashboard_slug)
        if not rec:
            return "No such dashboard", 404
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        dashboard = Dashboard.forge_from_input(flask.request, force_slug=dashboard_slug)
        rowcount = dashboard.update()
        if not rowcount:
            return "No such dashboard", 404

        # return "", 204  # https://github.com/flask-restful/flask-restful/issues/736
        resp = flask.make_response('', 204)
        resp.headers['Content-Length'] = 0
        return resp

    elif flask.request.method == 'DELETE':
        rowcount = Dashboard.delete(dashboard_slug)
        if not rowcount:
            return "No such dashboard", 404
        return "", 200


@app.route("/api/dashboards/<string:dashboard_slug>/charts", methods=['GET', 'POST'])
def charts_crud(dashboard_slug):
    if flask.request.method == 'GET':
        try:
            paths_limit = int(flask.request.args.get('paths_limit', 200))
        except:
            return "Invalid parameter: paths_limit\n\n", 400
        rec = Chart.get_list(dashboard_slug, paths_limit=paths_limit)
        return json.dumps({'list': rec}), 200
    elif flask.request.method == 'POST':
        chart = Chart.forge_from_input(flask.request, dashboard_slug)
        try:
            chart_id = chart.insert()
        except psycopg2.IntegrityError:
            return "Chart with this slug already exists", 400
        return json.dumps({'id': chart_id}), 201


@app.route("/api/dashboards/<string:dashboard_slug>/charts/<string:chart_id>", methods=['GET', 'PUT', 'DELETE'])
def chart_crud(dashboard_slug, chart_id):
    try:
        chart_id = int(chart_id)
    except:
        raise ValidationError("Invalid chart id")

    if flask.request.method == 'GET':
        try:
            paths_limit = int(flask.request.args.get('paths_limit', 200))
        except:
            return "Invalid parameter: paths_limit\n\n", 400
        rec = Chart.get(dashboard_slug, chart_id, paths_limit=paths_limit)
        if not rec:
            return "No such chart", 404
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        chart = Chart.forge_from_input(flask.request, dashboard_slug, chart_id=chart_id)
        rowcount = chart.update()
        if not rowcount:
            return "No such chart", 404

        # return "", 204  # https://github.com/flask-restful/flask-restful/issues/736
        resp = flask.make_response('', 204)
        resp.headers['Content-Length'] = 0
        return resp


    elif flask.request.method == 'DELETE':
        rowcount = Chart.delete(dashboard_slug, chart_id)
        if not rowcount:
            return "No such chart", 404
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
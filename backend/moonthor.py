#!/usr/bin/python3
import argparse
import flask
import json
import psycopg2
import re
import time

from datatypes import Measurement, Dashboard, Chart, Path, Timestamp, ValidationError
import utils


app = flask.Flask(__name__)
# since this is API, we don't care about trailing slashes - and we don't want redirects:
app.url_map.strict_slashes = False


@app.after_request
def after_request(response):
    # allow cross-origin requests:
    # (we will probably want to limit this to our domain later on, or make it configurable4)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    # don't you just hate it when curl output hijacks half of the line? Let's always add newline:
    response.set_data(response.get_data() + b"\n")
    return response


@app.errorhandler(ValidationError)
def handle_invalid_usage(error):
    return str(error), 400


@app.route("/api/values", methods=['PUT'])
def values_put():
    data = flask.request.get_json()
    # let's just pretend our data is of correct form, otherwise Exception will be thrown and Flash will return error response:
    Measurement.save_put_data_to_db(data)
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
        t_from = Timestamp(t_from_input)
    else:
        t_from = Measurement.get_oldest_measurement_time(paths)

    t_to_input = flask.request.args.get('t1')
    if t_to_input:
        t_to = Timestamp(t_to_input)
    else:
        t_to = Timestamp(time.time())

    aggr_level_input = flask.request.args.get('a')
    if not aggr_level_input:
        # suggest the aggr. level based on paths and time interval and redirect to it:
        suggested_aggr_level = Measurement.get_suggested_aggr_level(paths, t_from, t_to)
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
    paths_data = Measurement.fetch_data(paths, aggr_level, t_from, t_to)
    return json.dumps({
        'paths': paths_data,
    }), 200


@app.route("/api/dashboards", methods=['GET', 'POST'])
def dashboards_crud():
    if flask.request.method == 'GET':
        rec = Dashboard.get(slug=None)
        return json.dumps({'list': rec}), 200

    elif flask.request.method == 'POST':
        dashboard = Dashboard.forge_from_input(flask.request)
        try:
            dashboard.insert()
        except psycopg2.IntegrityError:
            return "Dashboard with this slug already exists", 400
        return "", 201


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
        return "", 204

    elif flask.request.method == 'DELETE':
        rowcount = Dashboard.delete(dashboard_slug)
        if not rowcount:
            return "No such dashboard", 404
        return "", 200


@app.route("/api/dashboards/<string:dashboard_slug>/charts", methods=['GET', 'POST'])
def charts_crud(dashboard_slug):
    if flask.request.method == 'GET':
        rec = Chart.get_list(dashboard_slug)
        return json.dumps({'list': rec}), 200
    elif flask.request.method == 'POST':
        chart = Chart.forge_from_input(flask.request, dashboard_slug)
        try:
            chart.insert()
        except psycopg2.IntegrityError:
            return "Chart with this slug already exists", 400
        return "", 201


@app.route("/api/dashboards/<string:dashboard_slug>/charts/<string:chart_id>", methods=['GET', 'PUT', 'DELETE'])
def chart_crud(dashboard_slug, chart_id):
    try:
        chart_id = int(chart_id)
    except:
        raise ValidationError("Invalid chart id")

    if flask.request.method == 'GET':
        rec = Chart.get(dashboard_slug, chart_id)
        if not rec:
            return "No such chart", 404
        return json.dumps(rec), 200

    elif flask.request.method == 'PUT':
        chart = Chart.forge_from_input(flask.request, dashboard_slug, chart_id=chart_id)
        rowcount = chart.update()
        if not rowcount:
            return "No such chart", 404
        return "", 204

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
        app.run()

#!/usr/bin/python3
import argparse
import flask
import json
import re
from slugify import slugify
import time

from datatypes import Measurement, Dashboard, Path, Timestamp
from validators import DashboardInputs, DashboardSchemaInputs, ValuesInputs
import utils


app = flask.Flask(__name__)
# since this is API, we don't care about trailing slashes - and we don't want redirects:
app.url_map.strict_slashes = False

# allow cross-origin requests:
@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.set_data(response.get_data() + b"\n")  # don't you just hate it when curl output hijacts half of the line?
    return response

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
    })

@app.route("/api/dashboards", methods=['GET', 'POST', 'PUT', 'DELETE'])
def dashboards_crud():
    if flask.request.method == 'GET':
        return "yeah... not implemented yet"

    elif flask.request.method in ['POST', 'PUT']:
        for inputs in [DashboardSchemaInputs(flask.request), DashboardInputs(flask.request)]:
            if not inputs.validate():
                return inputs.errors[0] + "\n", 400

        data = flask.request.get_json()
        slug = data.get('slug')
        if not slug:
            slug = slugify(data['name'])
        Dashboard.save_data_to_db(name=data['name'], slug=slug, method=flask.request.method)
        return "valid!\n"

    elif flask.request.method == 'DELETE':
        pass

@app.route("/api/dashboards/<string:dashboard_slug>/charts", methods=['GET', 'POST', 'PUT', 'DELETE'])
def charts_crud(dashboard_slug):
    print("dashboard_slug: {}".format(dashboard_slug))
    if flask.request.method == 'GET':
        pass
    elif flask.request.method in ['POST', 'PUT']:
        pass
    elif flask.request.method == 'DELETE':
        pass

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", type=str, choices=['migrate', 'serve'])
    args = parser.parse_args()

    if args.operation == 'migrate':
        utils.migrate_if_needed()
    elif args.operation == 'serve':
        app.run()

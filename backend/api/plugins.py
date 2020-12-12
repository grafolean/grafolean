import json

import flask
import psycopg2
import requests

from datatypes import Account, Bot, Permission, Person, WidgetPlugin
from .common import mqtt_publish_changed, noauth


plugins_api = flask.Blueprint('plugins_api', __name__)


# --------------
# /api/plugins/ - plugins
# --------------


@plugins_api.route('/widgets', methods=['GET'])
@noauth
def plugins_widgets():
    rec = WidgetPlugin.get_list()
    return json.dumps({'list': rec}), 200


@plugins_api.route('/widgets', methods=['POST'])
def plugins_widgets_post():
    j = flask.request.get_json()
    if "repo_url" not in j:
        return "Missing parameter url", 400

    try:
        widget_plugin = WidgetPlugin.forge_from_url(j["repo_url"])
    except requests.exceptions.ConnectionError:
        return "Backend could not connect to plugin repository - please check firewall rules!", 400
    except Exception as ex:
        return f"Backend could not connect to plugin repository ({str(ex)}) - please check firewall rules!", 400

    try:
        record_id = widget_plugin.insert()
    except psycopg2.errors.UniqueViolation:
        return "Plugin already exists", 400


    mqtt_publish_changed([
        'plugins/widgets',
    ])
    rec = {'id': record_id}
    return json.dumps(rec), 201


@plugins_api.route('/widgets/<int:widget_plugin_id>', methods=['GET'])
@noauth
def plugins_widgets_get(widget_plugin_id):
    rec = WidgetPlugin.get(widget_plugin_id)
    if not rec:
        return "No such widget plugin", 404

    del rec['widget_js']
    return json.dumps(rec), 200


@plugins_api.route('/widgets/<int:widget_plugin_id>', methods=['POST'])
def plugins_widget_upgrade_post(widget_plugin_id):
    rec = WidgetPlugin.get(widget_plugin_id)
    if not rec:
        return "No such widget plugin", 404

    try:
        widget_plugin = WidgetPlugin.forge_from_url(rec["repo_url"])
    except requests.exceptions.ConnectionError:
        return "Backend could not connect to plugin repository - please check firewall rules!", 400
    except Exception as ex:
        return f"Backend could not connect to plugin repository ({str(ex)}) - please check firewall rules!", 400

    widget_plugin.update()

    mqtt_publish_changed([
        'plugins/widgets',
    ])
    return "", 204


@plugins_api.route('/widgets/<int:widget_plugin_id>/widget.js', methods=['GET'])
@noauth
def plugins_widgets_get_widget_js(widget_plugin_id):
    rec = WidgetPlugin.get(widget_plugin_id)
    if not rec:
        return "No such widget plugin", 404

    # no need to send widget.js content if cache matches the version:
    if_none_match_header = flask.request.headers.get('If-None-Match', None)
    if if_none_match_header and if_none_match_header == f'"{rec["version"]}"':
        return "", 304

    response = flask.make_response(rec['widget_js'], 200)
    response.headers['Content-Type'] = "application/javascript"
    response.headers['ETag'] = f'"{rec["version"]}"'
    return response


@plugins_api.route('/widgets/<int:widget_plugin_id>/form.js', methods=['GET'])
@noauth
def plugins_widgets_get_form_js(widget_plugin_id):
    rec = WidgetPlugin.get(widget_plugin_id)
    if not rec:
        return "No such widget plugin", 404

    # no need to send widget.js content if cache matches the version:
    if_none_match_header = flask.request.headers.get('If-None-Match', None)
    if if_none_match_header and if_none_match_header == f'"{rec["version"]}"':
        return "", 304

    response = flask.make_response(rec['form_js'], 200)
    response.headers['Content-Type'] = "application/javascript"
    response.headers['ETag'] = f'"{rec["version"]}"'
    return response


@plugins_api.route('/widgets/<int:widget_plugin_id>', methods=['DELETE'])
def plugins_widgets_delete(widget_plugin_id):
    rowcount = WidgetPlugin.delete(widget_plugin_id)
    if not rowcount:
        return "No such widget plugin", 404

    mqtt_publish_changed([
        'plugins/widgets',
    ])
    return "", 204

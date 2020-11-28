import json

import flask

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
    if "url" not in j:
        return "Missing parameter url", 400

    widget_plugin = WidgetPlugin.forge_from_url(j["url"])
    record_id = widget_plugin.insert()

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


@plugins_api.route('/widgets/<int:widget_plugin_id>/widget.js', methods=['GET'])
@noauth
def plugins_widgets_get_widget_js(widget_plugin_id):
    rec = WidgetPlugin.get(widget_plugin_id)
    if not rec:
        return "No such widget plugin", 404

    response = flask.make_response(rec['widget_js'], 200)
    response.headers['Content-Type'] = "application/javascript"
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

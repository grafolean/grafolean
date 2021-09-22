import json

from fastapi import Depends, Request, Response, HTTPException
from fastapi.responses import JSONResponse
import psycopg2
import requests

from .fastapiutils import APIRouter, AuthenticatedUser, validate_user_authentication
from datatypes import Account, Bot, Permission, Person, WidgetPlugin
from .common import mqtt_publish_changed, noauth


plugins_api = APIRouter()


# --------------
# /api/plugins/ - plugins
# --------------


@plugins_api.get('/api/plugins/widgets')
@noauth
def plugins_widgets():
    rec = WidgetPlugin.get_list()
    return JSONResponse(content={'list': rec}, status_code=200)


@plugins_api.post('/api/plugins/widgets')
async def plugins_widgets_post(request: Request):
    j = await request.json()
    if "repo_url" not in j:
        raise HTTPException(status_code=404, detail="Missing parameter url")

    try:
        widget_plugin = WidgetPlugin.forge_from_url(j["repo_url"])
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=400, detail="Backend could not connect to plugin repository - please check firewall rules!")
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"Backend could not connect to plugin repository ({str(ex)}) - please check firewall rules!")

    try:
        record_id = widget_plugin.insert()
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(status_code=400, detail="Plugin already exists")


    mqtt_publish_changed([
        'plugins/widgets',
    ])
    rec = {'id': record_id}
    return JSONResponse(content=rec, status_code=201)


@plugins_api.get('/api/plugins/widgets/{widget_plugin_id}')
@noauth
def plugins_widgets_get(widget_plugin_id: int):
    rec = WidgetPlugin.get(widget_plugin_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No such widget plugin")

    del rec['widget_js']
    return JSONResponse(content=rec, status_code=200)


@plugins_api.post('/api/plugins/widgets/{widget_plugin_id}')
def plugins_widget_upgrade_post(widget_plugin_id: int):
    rec = WidgetPlugin.get(widget_plugin_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No such widget plugin")

    try:
        widget_plugin = WidgetPlugin.forge_from_url(rec["repo_url"])
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=400, detail="Backend could not connect to plugin repository - please check firewall rules!")
    except Exception as ex:
        raise HTTPException(status_code=400, detail=f"Backend could not connect to plugin repository ({str(ex)}) - please check firewall rules!")

    widget_plugin.update()

    mqtt_publish_changed([
        'plugins/widgets',
    ])
    return Response(status_code=204)


@plugins_api.get('/api/plugins/widgets/{widget_plugin_id}/widget.js')
@noauth
def plugins_widgets_get_widget_js(widget_plugin_id: int, request: Request):
    rec = WidgetPlugin.get(widget_plugin_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No such widget plugin")

    # no need to send widget.js content if cache matches the version:
    if_none_match_header = request.headers.get('if-none-match', None)
    if if_none_match_header and if_none_match_header == f'"{rec["version"]}"':
        return Response(status_code=304)

    return Response(content=rec['widget_js'], status_code=200, headers={
        "Content-Type": "application/javascript",
        "ETag": f'"{rec["version"]}"',
    })


@plugins_api.get('/api/plugins/widgets/{widget_plugin_id}/form.js')
@noauth
def plugins_widgets_get_form_js(widget_plugin_id: int, request: Request):
    rec = WidgetPlugin.get(widget_plugin_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No such widget plugin")

    # no need to send widget.js content if cache matches the version:
    if_none_match_header = request.headers.get('if-none-match', None)
    if if_none_match_header and if_none_match_header == f'"{rec["version"]}"':
        return Response(status_code=304)

    return Response(content=rec['form_js'], status_code=200, headers={
        "Content-Type": "application/javascript",
        "ETag": f'"{rec["version"]}"',
    })


@plugins_api.delete('/api/plugins/widgets/{widget_plugin_id}')
def plugins_widgets_delete(widget_plugin_id: int):
    rowcount = WidgetPlugin.delete(widget_plugin_id)
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such widget plugin")

    mqtt_publish_changed([
        'plugins/widgets',
    ])
    return "", 204

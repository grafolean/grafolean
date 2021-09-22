from datetime import timezone
import json
import math
import re
import time

from fastapi import Depends, Response, status, BackgroundTasks, HTTPException, Form, Security, Request
from fastapi.responses import JSONResponse
import psycopg2

from .fastapiutils import APIRouter, AuthenticatedUser, validate_user_authentication, api_authorization_header
import validators
from datatypes import (AccessDeniedError, Account, Bot, Dashboard, Entity, Credential, Sensor, Measurement,
    Path, PathInputValue, PathFilter, Permission, Timestamp, UnfinishedPathFilter, ValidationError, Widget, Stats,
)
from .common import mqtt_publish_changed, mqtt_publish_changed_multiple_payloads
from const import SYSTEM_PATH_INSERTED_COUNT, SYSTEM_PATH_UPDATED_COUNT, SYSTEM_PATH_CHANGED_COUNT


accounts_api = APIRouter()


# TBD!
# @accounts_api.before_request
# def accounts_before_request():
#     # If bot has successfully logged in (and retrieved the list of its accounts), we should
#     # publish an MQTT message so that frontend can update 'Last login' field of the bot, and
#     # show/hide notification badges based on it:
#     if flask.g.grafolean_data['user_is_bot']:
#         bot_id = flask.g.grafolean_data['user_id']
#         m = re.match(r'^/api/accounts/([0-9]+)(/.*)?$', flask.request.path)
#         if m:
#             account_id = m.groups()[0]
#             mqtt_publish_changed([
#                 'accounts/{account_id}/bots'.format(account_id=account_id),
#                 'accounts/{account_id}/bots/{bot_id}'.format(account_id=account_id, bot_id=bot_id),
#             ])
#         else:
#             mqtt_publish_changed([
#                 'bots',
#                 'bots/{bot_id}'.format(bot_id=bot_id),
#             ])


def accounts_apidoc_schemas():
    yield "AccountPOST", validators.AccountSchemaInputs
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
    yield "ValuesGET", {
        'type': 'object',
        'properties': {
            'paths': {
                'type': 'object',
                'additionalProperties': {
                    # we don't define any properties (because keys are paths and are not known in advance), but
                    # anything below must conform to this sub-schema:
                    'type': 'object',
                    'properties': {
                        'next_data_point': {
                            'type': ['number', 'null'],
                            'description': "Measurements time (UNIX timestamp) of the next value - null if limit was not reached",
                            'example': 1234567890.123456,
                        },
                        'data': {
                            'type': 'array',
                            'description': "List of values",
                            'items': {
                                'type': 'object',
                                'properties': {
                                    't': {
                                        'type': 'number',
                                        'description': "Measurements time (UNIX timestamp) - middle of aggregation bucket if aggregation was requested",
                                        'example': 1234567890.123456,
                                    },
                                    'v': {
                                        'type': 'number',
                                        'description': "Measurement value; median values if aggregation was requested",
                                        'example': 12.33,
                                    },
                                }
                            }
                        },
                    },
                },
            },
        },
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

@accounts_api.get('/api/accounts/')
# CAREFUL: accessible to any authenticated user (permissions check bypassed) - NO_PERMISSION_CHECK_RESOURCES_READ
def accounts_root(auth: AuthenticatedUser = Depends(validate_user_authentication)):
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
    accounts = Account.get_list(auth.user_id)
    return JSONResponse(content={'list': accounts}, status_code=200)


@accounts_api.get('/api/accounts/{account_id}')
def accounts_get(account_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
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
    """
    rec = Account.get(account_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No such account")
    return JSONResponse(content=rec, status_code=200)


@accounts_api.put('/api/accounts/{account_id}')
async def accounts_put(account_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    """
        ---
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
    rec = Account.forge_from_input(await request.json(), force_id=account_id)
    rowcount = rec.update()
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such account")
    mqtt_publish_changed([
        'accounts/{account_id}'.format(account_id=account_id),
    ])
    return Response(status_code=204)


@accounts_api.get('/api/accounts/{account_id}/bots')
def account_bots_get(account_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rec = Bot.get_list(account_id)
    return JSONResponse(content={'list': rec}, status_code=200)


@accounts_api.post('/api/accounts/{account_id}/bots')
async def account_bots_post(account_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    bot = Bot.forge_from_input(await request.json(), force_account=account_id)
    user_id, _ = bot.insert()
    rec = Bot.get(user_id, account_id)
    mqtt_publish_changed([
        'accounts/{account_id}/bots'.format(account_id=account_id),
        'accounts/{account_id}/bots/{bot_id}'.format(account_id=account_id, bot_id=user_id),
    ])
    return JSONResponse(content=rec, status_code=201)


@accounts_api.get('/api/accounts/{account_id}/bots/{user_id}')
def account_bot_get(account_id: int, user_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rec = Bot.get(user_id, account_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No such bot")
    return JSONResponse(content=rec, status_code=200)


@accounts_api.put('/api/accounts/{account_id}/bots/{user_id}')
async def account_bot_put(account_id: int, user_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    bot = Bot.forge_from_input(await request.json(), force_account=account_id, force_id=user_id)
    rowcount = bot.update()
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such bot")

    mqtt_publish_changed([
        'accounts/{account_id}/bots'.format(account_id=account_id),
        'accounts/{account_id}/bots/{bot_id}'.format(account_id=account_id, bot_id=user_id),
    ])
    return Response(status_code=204)


@accounts_api.delete('/api/accounts/{account_id}/bots/{user_id}')
def account_bot_delete(account_id: int, user_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    # bot should not be able to delete himself, otherwise they could lock themselves out:
    if int(auth.user_id) == int(user_id):
        raise HTTPException(status_code=403, detail="Can't delete yourself")
    rowcount = Bot.delete(user_id, force_account=account_id)
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such bot")
    mqtt_publish_changed([
        'accounts/{account_id}/bots'.format(account_id=account_id),
        'accounts/{account_id}/bots/{bot_id}'.format(account_id=account_id, bot_id=user_id),
    ])
    return Response(status_code=204)


@accounts_api.get('/api/accounts/{account_id}/bots/{user_id}/token')
def account_bot_token_get(account_id: int, user_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    # make sure the user who is requesting to see the bot token has every permission that this token has, and
    # also that this user can add the bot:
    request_user_permissions = Permission.get_list(int(auth.user_id))
    if not Permission.has_all_permissions(request_user_permissions, user_id):
        raise HTTPException(status_code=403, detail="Not enough permissions to see this bot's token")
    if not Permission.can_grant_permission(request_user_permissions, 'accounts/{}/bots'.format(account_id), 'POST'):
        raise HTTPException(status_code=403, detail="Not enough permissions to see this bot's token - POST to accounts/:account_id/bots not allowed")

    token = Bot.get_token(user_id, account_id)
    if not token:
        raise HTTPException(status_code=404, detail="No such bot")
    return JSONResponse(content={'token': token}, status_code=200)


@accounts_api.get('/api/accounts/{account_id}/entities')
def account_entities_get(account_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rec = Entity.get_list(account_id)
    return JSONResponse(content={'list': rec}, status_code=200)


@accounts_api.post('/api/accounts/{account_id}/entities')
async def account_entities_post(account_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    entity = Entity.forge_from_input(await request.json(), account_id)
    entity_id = entity.insert()
    rec = {'id': entity_id}
    mqtt_publish_changed([
        'accounts/{}/entities'.format(account_id),
    ])
    return JSONResponse(content=rec, status_code=201)


@accounts_api.get('/api/accounts/{account_id}/entities/{entity_id}')
def account_entity_crud_get(account_id: int, entity_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rec = Entity.get(entity_id, account_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No such entity")
    return JSONResponse(content=rec, status_code=200)

@accounts_api.put('/api/accounts/{account_id}/entities/{entity_id}')
async def account_entity_crud_put(account_id: int, entity_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    entity = Entity.forge_from_input(await request.json(), account_id, force_id=entity_id)
    rowcount = entity.update()
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such entity")
    mqtt_publish_changed([
        'accounts/{}/entities'.format(account_id),
        'accounts/{}/entities/{}'.format(account_id, entity_id),
    ])
    return Response(status_code=204)

@accounts_api.delete('/api/accounts/{account_id}/entities/{entity_id}')
def account_entity_crud_delete(account_id: int, entity_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rowcount = Entity.delete(entity_id, account_id)
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such entity")
    mqtt_publish_changed([
        'accounts/{}/entities'.format(account_id),
        'accounts/{}/entities/{}'.format(account_id, entity_id),
    ])
    return Response(status_code=204)


@accounts_api.get('/api/accounts/{account_id}/credentials')
def account_credentials_get(account_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rec = Credential.get_list(account_id)
    return JSONResponse(content={'list': rec}, status_code=200)


@accounts_api.post('/api/accounts/{account_id}/credentials')
async def account_credentials_post(account_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    credential = Credential.forge_from_input(await request.json(), account_id)
    credential_id = credential.insert()
    rec = {'id': credential_id}
    mqtt_publish_changed([
        'accounts/{}/credentials'.format(account_id),
    ])
    return JSONResponse(content=rec, status_code=201)


@accounts_api.get('/api/accounts/{account_id}/credentials/{credential_id}')
def account_credential_crud_get(account_id: int, credential_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rec = Credential.get(credential_id, account_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No such credential")
    return JSONResponse(content=rec, status_code=200)


@accounts_api.put('/api/accounts/{account_id}/credentials/{credential_id}')
async def account_credential_crud_put(account_id: int, credential_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    credential = Credential.forge_from_input(await request.json(), account_id, force_id=credential_id)
    rowcount = credential.update()
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such credential")
    mqtt_publish_changed([
        'accounts/{}/credentials'.format(account_id),
        'accounts/{}/credentials/{}'.format(account_id, credential_id),
    ])
    return Response(status_code=204)


@accounts_api.delete('/api/accounts/{account_id}/credentials/{credential_id}')
def account_credential_crud_delete(account_id: int, credential_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rowcount = Credential.delete(credential_id, account_id)
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such credential")
    mqtt_publish_changed([
        'accounts/{}/credentials'.format(account_id),
        'accounts/{}/credentials/{}'.format(account_id, credential_id),
    ])
    return Response(status_code=204)


@accounts_api.get('/api/accounts/{account_id}/sensors')
def account_sensors_get(account_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rec = Sensor.get_list(account_id)
    return JSONResponse(content={'list': rec}, status_code=200)


@accounts_api.post('/api/accounts/{account_id}/sensors')
async def account_sensors_post(account_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    sensor = Sensor.forge_from_input(await request.json(), account_id)
    sensor_id = sensor.insert()
    rec = {'id': sensor_id}
    mqtt_publish_changed([
        'accounts/{}/sensors'.format(account_id),
    ])
    return JSONResponse(content=rec, status_code=201)


@accounts_api.get('/api/accounts/{account_id}/sensors/{sensor_id}')
def account_sensor_crud_get(account_id: int, sensor_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rec = Sensor.get(sensor_id, account_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No such sensor")
    return JSONResponse(content=rec, status_code=200)


@accounts_api.put('/api/accounts/{account_id}/sensors/{sensor_id}')
async def account_sensor_crud_put(account_id: int, sensor_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    sensor = Sensor.forge_from_input(await request.json(), account_id, force_id=sensor_id)
    rowcount = sensor.update()
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such sensor")
    mqtt_publish_changed([
        'accounts/{}/sensors'.format(account_id),
        'accounts/{}/sensors/{}'.format(account_id, sensor_id),
    ])
    return Response(status_code=204)

@accounts_api.delete('/api/accounts/{account_id}/sensors/{sensor_id}')
def account_sensor_crud_delete(account_id: int, sensor_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rowcount = Sensor.delete(sensor_id, account_id)
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such sensor")
    mqtt_publish_changed([
        'accounts/{}/sensors'.format(account_id),
        'accounts/{}/sensors/{}'.format(account_id, sensor_id),
    ])
    return Response(status_code=204)


@accounts_api.get('/api/accounts/{account_id}/bots/{user_id}/permissions')
def account_bot_permissions_get(account_id: int, user_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    """
        Allows reading the permissions of account bots (bots which are tied to a specific account).
    """
    # make sure the bot really belongs to the account:
    rec = Bot.get(user_id, account_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No such bot")

    rec = Permission.get_list(user_id)
    return JSONResponse(content={'list': rec}, status_code=200)


@accounts_api.post('/api/accounts/{account_id}/bots/{user_id}/permissions')
async def account_bot_permissions_post(account_id: int, user_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    """
        Allows assigning permissions to account bots (bots which are tied to a specific account).
    """
    # make sure the bot really belongs to the account:
    rec = Bot.get(user_id, account_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No such bot")

    granting_user_id = auth.user_id
    permission = Permission.forge_from_input(await request.json(), user_id)
    try:
        permission_id = permission.insert(granting_user_id)
        mqtt_publish_changed([
            'persons/{}'.format(permission.user_id),
            'bots/{}'.format(permission.user_id),
        ])
        result = {
            'user_id': permission.user_id,
            'resource_prefix': permission.resource_prefix,
            'methods': permission.methods,
            'id': permission_id,
        }
        return JSONResponse(content=result, status_code=201)
    except AccessDeniedError as ex:
        raise HTTPException(status_code=403, detail=str(ex))
    except psycopg2.IntegrityError:
        raise HTTPException(status_code=400, detail="Invalid parameters")


@accounts_api.delete('/api/accounts/{account_id}/bots/{user_id}/permissions/{permission_id}')
def account_bot_permission_delete(account_id: int, user_id: int, permission_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    """ Revoke permission from account bot """
    # make sure the bot really belongs to the account:
    rec = Bot.get(user_id, account_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No such bot")

    granting_user_id = auth.user_id
    try:
        rowcount = Permission.delete(permission_id, user_id, granting_user_id)
    except AccessDeniedError as ex:
        raise HTTPException(status_code=403, detail=str(ex))
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such permission")
    mqtt_publish_changed([
        'persons/{user_id}'.format(user_id=user_id),
        'bots/{user_id}'.format(user_id=user_id),
    ])
    return Response(status_code=204)


@accounts_api.put("/api/accounts/{account_id}/values")
async def values_put(account_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    data = await request.json()

    # let's just pretend our data is of correct form, otherwise Exception will be thrown and Flask will return error response:
    try:
        newly_created_paths = Measurement.save_values_data_to_db(account_id, data)
    except psycopg2.IntegrityError:
        raise HTTPException(status_code=400, detail="Invalid input format")

    # save the stats:
    minute = math.floor(time.time() / 60) * 60
    stats_updates = {
        SYSTEM_PATH_UPDATED_COUNT: { 'v': len(data), 't': minute },
        SYSTEM_PATH_CHANGED_COUNT: { 'v': len(data), 't': minute },
    }
    topics_with_payloads_stats = Stats.update_account_stats(account_id, stats_updates)

    # publish the changes over MQTT:
    topics_with_payloads = [(
        f"accounts/{account_id}/values/{d['p']}",
        { 'v': d['v'], 't': d['t'] },
    ) for d in data]
    topics_with_payloads.extend(topics_with_payloads_stats)
    if newly_created_paths:
        topics_with_payloads.append(
            (
                f"accounts/{account_id}/paths",
                [{"p": p.path, "id": p.force_id} for p in newly_created_paths],
            ),
        )

    mqtt_publish_changed_multiple_payloads(topics_with_payloads)
    return Response(status_code=204)


@accounts_api.post("/api/accounts/{account_id}/values")
async def values_post(account_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    # data comes from two sources, query params and JSON body. We use both and append timestamp to each
    # piece, then we use the same function as for PUT:
    data = []
    now = time.time()
    json_data = await request.json()
    query_params_p = request.query_params.get('p')
    if json_data:
        for x in json_data:
            if x.get('t'):
                raise HTTPException(status_code=400, detail="Parameter 't' shouldn't be specified with POST")
        data = [{
                'p': x['p'],
                'v': x['v'],
                't': now,
                } for x in json_data]
    elif query_params_p:
        if request.query_params.get('t'):
            raise HTTPException(status_code=400, detail="Query parameter 't' shouldn't be specified with POST")
        data.append({
            'p': query_params_p,
            'v': request.query_params.get('v'),
            't': now,
        })
    else:
        raise HTTPException(status_code=400, detail="Missing data")

    # let's just pretend our data is of correct form, otherwise Exception will be thrown and Flask will return error response:
    try:
        newly_created_paths = Measurement.save_values_data_to_db(account_id, data)
    except psycopg2.IntegrityError:
        raise HTTPException(status_code=400, detail="Invalid input format")

    # update stats:
    minute = math.floor(time.time() / 60) * 60
    stats_updates = {
        SYSTEM_PATH_INSERTED_COUNT: { 'v': len(data), 't': minute },
        SYSTEM_PATH_CHANGED_COUNT: { 'v': len(data), 't': minute },
    }
    topics_with_payloads_stats = Stats.update_account_stats(account_id, stats_updates)

    # publish the changes over MQTT:
    topics_with_payloads = [(
        f"accounts/{account_id}/values/{d['p']}",
        { 'v': d['v'], 't': d['t'] },
    ) for d in data]
    topics_with_payloads.extend(topics_with_payloads_stats)
    if newly_created_paths:
        topics_with_payloads.append(
            (
                f"accounts/{account_id}/paths",
                [{"p": p.path, "id": p.force_id} for p in newly_created_paths],
            ),
        )

    mqtt_publish_changed_multiple_payloads(topics_with_payloads)
    return Response(status_code=204)


@accounts_api.get("/api/accounts/{account_id}/values/{path}")
def values_get(account_id: int, path: str, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    """
        ---
        get:
          summary: Get values within the specified timeframe
          tags:
            - Accounts
          description:
            Returns the values for the specified path. Similar to POST /accounts/<account_id>/getvalues/, except that only a single path can be specified (and GET is used).
          parameters:
            - name: account_id
              in: path
              description: "Account id"
              required: true
              schema:
                type: integer
            - name: path
              in: path
              description: "Path"
              required: true
              schema:
                type: string
            - name: t0
              in: query
              description: "Start time (UNIX timestamp with up to 6 decimals)"
              required: true
              schema:
                type: string
            - name: t1
              in: query
              description: "End time (UNIX timestamp with up to 6 decimals)"
              required: true
              schema:
                type: string
            - name: sort
              in: query
              description: "Sort order (default asc)"
              required: false
              schema:
                type: string
                enum: [asc, desc]
            - name: limit
              in: query
              description: "Limit number or returned results (default 100000, max 100000)"
              required: false
              schema:
                type: integer
                minimum: 1
                maximum: 100000
          responses:
            200:
              content:
                application/json:
                  schema:
                    "$ref": '#/definitions/ValuesGET'
    """
    args = request.query_params
    if "," in path:
        raise HTTPException(status_code=400, detail="Only a single path is allowed")
    paths_input = path
    return _values_get(account_id, paths_input, None, args)


@accounts_api.post("/api/accounts/{account_id}/getvalues")
async def values_get_with_post(account_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    # when we request data for too many paths at once, we run in trouble with URLs being too long. Using
    # POST is not ideal, but it works... We do however keep the interface as close to GET as possible, so
    # we use the same arguments:
    args = await request.json()
    paths_input = args.get('p')
    return _values_get(account_id, paths_input, None, args)


@accounts_api.post("/api/accounts/{account_id}/getaggrvalues")
async def aggrvalues_get_with_post(account_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    args = await request.json()
    paths_input = args.get('p')

    try:
        aggr_level = int(args.get('a'))
    except:
        raise HTTPException(status_code=400, detail="Invalid parameter: a")
    if not (0 <= aggr_level <= 6):
        raise HTTPException(status_code=400, detail="Invalid parameter a (should be a number in range from 0 to 6).")

    return _values_get(account_id, paths_input, aggr_level, args)


def _values_get(account_id, paths_input, aggr_level, args):
    if paths_input is None:
        raise HTTPException(status_code=400, detail="Path(s) not specified")
    try:
        paths = [Path(p, account_id).path for p in paths_input.split(',')]
    except:
        raise HTTPException(status_code=400, detail="Path(s) not specified correctly")

    t_from_input = args.get('t0')
    if t_from_input:
        try:
            t_froms = [Timestamp(t) for t in str(t_from_input).split(',')]
            if len(t_froms) == 1:
                t_froms = [t_froms[0] for _ in paths]
            elif len(t_froms) == len(paths):
                pass
            else:
                raise HTTPException(status_code=400, detail="Number of t0 timestamps must be 1 or equal to number of paths")
        except:
            raise HTTPException(status_code=400, detail="Error parsing t0")
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
            raise HTTPException(status_code=400, detail="Error parsing t1")
    else:
        t_to = Timestamp(time.time())

    sort_order = str(args.get('sort', 'asc'))
    if sort_order not in ['asc', 'desc']:
        raise HTTPException(status_code=400, detail="Invalid parameter: sort (should be 'asc' or 'desc')")
    should_sort_asc = True if sort_order == 'asc' else False

    try:
        max_records = int(args.get('limit', Measurement.MAX_DATAPOINTS_RETURNED))
        if max_records > Measurement.MAX_DATAPOINTS_RETURNED:
            raise HTTPException(status_code=400, detail="Invalid parameter: limit (max. value is {})\n\n".format(Measurement.MAX_DATAPOINTS_RETURNED))
    except:
        raise HTTPException(status_code=400, detail="Invalid parameter: limit")

    # finally, return the data:
    paths_data = Measurement.fetch_data(account_id, paths, aggr_level, t_froms, t_to, should_sort_asc, max_records)
    return JSONResponse(content={'paths': paths_data}, status_code=200)


@accounts_api.get("/api/accounts/{account_id}/topvalues")
def topvalues_get(account_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    """
        ---
        get:
          summary: Get highest N measurements for the latest timestamp before specified time
          tags:
            - Accounts
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
    max_results_input = request.query_params.get('n')
    max_results = max(0, int(max_results_input)) if max_results_input else 5

    path_filter_input = request.query_params.get('f')
    if not path_filter_input:
        raise HTTPException(status_code=400, detail="Path filter not specified")
    try:
        pf = str(PathFilter(path_filter_input))
    except ValidationError:
        raise ValidationError("Invalid path filter")

    ts_to_input = request.query_params.get('t', time.time())
    try:
        ts_to = Timestamp(ts_to_input)
    except ValidationError:
        raise ValidationError("Invalid parameter t")

    ts, total, topn = Measurement.fetch_topn(account_id, pf, ts_to, max_results)
    return JSONResponse(content={
        't': ts.replace(tzinfo=timezone.utc).timestamp(),
        'total': float(total),
        'list': topn,
    }, status_code=200)



@accounts_api.get("/api/accounts/{account_id}/paths")
def paths_get(account_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    max_results_input = request.query_params.get('limit')
    if not max_results_input:
        max_results = 10
    else:
        max_results = max(0, int(max_results_input))
    path_filters_input = request.query_params.get('filter')
    failover_trailing = request.query_params.get('failover_trailing', 'false').lower() == 'true'

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

    return JSONResponse(content=ret, status_code=200)


@accounts_api.get('/api/accounts/{account_id}/paths/{path_id}')
def account_path_crud_get(account_id: int, path_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rec = Path.get(path_id, account_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No such path")
    return JSONResponse(content=rec, status_code=200)


@accounts_api.put('/api/accounts/{account_id}/paths/{path_id}')
async def account_path_crud_put(account_id: int, path_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    record = Path.forge_from_input(await request.json(), account_id, force_id=path_id)
    rowcount = record.update()
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such path")
    return Response(status_code=204)


@accounts_api.delete('/api/accounts/{account_id}/paths/{path_id}')
def account_path_crud_delete(account_id: int, path_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rowcount = Path.delete(path_id, account_id)
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such path")
    return Response(status_code=204)


@accounts_api.get("/api/accounts/{account_id}/dashboards")
def dashboards_crud_get(account_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rec = Dashboard.get_list(account_id)
    return JSONResponse(content={'list': rec}, status_code=200)


@accounts_api.post("/api/accounts/{account_id}/dashboards")
async def dashboards_crud_post(account_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    dashboard = Dashboard.forge_from_input(account_id, await request.json())
    try:
        dashboard.insert()
    except psycopg2.IntegrityError:
        return "Dashboard with this slug already exists", 400
    mqtt_publish_changed(['accounts/{}/dashboards'.format(account_id)])
    return JSONResponse(content={'slug': dashboard.slug}, status_code=201)


@accounts_api.get("/api/accounts/{account_id}/dashboards/{dashboard_slug}")
def dashboard_crud_get(account_id: int, dashboard_slug: str, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rec = Dashboard.get(account_id, slug=dashboard_slug)
    if not rec:
        raise HTTPException(status_code=404, detail="No such dashboard")
    return JSONResponse(content=rec, status_code=200)


@accounts_api.put("/api/accounts/{account_id}/dashboards/{dashboard_slug}")
async def dashboard_crud_put(account_id: int, dashboard_slug: str, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    dashboard = Dashboard.forge_from_input(account_id, await request.json(), force_slug=dashboard_slug)
    rowcount = dashboard.update()
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such dashboard")
    mqtt_publish_changed([
        'accounts/{}/dashboards'.format(account_id),
        'accounts/{}/dashboards/{}'.format(account_id, dashboard_slug),
    ])
    return Response(status_code=204)


@accounts_api.delete("/api/accounts/{account_id}/dashboards/{dashboard_slug}")
def dashboard_crud_delete(account_id: int, dashboard_slug: str, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rowcount = Dashboard.delete(account_id, dashboard_slug)
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such dashboard")
    mqtt_publish_changed([
        'accounts/{}/dashboards'.format(account_id),
        'accounts/{}/dashboards/{}'.format(account_id, dashboard_slug),
    ])
    return Response(content='', status_code=200)


@accounts_api.get("/api/accounts/{account_id}/dashboards/{dashboard_slug}/widgets")
def widgets_crud_get(account_id: int, dashboard_slug: str, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    try:
        paths_limit = int(request.query_params.get('paths_limit', 200))
    except:
        raise HTTPException(status_code=400, detail="Invalid parameter: paths_limit")
    rec = Widget.get_list(account_id, dashboard_slug, paths_limit=paths_limit)
    return JSONResponse(content={'list': rec}, status_code=200)


@accounts_api.post("/api/accounts/{account_id}/dashboards/{dashboard_slug}/widgets")
async def widgets_crud_post(account_id: int, dashboard_slug: str, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    widget = Widget.forge_from_input(account_id, dashboard_slug, await request.json())
    try:
        widget_id = widget.insert()
    except psycopg2.IntegrityError as ex:
        raise HTTPException(status_code=400, detail="Error inserting widget" + str(ex))
    mqtt_publish_changed([
        f'accounts/{account_id}/dashboards/{dashboard_slug}',
    ])
    return JSONResponse(content={'id': widget_id}, status_code=201)


@accounts_api.get("/api/accounts/{account_id}/dashboards/{dashboard_slug}/widgets/{widget_id}")
def widget_crud_get(account_id: int, dashboard_slug: str, widget_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    try:
        paths_limit = int(request.query_params.get('paths_limit', 200))
    except:
        raise HTTPException(status_code=400, detail="Invalid parameter: paths_limit")
    rec = Widget.get(account_id, dashboard_slug, widget_id, paths_limit=paths_limit)
    if not rec:
        raise HTTPException(status_code=404, detail="No such widget")
    return JSONResponse(content=rec, status_code=200)


@accounts_api.put("/api/accounts/{account_id}/dashboards/{dashboard_slug}/widgets/{widget_id}")
async def widget_crud_put(account_id: int, dashboard_slug: str, widget_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    widget = Widget.forge_from_input(account_id, dashboard_slug, await request.json(), widget_id=widget_id)
    rowcount = widget.update()
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such widget")
    mqtt_publish_changed([
        f'accounts/{account_id}/dashboards/{dashboard_slug}',
    ])
    return Response(status_code=204)


@accounts_api.delete("/api/accounts/{account_id}/dashboards/{dashboard_slug}/widgets/{widget_id}")
def widget_crud_delete(account_id: int, dashboard_slug: str, widget_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rowcount = Widget.delete(account_id, dashboard_slug, widget_id)
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such widget")
    mqtt_publish_changed([
        f'accounts/{account_id}/dashboards/{dashboard_slug}',
    ])
    return Response(content='', status_code=200)


@accounts_api.put("/api/accounts/{account_id}/dashboards/{dashboard_slug}/widgets_positions/")
async def widgets_positions_put(account_id: int, dashboard_slug: str, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    Widget.set_positions(account_id, dashboard_slug, await request.json())
    mqtt_publish_changed([
        f'accounts/{account_id}/dashboards/{dashboard_slug}',
    ])
    return Response(status_code=204)

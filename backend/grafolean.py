#!/usr/bin/env python
import os
import re
import sys

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware import Middleware
from fastapi.middleware.cors import CORSMiddleware
import jsonschema
import uvicorn


from version import GRAFOLEAN_VERSION


app = FastAPI(
    title="Grafolean",
    description="Easy to use monitoring solution",
    version=GRAFOLEAN_VERSION,
    openapi_url="/api/swagger.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    contact={
        "name": "Grafolean",
        "url": "https://grafolean.com/",
        "email": "info@grafolean.com",
    },
    license_info={
        'name': 'Commons Clause',
        'url': 'https://github.com/grafolean/grafolean/blob/master/LICENSE.md',
    },
)


try:
    # It turns out that supplying os.environ vars to a script running under uWSGI is not so trivial. The
    # easiest way is to simply write them to .env and load them here:
    dotenv_filename = os.path.join(app.root_path, '.env')
    load_dotenv(dotenv_filename)
except:
    pass


from datatypes import ValidationError, Permission, Bot
import dbutils
from utils import log
from auth import JWT, AuthFailedException
from api import CORS_DOMAINS, accounts_api, admin_api, auth_api, profile_api, users_api, status_api, plugins_api
import validators


# register the blueprints for different api endpoints:
app.include_router(users_api)  # /api/users, /api/persons and /api/bots
app.include_router(admin_api)
app.include_router(auth_api)
app.include_router(accounts_api)
app.include_router(status_api)
app.include_router(profile_api)
app.include_router(plugins_api)


NO_AUTH_ENDPOINTS = [
    ('POST', '/api/persons/signup/new'),
    ('POST', '/api/admin/migratedb'),
    ('POST', '/api/admin/first'),
    ('POST', '/api/admin/mqtt-auth-plug/getuser'),
    ('POST', '/api/admin/mqtt-auth-plug/superuser'),
    ('POST', '/api/admin/mqtt-auth-plug/aclcheck'),
    ('POST', '/api/auth/login'),
    ('POST', '/api/auth/refresh'),
    ('GET', '/api/docs'),
    ('GET', '/api/redoc'),
    ('GET', '/api/swagger.json'),
    ('GET', '/api/plugins/widgets'),
    ('GET', '/api/status/info'),
    # ('GET', '/api/status/sitemap'),
    ('POST', '/api/status/cspreport'),
    ('POST', '/api/persons/signup/new'),
    ('POST', '/api/persons/signup/validatepin'),
    ('POST', '/api/persons/signup/complete'),
    ('POST', '/api/persons/forgot'),
    ('POST', '/api/persons/forgot/reset'),
]
NO_AUTH_GET_ENDPOINTS_REGEXES = [
    ('GET', re.compile(r'/api/plugins/widgets/[0-9]+')),
    ('GET', re.compile(r'/api/plugins/widgets/[0-9]+/widget[.]js')),
    ('GET', re.compile(r'/api/plugins/widgets/[0-9]+/form[.]js')),
]


@app.middleware("http")
async def grafolean_auth(request: Request, call_next):
    request.state.grafolean_auth = {}

    # some endpoints do not want us to perform any authorization for them:
    method = request.method.upper()
    url_path = request.url.path
    if (method, url_path) in NO_AUTH_ENDPOINTS:
        return await call_next(request)
    # some of these endpoints use path params and must be matched via regex:
    for no_auth_method, no_auth_path_pattern in NO_AUTH_GET_ENDPOINTS_REGEXES:
        if method == no_auth_method and re.match(no_auth_path_pattern, url_path):
            return await call_next(request)

    try:
        user_id = None
        user_is_bot = False
        authorization_header = request.headers.get('authorization')
        query_params_bot_token = request.query_params.get('b')
        if authorization_header is not None:
            received_jwt = JWT.forge_from_authorization_header(authorization_header, allow_leeway=0)
            request.state.grafolean_auth['jwt'] = received_jwt
            user_id = received_jwt.data['user_id']
        elif query_params_bot_token is not None:
            user_id = Bot.authenticate_token(query_params_bot_token)
            user_is_bot = True

        if user_id is None:
            log.info("Authentication failed (no such user)")
            return Response(status_code=401, content="Access denied")

        # check permissions:
        resource = request.url.path[len('/api/'):]
        resource = resource.rstrip('/')
        is_allowed = Permission.is_access_allowed(
            user_id=user_id,
            resource=resource,
            method=request.method,
        )
        if not is_allowed:
            log.info("Access denied (permissions check failed) {} {} {}".format(user_id, resource, request.method.upper()))
            return Response(status_code=403, content="Access to resource denied, insufficient permissions")

        request.state.grafolean_auth['user_id'] = user_id
        request.state.grafolean_auth['user_is_bot'] = user_is_bot
    except AuthFailedException as ex:
        log.info(f"Authentication failed: {str(ex)}")
        return Response(status_code=401, content="Access denied")
    except HTTPException:
        raise
    except:
        log.exception("Exception while checking access rights")
        return Response(status_code=500, content="Could not validate access")

    return await call_next(request)


# we are nice to the frontend - we allow call to (only) this path, so that if CORS is misconfigured, frontend can advise on proper solution:
@app.middleware("http")
async def status_info_no_cors(request: Request, call_next):
    url_path = request.url.path
    response = await call_next(request)
    if url_path == '/api/status/info':
        response.headers['access-control-allow-origin'] = '*'
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_DOMAINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Content-Type", "Authorization", "If-None-Match"],
    expose_headers=["X-JWT-Token"],
    max_age=3600,  # https://damon.ghost.io/killing-cors-preflight-requests-on-a-react-spa/
)


@app.exception_handler(ValidationError)
@app.exception_handler(jsonschema.exceptions.ValidationError)
def handle_invalid_usage(request: Request, error: Exception):
    content_type_header = request.headers.get('content-type', None)
    str_error = error.message if hasattr(error, 'message') else str(error)
    if not content_type_header or content_type_header != 'application/json':
        str_error = "{} - maybe Content-Type header was not set to application/json?".format(str_error)
    return Response(content='Input validation failed: {}'.format(str_error), status_code=400)


if __name__ == "__main__":

    log.info("Starting main")
    uvicorn.run(app)

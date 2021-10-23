import copy
import json
import os
import smtplib
import socket

from fastapi import Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse, Response
# from flask_mail import Message, Mail
import psycopg2

from .fastapiutils import APIRouter, AuthenticatedUser, validate_user_authentication
from .common import noauth, mqtt_publish_changed
import validators
from datatypes import Account, Bot, Permission, Person, AccessDeniedError, User
from utils import log


users_api = APIRouter()


def users_apidoc_schemas():
    yield "BotPOST", validators.BotSchemaInputs
    yield "BotGET", {
        'type': 'object',
        'properties': {
            'id': {
                'type': 'integer',
                'description': "User id",
                'example': 123,
            },
            'name': {
                'type': 'string',
                'description': "Bot name",
                'example': 'My Bot',
            },
            'token': {
                'type': 'string',
                'format': 'uuid',
                'description': "Bot authentication token",
            },
            'insert_time': {
                'type': 'integer',
                'description': "Insert time (UNIX timestamp)",
                'example': 1234567890,
            },
        },
        'required': ['id', 'name', 'token', 'insert_time'],
    }

    personGETSchema = {
        'type': 'object',
        'properties': {
            'user_id': {
                'type': 'integer',
                'description': "User id",
                'example': 123,
            },
            'username': {
                'type': 'string',
                'description': "Username",
                'example': 'myusername',
            },
            'name': {
                'type': 'string',
                'description': "Name",
                'example': 'Grafo Lean',
            },
            'email': {
                'type': 'string',
                'format': 'email',
                'description': "someone@example.org",
            },
        },
    }
    yield "PersonGET", personGETSchema

    personGETWithPermissionsSchema = copy.deepcopy(personGETSchema)
    personGETWithPermissionsSchema['properties']['permissions'] = {
        'type': 'array',
        'items': validators.PermissionSchemaInputs,
    }
    yield "PersonGETWithPermissions", personGETWithPermissionsSchema
    yield "PersonPOST", validators.PersonSchemaInputsPOST
    yield "Permission", validators.PermissionSchemaInputs
    yield "PersonSignupNewPOST", validators.PersonSignupNewPOST
    yield "PersonSignupValidatePinPOST", validators.PersonSignupValidatePinPOST
    yield "PersonSignupCompletePOST", validators.PersonSignupCompletePOST
    yield "ForgotPasswordPOST", validators.ForgotPasswordPOST
    yield "ForgotPasswordResetPOST", validators.ForgotPasswordResetPOST


def send_grafolean_noreply_email(subject, recipients, body):
    MAIL_SERVER = os.environ.get('MAIL_SERVER', None)
    MAIL_PORT = os.environ.get('MAIL_PORT', 587)
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() in ['true', 'yes', 'on', '1']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME', None)
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD', None)
    MAIL_REPLY_TO = os.environ.get('MAIL_REPLY_TO', None)

    if not MAIL_SERVER:
        log.error("Please set MAIL_SERVER to send e-mails!")
        return
    if not MAIL_REPLY_TO:
        log.error("Please set MAIL_REPLY_TO to send e-mails!")
        return

    mailer = smtplib.SMTP(MAIL_SERVER, MAIL_PORT)
    if MAIL_USE_TLS:
        mailer.starttls()
    if MAIL_USERNAME:
        mailer.login(MAIL_USERNAME, MAIL_PASSWORD)
    mailer.ehlo()  # must be called explicitly or "SMTPSenderRefused - malformed address" error happens
    for recipient_address in recipients:
        header = "\n".join([
            f"From: {MAIL_REPLY_TO}",
            f"To: {recipient_address}",
            f"Subject: {subject}",
        ])
        mailer.sendmail(MAIL_REPLY_TO, recipient_address, header + "\n\n" + body)
    mailer.quit()


# --------------
# /api/users/, /api/persons/ and /api/bots/ - user management
# --------------


@users_api.get('/api/users/{user_id}')
def users_user_get(user_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rec = User.get(user_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No such user")
    rec['permissions'] = Permission.get_list(user_id)
    return JSONResponse(content=rec, status_code=201)


@users_api.get('/api/bots')
# CAREFUL: accessible to any authenticated user (permissions check bypassed) - NO_PERMISSION_CHECK_RESOURCES_READ
def users_bots_get(auth: AuthenticatedUser = Depends(validate_user_authentication)):
    """
        ---
        get:
          summary: Get systemwide bots
          tags:
            - Users
          description:
            Returns a list of all systemwide bots (bots which are not tied to a specific account). The list is returned in a single array (no pagination).
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
                          "$ref": '#/definitions/BotGET'
        post:
          summary: Create a systemwide bot
          tags:
            - Users
          description:
            Creates a systemwide bot. By default, a created bot is without permissions, so they must be granted to it before it can do anything useful.

          parameters:
            - name: "body"
              in: body
              description: "Bot data"
              required: true
              schema:
                "$ref": '#/definitions/BotPOST'
          responses:
            201:
              content:
                application/json:
                  schema:
                    "$ref": '#/definitions/BotGET'
    """
    rec = Bot.get_list()
    return JSONResponse(content={'list': rec}, status_code=200)


@users_api.post('/api/bots')
# CAREFUL: accessible to any authenticated user (permissions check bypassed) - NO_PERMISSION_CHECK_RESOURCES_READ
async def users_bots_post(request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    bot = Bot.forge_from_input(await request.json())
    user_id, _ = bot.insert()
    rec = Bot.get(user_id, None)
    mqtt_publish_changed([
        'bots',
    ])
    return JSONResponse(content=rec, status_code=201)


@users_api.get('/api/bots/{user_id}')
def users_bot_crud_get(user_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    """
        ---
        get:
          summary: Get bot data
          tags:
            - Users
          description:
            Returns bot data.
          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: true
              schema:
                type: integer
          responses:
            200:
              content:
                application/json:
                  schema:
                    "$ref": '#/definitions/BotGET'
            404:
              description: No such bot
        put:
          summary: Update the bot
          tags:
            - Users
          description:
            Updates bot name. Note that all other fields are handled automatically (they can't be changed).
          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: true
              schema:
                type: integer
            - name: "body"
              in: body
              description: "Bot data"
              required: true
              schema:
                "$ref": '#/definitions/BotPOST'
          responses:
            204:
              description: Update successful
            404:
              description: No such bot
        delete:
          summary: Remove the bot
          tags:
            - Users
          description:
            Removes the bot. Also removes its permissions, if any.
          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: true
              schema:
                type: integer
          responses:
            204:
              description: Bot removed successfully
            403:
              description: Can't remove yourself
            404:
              description: No such bot
    """
    rec = Bot.get(user_id, None)
    if not rec:
        raise HTTPException(status_code=404, detail="No such bot")
    return JSONResponse(content=rec, status_code=200)


@users_api.put('/api/bots/{user_id}')
async def users_bot_crud_put(user_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    bot = Bot.forge_from_input(await request.json(), force_id=user_id)
    rowcount = bot.update()
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such bot")
    mqtt_publish_changed([
        'bots/{user_id}'.format(user_id=user_id),
        'bots',
    ])
    return Response(status_code=204)


@users_api.delete('/api/bots/{user_id}')
def users_bot_crud_delete(user_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    # bot should not be able to delete himself, otherwise they could lock themselves out:
    if int(auth.user_id) == int(user_id):
        raise HTTPException(status_code=403, detail="Can't delete yourself")
    rowcount = Bot.delete(user_id)
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such bot")
    mqtt_publish_changed([
        'bots/{user_id}'.format(user_id=user_id),
        'bots',
    ])
    return Response(status_code=204)


@users_api.get('/api/bots/{user_id}/token')
def users_bot_token_get(user_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    # make sure the user who is requesting to see the bot token has every permission that this token has, and
    # also that this user can add the bot:
    request_user_permissions = Permission.get_list(int(auth.user_id))
    if not Permission.has_all_permissions(request_user_permissions, user_id):
        raise HTTPException(status_code=403, detail="Not enough permissions to see this bot's token")
    if not Permission.can_grant_permission(request_user_permissions, 'bots', 'POST'):
        raise HTTPException(status_code=403, detail="Not enough permissions to see this bot's token - POST to /bots not allowed")
    token = Bot.get_token(user_id, None)
    if not token:
        raise HTTPException(status_code=404, detail="No such bot")
    return JSONResponse(content={'token': token}, status_code=200)


@users_api.get('/api/persons')
def users_persons_get(auth: AuthenticatedUser = Depends(validate_user_authentication)):
    """
        ---
        get:
          summary: Get all persons
          tags:
            - Users
          description:
            Returns a list of all persons. The list is returned in a single array (no pagination).
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
                          "$ref": '#/definitions/PersonGET'
        post:
          summary: Create a person account
          tags:
            - Users
          description:
            Creates a person account. By default (as any user) a person is without permissions, so they must be granted to it before it can do anything useful.
          parameters:
            - name: "body"
              in: body
              description: "Person data"
              required: true
              schema:
                "$ref": '#/definitions/PersonPOST'
          responses:
            201:
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
    """
    rec = Person.get_list()
    return JSONResponse(content={'list': rec}, status_code=200)


@users_api.post('/api/persons')
async def users_persons_post(request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    person = Person.forge_from_input(await request.json())
    user_id = person.insert()
    mqtt_publish_changed([
        'persons',
    ])
    return JSONResponse(content={'id': user_id}, status_code=201)


@users_api.get('/api/persons/{user_id}')
def users_person_crud_get(user_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    """
        ---
        get:
          summary: Get person data
          tags:
            - Users
          description:
            Returns person data.
          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: true
              schema:
                type: integer
          responses:
            200:
              content:
                application/json:
                  schema:
                    "$ref": '#/definitions/PersonGETWithPermissions'
            404:
              description: No such person
        put:
          summary: Update the bot
          tags:
            - Users
          description:
            Updates person data.
          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: true
              schema:
                type: integer
            - name: "body"
              in: body
              description: "Person data"
              required: true
              schema:
                "$ref": '#/definitions/PersonPOST'
          responses:
            204:
              description: Update successful
            404:
              description: No such person
        delete:
          summary: Remove the person data
          tags:
            - Users
          description:
            Removes the person data. Also removes user's permissions, if any.
          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: true
              schema:
                type: integer
          responses:
            204:
              description: Person data removed successfully
            403:
              description: Can't remove yourself
            404:
              description: No such person
    """
    rec = Person.get(user_id)
    if not rec:
        raise HTTPException(status_code=404, detail="No such person")
    rec['permissions'] = Permission.get_list(user_id)
    return JSONResponse(content=rec, status_code=200)


@users_api.put('/api/persons/{user_id}')
async def users_person_crud_put(user_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    person = Person.forge_from_input(await request.json(), force_id=user_id)
    rowcount = person.update()
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such person")
    mqtt_publish_changed([
        'persons/{user_id}'.format(user_id=user_id),
        'persons',
    ])
    return Response(status_code=204)


@users_api.delete('/api/persons/{user_id}')
def users_person_crud_delete(user_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    # user should not be able to delete himself, otherwise they could lock themselves out:
    if int(auth.user_id) == int(user_id):
        raise HTTPException(status_code=403, detail="Can't delete yourself")
    rowcount = Person.delete(user_id)
    if not rowcount:
        raise HTTPException(status_code=404, detail="No such person")
    mqtt_publish_changed([
        'persons/{user_id}'.format(user_id=user_id),
        'persons',
    ])
    return Response(status_code=204)


@users_api.post('/api/persons/{user_id}/password')
async def users_person_change_password(user_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    rowcount = Person.change_password(user_id, await request.json())
    if not rowcount:
        raise HTTPException(status_code=400, detail="Change failed")
    # no need to publish to mqtt - nobody cares
    return Response(status_code=204)


@users_api.get('/api/users/{user_id}/permissions')
@users_api.get('/api/bots/{user_id}/permissions')
@users_api.get('/api/persons/{user_id}/permissions')
def users_permissions_get(user_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    """
        ---
        get:
          summary: Get a list of all permissions granted to a specified user
          tags:
            - Users
          description:
            Returns a list of all permissions granted to the user. The list is returned in a single array (no pagination).


            Note that when comparing, resource prefix is checked either for equality (resource must match prefix), otherwise
            resource location must start with the prefix, followed by forward slash ('/'). In other words, allowing users
            access to 'accounts/123' does **not** grant them access to 'accounts/1234'.
          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: false
              schema:
                type: integer
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
                          type: object
                          properties:
                            id:
                              type: integer
                              description: "Permission id"
                            resource_prefix:
                              type: string
                              nullable: true
                              description: "Resource prefix (e.g., 'admin/permissions' or 'accounts/123'); if null, this permission applies to any resource"
                            methods:
                              type: array
                              items:
                                type: string
                                enum:
                                  - "GET"
                                  - "POST"
                                  - "PUT"
                                  - "DELETE"
                              nullable: true
                              description: "List of HTTP methods allowed; if null, this permission applies to any method"
        post:
          summary: Grant permission to the user
          tags:
            - Users
          description:
            Grants a specified permission to the user. Permissions are defined with a combination of resource prefix and a list of methods.
            Since both persons and bots are users, this endpoint can be used for granting permissions to either of them.


            Note that when comparing, resource prefix is checked either for equality (resource must match prefix), otherwise
            resource location must start with the prefix, followed by forward slash ('/'). In other words, allowing users
            access to 'accounts/123' does **not** grant them access to 'accounts/1234'.


          parameters:
            - name: user_id
              in: path
              description: "User id"
              required: false
              schema:
                type: integer
            - name: "body"
              in: body
              description: "Permission to be granted"
              required: true
              schema:
                "$ref": '#/definitions/Permission'
          responses:
            201:
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
                        description: "Permission id"
            400:
              description: Invalid parameters
            401:
              description: Not allowed to grant permissions
    """
    rec = Permission.get_list(user_id=user_id)
    return JSONResponse(content={'list': rec}, status_code=200)


@users_api.post('/api/users/{user_id}/permissions')
@users_api.post('/api/bots/{user_id}/permissions')
@users_api.post('/api/persons/{user_id}/permissions')
async def users_permissions_post(user_id: int, request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    granting_user_id = auth.user_id
    permission = Permission.forge_from_input(await request.json(), user_id)
    try:
        permission_id = permission.insert(granting_user_id)
        mqtt_publish_changed([
            'persons/{user_id}'.format(user_id=user_id),
            'bots/{user_id}'.format(user_id=user_id),
        ])
        return JSONResponse(content={'id': permission_id}, status_code=201)
    except AccessDeniedError as ex:
        raise HTTPException(status_code=403, detail=str(ex))
    except psycopg2.IntegrityError:
        raise HTTPException(status_code=400, detail="Invalid parameters")


@users_api.delete('/api/users/{user_id}/permissions/{permission_id}')
@users_api.delete('/api/bots/{user_id}/permissions/{permission_id}')
@users_api.delete('/api/persons/{user_id}/permissions/{permission_id}')
def users_permission_delete(user_id: int, permission_id: int, auth: AuthenticatedUser = Depends(validate_user_authentication)):
    """
        ---
        delete:
          summary: Revoke permission
          tags:
            - Users
          description:
            Revokes a specific permission, as specified by permission id.
          parameters:
            - name: permission_id
              in: path
              description: "Permission id"
              required: true
              schema:
                type: integer
          responses:
            204:
              description: Permission removed successfully
            401:
              description: Not allowed to revoke this permission
            404:
              description: No such permission
    """
    granting_user_id = auth.user_id
    try:
        rowcount = Permission.delete(permission_id, user_id, granting_user_id)
    except AccessDeniedError as ex:
        raise HTTPException(status_code=403, detail=str(ex))
    if not rowcount:
        raise HTTPException(status_code=403, detail="No such permission")
    mqtt_publish_changed([
        'persons/{user_id}'.format(user_id=user_id),
        'users/{user_id}'.format(user_id=user_id),
        'bots/{user_id}'.format(user_id=user_id),
    ])
    return Response(status_code=204)


def _generate_signup_mail_message(name, email, frontend_origin, user_id, confirm_pin):
    return f'''\
Welcome, {name if name else email}!

Click on this link to complete the signup process:

{frontend_origin}/signup/confirm/{user_id}/{confirm_pin}

Grafolean lets you easily collect and visualize data. We're excited to have
you on board! Let us know if you need anything: info@grafolean.com

Grafolean Team

* If you don't know what this is about, and you didn't signup for anything,
please ignore this e-mail - there is nothing you need to do in this case.
Whoever has entered your e-mail address will not be able to complete their
registration.
'''


def _is_tor_exit_node(ipv4):
    ip_parts = ipv4.split('.')
    ip_parts.reverse()
    try:
        addr = socket.gethostbyname(f'{".".join(ip_parts)}.dnsel.torproject.org')
    except socket.gaierror:
        return False
    if addr.startswith('127.0.0') and addr != '127.0.0.1':
        return True
    return False


@users_api.post('/api/persons/signup/new')
@noauth
async def users_person_signup_new(request: Request, background_tasks: BackgroundTasks):
    """
        ---
        post:
          summary: Allows a person to sign up (first step)
          tags:
            - Users
          description:
            Creates a new person (unconfirmed, with no access rights and without access to any account) and sends a welcome e-mail.
          parameters:
            - name: "body"
              in: body
              description: "Person data"
              required: true
              schema:
                "$ref": '#/definitions/PersonSignupNewPOST'
          responses:
            204:
              description: Request was accepted
            400:
              description: Invalid parameters
            403:
              description: Signup disabled
    """
    if os.environ.get('ENABLE_SIGNUP', 'false').lower() not in ['true', 'yes', 'on', '1']:
        raise HTTPException(status_code=403, detail="Signup disabled")

    if os.environ.get('SIGNUP_DISALLOW_TOR', 'true').lower() in ['true', 'yes', 'on', '1']:
        # if user is coming from Tor exit node, disallow signup:
        client_ip = request.headers.get('x-forwarded-for', None)
        if not client_ip:
            raise HTTPException(status_code=403, detail="Could not determine client IP")
        if _is_tor_exit_node(client_ip):
            raise HTTPException(status_code=403, detail="Sorry, Tor exit nodes are not allowed to signup due to abuse")

    user_id, confirm_pin = Person.signup_new(await request.json())
    person_data = Person.get(user_id)

    mail_subject = "Welcome to Grafolean!"
    # unless explicitly set otherwise, assume that backend and frontend have the same origin:
    backend_origin = f"{request.url.scheme}://{request.url.hostname}:{request.url.port}"
    frontend_origin = os.environ.get('FRONTEND_ORIGIN', backend_origin).rstrip('/')
    mail_body_text = _generate_signup_mail_message(person_data['name'], person_data['email'], frontend_origin, user_id, confirm_pin)

    background_tasks.add_task(send_grafolean_noreply_email, mail_subject, recipients=[person_data['email']], body=mail_body_text)

    return Response(status_code=204)


@users_api.post('/api/persons/signup/validatepin')
@noauth
async def users_person_signup_validatepin(request: Request):
    """
        ---
        post:
          summary: Checks if confirmation pin is valid
          tags:
            - Users
          description:
            Checks if confirmation pin is valid (but doesn't complete the signup yet). This allows
            frontend to ask for a password before completing the signup process.
          parameters:
            - name: "body"
              in: body
              description: "Pin"
              required: true
              schema:
                "$ref": '#/definitions/PersonSignupValidatePinPOST'
          responses:
            204:
              description: Pin is valid
            400:
              description: Invalid parameters
            403:
              description: Signup disabled
    """
    if os.environ.get('ENABLE_SIGNUP', 'false').lower() not in ['true', 'yes', 'on', '1']:
        raise HTTPException(status_code=403, detail="Signup disabled")

    confirm_pin_valid = Person.signup_pin_valid(await request.json())
    if not confirm_pin_valid:
        raise HTTPException(status_code=400, detail="Invalid pin, invalid user id, or signup already completed")
    else:
        return Response(status_code=204)


@users_api.post('/api/persons/signup/complete')
@noauth
# async def users_person_signup_complete(request: Request, auth: AuthenticatedUser = Depends(validate_user_authentication)):
async def users_person_signup_complete(request: Request):
    """
        ---
        post:
          summary: Complete the signup process
          tags:
            - Users
          description:
            Completes the user's signup process by supplying a valid confirmation pin and a new password.
          parameters:
            - name: "body"
              in: body
              description: "Pin and password"
              required: true
              schema:
                "$ref": '#/definitions/PersonSignupCompletePOST'
          responses:
            204:
              description: Pin is valid
            400:
              description: Invalid parameters
            403:
              description: Signup disabled
    """
    if os.environ.get('ENABLE_SIGNUP', 'false').lower() not in ['true', 'yes', 'on', '1']:
        raise HTTPException(status_code=403, detail="Signup disabled")

    status = Person.signup_complete(await request.json(), create_account=True)
    if status:
        return Response(status_code=204)
    else:
        raise HTTPException(status_code=400, detail="Invalid pin, invalid user id, or signup already completed")


def _generate_forgot_password_message(frontend_origin, user_id, confirm_pin):
    return f'''\
Hello,

We heard that you need a password reset. Click the link below and you will
be redirected to a page where you can set a new password:

{frontend_origin}/forgot/{user_id}/{confirm_pin}

This link expires in one hour.

Grafolean Team
'''


@users_api.post('/api/persons/forgot')
@noauth
async def users_person_forgot_password(request: Request, background_tasks: BackgroundTasks):
    """
        ---
        post:
          summary: Sends an email with a reset password link
          tags:
            - Users
          description:
            If given an existing e-mail address, sends an e-mail message with a password reset link.
          parameters:
            - name: "body"
              in: body
              description: "E-mail address"
              required: true
              schema:
                "$ref": '#/definitions/ForgotPasswordPOST'
          responses:
            204:
              description: Request was accepted
            400:
              description: Invalid parameters
            500:
              description: Mail sending not setup
    """
    if not os.environ.get('MAIL_SERVER', None):
        raise HTTPException(status_code=500, detail="Mail sending not setup")

    user_id, confirm_pin = Person.forgot_password(await request.json())
    if not user_id:
        raise HTTPException(status_code=400, detail="Email does not correspond to any registered user")

    person_data = Person.get(user_id)
    mail_subject = "Grafolean password reset link"
    # unless explicitly set otherwise, assume that backend and frontend have the same origin:
    backend_origin = f"{request.url.scheme}://{request.url.hostname}:{request.url.port}"
    frontend_origin = os.environ.get('FRONTEND_ORIGIN', backend_origin).rstrip('/')
    mail_body_text = _generate_forgot_password_message(frontend_origin, user_id, confirm_pin)

    background_tasks.add_task(send_grafolean_noreply_email, mail_subject, recipients=[person_data['email']], body=mail_body_text)

    return Response(status_code=204)


@users_api.post('/api/persons/forgot/reset')
@noauth
async def users_person_forgot_password_reset(request: Request):
    """
        ---
        post:
          summary: Resets a forgotten password
          tags:
            - Users
          description:
            Resets person's password if person exists, confirmation pin is correct and less than 1 hour old and person account is confirmed.
          parameters:
            - name: "body"
              in: body
              description: "E-mail address"
              required: true
              schema:
                "$ref": '#/definitions/ForgotPasswordResetPOST'
          responses:
            204:
              description: Password was reset
            400:
              description: Invalid parameters
    """
    success = Person.forgot_password_reset(await request.json())
    if success:
        return Response(status_code=204)
    else:
        raise HTTPException(status_code=400, detail="Password could not be changed - expired / invalid pin or user does not exist")

import json

from fastapi import Depends
from fastapi.responses import JSONResponse

from .fastapiutils import APIRouter, AuthenticatedUser, validate_user_authentication
from datatypes import Account, Bot, Permission, Person


profile_api = APIRouter()


# --------------
# /api/profile/ - user specific endpoints
# --------------


@profile_api.get('/api/profile/')
# CAREFUL: accessible to any authenticated user (permissions check bypassed) - NO_PERMISSION_CHECK_RESOURCES_READ
def profile(auth: AuthenticatedUser = Depends(validate_user_authentication)):
    user_id = auth.user_id
    user_is_bot = auth.user_is_bot
    if user_is_bot:
        tied_to_account = Bot.get_tied_to_account(user_id)
        return JSONResponse(content={
            'user_id': user_id,
            'user_type': 'bot',
            'record': Bot.get(user_id, tied_to_account=tied_to_account),
        }, status_code=200)
    else:
        return JSONResponse(content={
            'user_id': user_id,
            'user_type': 'person',
            'record': Person.get(user_id),
        }, status_code=200)


@profile_api.get('/api/profile/permissions')
# CAREFUL: accessible to any authenticated user (permissions check bypassed) - NO_PERMISSION_CHECK_RESOURCES_READ
def profile_permissions(auth: AuthenticatedUser = Depends(validate_user_authentication)):
    user_id = auth.user_id
    rec = Permission.get_list(user_id)
    return JSONResponse(content={'list': rec}, status_code=200)

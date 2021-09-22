import json
import secrets

from fastapi import Depends, HTTPException, Security
from fastapi.responses import JSONResponse

from .fastapiutils import APIRouter, api_authorization_header
from .objschemas import ReqPersonCredentialsPOST
from datatypes import Permission, PersonCredentials, Person
from auth import JWT
from .common import noauth


auth_api = APIRouter()


# --------------
# /auth/ - authentication; might need different logging settings
# --------------


@auth_api.post('/api/auth/login')
@noauth
def auth_login_post(credentials: ReqPersonCredentialsPOST):
    credentials_record = PersonCredentials.forge_from_input(credentials.dict())
    user_id = credentials_record.check_user_login()
    if not user_id:
        raise HTTPException(status_code=401, detail='Invalid credentials')

    session_data = {
        'user_id': user_id,
        'session_id': secrets.token_hex(32),
        'permissions': Permission.get_list(user_id),
    }
    header, _ = JWT(session_data).encode_as_authorization_header()
    return JSONResponse(content=session_data, status_code=200, headers={ 'X-JWT-Token': header })


@auth_api.post('/api/auth/refresh')
@noauth
def auth_refresh_post(authorization_header: str = Depends(lambda authorization_header = Security(api_authorization_header): authorization_header)):
    try:
        # authorization_header = flask.request.headers.get('Authorization')
        if not authorization_header:
            raise HTTPException(status_code=401, detail='Access denied')

        old_jwt = JWT.forge_from_authorization_header(authorization_header, allow_leeway=JWT.TOKEN_CAN_BE_REFRESHED_FOR)
        data = old_jwt.data.copy()
        new_jwt, _ = JWT(data).encode_as_authorization_header()

        return JSONResponse(content=data, status_code=200, headers={ 'X-JWT-Token': new_jwt })
    except:
        raise HTTPException(status_code=401, detail='Access denied')

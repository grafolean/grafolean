import re
from typing import Any, Callable

from fastapi import APIRouter as FastAPIRouter, Security, Request, HTTPException
from fastapi.types import DecoratedCallable
from fastapi.security.api_key import APIKeyHeader, APIKeyQuery, Request
from pydantic import BaseModel

from datatypes import Bot, Permission
from auth import JWT, AuthFailedException
from utils import log
from .common import mqtt_publish_changed, mqtt_publish_changed_multiple_payloads


# Since this is API, we don't care about trailing slashes - and we don't want redirects.
# In Flask we would do it like this:
# app.url_map.strict_slashes = False
# But Starlette/FastAPI is a bit more reluctant to help us achieve this, so we need to hack a bit:
# https://github.com/tiangolo/fastapi/issues/2060#issuecomment-834868906
class APIRouter(FastAPIRouter):
    def api_route(
        self, path: str, *, include_in_schema: bool = True, **kwargs: Any
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        if path.endswith("/"):
            path = path[:-1]

        add_path = super().api_route(
            path, include_in_schema=include_in_schema, **kwargs
        )

        alternate_path = path + "/"
        add_alternate_path = super().api_route(
            alternate_path, include_in_schema=False, **kwargs
        )

        def decorator(func: DecoratedCallable) -> DecoratedCallable:
            add_alternate_path(func)
            return add_path(func)

        return decorator


class AuthenticatedUser(BaseModel):
    user_id: int
    user_is_bot: bool


api_authorization_header = APIKeyHeader(name='Authorization', auto_error=False)
api_query_params_bot_token = APIKeyQuery(name='b', auto_error=False)


def validate_user_authentication(
        request: Request,
        authorization_header: str = Security(api_authorization_header),
        query_params_bot_token: str = Security(api_query_params_bot_token),
    ):
    return AuthenticatedUser(user_id=request.state.grafolean_auth['user_id'], user_is_bot=request.state.grafolean_auth['user_is_bot'])

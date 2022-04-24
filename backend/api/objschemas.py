from typing import Optional

from pydantic import Extra, BaseModel as PydanticBaseModel


class BaseModel(PydanticBaseModel):
    class Config:
        extra = Extra.forbid


class ReqPersonPOST(BaseModel):
    username: str
    password: str
    name: str
    email: str
    timezone: Optional[str]


class ReqPersonCredentialsPOST(BaseModel):
    username: str
    password: str


class ReqAccountsPOST(BaseModel):
    name: str


class ResId(BaseModel):
    id: int

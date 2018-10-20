import re
from flask_inputs import Inputs
from flask_inputs.validators import JsonSchema
import wtforms.validators as val


class ValuesInputs(Inputs):
    args = {
        'p': [val.InputRequired("Parameter 'p' (path) is required."), val.Length(min=1, max=200)],
        'slug': [val.Regexp(re.compile('^[0-9a-z-]{0,50}$'))],
    }


class DashboardInputs(Inputs):
    json = {
        'name': [val.InputRequired(), val.Length(min=1, max=200)],
        'slug': [val.Regexp(re.compile('^[0-9a-z-]{0,50}$'))],
    }


class DashboardSchemaInputs(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,  # do not allow fields which are not specified in schema
        'properties': {
            'name': {'type': 'string'},
            'slug': {'type': 'string'},
        },
        'required': ['name'],
    })]


class WidgetSchemaInputs(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,  # do not allow fields which are not specified in schema
        'properties': {
            'type': {'type': 'string'},
            'title': {'type': 'string'},
            'content': {'type': 'string'},
        },
        'required': ['type', 'title', 'content'],
    })]


class UserSchemaInputs(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,  # do not allow fields which are not specified in schema
        'properties': {
            'username': {'type': 'string'},
            'name': {'type': 'string'},
            'email': {'type': 'string'},
            'password': {'type': 'string'},
        },
        'required': ['username', 'name', 'email', 'password'],
    })]


class CredentialSchemaInputs(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,  # do not allow fields which are not specified in schema
        'properties': {
            'username': {'type': 'string'},
            'password': {'type': 'string'},
        },
        'required': ['username', 'password'],
    })]


class AccountSchemaInputs(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,  # do not allow fields which are not specified in schema
        'properties': {
            'name': {'type': 'string'},
        },
        'required': ['name'],
    })]


class PermissionSchemaInputs(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,
        'properties': {
            'user_id': {'type': ['integer', 'null']},
            'url_prefix': {'type': ['string', 'null']},
            'methods': {
                'type': ['array', 'null'],
                'items': {
                    'type': 'string',
                    'enum': ['GET', 'POST', 'PUT', 'DELETE'],
                },
                'uniqueItems': True,
                'minItems': 1,
            },
        },
        'required': ['user_id', 'url_prefix', 'methods'],
    })]


class BotSchemaInputs(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,  # do not allow fields which are not specified in schema
        'properties': {
            'name': {'type': 'string'},
        },
        'required': ['name'],
    })]

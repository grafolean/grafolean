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


class PersonSchemaInputsPOST(Inputs):
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

class PersonSchemaInputsPUT(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,  # do not allow fields which are not specified in schema
        'properties': {
            'username': {'type': 'string'},
            'name': {'type': 'string'},
            'email': {'type': 'string'},
        },
    })]


class PersonChangePasswordSchemaInputsPOST(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,
        'properties': {
            'old_password': {'type': 'string'},
            'new_password': {'type': 'string'},
        },
        'required': ['old_password', 'new_password'],
    })]


class PersonCredentialSchemaInputs(Inputs):
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
            'resource_prefix': {'type': ['string', 'null']},
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
        'required': ['resource_prefix', 'methods'],
    })]


class BotSchemaInputs(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,  # do not allow fields which are not specified in schema
        'properties': {
            'name': {'type': 'string'},
            'protocol': {'type': ['string', 'null']},
        },
        'required': ['name'],
    })]


class AccountBotSchemaInputs(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,
        'properties': {
            'name': {'type': 'string'},
            'protocol': {'type': ['string', 'null']},
            'config': {'type': ['string', 'null']},
        },
        'required': ['name'],
    })]


class EntitySchemaInputs(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,
        'properties': {
            'name': {'type': 'string'},
            'entity_type': {'type': 'string'},
            'details': {'type': 'object'},
            'protocols': {
                'type': 'object',
                'additionalProperties': {
                    # we don't define any properties (because keys are protocols and are not know in advance), but any
                    # protocol definition must conform to this sub-schema:
                    'type': 'object',
                    'properties': {
                        'credential': {'type': ['string', 'number']},
                        'sensors': {
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'properties': {
                                    'sensor': {'type': ['string', 'number']},
                                    'interval': {'type': ['number', 'null']},
                                },
                                'additionalProperties': False,
                            },
                        },
                    },
                    'additionalProperties': False,
                },
            },
        },
        'required': ['name', 'entity_type', 'details'],  # note that 'protocols' is not required
    })]


class CredentialSchemaInputs(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,
        'properties': {
            'name': {'type': 'string'},
            'protocol': {'type': 'string'},
            'details': {'type': 'object'},
        },
        'required': ['name', 'protocol', 'details'],
    })]


class SensorSchemaInputs(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,
        'properties': {
            'name': {'type': 'string'},
            'protocol': {'type': 'string'},
            'default_interval': {'type': ['number', 'null']},
            'details': {'type': 'object'},
        },
        'required': ['name', 'protocol', 'default_interval', 'details'],
    })]

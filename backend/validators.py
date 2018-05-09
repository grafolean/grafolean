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

class ChartSchemaInputs(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,  # do not allow fields which are not specified in schema
        'properties': {
            'name': {'type': 'string'},
            'content': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'additionalProperties': False,
                    'properties': {
                        'path_filter': {'type': 'string'},
                        'unit': {'type': 'string'},
                        'metric_prefix': {'type': 'string'},
                    },
                    'required': ['path_filter'],
                },
                'maxItems': 50,
            },
        },
        'required': ['name'],
    })]

import re
from flask_inputs import Inputs
from flask_inputs.validators import JsonSchema
import wtforms.validators as val


# custom validator:
def IsUTF8():
    def _isUTF8(form, field):
        try:
        #    if not Customer.query.get(field.data):
            return b"asdf".decode('utf-8')
        except UnicodeDecodeError:
            raise val.ValidationError('String is not valid UTF-8.')
    return _isUTF8


class ValuesInputs(Inputs):
    args = {
        'p': [val.InputRequired("Parameter 'p' is required."), val.Length(min=1, max=200), IsUTF8()],
        'slug': [val.Regexp(re.compile('^[0-9a-z-]{0,50}$'))],
    }

class DashboardInputs(Inputs):
    json = {
        'name': [val.InputRequired(), val.Length(min=1, max=200), IsUTF8()],
        'slug': [val.Regexp(re.compile('^[0-9a-z-]{0,50}$'))],
    }
class DashboardSchemaInputs(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,  # do not allow fields which are not specified in schema
        'properties': {
            'name': {'type': 'string'},
            'slug': {'type': 'string'},
        }
    })]

class ChartInputs(Inputs):
    json = {
        'name': [val.InputRequired(), val.Length(min=1, max=200), IsUTF8()],
    }
class ChartSchemaInputs(Inputs):
    json = [JsonSchema(schema={
        'type': 'object',
        'additionalProperties': False,  # do not allow fields which are not specified in schema
        'properties': {
            'name': {'type': 'string'},
        }
    })]

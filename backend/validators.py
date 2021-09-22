DashboardInputs = {
    'type': 'object',
    'properties': {
        'name': {'type': 'string', 'minLength': 1, 'maxLength': 200},
        'slug': {'type': 'string', 'pattern': '^[0-9a-z-]{0,50}$'},
    },
    'additionalProperties': False,
    'required': ['name'],
}


WidgetSchemaInputs = {
    'type': 'object',
    'properties': {
        'type': {'type': 'string'},
        'title': {'type': 'string'},
        'p': {'type': 'string', 'minLength': 1, 'maxLength': 20},
        'content': {'type': 'string'},
    },
    'additionalProperties': False,
    'required': ['type', 'title', 'content'],
}


WidgetsPositionsSchemaInputs = {
    'type': 'array',
    'items': {
        'type': 'object',
        'properties': {
            'widget_id': {'type': 'number'},
            'x': {'type': 'number'},
            'y': {'type': 'number'},
            'w': {'type': 'number'},
            'h': {'type': 'number'},
            'p': {'type': 'string', 'minLength': 1, 'maxLength': 20},
        },
        'additionalProperties': False,
        'required': ['widget_id', 'x', 'y', 'w', 'h'],
    },
}


PersonSchemaInputsPOST = {
    'type': 'object',
    'properties': {
        'username': {'type': 'string'},
        'password': {'type': 'string'},
        'name': {'type': 'string'},
        'email': {'type': 'string'},
        'timezone': {'type': ['string', 'null']},
    },
    'additionalProperties': False,
    'required': ['username', 'password', 'name', 'email'],
}


PersonSchemaInputsPUT = {
    'type': 'object',
    'additionalProperties': False,
    'properties': {
        'username': {'type': 'string'},
        'name': {'type': 'string'},
        'email': {'type': 'string'},
        'timezone': {'type': 'string'},
    },
}


PersonChangePasswordSchemaInputsPOST = {
    'type': 'object',
    'properties': {
        'old_password': {'type': 'string'},
        'new_password': {'type': 'string'},
    },
    'additionalProperties': False,
    'required': ['old_password', 'new_password'],
}


PersonCredentialSchemaInputs = {
    'type': 'object',
    'properties': {
        'username': {'type': 'string'},
        'password': {'type': 'string'},
    },
    'additionalProperties': False,
    'required': ['username', 'password'],
}


PersonSignupNewPOST = {
    'type': 'object',
    'properties': {
        'email': {'type': 'string'},
        'agree': {'type': 'boolean'},
    },
    'additionalProperties': False,
    'required': ['email', 'agree'],
}


PersonSignupValidatePinPOST = {
    'type': 'object',
    'properties': {
        'user_id': {'type': 'number'},
        'confirm_pin': {'type': 'string', 'minLength': 8, 'maxLength': 8},
    },
    'additionalProperties': False,
    'required': ['user_id', 'confirm_pin'],
}


PersonSignupCompletePOST = {
    'type': 'object',
    'properties': {
        'user_id': {'type': 'number'},
        'confirm_pin': {'type': 'string', 'minLength': 8, 'maxLength': 8},
        'password': {'type': 'string', 'minLength': 1},
    },
    'additionalProperties': False,
    'required': ['user_id', 'confirm_pin', 'password'],
}


ForgotPasswordPOST = {
    'type': 'object',
    'properties': {
        'email': {'type': 'string'},
    },
    'additionalProperties': False,
    'required': ['email'],
}


ForgotPasswordResetPOST = {
    'type': 'object',
    'properties': {
        'user_id': {'type': 'number'},
        'confirm_pin': {'type': 'string', 'minLength': 8, 'maxLength': 8},
        'password': {'type': 'string', 'minLength': 1},
    },
    'additionalProperties': False,
    'required': ['user_id', 'confirm_pin', 'password'],
}


AccountSchemaInputs = {
    'type': 'object',
    'properties': {
        'name': {'type': 'string'},
    },
    'additionalProperties': False,
    'required': ['name'],
}


PermissionSchemaInputs = {
    'type': 'object',
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
    'additionalProperties': False,
    'required': ['resource_prefix', 'methods'],
}


BotSchemaInputs = {
    'type': 'object',
    'properties': {
        'name': {'type': 'string'},
        'protocol': {'type': ['string', 'null']},
    },
    'additionalProperties': False,
    'required': ['name'],
}


AccountBotSchemaInputs = {
    'type': 'object',
    'properties': {
        'name': {'type': 'string'},
        'protocol': {'type': ['string', 'null']},
        'config': {'type': ['string', 'null']},
    },
    'additionalProperties': False,
    'required': ['name'],
}


EntitySchemaInputs = {
    'type': 'object',
    'properties': {
        'name': {'type': 'string'},
        'entity_type': {'type': 'string'},
        'parent': {'type': ['number', 'null']},
        'details': {'type': 'object'},
        'protocols': {
            'type': 'object',
            'additionalProperties': {
                # we don't define any properties (because keys are protocols and are not known in advance), but any
                # protocol definition must conform to this sub-schema:
                'type': 'object',
                'properties': {
                    'credential': {'type': ['string', 'number']},
                    'bot': {'type': ['string', 'number']},
                    'sensors': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'sensor': {'type': ['string', 'number']},
                                'interval': {'type': ['number', 'null']},
                            },
                            'additionalProperties': False,
                            'required': ['sensor'],
                        },
                    },
                },
                'additionalProperties': False,
                'required': ['credential', 'bot', 'sensors'],
            },
        },
    },
    'additionalProperties': False,
    'required': ['name', 'entity_type', 'details'],  # note that 'protocols' is not required
}


CredentialSchemaInputs = {
    'type': 'object',
    'properties': {
        'name': {'type': 'string'},
        'protocol': {'type': 'string'},
        'details': {'type': 'object'},
    },
    'additionalProperties': False,
    'required': ['name', 'protocol', 'details'],
}


SensorSchemaInputs = {
    'type': 'object',
    'properties': {
        'name': {'type': 'string'},
        'protocol': {'type': 'string'},
        'default_interval': {'type': ['number', 'null']},
        'details': {'type': 'object'},
    },
    'additionalProperties': False,
    'required': ['name', 'protocol', 'default_interval', 'details'],
}

PathSchemaInputs = {
    'type': 'object',
    'properties': {
        'path': {'type': 'string'},
    },
    'additionalProperties': False,
    'required': ['path'],
}

WidgetPluginManifestSchemaInputs = {
    'type': 'object',
    'properties': {
        'label': {'type': 'string', 'minLength': 1, 'maxLength': 200},
        'icon': {'type': 'string', 'pattern': '^[0-9a-z-]{0,50}$'},  # https://fontawesome.com/v4.7.0/icons/
        'is_header_widget': {'type': 'boolean'},
        'version': {'type': 'string'},  # not used, but allowed in manifest.json
        'repo': {'type': 'string'},  # not used, but allowed in manifest.json
    },
    'additionalProperties': False,
    'required': ['icon', 'label', 'is_header_widget'],
}
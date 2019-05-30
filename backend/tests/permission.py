#!/usr/bin/python3
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pytest

from datatypes import Permission

PERMISSION_ADMIN = {
    'resource_prefix': None,
    'methods': None,
}
PERMISSION_ACCOUNT_123 = {
    'resource_prefix': 'accounts/123',
    'methods': None,
}
PERMISSION_ACCOUNT_234_GET = {
    'resource_prefix': 'accounts/234',
    'methods': ['GET'],
}

@pytest.mark.parametrize("granting_user_permissions,requested_resource_prefix,requested_methods,expected", [
    # valid:
    ([PERMISSION_ADMIN], None, None, True),
    ([PERMISSION_ADMIN], 'accounts/123', None, True),
    ([PERMISSION_ADMIN], 'accounts/123', ['GET', 'POST'], True),
    ([PERMISSION_ACCOUNT_123], 'accounts/123', None, True),
    ([PERMISSION_ACCOUNT_123], 'accounts/123', ['GET'], True),
    ([PERMISSION_ACCOUNT_123], 'accounts/123', ['GET', 'POST'], True),
    ([PERMISSION_ACCOUNT_123], 'accounts/123/asdf', None, True),
    ([PERMISSION_ACCOUNT_123], 'accounts/123/asdf', ['GET'], True),
    ([PERMISSION_ACCOUNT_123, PERMISSION_ACCOUNT_234_GET], 'accounts/123/asdf', ['GET'], True),
    ([PERMISSION_ACCOUNT_123, PERMISSION_ACCOUNT_234_GET], 'accounts/234/asdf', ['GET'], True),
    # invalid:
    ([PERMISSION_ACCOUNT_123], 'accounts/234', ['GET'], False),
    ([PERMISSION_ACCOUNT_123], 'accounts/1234', ['GET'], False),
    ([PERMISSION_ACCOUNT_123], None, ['GET'], False),
    ([PERMISSION_ACCOUNT_123, PERMISSION_ACCOUNT_234_GET], 'accounts/234/asdf', None, False),
])
def test_Permission_can_grant_permission(granting_user_permissions, requested_resource_prefix, requested_methods, expected):
    assert expected == Permission.can_grant_permission(granting_user_permissions, requested_resource_prefix, requested_methods)


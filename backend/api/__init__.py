
def noauth(func):
    # This decorator puts a mark in *the route function* so that before_request can check for it, and decide not to
    # do authorization checks. It is a bit of a hack, but it works: https://stackoverflow.com/a/19575396/593487
    # The beauty of this approach is that every endpoint is defended *by default*.
    # WARNING: any further decorators must carry the attribute "_noauth" over to the wrapper.
    func._noauth = True
    return func


def auth_no_permissions(func):
    # Similar to noauth() decorator, except that it performs authentication, but doesn't deny access based on permissions.
    # This is useful for endpoint which should be accessible to all authenticated users (like /profile/*), but not to
    # unauthenticated.
    func._auth_no_permissions = True
    return func

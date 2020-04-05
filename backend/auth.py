import datetime
import jwt
from passlib.context import CryptContext
import secrets

import quart as flask

from utils import log, rowcount


class AuthFailedException(Exception):
    pass


class JWT(object):
    """
    Note:
     - private keys are auto-generated every hour (so install process doesn't need to care about that, and it is arguably safer)
     - instead of "refresh key" we have a short-term key that can be refreshed even 10 minutes after expiry
    Potential future improvement:
     - if multiple parties try to use the same key, this will invalidate the session (no refresh for that session will be possible anymore)
    JWT token schema:
     - session_id
     - exp
     - admin_id
    """
    DEFAULT_TOKEN_VALID_FOR = 600
    MAX_TOKEN_VALID_FOR = 24 * 3600
    TOKEN_CAN_BE_REFRESHED_FOR = 600 # when token expires, how long can it be refreshed for (/refresh/ endpoint)
    PRIVATE_KEY_EXTENDED_VALIDITY = MAX_TOKEN_VALID_FOR + TOKEN_CAN_BE_REFRESHED_FOR + 30  # accept expired keys for some extra time

    data = None
    decoded_with_leeway = False

    def __init__(self, data, decoded_with_leeway=False):
        self.data = data
        self.decoded_with_leeway = decoded_with_leeway

    @classmethod
    async def forge_from_authorization_header(cls, authorization_header, allow_leeway=0):
        if authorization_header is None:
            raise AuthFailedException("No Authorization header")

        if authorization_header[:7] != 'Bearer ':
            raise AuthFailedException("Invalid Authorization header")

        authorization_header = authorization_header[7:]
        if ':' not in authorization_header:
            log.info(authorization_header)
            raise AuthFailedException("Invalid Authorization header - missing key id")
        key_id, jwt_token = authorization_header.split(':', 1)
        key = await JWT._private_jwt_key_for_decoding(key_id)
        if key is None:
            raise AuthFailedException("Unknown or expired key (key id: {})".format(key_id))
        try:
            jwt_decoded = jwt.decode(jwt_token, key, algorithms='HS256')
            decoded_with_leeway = False
        except jwt.ExpiredSignatureError:
            if not allow_leeway:
                raise AuthFailedException("Signature expired")
            jwt_decoded = jwt.decode(jwt_token, key, algorithms='HS256', leeway=allow_leeway)
            decoded_with_leeway = True
        except Exception as ex:
            raise AuthFailedException("Error decoding JWT token") from ex

        return cls(jwt_decoded, decoded_with_leeway)

    async def encode_as_authorization_header(self, token_valid_for_s=None):
        key_id, key = await JWT._private_jwt_key_for_encoding()
        enriched_data = self.data.copy()
        if token_valid_for_s is None:
            token_valid_for_s = JWT.DEFAULT_TOKEN_VALID_FOR
        elif token_valid_for_s > JWT.MAX_TOKEN_VALID_FOR:
            raise AuthFailedException(f"Can't issue tokens with validity > {JWT.MAX_TOKEN_VALID_FOR} seconds")
        enriched_data['exp'] = datetime.datetime.utcnow() + datetime.timedelta(seconds=token_valid_for_s)
        # careful: jwt.encode() changes 'enriched_data' in-place (converts field 'exp' from datetime to UNIX timestamp)
        jwt_encoded = jwt.encode(enriched_data, key, algorithm='HS256')
        header = 'Bearer {}:{}'.format(key_id, jwt_encoded.decode("utf-8"))
        return header, enriched_data['exp']

    @classmethod
    async def _private_jwt_key_for_decoding(cls, key_id):
        async with flask.current_app.pool.acquire() as c:
            res = await c.fetchrow('SELECT key FROM private_jwt_keys WHERE id=$1 AND EXTRACT(EPOCH FROM NOW()) < use_until + {};'.format(JWT.PRIVATE_KEY_EXTENDED_VALIDITY,), int(key_id))
            if not res:
                return None
            key = res[0]
            return key

    @classmethod
    async def _private_jwt_key_for_encoding(cls):
        async with flask.current_app.pool.acquire() as c:
            # fetch the newest private key that is still valid:
            res = await c.fetchrow('SELECT id, key FROM private_jwt_keys WHERE EXTRACT(EPOCH FROM NOW()) < use_until ORDER BY use_until DESC LIMIT 1;')
            if not res:
                await cls._remove_old_jwt_keys()
                new_key = secrets.token_hex(512 // 8)  # 512 bits
                res = await c.fetchrow('INSERT INTO private_jwt_keys (key) VALUES ($1) RETURNING id, key;', new_key)
            key_id, key = res
            return key_id, key

    @classmethod
    async def _remove_old_jwt_keys(cls):
        async with flask.current_app.pool.acquire() as c:
            await c.execute('DELETE FROM private_jwt_keys WHERE use_until + {} < EXTRACT(EPOCH FROM NOW());'.format(JWT.PRIVATE_KEY_EXTENDED_VALIDITY,))


class Auth(object):
    pwd_context = CryptContext(schemes=["bcrypt"])

    @classmethod
    def password_hash(cls, password):
        return cls.pwd_context.hash(password)

    @classmethod
    def is_password_valid(cls, password, password_hash):
        return bool(cls.pwd_context.verify(password, password_hash))

    @classmethod
    async def first_user_exists(cls):
        async with flask.current_app.pool.acquire() as c:
            try:
                # make sure that no account or user exists:
                for table in ['accounts', 'users']:
                    res = await c.fetchrow('SELECT COUNT(*) FROM {};'.format(table))
                    if not res:
                        raise Exception("Could not check {} table".format(table,))
                    records_count = res[0]
                    if records_count > 0:
                        raise Exception("Record already exists in {}".format(table,))
                return False
            except:
                return True


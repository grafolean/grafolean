import datetime
import jwt
from passlib.context import CryptContext
import secrets

from utils import db, log


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
    TOKEN_VALID_FOR = 600
    TOKEN_CAN_BE_REFRESHED_FOR = 600
    PRIVATE_KEY_EXTENDED_VALIDITY = TOKEN_VALID_FOR + TOKEN_CAN_BE_REFRESHED_FOR + 30  # accept expired keys for some extra time

    data = None
    decoded_with_leeway = False

    def __init__(self, data, decoded_with_leeway=False):
        self.data = data
        self.decoded_with_leeway = decoded_with_leeway

    @classmethod
    def forge_from_authorization_header(cls, authorization_header, allow_leeway=0):
        if authorization_header is None:
            raise AuthFailedException("No Authorization header")

        if authorization_header[:7] != 'Bearer ':
            raise AuthFailedException("Invalid Authorization header")

        authorization_header = authorization_header[7:]
        if ':' not in authorization_header:
            log.info(authorization_header)
            raise AuthFailedException("Invalid Authorization header - missing key id")
        key_id, jwt_token = authorization_header.split(':', 1)
        key = JWT._private_jwt_key_for_decoding(key_id)
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

    def encode_as_authorization_header(self):
        key_id, key = JWT._private_jwt_key_for_encoding()
        enriched_data = self.data.copy()
        enriched_data['exp'] = datetime.datetime.utcnow() + datetime.timedelta(seconds=JWT.TOKEN_VALID_FOR)
        jwt_encoded = jwt.encode(enriched_data, key, algorithm='HS256')
        header = 'Bearer {}:{}'.format(key_id, jwt_encoded.decode("utf-8"))
        return header, enriched_data['exp']

    @classmethod
    def _private_jwt_key_for_decoding(cls, key_id):
        with db.cursor() as c:
            c.execute('SELECT key FROM private_jwt_keys WHERE id=%s AND EXTRACT(EPOCH FROM NOW()) < use_until + {};'.format(JWT.PRIVATE_KEY_EXTENDED_VALIDITY,), (key_id,))
            res = c.fetchone()
            if not res:
                return None
            key = res[0]
            return key

    @classmethod
    def _private_jwt_key_for_encoding(cls):
        with db.cursor() as c:
            # fetch the newest private key that is still valid:
            c.execute('SELECT id, key FROM private_jwt_keys WHERE EXTRACT(EPOCH FROM NOW()) < use_until ORDER BY use_until DESC LIMIT 1;')
            res = c.fetchone()
            if not res:
                cls._remove_old_jwt_keys()
                new_key = secrets.token_hex(512 // 8)  # 512 bits
                c.execute('INSERT INTO private_jwt_keys (key) VALUES (%s) RETURNING id, key;', (new_key,))
                res = c.fetchone()
            key_id, key = res
            return key_id, key

    @classmethod
    def _remove_old_jwt_keys(cls):
        with db.cursor() as c:
            c.execute('DELETE FROM private_jwt_keys WHERE use_until + {} < EXTRACT(EPOCH FROM NOW());'.format(JWT.PRIVATE_KEY_EXTENDED_VALIDITY,))


class Auth(object):
    pwd_context = CryptContext(schemes=["bcrypt"])

    @classmethod
    def password_hash(cls, password):
        return cls.pwd_context.hash(password)

    @classmethod
    def is_password_valid(cls, password, password_hash):
        return bool(cls.pwd_context.verify(password, password_hash))

    @classmethod
    def first_user_exists(cls):
        with db.cursor() as c:
            try:
                # make sure that no account or user exists:
                for table in ['accounts', 'users']:
                    c.execute('SELECT COUNT(*) FROM {};'.format(table))
                    res = c.fetchone()
                    if not res:
                        raise Exception("Could not check {} table".format(table,))
                    records_count = res[0]
                    if records_count > 0:
                        raise Exception("Record already exists in {}".format(table,))
                return False
            except:
                return True


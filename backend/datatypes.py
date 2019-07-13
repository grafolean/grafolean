import calendar
from collections import defaultdict
import dns
from functools import lru_cache
import math
import psycopg2.extras
import re
from slugify import slugify

from utils import db, log, ADMIN_ACCOUNT_ID
from validators import DashboardInputs, DashboardSchemaInputs, WidgetSchemaInputs, PersonSchemaInputsPOST, PersonSchemaInputsPUT, PersonCredentialSchemaInputs, AccountSchemaInputs, PermissionSchemaInputs, AccountBotSchemaInputs, BotSchemaInputs, ValuesInputs
from auth import Auth


# Lru_cache is currently disabled so that we can avoid strange caching issues when developing. We might enable it later though.
def clear_all_lru_cache():
    # when testing, it is important to clear memoization cache in between runs, or the results will be... interesting.
    # Dashboard.get_id.cache_clear()
    # Path._get_path_id_from_db.cache_clear()
    # PathFilter._find_matching_paths_for_filter.cache_clear()
    pass


class ValidationError(Exception):
    pass


class AccessDeniedError(Exception):
    pass


class _RegexValidatedInputValue(object):
    """ Helper parent class; allows easy creation of classes which validate their input with a regular expression. """
    _regex = None

    def __init__(self, v):
        if not self.is_valid(str(v)):
            raise ValidationError("Invalid {} format: {}".format(self.__class__.__name__, v))
        self.v = v

    @classmethod
    def is_valid(cls, v):
        return bool(cls._regex.match(v))

    def __str__(self):
        return str(self.v)

class Path(_RegexValidatedInputValue):
    _regex = re.compile(r'^([a-zA-Z0-9_-]+)([.][a-zA-Z0-9_-]+)*$')

    def __init__(self, account_id, v, ensure_in_db=False):
        super().__init__(v)
        if ensure_in_db:
            self.path_id = Path._get_path_id_from_db(account_id, path=self.v)

    @staticmethod
    # @lru_cache(maxsize=256)
    def _get_path_id_from_db(account_id, path):
        with db.cursor() as c:
            path_cleaned = path.strip()
            c.execute('SELECT id FROM paths WHERE account = %s AND path=%s;', (account_id, path_cleaned,))
            res = c.fetchone()
            if not res:
                c.execute('INSERT INTO paths (account, path) VALUES (%s, %s) RETURNING id;', (account_id, path_cleaned,))
                res = c.fetchone()
            path_id = res[0]
            return path_id

    # this can probably be removed:
    # @staticmethod
    # def get_all_paths():
    #     with db.cursor() as c:
    #         c.execute('SELECT path FROM paths ORDER BY path;')
    #         for path, in c.fetchall():
    #             yield(path)

    @classmethod
    def delete(cls, account_id, path):
        with db.cursor() as c:
            # delete just the path, "ON DELETE CASCADE" takes care of removing values and aggregations:
            c.execute('DELETE FROM paths WHERE account = %s AND path = %s;', (account_id, str(path),))
            return c.rowcount


class PathFilter(_RegexValidatedInputValue):
    _regex = re.compile(r'^([a-zA-Z0-9_-]+|[*?])([.]([a-zA-Z0-9_-]+|[*?]))*$')

    @staticmethod
    def find_matching_paths(account_id, path_filters, limit=200, allow_trailing_chars=False):
        all_found_paths = set()
        was_limit_reached = False
        for pf in path_filters:
            found_paths, was_limit_reached = PathFilter._find_matching_paths_for_filter(account_id, pf, limit, allow_trailing_chars)  # we could ask for `limit - len(found)` - but then lru_cache wouldn't make sense
            all_found_paths |= found_paths
            if was_limit_reached or len(all_found_paths) > limit:
                # always return only up to a limit elements:
                return list(all_found_paths)[:limit], True

        return list(all_found_paths), False

    @staticmethod
    # @lru_cache(maxsize=1024)
    def _find_matching_paths_for_filter(account_id, path_filter, total_limit, allow_trailing_chars=False):
        found_paths = set()
        pf_regex = PathFilter._regex_from_filter(path_filter, allow_trailing_chars)
        with db.cursor() as c:
            c.execute('SELECT path FROM paths WHERE account = %s AND path ~ %s ORDER BY path LIMIT %s;', (account_id, pf_regex, total_limit + 1,))
            for res in c.fetchall():
                if len(found_paths) >= total_limit:  # we have found one element over the limit - we don't add it, but we know it exists
                    return found_paths, True
                found_paths.add(res[0])
        return found_paths, False

    @staticmethod
    def _regex_from_filter(path_filter_str, allow_trailing_chars=False):
        """ Prepares regex for asking Postgres from supplied path filter string. """
        # - replace all "." with "[.]"
        # - replace all "*" with ".*"
        # - replace all "?" with "[^.]+"
        # - add ^ and $
        path_filter_str = path_filter_str.replace(".", "[.]")
        path_filter_str = path_filter_str.replace("*", "[^.]+([.][^.]+)*")
        path_filter_str = path_filter_str.replace("?", "[^.]+")
        if allow_trailing_chars:
            path_filter_str += '.*'
        path_filter_str = "^{}$".format(path_filter_str)
        return path_filter_str


# when user is entering a path filter, it is not finished yet - but we must validate it to display the matches:
class UnfinishedPathFilter(PathFilter):
    _regex = re.compile(r'^(([a-zA-Z0-9_-]+|[*?])[.])*([a-zA-Z0-9_-]*|[*?])$')


class Timestamp(_RegexValidatedInputValue):
    _regex = re.compile(r'^[1-9][0-9]{1,9}([.][0-9]{1,6})?$')

    def __init__(self, v):
        # allow initialization with numeric types:
        if isinstance(v, (float, int,)):
            self.v = v
        else:
            super().__init__(v)

    def __float__(self):
        return float(self.v)

    def __int__(self):
        return int(self.v)


class MeasuredValue(object):
    def __init__(self, v):
        if not self.is_valid(v):
            raise ValidationError("Invalid {} format: {}".format(self.__class__.__name__, v))
        self.v = v

    @classmethod
    def is_valid(cls, v):
        try:
            float(v)
            return True
        except:
            return False

    def __str__(self):
        return str(self.v)


class BotToken(_RegexValidatedInputValue):
    _regex = re.compile(r'^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$')


class EmailAddress(object):
    def __init__(self, v):
        if not self.is_valid(str(v)):
            raise ValidationError("Invalid email format: {}".format(str(v)))
        self.v = str(v)

    @classmethod
    def is_valid(cls, v):
        if '@' not in v:
            return False
        domain = v.rsplit('@', 1)[-1]
        try:
            dns_records = dns.resolver.query(domain, 'MX')
            return len(dns_records) > 0
        except:
            return False

    def __str__(self):
        return self.v


class Aggregation(object):
    FACTOR = 3
    MAX_AGGR_LEVEL = 6  # 6 == one point per month

    def __init__(self, level=0):
        self.level = level
        self._interval_size = 3600 * (self.FACTOR ** self.level)
        self._dirty_intervals = defaultdict(set)
        if Aggregation.MAX_AGGR_LEVEL > level:
            self._parent_aggr = Aggregation(level + 1)
        else:
            self._parent_aggr = None

    def mark_timestamp_as_dirty(self, path_id, ts):
        self._dirty_intervals[path_id].add(math.floor(float(ts)) // self._interval_size)

    def fix_aggregations(self):
        try:
            with db.cursor() as c:
                for p_id in self._dirty_intervals:
                    for h in self._dirty_intervals[p_id]:
                        tsh = h * self._interval_size
                        tsh_med = tsh + self._interval_size / 2
                        if self.level == 0:
                            c.execute("""
                                INSERT INTO
                                    aggregations (path, level, tsmed, vmin, vmax, vavg)
                                    SELECT %s, %s, %s, MIN(value), MAX(value), AVG(value) FROM measurements WHERE path = %s AND ts >= %s AND ts < %s
                                ON CONFLICT (path, level, tsmed) DO UPDATE SET
                                    vmin=excluded.vmin, vmax=excluded.vmax, vavg=excluded.vavg""",
                                (p_id, self.level, tsh + 1800, p_id, tsh, tsh + 3600,))
                        else:
                            c.execute("""
                                INSERT INTO
                                    aggregations (path, level, tsmed, vmin, vmax, vavg)
                                    SELECT %s, %s, %s, MIN(vmin), MAX(vmax), AVG(vavg) FROM aggregations WHERE path = %s AND level = %s AND tsmed >= %s AND tsmed < %s
                                ON CONFLICT (path, level, tsmed) DO UPDATE SET
                                    vmin=excluded.vmin, vmax=excluded.vmax, vavg=excluded.vavg""",
                                (p_id, self.level, tsh_med, p_id, self.level - 1, tsh, tsh + self._interval_size,))
                        if self._parent_aggr:
                            self._parent_aggr.mark_timestamp_as_dirty(p_id, tsh_med)
        finally:
            if self._parent_aggr:
                self._parent_aggr.fix_aggregations()

    @classmethod
    def times_aligned_to_aggr(cls, times, aggr_level):
        if not aggr_level:
            return True
        interval_size = 3600 * (cls.FACTOR ** aggr_level)
        for t in times:
            if int(t) % interval_size != 0:
                return False
        return True


class Measurement(object):

    MAX_DATAPOINTS_RETURNED = 100000

    def __init__(self, account_id, path, ts, value):
        self.path = Path(account_id, path)
        self.ts = Timestamp(ts)
        self.value = MeasuredValue(value)

    @classmethod
    def save_values_data_to_db(cls, account_id, put_data, update_on_conflict=True):

        aggr = Aggregation()
        try:
            # to use execute_values, we need an iterator which will feed our data:
            def _get_data(put_data, aggr):
                for x in put_data:
                    ts_str = str(Timestamp(x['t']))
                    path = Path(account_id, x['p'], ensure_in_db=True)
                    # while we are traversing our data, we might as well mark the dirty aggregation blocks:
                    aggr.mark_timestamp_as_dirty(path.path_id, ts_str)
                    yield (path.path_id, ts_str, str(MeasuredValue(x['v'])),)
            data_iterator = _get_data(put_data, aggr)

            with db.cursor() as c:
                # https://stackoverflow.com/a/34529505/593487
                if update_on_conflict:
                    psycopg2.extras.execute_values(c, "INSERT INTO measurements (path, ts, value) VALUES %s ON CONFLICT (path, ts) DO UPDATE SET value=excluded.value", data_iterator, "(%s, %s, %s)", page_size=100)
                else:
                    psycopg2.extras.execute_values(c, "INSERT INTO measurements (path, ts, value) VALUES %s", data_iterator, "(%s, %s, %s)", page_size=100)
        finally:
            aggr.fix_aggregations()

    @classmethod
    def get_suggested_aggr_level(cls, t_from, t_to, max_points=100):
        aggr_level = cls._get_aggr_level(max_points, math.ceil((float(t_to) - float(t_from))/3600.0))
        if aggr_level < 0:
            return None
        else:
            return aggr_level

    @classmethod
    def _get_aggr_level(cls, max_points, n_hours):
        for l in range(-1, Aggregation.MAX_AGGR_LEVEL):
            if max_points >= n_hours / (3**l):
                return l
        return Aggregation.MAX_AGGR_LEVEL

    @classmethod
    def fetch_data(cls, account_id, paths, aggr_level, t_froms, t_to, should_sort_asc, max_records):
        # t_froms: an array of t_from, one for each path (because the subsequent fetchings usually request a different t_from for each path)
        paths_data = {}
        sort_order = 'ASC' if should_sort_asc else 'DESC'  # PgSQL doesn't allow sort order to be parametrized
        with db.cursor() as c:
            for p, t_from in zip(paths, t_froms):
                str_p = str(p)
                path_data = []
                path_id = Path._get_path_id_from_db(account_id, str_p)

                # trick: fetch one result more than is allowed (by MAX_DATAPOINTS_RETURNED) so that we know that the result set is not complete and where the client should continue from
                if aggr_level is None:  # fetch raw data
                    c.execute('SELECT ts, value FROM measurements WHERE path = %s AND ts >= %s AND ts < %s ORDER BY ts ' + sort_order + ' LIMIT %s;', (path_id, float(t_from), float(t_to), max_records + 1,))
                    for ts, value in c.fetchall():
                        path_data.append({'t': float(ts), 'v': float(value)})
                else:  # fetch aggregated data
                    c.execute('SELECT tsmed, vavg, vmin, vmax FROM aggregations WHERE path = %s AND level = %s AND tsmed >= %s AND tsmed < %s ORDER BY tsmed ' + sort_order + ' LIMIT %s;', (path_id, aggr_level, float(t_from), float(t_to), max_records + 1,))
                    for ts, vavg, vmin, vmax in c.fetchall():
                        path_data.append({'t': float(ts), 'v': float(vavg), 'minv': float(vmin), 'maxv': float(vmax)})

                # if we have one result too many, eliminate it and set "next_data_point" field:
                if len(path_data) > max_records:
                    paths_data[str_p] = {
                        'next_data_point': path_data[max_records]['t'],
                        'data': path_data[:max_records],
                    }
                else:
                    paths_data[str_p] = {
                        'next_data_point': None,
                        'data': path_data,
                    }

        return paths_data

    @classmethod
    def get_oldest_measurement_time(cls, account_id, paths):
        path_ids = tuple(Path._get_path_id_from_db(account_id, str(p)) for p in paths)
        with db.cursor() as c:
            c.execute('SELECT MIN(ts) FROM measurements WHERE path IN %s;', (path_ids,))
            res = c.fetchone()
            if not res:
                return None
            return res[0]

    def save(self):
        with db.cursor() as c:
            c.execute('INSERT INTO measurements (path, ts, value) VALUES (%s, %s, %s);', (str(self.path), str(self.ts), str(self.value)))


class Widget(object):

    def __init__(self, dashboard_id, widget_type, title, content, widget_id):
        self.dashboard_id = dashboard_id
        self.widget_type = widget_type
        self.title = title
        self.content = content
        self.widget_id = widget_id

    @classmethod
    def forge_from_input(cls, account_id, dashboard_slug, flask_request, widget_id=None):
        inputs = WidgetSchemaInputs(flask_request)
        if not inputs.validate():
            raise ValidationError(inputs.errors[0])

        data = flask_request.get_json()

        widget_type = data['type']
        title = data['title']
        content = data['content']
        # users reference the dashboards by its slug, but we need to know its ID:
        dashboard_id = Dashboard.get_id(account_id, dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        if widget_id is not None and not Widget._check_exists(widget_id):
            raise ValidationError("Unknown widget id")

        return cls(dashboard_id, widget_type, title, content, widget_id)

    @staticmethod
    def _check_exists(widget_id):
        with db.cursor() as c:
            c.execute('SELECT id FROM widgets WHERE id = %s;', (widget_id,))
            res = c.fetchone()
            if res:
                return True
            return False

    def insert(self):
        with db.cursor() as c:
            c.execute("INSERT INTO widgets (dashboard, type, title, content) VALUES (%s, %s, %s, %s) RETURNING id;", (self.dashboard_id, self.widget_type, self.title, self.content,))
            widget_id = c.fetchone()[0]
            return widget_id

    def update(self):
        with db.cursor() as c:
            c.execute("UPDATE widgets SET type = %s, title = %s, content = %s  WHERE id = %s and dashboard = %s;", (self.widget_type, self.title, self.content, self.widget_id, self.dashboard_id,))
            rowcount = c.rowcount
            if not rowcount:
                return 0
            return rowcount

    @staticmethod
    def delete(account_id, dashboard_slug, widget_id):
        dashboard_id = Dashboard.get_id(account_id, dashboard_slug)
        with db.cursor() as c:
            c.execute("DELETE FROM widgets WHERE id = %s and dashboard = %s;", (widget_id, dashboard_id,))
            return c.rowcount

    @staticmethod
    def get_list(account_id, dashboard_slug, paths_limit=200):
        dashboard_id = Dashboard.get_id(account_id, dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        with db.cursor() as c, db.cursor() as c2:
            c.execute('SELECT id, type, title, content FROM widgets WHERE dashboard = %s ORDER BY id;', (dashboard_id,))
            ret = []
            for widget_id, widget_type, title, content in c.fetchall():
                # c2.execute('SELECT path_filter, renaming, unit, metric_prefix FROM charts_content WHERE chart = %s ORDER BY id;', (widget_id,))
                # content = []
                # for path_filter, renaming, unit, metric_prefix in c2:
                #     paths, paths_limit_reached = PathFilter.find_matching_paths([path_filter], limit=paths_limit)
                #     content.append({
                #         'path_filter': path_filter,
                #         'renaming': renaming,
                #         'unit': unit,
                #         'metric_prefix': metric_prefix,
                #         'paths': paths,
                #         'paths_limit_reached': paths_limit_reached,
                #     })
                ret.append({
                    'id': widget_id,
                    'type': widget_type,
                    'title': title,
                    'content': content,
                })
            return ret

    @staticmethod
    def get(account_id, dashboard_slug, widget_id, paths_limit=200):
        dashboard_id = Dashboard.get_id(account_id, dashboard_slug)
        if not dashboard_id:
            raise ValidationError("Unknown dashboard")

        with db.cursor() as c:  #, db.cursor() as c2:
            c.execute('SELECT type, title, content FROM widgets WHERE id = %s and dashboard = %s;', (widget_id, dashboard_id,))
            res = c.fetchone()
            if not res:
                return None

            # c2.execute('SELECT path_filter, renaming, unit, metric_prefix FROM charts_content WHERE chart = %s ORDER BY id;', (widget_id,))
            # content = []
            # for path_filter, renaming, unit, metric_prefix in c2:
            #     paths, paths_limit_reached = PathFilter.find_matching_paths([path_filter], limit=paths_limit)
            #     content.append({
            #         'path_filter': path_filter,
            #         'renaming': renaming,
            #         'unit': unit,
            #         'metric_prefix': metric_prefix,
            #         'paths': paths,
            #         'paths_limit_reached': paths_limit_reached,
            #     })
            return {
                'id': widget_id,
                'type': res[0],
                'title': res[1],
                'content': res[2],
            }


class Dashboard(object):

    def __init__(self, account_id, name, slug):
        self.account_id = account_id
        self.name = name
        self.slug = slug

    @classmethod
    def forge_from_input(cls, account_id, flask_request, force_slug=None):
        """ This function validates input and returns an object which can be used for inserting or updating. """
        for inputs in [DashboardSchemaInputs(flask_request), DashboardInputs(flask_request)]:
            if not inputs.validate():
                raise ValidationError(inputs.errors[0])

        data = flask_request.get_json()
        name = data['name']
        slug = data.get('slug')
        if force_slug:  # when updating existing record, we want to supply slug through query parameters, not through JSON
            if slug:
                raise ValidationError("Field 'slug' shouldn't be specified in JSON body")
            slug = force_slug
        else:
            if not slug:
                slug = cls._suggest_new_slug(account_id, name)
        return cls(account_id, name, slug)

    @classmethod
    def _suggest_new_slug(cls, account_id, name):
        # Find a suitable slug from name, appending numbers for as long as it takes to find a non-existing slug.
        # This is probably not 100% race-condition safe, but it doesn't matter - unique contraint is on DB level,
        # and this is just a nicety from us.
        postfix_nr = 1
        while True:
            slug = slugify(name[:40]) + ('' if postfix_nr == 1 else '-{}'.format(postfix_nr))
            if Dashboard.get_id(account_id, slug) is None:
                return slug  # we have found a slug which doesn't exist yet, use it
            postfix_nr += 1

    def insert(self):
        with db.cursor() as c:
            c.execute("INSERT INTO dashboards (name, account, slug) VALUES (%s, %s, %s);", (self.name, self.account_id, self.slug,))
            # we must invalidate get_id()'s lru_cache, otherwise it will keep returning None instead of new ID:
            # Dashboard.get_id.cache_clear()

    def update(self):
        with db.cursor() as c:
            c.execute("UPDATE dashboards SET name = %s WHERE account = %s AND slug = %s;", (self.name, self.account_id, self.slug,))
            return c.rowcount

    @staticmethod
    def delete(account_id, slug):
        with db.cursor() as c:
            c.execute("DELETE FROM dashboards WHERE account = %s AND slug = %s;", (account_id, slug,))
            # we must invalidate get_id()'s lru_cache, otherwise it will keep returning the old ID instead of None:
            # Dashboard.get_id.cache_clear()
            return c.rowcount

    @staticmethod
    def get_list(account_id):
        with db.cursor() as c:
            ret = []
            c.execute('SELECT name, slug FROM dashboards WHERE account = %s ORDER BY name;', (account_id,))
            for name, slug in c.fetchall():
                ret.append({'name': name, 'slug': slug})
            return ret

    @staticmethod
    def get(account_id, slug):
        with db.cursor() as c:
            c.execute('SELECT name FROM dashboards WHERE account = %s AND slug = %s;', (account_id, slug,))
            res = c.fetchone()
            if not res:
                return None
            name = res[0]

        widgets = Widget.get_list(account_id, slug)
        return {
            'name': name,
            'slug': slug,
            'widgets': widgets,
        }

    @staticmethod
    # @lru_cache(maxsize=256)
    def get_id(account_id, slug):
        """ This is a *cached* function which returns ID based on dashboard slug. Make sure
            to invalidate lru_cache whenever one of the existing slug <-> ID relationships
            changes in any way (delete, insert). """
        with db.cursor() as c:
            c.execute('SELECT id FROM dashboards WHERE account = %s AND slug = %s;', (account_id, slug,))
            res = c.fetchone()
            if not res:
                return None
            return res[0]


class Account(object):
    RESOURCE_ACCOUNTS_REGEX = re.compile('^accounts/([0-9]+)([/].*)?$')

    def __init__(self, name, force_id=None):
        self.name = name
        self.force_id = force_id

    @classmethod
    def forge_from_input(cls, flask_request, force_id=None):
        inputs = AccountSchemaInputs(flask_request)
        if not inputs.validate():
            raise ValidationError(inputs.errors[0])
        data = flask_request.get_json()

        name = data['name']
        return cls(name, force_id)

    def insert(self):
        with db.cursor() as c:
            c.execute("INSERT INTO accounts (name) VALUES (%s) RETURNING id;", (self.name,))
            account_id = c.fetchone()[0]
            return account_id

    def update(self):
        if self.force_id is None:
            return 0
        with db.cursor() as c:
            c.execute("UPDATE accounts SET name = %s WHERE id = %s;", (self.name, self.force_id,))
            return c.rowcount

    @staticmethod
    def get_list(user_id=None):
        with db.cursor() as c:
            ret = []
            if user_id is None:
                c.execute('SELECT id, name FROM accounts ORDER BY name;')
            else:
                # get the list of accounts that this user has the permission to access: (GET)
                # - get user's permissions, then:
                #   - find a permission that grants access to all accounts, or
                #   - find specific accounts that users has GET permission for
                can_access_all_accounts = False
                specific_accounts = []
                for permission in Permission.get_list(user_id):
                    # we are only interested in GET methods: (or None)
                    if permission['resource_prefix'] is None or permission['resource_prefix'] == 'accounts':
                        can_access_all_accounts = True
                        break
                    m = Account.RESOURCE_ACCOUNTS_REGEX.match(permission['resource_prefix'])
                    if m:
                        specific_accounts.append(int(m.group(1)))

                if can_access_all_accounts:
                    c.execute('SELECT id, name FROM accounts ORDER BY name;')
                elif specific_accounts:
                    c.execute('SELECT id, name FROM accounts WHERE id IN %s ORDER BY name;', (tuple(specific_accounts),))
                else:
                    c = []

            for account_id, name in c:
                ret.append({'id': account_id, 'name': name})
            return ret

    @staticmethod
    def get(account_id):
        with db.cursor() as c:
            c.execute('SELECT name FROM accounts WHERE id = %s;', (account_id,))
            res = c.fetchone()
            if not res:
                return None
            name = res[0]
            return {
                'id': account_id,
                'name': name,
            }


class Permission(object):
    def __init__(self, user_id, resource_prefix, methods):
        self.user_id = user_id
        # resource_prefix always implicitly ends with a slash, so let's make sure it is always in the same format here:
        self.resource_prefix = None if resource_prefix is None else resource_prefix.rstrip('/')
        self.methods = methods

    @classmethod
    def forge_from_input(cls, flask_request, user_id):
        inputs = PermissionSchemaInputs(flask_request)
        if not inputs.validate():
            raise ValidationError(inputs.errors[0])
        data = flask_request.get_json()
        return cls(user_id, data['resource_prefix'], data['methods'])

    @staticmethod
    def get_list(user_id):
        with db.cursor() as c:
            ret = []
            c.execute('SELECT id, user_id, resource_prefix, methods FROM permissions WHERE user_id = %s ORDER BY resource_prefix, id;', (user_id,))
            for permission_id, user_id, resource_prefix, methods in c:
                methods_as_list = None if not methods else [m.strip('{ }') for m in methods.split(',')]  # not sure why, but we get what we inserted (string instead of a list)... this is workaround
                ret.append({'id': permission_id, 'resource_prefix': resource_prefix, 'methods': methods_as_list})
            return ret

    def insert(self, granting_user_id, skip_checks=False):
        if not skip_checks:
            # make sure user is not granting permissions to themselves:
            if int(granting_user_id) == int(self.user_id):
                raise AccessDeniedError("Can't grant permissions to yourself")
            # make sure that authenticated user's permissions are a superset of the ones that they wish to grant:
            granting_user_permissions = Permission.get_list(granting_user_id)
            if not Permission.can_grant_permission(granting_user_permissions, self.resource_prefix, self.methods):
                raise AccessDeniedError("Can't grant permission you don't have")

        with db.cursor() as c:
            methods_array = None if self.methods is None else '{' + ",".join(self.methods) + '}'  # passing the list directly results in integrity error, this is another way - https://stackoverflow.com/a/15073439/593487
            c.execute("INSERT INTO permissions (user_id, resource_prefix, methods) VALUES (%s, %s, %s) RETURNING id;", (self.user_id, self.resource_prefix, methods_array,))
            account_id = c.fetchone()[0]
            return account_id

    @staticmethod
    def is_access_allowed(user_id, resource, method):
        if method == 'HEAD':
            method = 'GET'  # access for HEAD is the same as for GET
        with db.cursor() as c:
            # with resource_prefix, make sure that it either matches the urls exactly, or that the url continues with '/' + anything (not just anything)
            c.execute('SELECT id FROM permissions WHERE ' + \
                '(user_id = %s) AND ' + \
                "(resource_prefix IS NULL OR resource_prefix = %s OR %s LIKE resource_prefix || '/%%') AND " + \
                '(methods IS NULL OR %s = ANY(methods));',
                (user_id, resource, resource, method,))
            res = c.fetchone()
            if res:
                return True
            else:
                return False

    @staticmethod
    def delete(permission_id, user_id, granting_user_id):
        # make sure user is not removing their own permission:
        if int(granting_user_id) == int(user_id):
            raise AccessDeniedError("Can't grant permissions to yourself")
        with db.cursor() as c:
            c.execute('DELETE FROM permissions WHERE id = %s AND user_id = %s;', (permission_id, user_id,))
            return c.rowcount


    @staticmethod
    def can_grant_permission(granting_user_permissions, requested_resource_prefix, requested_methods):
        # User can grant a permission if he has a (single!) permission which includes the desired permission

        def is_resource_prefix_subset_of(subset_resource_prefix, superset_resource_prefix):
            if superset_resource_prefix is None:
                return True
            if subset_resource_prefix is None:  # we can't grant access to every resource if we don't have it
                return False
            if superset_resource_prefix == subset_resource_prefix:
                return True
            if subset_resource_prefix.startswith(superset_resource_prefix + '/'):
                return True
            return False

        def are_methods_subset_of(subset_methods, superset_methods):
            if superset_methods is None:
                return True
            if subset_methods is None:  # we can't grant access for every method if we don't have it
                return False
            if set(superset_methods).issuperset(set(subset_methods)):
                return True
            return False

        for granting_permission in granting_user_permissions:
            if is_resource_prefix_subset_of(requested_resource_prefix, granting_permission['resource_prefix']) and \
                are_methods_subset_of(requested_methods, granting_permission['methods']):
                return True

        return False


class Bot(object):
    def __init__(self, name, bot_type, config, force_account=None, force_id=None):
        self.name = name
        self.bot_type = bot_type
        self.config = config
        self.force_account = force_account
        self.force_id = force_id

    @classmethod
    def forge_from_input(cls, flask_request, force_account=None, force_id=None):
        if force_account:
            inputs = AccountBotSchemaInputs(flask_request)
        else:
            inputs = BotSchemaInputs(flask_request)
        if not inputs.validate():
            raise ValidationError(inputs.errors[0])
        data = flask_request.get_json()
        name = data['name']
        bot_type = data.get('bot_type', None)
        config = data.get('config', None)
        return cls(name, bot_type, config, force_account=force_account, force_id=force_id)

    @staticmethod
    def get_list(force_account=None):
        with db.cursor() as c:
            ret = []
            if force_account is None:
                c.execute('SELECT user_id, name, bot_type, token, insert_time FROM bots ORDER BY insert_time DESC;')
            else:
                c.execute('SELECT b.user_id, b.name, b.bot_type, b.token, b.insert_time ' +
                          'FROM bots AS b INNER JOIN users_accounts AS ua ON b.user_id = ua.user_id ' +
                          'WHERE ua.account = %s ORDER BY b.insert_time DESC;', (force_account,))
            for user_id, name, bot_type, token, insert_time in c:
                ret.append({
                    'id': user_id,
                    'name': name,
                    'bot_type': bot_type,
                    'token': token,
                    'insert_time': calendar.timegm(insert_time.timetuple()),
                })
            return ret

    def insert(self):
        with db.cursor() as c:
            c.execute("INSERT INTO users (user_type) VALUES ('bot') RETURNING id;")
            user_id, = c.fetchone()
            c.execute("INSERT INTO bots (user_id, name, bot_type) VALUES (%s, %s, %s) RETURNING token;", (user_id, self.name, self.bot_type,))
            bot_token, = c.fetchone()
            if self.force_account:
                c.execute("INSERT INTO users_accounts (user_id, account, config) VALUES (%s, %s, %s);", (user_id, self.force_account, self.config,))
            return user_id, bot_token

    @staticmethod
    def _is_tied_to_account(user_id, account_id):
        # make sure that the bot with this user_id really has this account:
        test_record = Bot.get(user_id, account_id)
        if not test_record:
            return False
        return True

    @staticmethod
    def _is_tied_only_to_account(user_id, account_id):
        # additional check, just to be safe - bot must not have other accounts:
        with db.cursor() as c:
            c.execute('SELECT count(*) FROM users_accounts WHERE user_id = %s;', (user_id,))
            if c.fetchone()[0] != 1:
                return False
        return True

    def update(self):
        if self.force_id is None:
            return 0
        with db.cursor() as c:
            if self.force_account is not None:
                if not Bot._is_tied_to_account(self.force_id, self.force_account):
                    return 0

            c.execute("UPDATE bots SET name = %s, bot_type = %s WHERE user_id = %s;", (self.name, self.bot_type, self.force_id,))
            if not c.rowcount:
                return 0
            # if account id is known, we must update config information in users_accounts table:
            if self.force_account:
                c.execute("UPDATE users_accounts SET config = %s WHERE user_id = %s and account = %s;", (self.config, self.force_id, self.force_account,))
            return 1

    @staticmethod
    def delete(user_id, force_account=None):
        with db.cursor() as c:
            if force_account is not None:
                if not Bot._is_tied_to_account(user_id, force_account):
                    return 0
                if not Bot._is_tied_only_to_account(user_id, force_account):
                    # just remove the connection to this account, leave the bot itself alone:
                    # (this can't actually happen because we can't tie bot to multiple accounts - no API endpoint for that. Still, DB schema allows for that option...)
                    c.execute("DELETE FROM users_accounts WHERE user_id = %s AND user_type = 'bot' AND account = %s;", (user_id, force_account,))
                    return c.rowcount

            c.execute("DELETE FROM users WHERE id = %s AND user_type = 'bot';", (user_id,))  # record from bots will be removed automatically (cascade)
            return c.rowcount

    @staticmethod
    def get(user_id, force_account=None):
        with db.cursor() as c:
            if force_account is None:
                c.execute('SELECT user_id, name, token, bot_type, NULL, insert_time FROM bots WHERE user_id = %s;', (user_id,))
            else:
                c.execute('SELECT b.user_id, b.name, b.token, b.bot_type, ua.config, b.insert_time ' +
                          'FROM bots AS b INNER JOIN users_accounts AS ua ON b.user_id = ua.user_id ' +
                          'WHERE ua.account = %s AND b.user_id = %s;', (force_account, user_id,))
            res = c.fetchone()
            if not res:
                return None
            user_id, name, token, bot_type, config, insert_time = res
        return {
            'id': user_id,
            'name': name,
            'token': token,
            'bot_type': bot_type,
            'config': config,
            'insert_time': calendar.timegm(insert_time.timetuple()),
        }

    @staticmethod
    def is_bot(user_id):
        with db.cursor() as c:
            c.execute("SELECT user_type FROM users WHERE id = %s;", (user_id,))
            user_type, = c.fetchone()
            return user_type == 'bot'

    @staticmethod
    def authenticate_token(bot_token_unclean):
        try:
            bot_token = str(BotToken(bot_token_unclean))
        except:
            log.info("Invalid bot token format")
            return None
        # authenticate against DB:
        with db.cursor() as c:
            c.execute("SELECT user_id FROM bots WHERE token = %s;", (bot_token,))
            res = c.fetchone()
            if not res:
                log.info("No such bot token")
                return None
            user_id, = res
            return user_id


class Person(object):
    def __init__(self, name, email, username, password, force_id=None):
        self.name = name
        self.email = EmailAddress(email)
        self.username = username
        self.password = password
        self.force_id = force_id

    @classmethod
    def forge_from_input(cls, flask_request, force_id=None):
        inputs = PersonSchemaInputsPOST(flask_request) if force_id is None else PersonSchemaInputsPUT(flask_request)
        if not inputs.validate():
            raise ValidationError(inputs.errors[0])
        data = flask_request.get_json()

        name = data.get('name', None)
        email = data.get('email', None)
        username = data.get('username', None)
        password = data.get('password', None)
        return cls(name, email, username, password, force_id)

    @staticmethod
    def get_list():
        with db.cursor() as c:
            ret = []
            c.execute('SELECT user_id, name, email, username FROM persons ORDER BY username ASC;')
            for user_id, name, email, username in c:
                ret.append({
                    'user_id': user_id,
                    'name': name,
                    'email': email,
                    'username': username,
                })
            return ret

    def insert(self):
        with db.cursor() as c:
            c.execute("INSERT INTO users (user_type) VALUES ('person') RETURNING id;")
            user_id, = c.fetchone()
            pass_hash = Auth.password_hash(self.password)
            c.execute("INSERT INTO persons (user_id, name, email, username, passhash) VALUES (%s, %s, %s, %s, %s);", (user_id, self.name, str(self.email), self.username, pass_hash,))
            return user_id

    def update(self):
        if self.force_id is None:
            raise ValidationError("Invalid user id")  # this should never happen
        with db.cursor() as c:
            if self.name:
                c.execute("UPDATE persons SET name = %s WHERE user_id = %s;", (self.name, self.force_id,))
            if self.username:
                c.execute("UPDATE persons SET username = %s WHERE user_id = %s;", (self.username, self.force_id,))
            if self.email:
                c.execute("UPDATE persons SET email = %s WHERE user_id = %s;", (str(self.email), self.force_id,))
            if self.password:
                pass_hash = Auth.password_hash(self.password)
                c.execute("UPDATE persons SET passhash = %s WHERE user_id = %s;", (pass_hash, self.force_id,))
            return c.rowcount

    @staticmethod
    def delete(user_id):
        with db.cursor() as c:
            c.execute("DELETE FROM users WHERE id = %s and user_type = 'person';", (user_id,))  # record from persons will be removed automatically (cascade)
            return c.rowcount

    @staticmethod
    def get(user_id):
        with db.cursor() as c:
            c.execute('SELECT user_id, name, email, username FROM persons WHERE user_id = %s;', (user_id,))
            res = c.fetchone()
            if not res:
                return None
            user_id, name, email, username = res
        return {
            'user_id': user_id,
            'name': name,
            'email': email,
            'username': username,
        }


class PersonCredentials(object):
    def __init__(self, username, password):
        self.username = username
        self.password = password

    @classmethod
    def forge_from_input(cls, flask_request):
        inputs = PersonCredentialSchemaInputs(flask_request)
        if not inputs.validate():
            raise ValidationError(inputs.errors[0])
        data = flask_request.get_json()

        username = data['username']
        password = data['password']
        return cls(username, password)

    def check_user_login(self):
        with db.cursor() as c:
            c.execute("SELECT user_id, passhash FROM persons WHERE username = %s;", (self.username,))
            res = c.fetchone()
            if not res:
                return None
            user_id, passhash = res
            if Auth.is_password_valid(self.password, passhash):
                return user_id
            return None

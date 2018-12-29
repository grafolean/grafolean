# Database (PostgreSQL)

```
$ apt-get update && apt-get install -y postgresql-9.6
```

## Moving PostgreSQL data dir (optional)

This is especially recommended if running GrafoLean on RaspberryPi (continuous writing to SD card is a bad idea so it makes sense to move database elsewhere, for example to an USB stick).
Warning: PostgreSQL will not accept FAT32/VFAT target.

```
# systemctl stop postgresql
# vi /etc/postgresql/9.5/main/postgresql.conf
```

Set appropriate directory:
```
data_directory = '/data/grafolean_db'
```

Copy original directory, preserving all file attributes:
```
# cp -aRv /var/lib/postgresql/9.6/main.original/ /data/grafolean_db
```

Start PostgreSQL again:
```
# systemctl start postgresql
```

## Creating default credentials

Create database, user and password:
```
# su postgres
$ createuser admin
$ createdb grafolean
$ psql
postgres=# alter user admin with encrypted password 'admin';
```

Warning: please do not use this username and password if there is even a remote chance these settings will be protecting any non-trivial data.


# AWS

Security Groups: http://blog.brianz.bz/post/accessing-vpc-resources-with-lambda/

pipenv shell
cd backend/
vi zappa_settings.json
zappa deploy dev
zappa update dev

# CORS

CORS is a mechanism that protects your browser from being tricked into doing something on your behalf.

If you want to host a web interface (such as GrafoLean frontend) on a different protocol / domain / ip / port than the backend, you MUST let backend know about it. Note that backend will not filter anything out by itself (because any header, including Origin, can easily be spoofed), it will just enable the *browser* to distinguish between legitimate requests and malicious ones. Backend will do this by returning `Access-Control-Allow-*` headers only for those `OPTIONS` requests that have a valid `Origin` header set (*valid* meaning one of the whitelisted ones).

In short, set `GRAFOLEAN_CORS_DOMAINS` environment var to a comma-separated list of valid values for [Origin header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin). For example, if you want to run two frontends, one on `https://11.22.33.44:555` and the other one on `https://example.org:123`, you need to set `GRAFOLEAN_CORS_DOMAINS` to `https://11.22.33.44:555,https://example.org:555`.

Note that `*` is NOT supported because it would introduce a security vulnerability. If you are having trouble with CORS then you should learn about it or invoke help of someone who understands it.

To see if the settings were applied correctly, see `cors_domains` field in `/api/status/info` response. Note that this endpoint is the *only one* that allows CORS requests from any domain - this is done on purpose so that frontend can check if domain matches and present user with a (hopefully) helpful explanation of the problem.

# Database (PostgreSQL)

```
$ apt-get update && apt-get install -y postgresql-9.6
```

## Moving PostgreSQL data dir (optional)

This is especially recommended if running Moonthor on RaspberryPi (continuous writing to SD card is a bad idea so it makes sense to move database elsewhere, for example to an USB stick).
Warning: PostgreSQL will not accept FAT32/VFAT target.

```
# systemctl stop postgresql
# vi /etc/postgresql/9.5/main/postgresql.conf
```

Set appropriate directory:
```
data_directory = '/data/moonthor_db'
```

Copy original directory, preserving all file attributes:
```
# cp -aRv /var/lib/postgresql/9.6/main.original/ /data/moonthor_db
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
$ createdb moonthor
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


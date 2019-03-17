# About Grafolean

Grafolean is an easy to use, powerful and secure generic monitoring system. It can be self-hosted and is not resource hungry (it can even run on Raspberry Pi [^1]). It uses PostgreSQL database as data storage and (optionally) Mosquitto MQTT broker to display real-time changes. Being also packaged as Docker image, it should be easy to install on any Linux platform (and probably elsewhere). It can also run on AWS (Lambda + S3 + RDS + ... [^2]).

This is still an early stage software, with many features still in planning and development. We would encourage you to grab a copy and give it a spin, and to tell us if you miss something via [Issues](https://gitlab.com/grafolean/grafolean/issues). Bug reports (or simply questions) are of course also welcome there.

[^1]: though running any software that writes to SD card often is in general not a good idea due to SD card reliability issues (on power failure)
[^2]: note that AWS IOT is not a suitable replacement for Mosquitto in this case, because it uses a different authentication mechanism

# License

Grafolean is licensed under Fair Source 20 license (see `LICENSE.md`), which means that the number of users per organization is limited to 20, otherwise the usage must be paid for [^3].

This licence means that Grafolean is *not* open source (as per [OSI definition](https://opensource.org/osd-annotated)), nor is it free software (as per [FSF definition](https://www.gnu.org/philosophy/free-sw.en.html)). We understand (and regret) that this might not be acceptable to some potential users or contributors. However we believe this compromise keeps the best properties of free / open source, while also aligning incentives of developers and users - to have a monitoring system with the best possible user experience, freely available to small entities, with active and ongoing development.

[^3]: commercial licenses are currently not (yet) available - contact us if you hit the limit and we will find a suitable solution

# Install

## Docker (docker-compose)

This is the easiest way, because it installs and runs all the services necessary with a few simple steps:

1) save [docker-compose.yml](https://grafolean.com/docker-compose.yml) to a local file
2) (optional, but recommended) edit `docker-compose.yml` and change the path where the DB data will be saved locally (`/grafolean/db/` by default), DB admin credentials and similar
3) run: `docker-compose up -d`
4) point your browser to http://localhost/ and follow post-installation instructions

# Sending values

To send values to Grafolean, you first need to create a bot account (via UI) and obtain its bot token. Then you can use a regular POST request to send values:

```bash
$ curl -X POST 'https://grafolean.com/api/accounts/1/values/?p=just.some.path&v=12.345&b=<BotAPIToken>'
```

Please consult API.md for more info.

# Development

## Frontend

If you only want to run and develop the frontend, the easiest way is to start backend service, database and MQTT broker from `frontend/docker-compose.yml`:

```bash
$ cd frontend/
$ docker-compose up -d
$ npm install
$ npm start
```

To exit, press `Control-C`, then stop the services:
```
$ docker-compose down
```

## Backend

```bash
$ cd backend/
$ docker-compose up -d
$ pipenv shell
... $ pipenv install
... $ export GRAFOLEAN_CORS_DOMAINS=http://localhost:3000
... $ python grafolean.py
```

This assumes you are running the frontend at `http://localhost:3000/`. If this is not the case, fix `GRAFOLEAN_CORS_DOMAINS` accordingly.

To exit, press `Control+C`, then exit pipenv shell and stop the services:
```
... $ exit
$ docker-compose down
```

## Backend integration tests

Integrations tests need a running database, Mosquitto and a backend service (which is only used as authentication mechanism for Mosquitto).

```bash
$ cd backend/tests/
$ docker-compose up -d
$ pipenv shell
... $ pipenv install
... $ pytest integration.py
```

To exit:
```
... $ exit
$ docker-compose down
```

-----

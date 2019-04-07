# About Grafolean

Grafolean is an easy to use, powerful and secure generic monitoring system. It can be self-hosted and is not resource hungry (it can even run on Raspberry Pi [^1]). It uses PostgreSQL database as data storage and Mosquitto MQTT broker to display real-time changes. Being also packaged as Docker image, it is very easy to install on any Linux platform (and probably elsewhere). It can also run on AWS (EC2 + RDS). [^2]).

This is still an early stage software, with many features still in planning and development. We would encourage you to grab a copy and give it a spin, and to tell us if you miss something via [Issues](https://gitlab.com/grafolean/grafolean/issues). Bug reports (or simply questions) are of course also welcome there.

[^1]: though running any software that writes to SD card often is in general not a good idea due to SD card reliability issues (on power failure)
[^2]: note that AWS IOT is not a suitable replacement for Mosquitto in this case, because it uses a different authentication mechanism. However running backend on Lambda is possible.

# License

Grafolean is licensed under Fair Source 10 license (see `LICENSE.md`).

In short:
- source available
- free to use for up to 10 users per organization [^3]

This licence means that Grafolean is *not* open source (as per [OSI definition](https://opensource.org/osd-annotated)), nor is it free software (as per [FSF definition](https://www.gnu.org/philosophy/free-sw.en.html)). We understand (and regret) that this might not be acceptable to some potential users or contributors. However we believe this compromise keeps the best properties of free / open source, while also aligning incentives of developers and users - to have a monitoring system with the best possible user experience, freely available to small entities, with active and ongoing development.

The goal is to provide *polished* experience while still allowing users to make modifications as they see fit.

[^3]: this being early stage software, commercial licenses are not yet available. [Contact us](info@grafolean.com) if you hit the limit and we will find a suitable solution.

# Install

## Docker (docker-compose)

This is the easiest way, because it installs and runs all the services necessary with a few simple steps:

1) save [docker-compose.yml](https://grafolean.com/docker-compose.yml) to a local file
2) (recommended) edit `docker-compose.yml` and change the path where the DB data will be saved locally (`/grafolean/db/` by default), DB admin credentials and similar
3) run: `docker-compose up -d`
4) point your browser to http://localhost/ (or other appropriate URL) and follow post-installation instructions

## SSL

By default, Grafolean is being served through unencrypted HTTP (port 80). Additional steps need to be taken to protect the traffic with SSL/TLS, however they are unfortunately manual. Since all traffic is going through Nginx (including websockets) in the default installation, it is enough to install certificate there. The guide below assumes we will be using LetsEncrypt certificates (there are many alternatives, but this is probably the easiest one).

1) install `certbot` on the host machine. On Debian / Ubuntu:
  ```
    add-apt-repository ppa:certbot/certbot
    apt install certbot python-certbot-nginx
  ```

2) ...? certbot certonly --webroot -d demo2.grafolean.com ?

3) renewing:
  ```
    vi /etc/cron.daily/certbot-renew
     #!/bin/sh
     /usr/bin/certbot renew --webroot -n --post-hook "docker exec -ti grafolean_grafolean_1 service nginx reload"
    chmod 755 certbot-renew
  ```
  // !!! containers should be named

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

### Frontend configuration

Frontend can only receive configuration data during build time, because it is being served as a set of HTML, JS and CSS files.

Build time configuration only allows a single setting:

- `REACT_APP_BACKEND_ROOT_URL`: URL address of the backend service. Example: `http://127.0.0.1:5000/api`. Default value is origin of frontend with `/api` suffix.

If running frontend locally (`npm start`), this setting can be put to `.env` file (see `.env.example`). If building, it needs to be set as envoronment variable (for example `REACT_APP_BACKEND_ROOT_URL=https://mydomain.com/grafolean/api npm build`).

The rest of configuration data (for example location of MQTT broker) will be fetched from the backend via `/api/status/info` call.

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

### Backend configuration

Backend configuration can be supplied via environment variables. When running backend through uWSGI and nginx (as is the case )

- `MQTT_HOSTNAME`: Hostname of MQTT broker *as seen from backend*. Backend will use MQTT protocol to communicate with the broker.
- `MQTT_PORT`: Port of MQTT broker (default `1883`).
- `MQTT_WS_HOSTNAME`: Hostname of MQTT broker *as seen from frontend*. This setting is simply forwarded to frontend when it requests `/api/status/info`, and is not used by backend at all. Frontend uses this address to setup websockets connection to MQTT broker. In case of default docker install, this connection is proxied through nginx, which means that address of MQTT broker (for websocket connection) is the same as the address of backend. Empty string can be used for this option (default).
- `MQTT_WS_PORT`: Port of MQTT broker for websockets connection. If empty, the port of backend service will be used (the same as with `MQTT_WS_HOSTNAME` setting).
- `MQTT_WS_SSL`: *Deprecated.* SSL is only used if websockets connection is proxied through nginx, in which case frontend can determine this value from protocol used for communication with backend (`http:` => use `ws:`, `https:` => use `wss:`).
- `GRAFOLEAN_CORS_DOMAINS`: A comma separated list of domains that host frontend. Example: `"demo.grafolean.com,demo2.grafolean.com"`. Note that frontend will warn the user if frontend is hosted on domain which is not in this list. Also, backend denies any request from an unlisted domain (if `Origin` header is set).

## Backend integration tests

Integrations tests need a running database, Mosquitto and a backend service (which is used as authentication mechanism for Mosquitto).

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

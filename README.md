# About Grafolean

Grafolean is an easy to use, powerful and secure generic monitoring system. It can be self-hosted and is not resource hungry (it can even run on Raspberry Pi [^1]). It uses PostgreSQL database as data storage and Mosquitto MQTT broker to display real-time changes. Being also packaged as Docker image, it is very easy to install on any Linux platform (and probably elsewhere). With some work it can also run on AWS (EC2 + RDS). [^2]).

** THIS IS ALPHA SOFTWARE - USE AT YOUR OWN RISK! **

Many features are still planned or in development and there might be bugs. Feel free to test it and to create an [issue](https://gitlab.com/grafolean/grafolean/issues) if you find a problem.


[^1]: though running any software that writes to SD card is in general not a good idea due to SD cards' reliability issues (especially on power failure)
[^2]: note that AWS IOT is not a suitable replacement for Mosquitto in this case, because it uses a different authentication mechanism. However running backend on Lambda is possible.

# Demo

https://demo.grafolean.com/

Username: `demo`, password: `demo`.

# License

License is Commons Clause license (on top of Apache 2.0) - similar to open source, but you can't sell it (you can use it for free though, even for commercial purposes). See [LICENSE.md](https://gitlab.com/grafolean/grafolean/blob/master/LICENSE.md) for details.

If in doubt, please [open an issue](https://gitlab.com/grafolean/grafolean/issues) to get further clarification.

# Install (docker / docker-compose)

This is the easiest and currently the only officially supported way. All the services necessary can be run with a few simple steps:

1) save [install/docker-compose.yml](https://gitlab.com/grafolean/grafolean/raw/master/install/docker-compose.yml) to a local file
2) edit `docker-compose.yml` and change the path where the DB data will be saved locally (`/grafolean/db/` by default), DB admin credentials, hostname and similar
3) run: `docker-compose up -d`
4) point your browser to http://localhost/ (or other appropriate URL) and follow post-installation instructions

## Upgrade

1) `docker-compose pull`
2) `docker-compose down && sleep 1 && docker-compose up -d`

## HTTPS

If you follow default installation (docker), setting up Grafolean for HTTPS should be easy. All traffic (including websockets) is going through Nginx, so it is enough to install certificate there.

#### Existing certificates

If you have your own certificates and will renew them manually, it is enough to expose port `443` and mount certificates (as indicated in `docker-compose.yml`). When changing the certificates you also need to restart nginx:

```bash
docker exec -ti grafolean service nginx reload`
```

#### Configuring certbot (LetsEncrypt certificates)

The guide below describes how to setup `certbot` on host computer, so that it correctly manages SSL/TLS certificates.

IMPORTANT: you need to replace `yourdomain.example.org` everywhere in this guide with some domain or IP address that actually leads to your host, both on port 80 and 443. Make sure you don't block port 80, because it is important for (re)issuing certificates.

1) Install `certbot` on the host machine. On Debian / Ubuntu:
  ```bash
    $ sudo add-apt-repository ppa:certbot/certbot
    $ sudo apt install certbot
  ```

2) If Grafolean is already running, stop it:
  ```bash
    $ sudo docker-compose down
  ```

3) Create a valid certificate using `certbot`:
  ```bash
    $ sudo certbot certonly --standalone -d yourdomain.example.org
  ```
  (replace `yourdomain.example.org` with the actual domain or IP address)

3.b) (might not be needed?)
  ```bash
    $ sudo mkdir -p /etc/letsencrypt/acme-challenge
  ```

4) Edit `docker-compose.yml` and make sure the following lines are enabled in `grafolean` service:
  ```
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/letsencrypt/acme-challenge:/var/www/acme-challenge
      - /etc/letsencrypt/live/yourdomain.example.org/fullchain.pem:/etc/certs/cert.crt
      - /etc/letsencrypt/live/yourdomain.example.org/privkey.pem:/etc/certs/cert.key
  ```
  (replace `yourdomain.example.org` with the actual domain or IP address)

5) Run Grafolean:
  ```bash
    $ sudo docker-compose up -d
  ```
  If everything went according to plan, you should now be able to access the service at `https://yourdomain.example.org/`. Congratulations!

6) Important final step - setup automatic certificate renewal process. Edit `/etc/cron.daily/certbot-renew` and enter the following content:
  ```
    #!/bin/sh
    /usr/bin/certbot renew --webroot --webroot-path /etc/letsencrypt/acme-challenge/ -n --post-hook "docker exec -ti grafolean service nginx reload"
  ```
  Also make the file executable:
  ```bash
    $ sudo chmod 755 /etc/cron.daily/certbot-renew
  ```

# Sending values

To send values to Grafolean, you first need to create a bot account (via UI) and obtain its bot token. Then you can use a regular POST request to send values:

```bash
$ curl -X POST 'https://grafolean.com/api/accounts/1/values/?p=myhouse.livingroom.humidity&v=57.3&b=<BotAPIToken>'
```

Please consult [backend/API.md](https://gitlab.com/grafolean/grafolean/blob/master/backend/API.md) for more info.

# Development

## Contributing

To contribute to this repository, CLA needs to be signed. Please open an issue before submitting a pull request.

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

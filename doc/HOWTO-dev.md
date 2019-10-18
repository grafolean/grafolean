# Development

## Contributing

To contribute to this repository, CLA needs to be signed. Please open an issue about the problem you are facing before submitting a pull request.

## Frontend

If you only want to run and develop the frontend, the easiest way is to start backend service, database and MQTT broker from `frontend/docker-compose.yml`:

```bash
$ cd frontend/
$ docker-compose up -d
$ npm install
$ npm start
```

Then run the frontend:
```bash
$ npm start
```

The changes of the code should be automatically visible in the browser that was launched by this.

To exit, press `Control-C` where the `npm start` is running, then stop the services:
```bash
$ docker-compose down
```

### Frontend configuration

Frontend can only receive configuration data during build time, because it is being served as a set of HTML, JS and CSS files.

Build time configuration only allows a single setting:

- `REACT_APP_BACKEND_ROOT_URL`: URL address of the backend service. Example: `http://127.0.0.1:5000/api`. Default value is origin of frontend with `/api` suffix.

If running frontend locally (`npm start`), this setting can be put to `.env` file (see `.env.example`). If building, it needs to be set as environment variable (for example `REACT_APP_BACKEND_ROOT_URL=https://mydomain.com/grafolean/api npm build`).

The rest of configuration data (for example location of MQTT broker) will be fetched at runtime from the backend via `/api/status/info` call.

## Backend

```bash
$ cd backend/
$ docker-compose up -d
$ pipenv shell
... $ pipenv install
... $ export GRAFOLEAN_CORS_DOMAINS=http://localhost:3000
... $ export MQTT_WS_HOSTNAME=localhost
... $ python grafolean.py
```

This assumes you are running the frontend at `http://localhost:3000/`. If this is not the case, fix `GRAFOLEAN_CORS_DOMAINS` accordingly.

To exit, press `Control+C`, then exit pipenv shell and stop the services:
```bash
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

## Running API integration tests

Integrations tests need a running database, Mosquitto and a copy of a backend service (which is used as authentication mechanism for Mosquitto).

```bash
$ cd backend/tests/
$ docker-compose up -d
$ pipenv shell
... $ pipenv install
... $ pytest integration.py
```

To exit:
```bash
... $ exit
$ docker-compose down
```


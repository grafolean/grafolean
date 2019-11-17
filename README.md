# About Grafolean

Grafolean is an easy to use generic monitoring system. It can be used for free, can be self-hosted and is not resource hungry (it can even run on Raspberry Pi [^1]). It uses
PostgreSQL database as data storage and Mosquitto MQTT broker to display real-time changes. Being also packaged as Docker image, it is very easy to install on Linux PC (and probably elsewhere).

![screenshot](doc/screenshot-dark.png)

Project priorities are:
- correctness and security
- usability (UX)
- maintainability
- performance

Feel free to create an [issue](https://gitlab.com/grafolean/grafolean/issues) if you encounter a problem.

[^1]: though running any software that writes to SD card is in general not a good idea due to SD cards' reliability issues (especially on power failure)

# Demo

https://grafolean.com/

Username: `demo`, password: `demo`.

# License

License is Commons Clause license (on top of Apache 2.0) - source is available and you can use it for free (commercially too), modify it and
share modifications. To sell it however you need a commercial license (not yet available - [contact us](info@grafolean.com) if
interested). See [LICENSE.md](./LICENSE.md) for details.

If in doubt, please [open an issue](https://gitlab.com/grafolean/grafolean/issues) to get further clarification.

# Install (docker / docker-compose)

This is the easiest and currently the only officially supported way. [Open an issue](https://gitlab.com/grafolean/grafolean/issues) if you need help
installing some other way (or to post your experience).

All the services necessary can be run with a few simple steps:

1) save [install/docker-compose.yml](https://gitlab.com/grafolean/grafolean/raw/master/install/docker-compose.yml) to a local file
2) edit `docker-compose.yml` and change:
    - mandatory: `MQTT_WS_HOSTNAME` (set to the external IP/hostname of the server),
    - optional but recommended: DB admin credentials, and
    - optional: the path where the DB data will be saved locally (`/grafolean/db/` by default).
3) run: `docker-compose up -d`
4) point your browser to http://localhost/ (or other appropriate URL) and follow post-installation instructions

## Upgrade

1) `docker-compose pull`
2) `docker-compose down && sleep 1 && docker-compose up -d`

## HTTPS

See [doc/HOWTO-HTTPS.md](doc/HOWTO-HTTPS.md) for details on how to setup HTTPS.

# Sending values

To send values to Grafolean, you first need to create a bot account (via UI) and obtain its bot token. Then you can use a regular POST request to send values:

```bash
$ curl -X POST 'https://grafolean.com/api/accounts/1/values/?p=myhouse.livingroom.humidity&v=57.3&b=<BotAPIToken>'
```

Please consult [backend/API.md](https://gitlab.com/grafolean/grafolean/blob/master/backend/API.md) for more info.

# Development

Please see [doc/HOWTO-dev.md](doc/HOWTO-dev.md) for details.


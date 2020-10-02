# Grafolean

Easy to use monitoring system.

---

- [Demo](#demo)
- [Highlights](#highlights)
- [Requirements](#requirements)
- [Installation](#installation)
- [Upgrading](#upgrading)
- [Guides](#guides)
- [Quick start - sending values to Grafolean](#quick-start---sending-values-to-grafolean)
- [Development](#development)
- [License](#license)

---

## Demo

https://app.grafolean.com/ (`demo` / `demo`)

## Highlights

- self-hosted or [hosted service](https://app.grafolean.com/)
- [API-first](https://app.grafolean.com/api-doc/)
- built-in or remote agents ("bots")
- UI-controlled agents (bots) for ICMP ping, SNMP (SNMPv1, SNMPv2 and SNMPv3 - netsnmp compatible) and NetFlow
- uses PostgreSQL / TimescaleDB as data storage (easy data maintenance)
- granular permissions model

![screenshot](doc/screenshot-dark.png)


## Requirements

- Docker (see [installation instructions](https://docs.docker.com/install/))
- Docker Compose (see [installation instructions](https://docs.docker.com/compose/install/))

## Installation

1) save [install/docker-compose.yml](https://raw.githubusercontent.com/grafolean/grafolean/master/install/docker-compose.yml) to a local file:

    ```
    $ curl https://raw.githubusercontent.com/grafolean/grafolean/master/install/docker-compose.yml > docker-compose.yml
    ```

2) save [.env.example](https://raw.githubusercontent.com/grafolean/grafolean/master/install/.env.example) to a local file and rename it to `.env`:

    ```
    $ curl https://raw.githubusercontent.com/grafolean/grafolean/master/install/.env.example > .env
    ```

3) edit `.env`, for example with `nano`:
    ```
    $ nano .env
    ```
     and change the settings:

    - mandatory: `EXTERNAL_HOSTNAME` (set to the IP/hostname of the server as seen from the outside - for example `grafolean.example.com` or `198.51.100.12`),
    - optional but recommended: DB admin credentials and the path where the DB data will be saved locally (`/grafolean-db/` by default).

4) run:
    ```
    $ docker-compose up -d
    ```

5) point your browser to `http://<IP or domain>/` (where `<IP or domain>` should be the same as `EXTERNAL_HOSTNAME` in step 3)

Congratulations, you are done! :rocket:

If you wish to setup HTTPS, see [doc/HOWTO-HTTPS.md](doc/HOWTO-HTTPS.md) for instructions.

## Upgrading

```
$ docker-compose pull
$ docker-compose down
$ docker-compose up -d
```

## Guides

- [User Guide](doc/user-guide.md) - core concepts and first steps
- [NetFlow Guide](doc/HOWTO-NetFlow.md) - step-by-step NetFlow monitoring setup guide
- [HTTPS](doc/HOWTO-HTTPS.md) - configuring Grafolean to use SSL/TLS
- [API Guide](backend/API.md)
- [Development Guide](doc/HOWTO-dev.md)


## Quick start - sending values to Grafolean

You can send data to Grafolean from your own scripts ("custom bots") or you can use one of the existing bots, which can even be configured from within the Grafolean (like ICMP ping, SNMP or Netflow - see [Grafolean User Guide](doc/user-guide.md)).

When you just want to send values to Grafolean, create a *custom* bot (via UI) and obtain its token. Then you can use a regular POST request to send values:

```bash
$ curl -X POST 'https://app.grafolean.com/api/accounts/1/values/?p=myhouse.livingroom.humidity&v=57.3&b=<BotAPIToken>'
```

That's it! The values can now be shown in dashboards. See [backend/API.md](backend/API.md) for more info on API.

[User Guide](doc/user-guide.md) explains the core concepts and guides you further.


## License

This software is free to use, free to repair and free to share. License is Commons Clause license (on top of Apache 2.0), which means that source is available and you can use it free-of-charge forever (both non-commercially and commercially), modify it and share modifications.

The license limits the ability to sell Grafolean to third parties (for example as product, offering support,...), as you need a commercial license for that (not yet available, [contact us](mailto:info@grafolean.com) if interested). Please [open an issue](https://github.com/grafolean/grafolean/issues) or [ask directly](mailto:info@grafolean.com) if in doubt.

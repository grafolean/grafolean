# Grafolean

---

- [What is Grafolean?](#what-is-grafolean)
- [Requirements](#requirements)
- [Installation](#installation)
- [Upgrading](#upgrading)
- [Quick start - sending values to Grafolean](#quick-start---sending-values-to-grafolean)
- [Development](#development)
- [License: Commons Clause](#license-commons-clause)
---

## What is Grafolean?

Grafolean is an easy to use monitoring system:

- self-hosted or hosted service (currently invitation only)
- light on resources
- [API-first](https://grafolean.com/api-doc/)
- remote agents (bots)
- UI-controlled agents (bots) for ICMP ping and SNMP (SNMPv1, SNMPv2 and SNMPv3 - netsnmp compatible) - with more coming
- auto-updating UI
- uses PostgreSQL as data storage (easy maintenance)
- granular permissions model
- ...

Demo: https://grafolean.com/ (`demo` / `demo`)

[User Guide](doc/user-guide.md) explains the core concepts and guides you through the first steps.

![screenshot](doc/screenshot-dark.png)

## Requirements

- Docker (see [installation instructions](https://docs.docker.com/install/))
- Docker Compose (see [installation instructions](https://docs.docker.com/compose/install/))

## Installation

1) save [install/docker-compose.yml](https://raw.githubusercontent.com/grafolean/grafolean/master/install/docker-compose.yml) to a local file:

    ```
    $ curl https://raw.githubusercontent.com/grafolean/grafolean/master/install/docker-compose.yml > docker-compose.yml
    ```

    Alternative: if you wish to install NetFlow bot as part of this installation, use [install/docker-compose.netflow.yml](https://raw.githubusercontent.com/grafolean/grafolean/master/install/docker-compose.netflow.yml) instead, but you must still save it to `docker-compose.yml`:

    ```
    $ curl https://raw.githubusercontent.com/grafolean/grafolean/master/install/docker-compose.netflow.yml > docker-compose.yml
    ```

2) save [.env.example](https://raw.githubusercontent.com/grafolean/grafolean/master/install/.env.example) to a local file and rename it to `.env`:

    ```
    $ curl https://raw.githubusercontent.com/grafolean/grafolean/master/install/.env.example > .env
    ```

3) edit `.env`, for example with `nano`:
    ```
    $ nano .env
    ```
     and change:

    - mandatory: `EXTERNAL_HOSTNAME` (set to the IP/hostname of the server as seen from the outside),
    - optional but recommended: DB admin credentials and the path where the DB data will be saved locally (`/grafolean-db/` by default).
    - optional: HTTP port

4) run:
    ```
    $ docker-compose up -d
    ```

5) point your browser to `http://<IP or domain>/` (where `<IP or domain>` should be the same as `EXTERNAL_HOSTNAME` in step 3)

Congratulations, you are done! :)

If you wish to setup HTTPS, see [doc/HOWTO-HTTPS.md](doc/HOWTO-HTTPS.md) for instructions.

## Upgrading

```
$ docker-compose pull
$ docker-compose down
$ docker-compose up -d
```

## Quick start - sending values to Grafolean

SNMP and ICMP Ping bots are part of the installed services, and they are controlled from the Grafolean UI (see [Grafolean User Guide](doc/user-guide.md)).

You can also send any values to Grafolean using a *custom* bot. First you need to create a bot (via UI) and obtain its token. Then you can use a regular POST request to send values:

```bash
$ curl -X POST 'https://grafolean.com/api/accounts/1/values/?p=myhouse.livingroom.humidity&v=57.3&b=<BotAPIToken>'
```

That's it! The values can now be shown in dashboards. See [backend/API.md](backend/API.md) for more info on API.

[User Guide](doc/user-guide.md) explains the core concepts and guides you further.

## Development

See [doc/HOWTO-dev.md](doc/HOWTO-dev.md) for details.

## License: Commons Clause

This software is free (as in beer and as in some of the freedoms), but it is not FOSS. License is Commons Clause license (on top of Apache 2.0), which means that source is available and you can use it free-of-charge (both non-commercially or commercially), modify it and share modifications.

What you _can't_ do however is sell it to third parties (for example as product, offering support,...); you need a commercial license for that (not yet
available, [contact us](info@grafolean.com) if interested).

If in doubt, please read the [license](./LICENSE.md) - it is very short. Or, [open an issue](https://github.com/grafolean/grafolean/issues) with a request for a clarification on a specific matter.

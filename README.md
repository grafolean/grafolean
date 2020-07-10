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

- self-hosted or [hosted service](https://app.grafolean.com/)
- light on resources
- [API-first](https://app.grafolean.com/api-doc/)
- remote agents (bots)
- UI-controlled agents (bots) for ICMP ping, SNMP (SNMPv1, SNMPv2 and SNMPv3 - netsnmp compatible) and NetFlow
- auto-updating UI
- uses PostgreSQL as data storage (easy maintenance)
- granular permissions model
- ...

Useful resources:

- Demo: https://app.grafolean.com/ (`demo` / `demo`)
- [User Guide](doc/user-guide.md) explains the core concepts and guides you through the first steps.
- [NetFlow guide](doc/HOWTO-netflow.md) explains how to setup Grafolean for NetFlow data collection.

![screenshot](doc/screenshot-dark.png)

## Requirements

- Docker (see [installation instructions](https://docs.docker.com/install/))
- Docker Compose (see [installation instructions](https://docs.docker.com/compose/install/))

## Installation

1) save [install/docker-compose.yml](https://raw.githubusercontent.com/grafolean/grafolean/master/install/docker-compose.yml) to a local file:

    ```
    $ curl https://raw.githubusercontent.com/grafolean/grafolean/master/install/docker-compose.yml > docker-compose.yml
    ```

    > Alternative: if you wish to install NetFlow bot as part of this installation, use [install/docker-compose.netflow.yml](https://raw.githubusercontent.com/grafolean/grafolean/master/install/docker-compose.netflow.yml) instead, but you should still save it to `docker-compose.yml`:
    >
    >    ```
    >    $ curl https://raw.githubusercontent.com/grafolean/grafolean/master/install/docker-compose.netflow.yml > docker-compose.yml
    >    ```

2) save [.env.example](https://raw.githubusercontent.com/grafolean/grafolean/master/install/.env.example) to a local file and rename it to `.env`:

    ```
    $ curl https://raw.githubusercontent.com/grafolean/grafolean/master/install/.env.example > .env
    ```

3) edit `.env`, for example with `nano`:
    ```
    $ nano .env
    ```
     and change:

    - mandatory: `EXTERNAL_HOSTNAME` (set to the IP/hostname of the server as seen from the outside - for example `grafolean.example.com` or `198.51.100.12`),
    - optional but recommended: DB admin credentials and the path where the DB data will be saved locally (`/grafolean-db/` by default).
    - optional: HTTP port

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

## Quick start - sending values to Grafolean

You can send data to Grafolean from your own scripts ("custom bots") or you can use one of the existing bots, which can even be configured from within the Grafolean (like ICMP ping, SNMP or Netflow - see [Grafolean User Guide](doc/user-guide.md)).

When you just want to send values to Grafolean, create a *custom* bot (via UI) and obtain its token. Then you can use a regular POST request to send values:

```bash
$ curl -X POST 'https://app.grafolean.com/api/accounts/1/values/?p=myhouse.livingroom.humidity&v=57.3&b=<BotAPIToken>'
```

That's it! The values can now be shown in dashboards. See [backend/API.md](backend/API.md) for more info on API.

[User Guide](doc/user-guide.md) explains the core concepts and guides you further.

## Development

See [doc/HOWTO-dev.md](doc/HOWTO-dev.md) for details.

## License: Commons Clause

This software is free (as in beer and as in some of the freedoms), but it is not FOSS. License is Commons Clause license (on top of Apache 2.0), which means that source is available and you can use it free-of-charge (both non-commercially or commercially), modify it and share modifications.

What you _can't_ do however is sell it to third parties (for example as product, offering support,...); you need a commercial license for that (not yet
available, [contact us](mailto:info@grafolean.com) if interested).

If in doubt, please read the [license](./LICENSE.md) - it is very short. Or, [open an issue](https://github.com/grafolean/grafolean/issues) with a request for a clarification on a specific matter.

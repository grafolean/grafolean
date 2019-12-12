# Grafolean user guide

## What is what?

### Bots

**Bots** are external scripts and applications that send values to Grafolean.

There are 2 types of bots, *custom* and others (like SNMP, ICMP Ping,...). Grafolean doesn't know any details about *custom* bots, except that they will send data to backend via REST (i.e., HTTP) using their own authentication token - they are the most generic kind, but it takes an additional effort to set them up and to reconfigure them when needed. They are usually less convenient, but they provide a nice escape hatch in case we just want to send values via cron, from inside of an app, or when we are using a protocol not supported by dedicated Grafolean bots.

Other kinds of bots (SNMP, Ping) are configured via Grafolean user interface. The bots themselves need to be installed somewhere where they can collect data (possibly in remote networks), but once that is done, they periodically ask Grafolean for instructions (which *entities* to monitor, which *sensors* are enabled on them, and which *credentials* to use when fetching data). The data is then sent to Grafolean the same way the custom bots would send it.

### Entities

**Entities** are the things we would like to monitor (like devices, web pages, systems,...).

Note that they are only needed when we use non-custom bots. Grafolean doesn't use entities directly, it just passes their information to bots which then gather data from them.

### Credentials

**Credentials** are protocol settings. They are named this way because many protocols (like SNMP) need "credentials" to access monitored entities (devices). SNMP credentials include protocol version, community (for SNMPv1 and v2c) or security details (SNMPv3). ICMP Ping credentials include settings like retries, timeout and similar.

### Sensors

**Sensors** describe which data is being gathered. When the sensors are selected on an entity the period of data collection is also set (every minute, 10 seconds,...), with intervals being multiples of a second.

For Ping the sensors are currently "boring", as they only need to be enabled on the device for the data to be gathered. For SNMP however we can specify OIDs that are being fetched, and then specify the formula for calculating values and expression for composing the paths.

### Paths

As values are being collected and sent to Grafolean, they must somehow carry the information about *what* the measured value represents. Grafolean uses a concept of **paths** to mark the context of every value. For example, path *entity.1234567.snmp.network.eth-1.ifoctets-in* could mark that inbound traffic on "eth-1" network interface on entity with ID "1234567" is being measured.

SNMP and Ping bots *do* enforce the leading part of the paths, but in general, it is up to the user to create a meaningful representation of the data. The paths should include any labels that might need to be displayed in the legends of the charts (any part between the dots can later be used as part of chart legend label).

### Dashboards and widgets

**Dashboards** allow us to preview data. Currently only *charts* and *latest values* **widgets** are supported. Widgets are ordered in alphabetical order (manual reordering is not implemented yet).

## First steps

### Installation

See [README.md](../README.md) for instalation instructions. Once done, configure account and first (admin) user via user interface. Login and select `My first account`.

**IMPORTANT:** please make sure you can access Grafolean via an URL which is not on local IP or domain `localhost`. Bots would not be able to connect to such an address because they are running inside their Docker containers, where local addresses resolve to the container itself. Grafolean UI tries to be nice and guide you through the installation steps for bots, but when you use local IPs or domain `localhost`, the instructions will be incorrect (you will be warned though).

### Adding a bot

> For ICMP ping, this step has already been carried out for you (though the bot is systemwide, instead of being account specific). You can safely skip it.

You can add either a SNMP, ICMP Ping or a custom bot. Select `Bots` in sidebar menu and click `+ Add bot` button. Select the protocol (SNMP, ICMP Ping or custom) and the label by which the bot will be known to you.

When bot is added, its `Last successful login` field reads `Never`, because it has not accessed Grafolean yet (at least not with a provisioned token). Open a bot page (select `Bots` in menu, click on bot name). There will be a warning about bot not having connected yet, along with the instructions on how to install and configure it. Open and follow the instructions. When bot connects, `Last successful login` field will show the date and imte of last successful connection.

If you have selected a custom bot, the data is being collected and there is nothing we need to do in Grafolean except to display it in dashboards - all of the configuration is done in the script that is sending data. For SNMP and Ping however we need to configure *credentials*, *entities* and *sensors*.

### Configuring protocol configs (credentials) and adding sensors

> For ICMP ping, this step has already been carried out for you. You can safely skip it.

Select `Credentials` in sidebar menu and click `+ Add credentials` button. Fill the form (the fields depend on the protocol selected) and click `Submit`. Repeat the process for all the protocols and their settings as needed.

Next select `Sensors` in sidebar menu. There should be existing sensors for both ICMP Ping and SNMP protocol. If you wish to add additional sensors, click `+ Add sensor` and fill the form. Note that for ICMP Ping, currently only an empty sensor can be added, so it currently doesn't make sense to add additional ones.

### Configuring data collection

Finally, we need to specify which entities (devices) we would like to monitor. Select `Monitored entities` in sidebar menu and click `+ Add monitored entity` button. Fill the form and click `Submit` button. In the list, click on the name of newly added entity. Number of `Sensors enabled` should read `0`. Click `Settings`, then select appropriate credentials for each of the protocols you wish to use to monitor the entity. Selecting a credential will show a list of sensors, allowing us to select them and to customize their polling interval if needed. Once the sensors are selected, click `Submit`. Number of `Sensors enabled` should now read reflect our choices on previous screen.

### Displaying data

Data is displayed within *dashboards*. To see the data, a new dashboard needs to be created (`Dashboards` -> `+ Add dashboard`). Dashboards are empty on creation, but we can add *widgets* to them. Currently only *chart* and *latest value* widgets are available.

Chart widget features a `Path filter` field which shows the paths that match the entered filter. Currently this is the only way to investigate which paths are available. Copying one of the paths to `Path filter` will select only this path, but you can replace segments of the path (between dots) with either `*` or `?` wildcards which match multiple segments or a single segment respectively.

`Series label` field allows us to construct a nicer label in the legend of the chart instead of the plain path. `$1` can be used to include the segment(s) that match the first wildcard in the `Path filter` field, `$2` for the second, and so on.

Values can also be modified on-the-fly. For example, if values are measured in seconds, we can divide them by 3600 (`$1 / 3600`) and choose a different unit (`h` in this case).

Make sure that `Widget title` on the top of the form is entered, then click `Submit`.

If everything went well, you should be looking at your first Grafolean chart. Congratulations! :)

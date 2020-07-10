# NetFlow

One of the officially supported protocols in Grafolean is NetFlow. Currently versions v5 and v9 are supported (though it should be easy to improve [Grafolean NetFlow bot](https://github.com/grafolean/grafolean-netflow-bot/) to support other versions if needed).

## Configuration

1) Installation

To collect data, NetFlow bot needs to be installed and configured. The easiest way to do so is to use a NetFlow specific `docker-compose.yml` during [installation of Grafolean](https://github.com/grafolean/grafolean#installation). The alternative option is to install NetFlow bot on a [remote machine](https://github.com/grafolean/grafolean-netflow-bot/#install).

2) Enable (suggested) entity

Grafolean helps with configuration by automatically creating the entities that correspond to any NetFlow exporter it is getting data from (see "Monitored entities"). It might take up to 2 minutes for the suggestions to appear.

However, these entities are not automatically enabled. To do so, click on the name of the entity (which is IP + `"(NetFlow exporter)"` by default) -> Settings, then edit NetFlow protocol:
- for Credentials select `Default NetFlow credential`
- for Bot select `Systemwide NetFlow bot`
- at last, enable `Default NetFlow sensor`

Don't forget to save changes.

3) View data

Grafolean should now be collecting the data automatically. To view it, create a new Dashboard, but make sure you select "NetFlow" template. This will automatically populate the dashboard with the widgets that are useful for this kind of data. Of course, you can always modify the existing widgets, add new ones (even those unrelated to NetFlow) or remove those that are not needed.

- click Dashboards in the menu -> Add dashboard
- enter dashboard name and in the dropdown "Initialize using a template" choose `NetFlow`

IMPORTANT: It might take up to 5 minutes (with default settings for NetFlow bot's `JOBS_REFRESH_INTERVAL`) for enough data to be collected. If you see message `There is no NetFlow data available for any entity` in NetFlow Navigation Widget, it means that the data was not aggregated and sent to Grafolean yet. If there is no change after this time (you might need to refresh browser), please check the [NetFlow Bot docker logs](https://github.com/grafolean/grafolean-netflow-bot/#debugging) to make sure the data is being collected and sent to Grafolean.

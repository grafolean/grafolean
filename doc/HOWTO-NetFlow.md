# NetFlow

One of the officially supported protocols in Grafolean is NetFlow. Currently versions v5 and v9 are supported (though it should be easy to improve [Grafolean NetFlow bot](https://github.com/grafolean/grafolean-netflow-bot/) to support other versions if needed).

## Configuration

To collect data, NetFlow bot needs to be installed and configured. The easiest way to do so is to use a NetFlow specific `docker-compose.yml` during [installation of Grafolean](https://github.com/grafolean/grafolean#installation). The alternative option is to install NetFlow bot on a [remote machine](https://github.com/grafolean/grafolean-netflow-bot/#install).

Once NetFlow bot is installed and your NetFlow exporter is sending data to it, Grafolean should be collecting it automatically. To view the data, create a new Dashboard, but make sure you select "NetFlow" template. This will automatically populate the dashboard with the widgets that are useful for this kind of data. Of course, you can always modify the existing widgets, add new ones (even those unrelated to NetFlow) or remove those that are not needed.

IMPORTANT: It might take some time for enough data to be collected. If you see message `There is no NetFlow data available for any entity` in NetFlow Navigation Widget, it means that the data was not aggregated and sent to Grafolean yet. If there is no change after an hour max. (you might need to refresh browser), please check the [NetFlow Bot docker logs](https://github.com/grafolean/grafolean-netflow-bot/#debugging) to make sure the data is being collected and sent to Grafolean.

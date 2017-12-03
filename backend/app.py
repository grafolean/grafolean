#!/usr/bin/python3
import argparse
import flask
import json
import re
from datatypes import Measurement
import utils


app = flask.Flask(__name__)
# since this is API, we don't care about trailing slashes - and we don't want redirects:
app.url_map.strict_slashes = False


@app.route("/api/values", methods=['PUT'])
def values_put():
    """
    If one wishes to fill historical data or repair the values in the charts, PUT requests should be used. Note that this kind of requests will *not* trigger any alarms (that would be pointless for past events).

    ```
    curl \
        -X PUT \
        -H 'Content-Type: application/json' \
        -d '[{"p": "<Path>", "t": <Timestamp>, "v": <Value>}, ...]' \
        'https://moonthor.com/api/values/'
    ```
        Path: dot-delimited string which uniquely identifies the metric being tracked.
        Timestamp: will be used to insert data at a specific time. Note that HTTP request is idempotent - last value will overwrite the previous ones for a specified EntitySlug and Timestamp pair.
    """
    data = flask.request.get_json()
    # let's just pretend our data is of correct form, otherwise Exception will be thrown and Flash will return response 400:
    for point in data:
        m = Measurement(point['p'], point['t'], point['v'])
        m.save()

    return ""


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", type=str, choices=['migrate', 'serve'])
    args = parser.parse_args()

    if args.operation == 'migrate':
        utils.migrate_if_needed()
    elif args.operation == 'serve':
        app.run()

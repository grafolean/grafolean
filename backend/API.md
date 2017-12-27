
## Authentication

Authentication is via standard HTTP Basic auth. Instead of password you need to use API token (available through UI).

Supply them in Authorization header like this:

```
curl -H 'Authorization: Basic <Base64(Username:APIToken)>' ...
```

This part of `curl` command will not be repeated, but should be used everywhere in the examples below.

# Values

## Sending values without timestamps (POST)

If you only need to supply a single value it might be easiest to use query parameters:

```
curl -X POST 'https://moonthor.com/api/values/?p=<Path>&v=<Value>'
```

Often you might have multiple values you want to send in one call, so you just do:

```
curl \
    -X POST \
    -H 'Content-Type: application/json' \
    -d '[{p: "<Path>", v: <Value>}, ...]' \
    'https://moonthor.com/api/values/'
```

Parameters:

    Path: defines a path that the value should be connected to (for example: `zone2.server1.cpu.load`). You are free to use whatever paths you wish, as long as they are lowercase and include only characters a-z, 0-9, dash ('-') and dot ('.'). Dot should be used to denote hierarhical pieces of the path.

Note that there is no way to specify timestamp with POST requests (time is inferred for time of HTTP request). Specifying time wouldn't make sense anyway - alarms are only possible if the data is current. If you need to cache data and send it in batches, use PUT requests instead.

## Sending values with timestamps (PUT)

If one wishes to fill historical data or repair the values in the charts, PUT requests should be used. Note that this kind of requests will *not* trigger any alarms (that would be pointless for past events).

```
curl \
    -X PUT \
    -H 'Content-Type: application/json' \
    -d '[{"p": "<Path>", "t": <Timestamp>, "v": <Value>}, ...]' \
    'https://moonthor.com/api/values/'
```

    Timestamp: will be used to insert data at a specific time. Note that HTTP request is idempotent - last value will overwrite the previous ones for a specified EntitySlug and Timestamp pair. If timestamp is floating point, it is rounded on 3 decimal places (millisecond)

## Removing values (DELETE)

```
curl \
    -X DELETE \
    'https://moonthor.com/api/values/?p=<Path>&t0=<TimestampFrom>&t1=<TimestampTo>'
```

Parameters:

    TimestampFrom: start timestamp (included)
    TimestampTo: end timestamp (included)
        Specify time interval for removal. Both parameters are mandatory. If you wish to remove whole history for the path, use values `0` and `9999999999`.

## Reading values (GET)

```
curl 'https://moonthor.com/api/values/?p=<Path0[,Path1...]>&t0=<TimestampFrom>&t1=<TimestampTo>&a=<AggregationLevel>'
```

Parameters:

    PathN: path that the data was connected to
    TimestampFrom: start timestamp (included) - optional
    TimestampTo: end timestamp (included) - optional
    AggregationLevel: values from 0 to 6 or string "no" are allowed. Aggregation level 0 returns one data point (average, min and max value) per hour. Every
        higher aggr. level returns one data point per 3-times as much time. In other words, level 1 returns one data point per 3 hours, level 2 per 9 hours,... and
        level 6 one data point per 3 ^ 6 hours or roughly 30 days. Special value "no" will return raw data (non-aggregated).
        Parameter is mandatory - if absent, server will respond with a 301 redirect to URL which includes default aggregation level for selected time interval (by default
        there will be fewer than 100 data points returned in almost all cases).

    Note that number of returned data points will never exceed 500. If requested time interval and aggr. level would return more than 500 results, incomplete response with only
    first 500 data points will be returned. In this case field "next_data_point" will mark the beginning of the next time interval so that client can repeat request with
    updated time interval.

JSON response:

{
    paths: [
        <Path0>: {
            next_data_point: null|<Timestamp>,  // if not null, use Timestamp as TimestampFrom to fetch another batch of data
            data: [
                { t: <Timestamp>, v: [<AvgValue>, <MinValue>, <MaxValue>] }  // if data was aggregated
                { t: <Timestamp>, v: <Value> }  // if raw data was requested
            ]
        },
        ...
    ]
}


# Chart labels

Often one wishes to mark events on charts (version upgrades, sensor detections,...).

## Writing labels

```
curl -X POST 'https://moonthor.com/api/labels/?l=<Label>&e=<EntityBlob>'
```

Parameters:

    Label: short label (up to 64 UTF-8 characters)
    EntityBlob: denotes the entities that this event affects. Allowed modifiers are '*' (anything), '+' (any part between dots) or '?' (any character).

The same as with values, timestamp is inferred from the time of HTTP request.

```
curl -X PUT 'https://moonthor.com/api/labels/?l=<Label>&t=<TimeStamp>&e=<EntityBlob>'
```
Note that Label + TimeStamp together identify a record. If you wish to change a label, you need to remove the record first and then insert it again.

```
curl -X DELETE 'https://moonthor.com/api/labels/?l=<Label>&t=<TimeStamp>'
```

```
curl 'https://moonthor.com/api/labels/?ts=<TimestampFrom>&te=<TimestampTo>'
```

    TimestampFrom: start timestamp (not included)
    TimestampTo: end timestamp (included)

JSON response:

{
    pagination_timestamp: <LastTimestamp>,  // if not null, use LastTimestamp as TimestampFrom to fetch another batch of data
    labels: [
        { t: <Timestamp>, l: <Label> },
        ...
    ]
}


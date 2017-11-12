
## Authentication

Authentication is via standard HTTP Basic auth. Instead of password you neeed to use API token (available through UI). 

Supply them in Authorization header like this:

```
curl -H 'Authorization: Basic <Base64(Username:APIToken)>' ...
```

This part of `curl` command will not be repeated, but should be used everywhere in the examples below.

# Values

## Sending values without timestamps (POST)

If you only need to supply a single value it might be easiest to use query parameters:

```
curl -X POST 'https://moonthor.com/api/values/?e=<EntitySlug>&v=<Value>'
```

Often you might have multiple values you want to send in one call, so you just do:

```
curl \
    -X POST \
    -H 'Content-Type: application/json' \
    -d '[{e: "<EntitySlug>", v: <Value>}, ...]' \
    'https://moonthor.com/api/values/'
```

Parameters:

    EntitySlug: defines an entity that the value should be connected to (for example: `zone2.server1.cpu.load`). You are free to use whatever entities you wish, as long as they are lowercase and include only characters a-z, 0-9, dash ('-') and dot ('.'). Dot should be used to denote hierarhical place of the entity.

Note that there is no way to specify timestamp with POST requests (time is inferred for time of HTTP request). Specifying time wouldn't make sense anyway - alarms are only possible if the data is current. If you need to cache data and send it in batches, use PUT requests instead.

## Sending values with timestamps (PUT)

If one wishes to fill historical data or repair the values in the charts, PUT requests should be used. Note that this kind of requests will *not* trigger any alarms (that would be pointless for past events).

```
curl \
    -X PUT \
    -H 'Content-Type: application/json' \
    -d '[{e: "<EntitySlug>", t: <Timestamp>, v: <Value>}, ...]' \
    'https://moonthor.com/api/values/'
```

    Timestamp: will be used to insert data at a specific time. Note that HTTP request is idempotent - last value will overwrite the previous ones for a specified EntitySlug and Timestamp pair.

## Removing values (DELETE)

```
curl \
    -X DELETE \
    'https://moonthor.com/api/values/?e=<EntitySlug>&t=<Timestamp>'
```

Parameters:

    Timestamp: specify timestamp of a specific record to remove. The parameter is mandatory. If you wish to remove whole history of the entity, use value 'remove_all_history'.

## Reading values (GET)



```
curl 'https://moonthor.com/api/values/?e=<EntitySlug[,EntitySlug...]>&ts=<TimestampFrom>&te=<TimestampTo>&max=<MaxCount>'
```

Parameters:

    TimestampFrom: start timestamp (not included)
    TimestampTo: end timestamp (included)
    MaxCount: max. number of values returned. Note that this is just a suggestion and is limited by the system imposed max. count. The idea is to limit the max. number of points on charts for screens with smaller width (mobile). Depending on this parameter and the selected time interval aggregated data might be returned.

JSON response:

{
    aggregation_level: <AggregationLevel>,  // 0: raw data, >0: 3^(L-1) hours are aggregated in a single data point
    pagination_timestamp: <LastTimestamp>,  // if not null, use LastTimestamp as TimestampFrom to fetch another batch of data
    data: {
        <EntitySlug0>: [
            { t: <Timestamp>, v: [<Value>, <MinValue>, <MaxValue>] }  // if data was aggregated
            { t: <Timestamp>, v: <Value> }  // if raw data was returned
        ],
        ...
    }
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



Passing parameters:
- GET & DELETE requests: query parameters (because it's a filter)
- POST & PUT requests: JSON in body (structures are needed), with some exceptions allowing query parameters too if simplicity is paramount


## Authentication

Authentication for sending values (via POST method) is through query parameters. All other forms use JWT auth.

### Fetching JWT token

```
curl -i 'https://grafolean.com/api/auth/login/' -d '{ "username": "<Username>", "password": "<Pass>" }'
```

Example response header:
X-JWT-Token: Bearer <KeyId>:<JWTToken>


### Authenticating

Tokens should be supplied in Authorization header like this:

```
curl -H 'Authorization: Bearer <KeyId>:<JWTToken>' ...
```

This part of `curl` command should be used everywhere in the examples below (except in POST to /api/accounts/<AccountId>/values/).

### Refreshing tokens

When the old token expires, any request with it will respond with 401. User should then obtain new token through /api/auth/refresh and repeat the request in question.


## Access control (authorization)

System maintains a list of permissions, each of which is defined by:

  - user id (or none if it applies to all users)
  - url prefix (or none if it applies to all urls)
  - method(s) (or none if it applies to all methods)

User's request is authorized if there exists a record which conforms to all of the above conditions.

This allows us to implement very different protections:

  - a superuser which can access everything (like the one generated through /admin/first/)
  - a readonly user which can access all account, but change nothing (for example, for support users)
  - a normal user, linked to one or multiple accounts
  - a readonly user, linked to a single account
  - resources which are publicly readable (that is, visible to every user)

# Values

## Sending values without timestamps (POST)

If you only need to supply a single value it might be easiest to use query parameters:

```
curl -X POST 'https://grafolean.com/api/accounts/<AccountId>/values/?p=<Path>&v=<Value>&b=<BotAPIToken>'
```

Often you might have multiple values you want to send in one call, so you just do:

```
curl \
    -X POST \
    -H 'Content-Type: application/json' \
    -d '[{p: "<Path>", v: <Value>}, ...]' \
    'https://grafolean.com/api/accounts/<AccountId>/values/?b=<BotAPIToken>'
```

Parameters:

    Path: defines a path that the value should be connected to (for example: `zone2.server1.cpu.load`). You are free to use whatever paths you wish, as long as
        they include only characters a-z, A-Z, 0-9, dash ('-'), underscore ('_') and dot ('.'), which is treated as a separator by the system. Maximum
        length is 200 characters.
    Value: numeric value. Only digits and dot ('.') as decimal separator are allowed. Only 6 decimal places are allowed for fractional digits.
    BotAPIToken: token to authenticate sender of values. Note that this token only allows sending data, but not modifying, querying or deleting it.

Note that there is no way to specify timestamp with POST requests (time is inferred for time of HTTP request). Specifying time wouldn't make sense anyway - alarms are only possible if the data is current. If you need to cache data and send it in batches, use PUT requests instead.

## Sending values with timestamps (PUT)

If one wishes to fill historical data or repair the values in the charts, PUT requests should be used. Note that this kind of requests will *not* trigger any alarms (that would be pointless for past events).

```
curl \
    -X PUT \
    -H 'Content-Type: application/json' \
    -d '[{"p": "<Path>", "t": <Timestamp>, "v": <Value>}, ...]' \
    'https://grafolean.com/api/accounts/<AccountId>/values/'
```

    Timestamp: will be used to insert data at a specific time. Note that HTTP request is idempotent - last value will overwrite the previous ones for a specified EntitySlug and Timestamp pair. If timestamp is floating point, it is rounded on 3 decimal places (millisecond)

Note that (as opposed to POST method) JWT token authentication should be used.

## Removing values (DELETE)

```
curl \
    -X DELETE \
    'https://grafolean.com/api/accounts/<AccountId>/values/?p=<Path>&t0=<TimestampFrom|TimestampsFrom>&t1=<TimestampTo>'
```

Note: not implemented yet.

Parameters:

    TimestampFrom: start timestamp (included)
    TimestampTo: end timestamp (included)
        Specify time interval for removal. Both parameters are mandatory. If you wish to remove whole history for the path, use values `0` and `9999999999`.

## Reading values (GET)

```
curl 'https://grafolean.com/api/accounts/<AccountId>/values/?p=<Path0[,Path1...]>&t0=<TimestampFrom>&t1=<TimestampTo>&a=<AggregationLevel>&sort=<SortAscDesc>&limit=<MaxResults>'
```

Parameters:

    PathN: path that the data was connected to
    TimestampFrom/TimestampsFrom: start timestamp/s; either a single timestamp (up to 10 digits) or a comma separated list of timestamps, one for each path
        (inclusive) (optional)
    TimestampTo: end timestamp (exclusive) (optional)
    AggregationLevel: values from 0 to 6 or string "no" are allowed. Aggregation level 0 returns one data point (average, min and max value) per hour. Every
        higher aggr. level returns one data point per 3-times as much time. In other words, level 1 returns one data point per 3 hours, level 2 per 9 hours,... and
        level 6 one data point per 3 ^ 6 hours or roughly 30 days. Special value "no" will return raw data (non-aggregated).
        Parameter is mandatory - if absent, server will respond with a 301 redirect to URL which includes default aggregation level for selected time interval (by default
        there will be fewer than 100 data points returned in almost all cases).
    SortAscDesc: 'asc' (default) / 'desc' (optional)
    MaxResults: (optional) number of returned results (max. 100000 - default).

    Note that timestamps (from, to) must be aligned depending on aggregation level, otherwise server will respond with status 400. For example, if using aggr.
    level 2, TimestampFrom must be evenly divisible by `3600 * (3 ^ 2)`.

    If requested time interval and aggr. level would return more than MaxResults results, incomplete response with only first MaxResults data points will
    be returned. In this case field "next_data_point" will mark the beginning of the next time interval so that client can repeat request with
    updated time interval.

JSON response:

{
    paths: {
        <Path0>: {
            next_data_point: null|<Timestamp>,  // if not null, use Timestamp as TimestampFrom to fetch another batch of data
            data: [
                { t: <Timestamp>, v: <AvgValue>, minv: <MinValue>, maxv: <MaxValue> }  // if data was aggregated
                { t: <Timestamp>, v: <Value> }  // if raw data was requested
            ]
        },
        ...
    }
}

# Paths

## Reading paths (GET)

```
curl \
    -X GET \
    'https://grafolean.com/api/accounts/<AccountId>/paths/?filter=<PathFilter>&limit=<MaxResults>&failover_trailing=<FailoverTrailing>'
```

Parameters:

    PathFilters: either explicit paths or filters (or start of them) which can try to match multiple paths by using wildcards. Wildcard '?' marks a single level arbitrary
        string (single level meaning: no dot). Wildcard '*' matches multiple levels. Examples: '*.cpu.load', 'zone1.dev12.port.?.traffic-in'. Mandatory, should not be empty.
        Multiple filters should be separated by comma (',').
    MaxResults: maximum number of paths returned for each chart (optional; 10 by default).
    FailoverTrailing: "true" or "false" (default). System will first attempt to determine matching paths as if the filter is complete. If no paths are found and
        this parameter is set to "true", system will repeat matching process as if the PathFilter is only partially entered and will try to match paths with possible
        trailing chars. These paths will then be returned in "paths_with_trailing" list. This is useful for auto-complete when user is entering a path filter in a form.

JSON response:

{
    paths: {
        <Filter0>: [
            <Path0>,
            ...
        ],
        ...
    }
    limit_reached: false,
    paths_with_trailing: {
        // only available if 'paths' is empty and parameter "failover_trailing" is set to "true"; same format as with 'paths'
    }
]

## Deleting paths and associated data (DELETE)

```
curl -X DELETE 'https://grafolean.com/api/accounts/<AccountId>/paths/?p=<Path>'
```

CAREFUL! This will also delete the measurements and aggregations.

# Dashboards

## Creating

```
curl \
    -X POST \
    -H 'Content-Type: application/json' \
    -d '{ \
        "name": <DashboardName>, \
        "slug": <DashboardSlug> \
    }' \
    'https://grafolean.com/api/accounts/<AccountId>/dashboards/'
```

Parameters:

    DashboardName: UTF-8 encoded name of the dashboard (non-UTF-8 strings will be rejected). Characters '<', '>', double and single quotes, and newlines
        will be removed. Name will also be stripped of trailing and leading spaces and tabs. Maximum string length is 200 characters.
    DashboardSlug: optional slug, made of lowercase letters ("a" to "z"), digits ("0" to "9") and hyphens ("-"). If not supplied it will be generated
        automatically from dashboard name. Must be unique, otherwise POST request will be rejected. Accepted slug will be returned in JSON response.

JSON response:

{
    "slug": <DashboardSlug>
}


## Reading

```
curl 'https://grafolean.com/api/accounts/<AccountId>/dashboards/'
```
## Updating

## Deleting


# Widgets

## Creating

```
curl \
    -X POST \
    -H 'Content-Type: application/json' \
    -d '{ \
        "type": <WidgetType>, \
        "title": <WidgetTitle>, \
        "content": <WidgetContent>, \
    }' \
    'https://grafolean.com/api/accounts/<AccountId>/dashboards/<DashboardSlug>/widgets'
```

Parameters:

    WidgetType: string - type of the widget. Note that server does *NOT* check this variable against any list. 50 chars max.

    WidgetTitle: string - title of the widget.

    WidgetContent: a JSON encoded string which specifies the contents of the widget. Note that server does *NOT* check either validity or contents of this variable,
        except that it is a valid UTF-8 string. However frontend expects specific schema for each widget type.

        With a chart widget, the content would be a JSON encoded array:
            [ \
                {
                    path_filter: <PathFilter0>, \
                    unit: <BaseUnit0>, \
                    metric_prefix: <MetricPrefix0> \
                }, \
                ...
            ]
        Where PathFilterN is either explicit path that should be included or a filter which matches multiple paths by using wildcards. Wildcard '?' marks a single level arbitrary
            string (single level meaning: no dot). Wildcard '*' matches multiple levels. Examples: '*.cpu.load', 'zone1.dev12.port.?.traffic-in'. Maximum of 50 filters per
            chart are allowed.

JSON response:

{
    id: <WidgetId>
}

## Updating

```
curl \
    -X PUT \
    -H 'Content-Type: application/json' \
    -d '{ \
        "name": <WidgetTitle>, \
        "content": [ \
            {
                path_filter: <PathFilter0>, \
                renaming: <Renaming0>, \
                unit: <BaseUnit0>, \
                metric_prefix: <MetricPrefix0> \
            }, \
            ...
        ], \
    }' \
    'https://grafolean.com/api/dashboards/<DashboardSlug>/widgets/<WidgetId>'
```


## Reading all widgets in dashboard

```
curl \
    -X GET \
    'https://grafolean.com/api/accounts/<AccountId>/dashboards/<DashboardSlug>/widgets?paths_limit=<PathsLimit>'
```

Parameters:

    PathsLimit: maximum number of paths returned for each widget (optional; 200 by default). This is a safeguard against too broad path filters. Field 'paths_limit_reached'
        will be set to `true` if the limit is exceeded.

JSON response:

{
    list: [
        {
            name: <WidgetTitle>,
            id: <WidgetId>,
            content: [
                {
                    path_filter: <PathFilter0>,
                    unit: <Unit0>,
                    metric_prefix: <MetricPrefix0>,
                    paths: [
                        ... // list of all the paths that match the specified path filter
                    ],
                    paths_limit_reached: true/false,
                },
            ]
        }
    ]
}

## Reading a widget

```
curl \
    -X GET \
    'https://grafolean.com/api/accounts/<AccountId>/dashboards/<DashboardSlug>/widgets/<WidgetId>?paths_limit=<PathsLimit>'
```

Parameters:

    PathsLimit: maximum number of paths returned for each widget (optional; 200 by default). This is a safeguard against too broad path filters. Field 'paths_limit_reached'
        will be set to `true` if the limit is exceeded.

JSON response:

{
    name: <WidgetTitle>,
    id: <WidgetId>,
    content: [
        {
            path_filter: <PathFilter0>,
            unit: <Unit0>,
            metric_prefix: <MetricPrefix0>,
            paths: [
                ... // list of all the paths that match the specified path filter
            ],
            paths_limit_reached: true/false,
        },
    ]
}

# Events

Often one wishes to mark events on charts (version upgrades, sensor detections,...).

## Writing labels

```
curl -X POST 'https://grafolean.com/api/accounts/<AccountId>/labels/?l=<Label>&e=<EntityBlob>'
```

Parameters:

    Label: short label (up to 64 UTF-8 characters)
    EntityBlob: denotes the entities that this event affects. Allowed modifiers are '*' (anything), '+' (any part between dots) or '?' (any character).

The same as with values, timestamp is inferred from the time of HTTP request.

```
curl -X PUT 'https://grafolean.com/api/accounts/<AccountId>/labels/?l=<Label>&t=<TimeStamp>&e=<EntityBlob>'
```
Note that Label + TimeStamp together identify a record. If you wish to change a label, you need to remove the record first and then insert it again.

```
curl -X DELETE 'https://grafolean.com/api/accounts/<AccountId>/labels/?l=<Label>&t=<TimeStamp>'
```

```
curl 'https://grafolean.com/api/accounts/<AccountId>/labels/?ts=<TimestampFrom>&te=<TimestampTo>'
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

# Accounts

## Creating
```
curl \
    -X POST \
    -H 'Content-Type: application/json' \
    -d '{ \
        "name": <AccountName> \
    }' \
    'https://grafolean.com/api/admin/accounts'
```

Response:

```
{
  id: <AccountId>
}
```

## Reading

```
curl https://grafolean.com/api/admin/accounts
```
Response:
```
{
    "list": [
        {
            "id": <AccountId>,
            "name": <AccountName>,
        },
        ...
    ]
}
```



# Persons



# Bots

```
curl \
    -X POST \
    -H 'Content-Type: application/json' \
    -d '{ \
        "name": <BotName> \
    }' \
    'https://grafolean.com/api/accounts/<AccountId>/bots'
```

Response:

```
{
  id: <BotId>,
  token: <BotAPIToken>
}
```
#!/bin/bash

set +v

# This file contains various workarounds that change running environment based on evironment
# variables. It would be nicer if we could convince various apps to use environment vars
# directly, but... there you have it.

# uWSGI doesn't pass environment variables (which are available in Docker container) to our
# backend. To fix this we run this script in entrypoint and save the env vars to .env file,
# from where we load them in the Python code itself (using dotenv package).
# The env vars must not be empty - if they are present, they must contain some value.
echo "" > /grafolean/backend/.env
[ -n "${MQTT_HOSTNAME}" ] && echo "MQTT_HOSTNAME=${MQTT_HOSTNAME}" >> /grafolean/backend/.env
[ -n "${MQTT_PORT}" ] && echo "MQTT_PORT=${MQTT_PORT}" >> /grafolean/backend/.env
[ -n "${MQTT_WS_HOSTNAME}" ] && echo "MQTT_WS_HOSTNAME=${MQTT_WS_HOSTNAME}" >> /grafolean/backend/.env
[ -n "${MQTT_WS_PORT}" ] && echo "MQTT_WS_PORT=${MQTT_WS_PORT}" >> /grafolean/backend/.env
[ -n "${GRAFOLEAN_CORS_DOMAINS}" ] && echo "GRAFOLEAN_CORS_DOMAINS=${GRAFOLEAN_CORS_DOMAINS}" >> /grafolean/backend/.env
[ -n "${TELEMETRY}" ] && echo "TELEMETRY=${TELEMETRY}" >> /grafolean/backend/.env

# telemetry details can be hard-coded and are public:
TELEMETRY_ACCOUNT="1990041850"
TELEMETRY_BOT_TOKEN="037cf5c0-20a9-4f2a-99b8-e07468a2b84b"
echo "TELEMETRY_ACCOUNT=${TELEMETRY_ACCOUNT}" >> /grafolean/backend/.env
echo "TELEMETRY_BOT_TOKEN=${TELEMETRY_BOT_TOKEN}" >> /grafolean/backend/.env

# depending on whether https certificates are available, include a bit different nginx config:
if [ -f /etc/certs/cert.crt ] && [ -f /etc/certs/cert.key ]
then
  cp /etc/nginx/grafolean.https.conf.disabled /etc/nginx/grafolean.https.conf
else
  cp /etc/nginx/grafolean.http.conf.disabled /etc/nginx/grafolean.http.conf
fi
# nginx doesn't (easily) support env vars in its config files, so we must replace them on startup:
sed -i "s/[$]MQTT_HOSTNAME/${MQTT_HOSTNAME}/g" /etc/nginx/grafolean.*.conf
# Content-Security-Policy is a bit awkward to use with websockets, because even if we have WS running
# on the same domain and port, the protocol is different. This means that we MUST specify the domain
# we will be running MQTT on, even if it is the same as the http(s) one.
if [ -n "${MQTT_WS_HOSTNAME}" ]
then
  if [ -n "${MQTT_WS_PORT}" ]
  then
    ALLOW_WS="ws://${MQTT_WS_HOSTNAME}:${MQTT_WS_PORT} wss://${MQTT_WS_HOSTNAME}:${MQTT_WS_PORT}"
  else
    ALLOW_WS="ws://${MQTT_WS_HOSTNAME} wss://${MQTT_WS_HOSTNAME}"
  fi
  echo "Setting Content-Security-Policy so that it allows connect-src: ${ALLOW_WS}"
  sed -i -r "s#connect-src ([^;]+);#connect-src \\1 ${ALLOW_WS};#g" /etc/nginx/grafolean.*.conf
  sed -i -r "s#connect-src ([^;]+);#connect-src \\1 ${ALLOW_WS};#g" /var/www/html/index.html
else
  echo "WARNING: MQTT_WS_HOSTNAME is not set, consequently Content-Security-Policy headers will disallow websockets connection."
  echo "To avoid further problems, exiting now with error."
  echo " - if you are using default Docker installation: set this to the domain or IP under which this container will be accessible"
  echo " - otherwise: set this to the domain or IP under which the MQTT broker's websocket service will be accessible, and don't"
  echo "   forget to set MQTT_WS_PORT too (unless it is the same as the port of backend - 80 or 443)"
  exit 1
fi

# for sharing secret tokens with systemwide bots running in paralled containers, we need to create
# a dir with enough permissions so that our www user can write and their users can read it:
mkdir -p /shared-secrets/tokens/
chown www-data:www-data /shared-secrets/tokens/
chmod 755 /shared-secrets/tokens/

if [ "${TELEMETRY}" != "none" ]
then
  echo "Telemetry: sending boot increment."
  curl -s --max-time 5 -X POST "https://app.grafolean.com/api/accounts/${TELEMETRY_ACCOUNT}/values/?b=${TELEMETRY_BOT_TOKEN}&p=telemetry.boot&v=1"
  echo "Telemetry: setting daily sending of 'up' signal."
  echo "11 3 * * * root  (echo 'Telemetry: sending daily signal.' && /usr/bin/curl -s -X POST 'https://app.grafolean.com/api/accounts/${TELEMETRY_ACCOUNT}/values/?b=${TELEMETRY_BOT_TOKEN}&p=telemetry.daily&v=1') >/proc/1/fd/1 2>/proc/1/fd/2" > /etc/cron.d/grafolean-telemetry
else
  echo "Telemetry: disabled, not sending anything."
fi

# we must exit with status code 0 or container won't start:
exit 0
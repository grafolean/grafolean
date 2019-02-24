#!/bin/bash

# uWSGI doesn't pass environment variables (which are available in Docker container) to our
# backend. To fix this we run this script in entrypoint and save the env vars to .env file,
# from where we load them in the Python code itself (using dotenv package).

echo "" > /grafolean/backend/.env
echo "MQTT_HOSTNAME=${MQTT_HOSTNAME}" >> /grafolean/backend/.env
echo "MQTT_PORT=${MQTT_PORT}" >> /grafolean/backend/.env
echo "MQTT_WS_HOSTNAME=${MQTT_WS_HOSTNAME}" >> /grafolean/backend/.env
echo "MQTT_WS_PORT=${MQTT_WS_PORT}" >> /grafolean/backend/.env
echo "MQTT_WS_SSL=${MQTT_WS_SSL}" >> /grafolean/backend/.env

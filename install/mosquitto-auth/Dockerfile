FROM alpine:3.8

ENV MOSQUITTO_VERSION=v1.5.5
# Latest released version of mosquitto-auth-plugin (0.1.3) has a bug in be_jwt.c (line 205 - can't free a static array) which causes build to fail. So we
# use the latest commit id instead, but we still want to pin it:
ENV MOSQUITTO_AUTH_PLUGIN_COMMIT_ID=1bc268535d526bfabea8dafb3a43d51bc5655b22

RUN \
    apk add --no-cache --virtual .build-dependencies git libressl build-base libressl-dev util-linux-dev libwebsockets-dev c-ares-dev curl-dev && \
    mkdir /build && \
    cd /build && \
    git clone -b ${MOSQUITTO_VERSION} https://github.com/eclipse/mosquitto.git && \
    cd mosquitto && \
    make WITH_SRV=yes WITH_ADNS=no WITH_DOCS=no WITH_MEMORY_TRACKING=no WITH_TLS_PSK=no WITH_WEBSOCKETS=yes WITH_PERSISTENCE=no install && \
    \
    cd /build && \
    git clone https://github.com/jpmens/mosquitto-auth-plug.git && \
    cd mosquitto-auth-plug && \
    git checkout ${MOSQUITTO_AUTH_PLUGIN_COMMIT_ID} && \
    cp config.mk.in config.mk && \
    sed -i -E 's/(BACKEND_[A-Z]+[ ]*[?]=[ ]*)yes/\1no/g' config.mk && \
    sed -i -E 's/(BACKEND_JWT+[ ]*[?]=[ ]*)no/\1yes/g' config.mk && \
    sed -i -E 's#^(MOSQUITTO_SRC+[ ]*=).*#\1 /build/mosquitto#g' config.mk && \
    make && \
    install -s -m755 auth-plug.so /usr/local/lib/ && \
    install -s -m755 np /usr/local/bin/ && \
    \
    rm -rf /build/ && \
    apk del .build-dependencies

RUN \
    apk add --no-cache libressl libuuid libwebsockets && \
    addgroup -S mosquitto && \
    adduser -S mosquitto -G mosquitto -D -H

ADD mosquitto.conf /etc/mosquitto/mosquitto.conf

EXPOSE 1883
EXPOSE 9883

USER mosquitto

ENTRYPOINT ["mosquitto"]


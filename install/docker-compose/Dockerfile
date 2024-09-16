# Prepare (build) frontend:
FROM node:12.22-buster-slim as build-frontend
WORKDIR /usr/src/app
# first copy just package.json & lock, so we don't re-install packages on every change:
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/. ./
ARG REACT_APP_BACKEND_ROOT_URL=/api
# block "zloirock is looking for a good job" core-js message:
ENV ADBLOCK=yes
RUN npm run build
# until we find a better solution, manually search and replace https://storage.googleapis.com/workbox-cdn/releases/3.6.2/workbox-sw.js
# with a local copy of the file: (to avoid using CDN)
#RUN sed -i -e 's#https://storage[.]googleapis[.]com/workbox-cdn/releases/[0-9.]*/workbox-sw.js#/workbox/workbox-sw.js#g' build/service-worker.js
RUN rm -rf build/workbox


FROM python:3.8-slim-buster as python-requirements
WORKDIR /grafolean/backend
COPY ./backend/Pipfile ./backend/Pipfile.lock /grafolean/backend/


# Prepare backend:
#  - /requirements.txt
#  - /api-doc.yml
#  - /grafolean/backend/
FROM python:3.8-slim-buster as build-backend
ARG VERSION="0.0.0"
WORKDIR /grafolean/backend
RUN \
    apt-get update && \
    apt-get install -q -y git && \
    pip install pipenv
# - prepare pip requirements.txt for backend:
COPY ./backend/Pipfile ./backend/Pipfile.lock /grafolean/backend/
RUN \
    pipenv requirements > /requirements.txt && \
    pipenv install --dev
# - build .py files to .pyc:
COPY ./backend/ /grafolean/backend/
RUN \
    find ./ -not -path "./static/*" -not -name '*.py' -type f -exec rm '{}' ';' && \
    rm -rf tests/ .vscode/ .pytest_cache/ __pycache__/ && \
    python3.8 -m compileall -b ./ && \
    find ./ -name '*.py' -exec rm '{}' ';'



FROM python:3.8-slim-buster
ARG VERSION
ARG VCS_REF
ARG BUILD_DATE
LABEL org.label-schema.vendor="Grafolean" \
      org.label-schema.url="https://grafolean.com/" \
      org.label-schema.name="Grafolean" \
      org.label-schema.description="Easy to use monitoring system" \
      org.label-schema.version=$VERSION \
      org.label-schema.vcs-url="https://github.com/grafolean/grafolean/" \
      org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.docker.schema-version="1.0"
ARG MQTT_HOSTNAME=""
ARG MQTT_PORT=1883
ENV MQTT_HOSTNAME=${MQTT_HOSTNAME}
ENV MQTT_PORT=${MQTT_PORT}
RUN \
    apt-get update && \
    apt-get install --no-install-recommends -q -y nginx git build-essential supervisor curl cron && \
    pip install gunicorn uvicorn && \
    apt-get purge -y build-essential && \
    apt-get clean autoclean && \
    apt-get autoremove --yes && \
    rm -rf /var/lib/{apt,dpkg,cache,log}/ /var/cache/apt/* /tmp/* && \
    echo "alias l='ls -altr'" >> /root/.bashrc
COPY --from=build-backend /requirements.txt /requirements.txt
RUN pip install -r /requirements.txt
COPY --from=build-frontend /usr/src/app/build /var/www/html
# nginx makes life complex when serving gzip content-encoded files, so we
# gzip them ahead of time and serve them with appropriate header:
RUN find /var/www/html/ -type f -exec gzip '{}' ';' -exec mv '{}'.gz '{}' ';'
COPY ./install/docker-compose/nginx.conf /etc/nginx/nginx.conf
COPY ./install/docker-compose/apply_env.sh /grafolean/apply_env.sh
COPY ./install/docker-compose/gunicorn.conf.py /etc/gunicorn.conf.py
COPY ./install/docker-compose/grafolean.nginx.conf.http /etc/nginx/grafolean.http.conf.disabled
COPY ./install/docker-compose/grafolean.nginx.conf.https /etc/nginx/grafolean.https.conf.disabled
COPY ./install/docker-compose/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY --from=build-backend /grafolean/backend/ /grafolean/backend/
RUN chmod +x /grafolean/apply_env.sh
WORKDIR /grafolean/backend
CMD ["supervisord"]


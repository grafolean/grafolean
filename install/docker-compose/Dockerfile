FROM node:10.15-jessie-slim as build-frontend
WORKDIR /usr/src/app
# first copy just package.json & lock, so we don't re-install packages on every change:
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install
COPY frontend/. ./
ARG REACT_APP_BACKEND_ROOT_URL=/api
RUN yarn build
# until we find a better solution, manually search and replace https://storage.googleapis.com/workbox-cdn/releases/3.6.2/workbox-sw.js
# with a local copy of the file: (to avoid using CDN)
RUN sed -i -e 's#https://storage[.]googleapis[.]com/workbox-cdn/releases/[0-9.]*/workbox-sw.js#/workbox/workbox-sw.js#g' build/service-worker.js


FROM python:3.6-slim-stretch as python-requirements
WORKDIR /grafolean/backend
COPY ./backend/Pipfile ./backend/Pipfile.lock /grafolean/backend/
RUN \
    pip install pipenv && \
    pipenv lock -r > /requirements.txt


FROM python:3.6-slim-stretch
RUN \
    apt-get update && \
    apt-get install --no-install-recommends -q -y nginx git && \
    apt-get install --no-install-recommends -q -y build-essential && \
    pip install uwsgi && \
    apt-get purge -y build-essential && \
    apt-get clean autoclean && \
    apt-get autoremove --yes && \
    rm -rf /var/lib/{apt,dpkg,cache,log}/
COPY --from=python-requirements /requirements.txt /requirements.txt
RUN pip install -r /requirements.txt
COPY --from=build-frontend /usr/src/app/build /var/www/html
COPY ./install/docker-compose/nginx.conf /etc/nginx/nginx.conf
COPY ./install/docker-compose/uwsgi.ini /etc/uwsgi.ini
COPY ./backend /grafolean/backend
WORKDIR /grafolean/backend
CMD ["/bin/bash", "-c", "service nginx start && uwsgi --ini /etc/uwsgi.ini"]


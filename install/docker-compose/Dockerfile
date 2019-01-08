FROM node:10.15-jessie-slim as build-frontend
WORKDIR /usr/src/app
# first copy just package.json & lock, so we don't re-install packages on every change:
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install
COPY frontend/. ./
ARG REACT_APP_BACKEND_ROOT_URL
RUN yarn build


FROM python:3.6
RUN \
    pip install uwsgi && \
    apt-get update && \
    apt-get install -q -y nginx && \
    apt-get clean autoclean && \
    apt-get autoremove --yes && \
    rm -rf /var/lib/{apt,dpkg,cache,log}/
COPY --from=build-frontend /usr/src/app/build /var/www/html
COPY ./install/docker-compose/nginx.conf /etc/nginx/nginx.conf
COPY ./install/docker-compose/uwsgi.ini /etc/uwsgi.ini
COPY ./backend /grafolean/backend
WORKDIR /grafolean/backend
RUN \
    pip install pipenv && \
    pipenv lock -r > requirements.txt && \
    pip install -r requirements.txt && \
    pip uninstall -y pipenv
CMD ["/bin/bash", "-c", "service nginx start && uwsgi --ini /etc/uwsgi.ini"]


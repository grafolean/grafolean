FROM python:3.6

RUN \
    pip install uwsgi && \
    apt-get update && \
    apt-get install -q -y nginx && \
    apt-get clean autoclean && \
    apt-get autoremove --yes && \
    rm -rf /var/lib/{apt,dpkg,cache,log}/

COPY ./docker/nginx.conf /etc/nginx/nginx.conf
COPY ./docker/uwsgi.ini /etc/uwsgi.ini
COPY ./ /grafolean
WORKDIR /grafolean
RUN \
    rm /etc/nginx/sites-enabled/default && \
    pip install pipenv && \
    pipenv lock -r > requirements.txt && \
    pip install -r requirements.txt && \
    pip uninstall -y pipenv

CMD ["/bin/bash", "-c", "service nginx start && uwsgi --ini /etc/uwsgi.ini"]


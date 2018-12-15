#!/bin/bash
docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=admin -e POSTGRES_USER=admin -e POSTGRES_DB=grafolean -v /var/www/grafolean/pgdata/:/var/lib/postgresql/data/ postgres:latest

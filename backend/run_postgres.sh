#!/bin/bash
docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=admin -e POSTGRES_USER=admin -e POSTGRES_DB=moonthor -v /var/www/moonthor/pgdata/:/var/lib/postgresql/data/ postgres:latest

# Performance optimization tips

Flame charts for Python:

1) download and install https://github.com/uber/pyflame
2) git clone https://github.com/brendangregg/FlameGraph /opt/FlameGraph
3) start listening for 60 s:
  $ sudo /opt/pyflame/src/pyflame -p 12345 -s 60 -r 0.01 | /opt/FlameGraph/flamegraph.pl > /tmp/test.svg
4) while listening, stress out app
5) open SVG in Firefox


PostgreSQL slow queries:

$ docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=admin -e POSTGRES_USER=admin -e POSTGRES_DB=moonthor \
  -v ./pgdata/:/var/lib/postgresql/data/ postgres:latest -c shared_preload_libraries=pg_stat_statements
$ docker exec -ti postgres bash
# psql -U admin moonthor
moonthor=# SELECT query,calls,total_time,mean_time,stddev_time,blk_read_time FROM pg_stat_statements ORDER BY total_time DESC;
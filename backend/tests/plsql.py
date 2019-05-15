#!/usr/bin/python3
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pytest

# since we are running our own environment for testing (use `docker-compose up -d` and
# `docker-compose down`), we need to setup env vars accordingly:
os.environ['DB_HOST'] = 'localhost'  # we expose to port 5432 on host (== localhost)
os.environ['DB_DATABASE'] = 'pytest'
os.environ['DB_USERNAME'] = 'pytest'
os.environ['DB_PASSWORD'] = 'pytest'
os.environ['MQTT_HOSTNAME'] = 'localhost'
os.environ['MQTT_PORT'] = '1883'

from utils import db, _construct_plsql_randid_function

def test_randid():
    """
        Create a test table, but when you create corresponding randid_testtable() function, alter it so it only allows integers 1 to 10, so
        that we can test that all 10 IDs are generated, and that 11th raises an exception.
    """
    with db.cursor() as c:
        create_func_sql = _construct_plsql_randid_function('testtable')
        create_func_sql = create_func_sql.replace('2147483647', '10')
        c.execute(create_func_sql)
        # print(create_func_sql)

        sql = "DROP TABLE IF EXISTS testtable CASCADE;"
        c.execute(sql)
        sql = "CREATE TABLE testtable (id INTEGER NOT NULL DEFAULT randid_testtable() PRIMARY KEY, a INTEGER);"
        c.execute(sql)

        for i in range(10):
            c.execute("INSERT INTO testtable (a) VALUES (%s);", (i,))

        try:
            c.execute("INSERT INTO testtable (a) VALUES (%s);", (999,))
            raise AssertionError("This should not succeed")
        except:
            pass

        c.execute("SELECT id FROM testtable ORDER BY id;")
        actual = [x for x, in c]
        expected = list(range(1, 11))
        assert actual == expected



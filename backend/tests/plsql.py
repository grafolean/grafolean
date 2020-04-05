#!/usr/bin/python3
import sys, os
import asyncpg
import pytest

# since we are running our own environment for testing (use `docker-compose up -d` and
# `docker-compose down`), we need to setup env vars accordingly:
os.environ['DB_HOST'] = 'localhost'  # we expose to port 5432 on host (== localhost)
os.environ['DB_DATABASE'] = 'pytest'
os.environ['DB_USERNAME'] = 'pytest'
os.environ['DB_PASSWORD'] = 'pytest'
os.environ['MQTT_HOSTNAME'] = 'localhost'
os.environ['MQTT_PORT'] = '1883'

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from grafolean import app
from utils import _construct_plsql_randid_function

@pytest.fixture
async def pool():
    return await asyncpg.create_pool(
        host=os.environ.get('DB_HOST', 'localhost'),
        database=os.environ.get('DB_DATABASE', 'grafolean'),
        user=os.environ.get('DB_USERNAME', 'admin'),
        password=os.environ.get('DB_PASSWORD', 'admin'),
        timeout=int(os.environ.get('DB_CONNECT_TIMEOUT', '10')),
    )


@pytest.mark.asyncio
async def test_randid(pool):
    """
        Create a test table, but when you create corresponding randid_testtable() function, alter it so it only allows integers 1 to 10, so
        that we can test that all 10 IDs are generated, and that 11th raises an exception.
    """
    async with pool.acquire() as c:
        create_func_sql = _construct_plsql_randid_function('testtable')
        create_func_sql = create_func_sql.replace('2147483647', '10')
        await c.execute(create_func_sql)
        # print(create_func_sql)

        sql = "DROP TABLE IF EXISTS testtable CASCADE;"
        await c.execute(sql)
        sql = "CREATE TABLE testtable (id INTEGER NOT NULL DEFAULT randid_testtable() PRIMARY KEY, a INTEGER);"
        await c.execute(sql)

        for i in range(10):
            await c.execute("INSERT INTO testtable (a) VALUES ($1);", i)

        try:
            await c.execute("INSERT INTO testtable (a) VALUES ($1);", 999)
            raise AssertionError("This should not succeed")
        except:
            pass

        res = await c.fetch("SELECT id FROM testtable ORDER BY id;")
        actual = [x for x, in res]
        expected = list(range(1, 11))
        assert actual == expected



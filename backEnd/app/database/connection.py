# app/database/connection.py
import time
from dbutils.pooled_db import PooledDB
import pymysql

from config.settings import settings
from config.logger import logger

def create_pool():
    return PooledDB(
        creator=pymysql,
        maxconnections=10,
        mincached=2,
        host=settings.DB_HOST,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME,
        port=settings.DB_PORT,
        charset='utf8mb4'
    )


def get_db_connection():
    retries = 3
    delay = 1
    for attempt in range(retries):
        try:
            conn = pool.connection()
            logger.debug(f"Successfully obtained database connection (attempt {attempt+1})")
            return conn
        except pymysql.OperationalError as e:
            logger.warning(f"Connection attempt {attempt+1} failed: {str(e)}")
            if attempt == retries - 1:
                raise
            time.sleep(delay * (attempt + 1))
    raise pymysql.OperationalError("Failed to obtain database connection after multiple attempts")



pool = create_pool()

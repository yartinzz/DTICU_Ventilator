#!/usr/bin/env python
"""
Author: yadian zhao
Institution: Canterbury University
Description: This module manages database connections using a connection pool.
             It creates a pool of connections and provides a method to retrieve a database connection
             with built-in retry logic.
"""

import time
from dbutils.pooled_db import PooledDB
import pymysql

from config.settings import settings
from config.logger import logger

def create_pool():
    """
    Create and return a database connection pool using dbutils' PooledDB.
    
    Returns:
        PooledDB: A pool of database connections configured with the provided settings.
    """
    return PooledDB(
        creator=pymysql,      # Use pymysql as the underlying DB-API module.
        maxconnections=10,    # Maximum number of connections that can be created.
        mincached=2,          # Minimum number of idle connections in the pool.
        host=settings.DB_HOST,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME,
        port=settings.DB_PORT,
        charset='utf8mb4'
    )

def get_db_connection():
    """
    Retrieve a database connection from the pool with retry logic.
    
    The function attempts to obtain a connection from the pool up to 3 times.
    If a connection attempt fails due to an OperationalError, it waits for an increasing delay
    before retrying.
    
    Returns:
        A database connection from the pool.
    
    Raises:
        pymysql.OperationalError: If all attempts fail to obtain a connection.
    """
    retries = 3
    delay = 1  # Initial delay in seconds between retries.
    for attempt in range(retries):
        try:
            conn = pool.connection()
            logger.debug(f"Successfully obtained database connection (attempt {attempt+1})")
            return conn
        except pymysql.OperationalError as e:
            logger.warning(f"Connection attempt {attempt+1} failed: {str(e)}")
            if attempt == retries - 1:
                # If this is the final attempt, re-raise the exception.
                raise
            # Wait for an increasing delay before the next retry.
            time.sleep(delay * (attempt + 1))
    # In case the loop completes without returning, raise an exception.
    raise pymysql.OperationalError("Failed to obtain database connection after multiple attempts")

# Initialize the connection pool when the module is loaded.
pool = create_pool()

#!/usr/bin/env python
"""
Author: yadian zhao
Institution: Canterbury University
Description: This module implements a pool for MATLAB engines.
             It preloads a number of MATLAB engines, manages their lifecycle,
             and provides a context manager for safely acquiring and releasing engines.
"""

import queue
import threading
import matlab.engine
from contextlib import contextmanager

from config.settings import settings
from config.logger import logger


class MatlabEnginePool:
    def __init__(self, pool_size):
        """
        Initialize the MATLAB Engine Pool.
        
        Parameters:
            pool_size (int): The number of MATLAB engines to maintain in the pool.
        """
        self.pool_size = pool_size
        # Queue to hold the MATLAB engine instances.
        self._pool = queue.Queue(maxsize=pool_size)
        # Lock for thread-safe operations (if needed in the future).
        self._lock = threading.Lock()
        # Flag indicating if the pool has been preloaded with MATLAB engines.
        self._initialized = False

    def preload_engines(self):
        """
        Preload the MATLAB engines into the pool during application startup.
        
        Each worker connects to MATLAB, adds the necessary MATLAB code path, and
        puts the engine instance into the pool.
        """
        def _worker():
            # Connect to a running MATLAB session.
            engine = matlab.engine.connect_matlab()
            # Add MATLAB code path as specified in settings.
            engine.addpath(settings.MATLAB_CODE_PATH, nargout=0)
            self._pool.put(engine)
        
        # Use ThreadPoolExecutor to preload MATLAB engines concurrently.
        from concurrent.futures import ThreadPoolExecutor, wait
        with ThreadPoolExecutor(max_workers=self.pool_size) as executor:
            futures = [executor.submit(_worker) for _ in range(self.pool_size)]
            wait(futures)
        
        self._initialized = True
        logger.info(f"Preheated {self.pool_size} MATLAB engines")

    @contextmanager
    def get_engine(self, timeout=None):
        """
        Context manager to acquire a MATLAB engine from the pool.
        
        Parameters:
            timeout (float, optional): The maximum time to wait for an available engine.
        
        Yields:
            matlab.engine.MatlabEngine: An acquired MATLAB engine.
            
        After the context is exited, the engine is automatically returned to the pool.
        
        Raises:
            queue.Empty: If no engine is available within the specified timeout.
        """
        try:
            # Attempt to get an engine from the pool.
            engine = self._pool.get(timeout=timeout)
            logger.debug(f"Acquired MATLAB engine in thread {threading.get_ident()}")
            # Clear the MATLAB workspace to avoid leftover state from previous usage.
            engine.eval("clear;", nargout=0)
            yield engine
        except queue.Empty:
            logger.error("No available MATLAB engine in the pool!")
            raise
        finally:
            # Return the engine back to the pool for reuse.
            self._pool.put(engine)
            logger.debug(f"Released MATLAB engine in thread {threading.get_ident()}")


# Global instance of the MatlabEnginePool using the size specified in settings.
ENGINE_POOL = MatlabEnginePool(settings.MATLAB_ENGINE_POOL_SIZE)

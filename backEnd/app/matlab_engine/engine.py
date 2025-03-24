# app/matlab_engine/engine_pool.py
import queue
import threading
import matlab.engine
from contextlib import contextmanager

from config.settings import settings
from config.logger import logger


class MatlabEnginePool:
    def __init__(self, pool_size):
        self.pool_size = pool_size
        self._pool = queue.Queue(maxsize=pool_size)
        self._lock = threading.Lock()
        self._initialized = False

    def preload_engines(self):
        """应用启动时预加载引擎池"""
        def _worker():
            engine = matlab.engine.connect_matlab()
            engine.addpath(settings.MATLAB_CODE_PATH, nargout=0)
            self._pool.put(engine)
        
        from concurrent.futures import ThreadPoolExecutor, wait
        with ThreadPoolExecutor(max_workers=self.pool_size) as executor:
            futures = [executor.submit(_worker) for _ in range(self.pool_size)]
            wait(futures)
        
        self._initialized = True
        logger.info(f"Preheated {self.pool_size} MATLAB engines")

    @contextmanager
    def get_engine(self, timeout=None):
        """
        获取一个 MATLAB 引擎，使用完毕后自动归还到池中。
        如果池为空，可设置 timeout 等待时间。
        """
        try:
            engine = self._pool.get(timeout=timeout)
            logger.debug(f"Acquired MATLAB engine in thread {threading.get_ident()}")
            # 清理状态，防止上次调用的残留
            engine.eval("clear;", nargout=0)
            yield engine
        except queue.Empty:
            logger.error("No available MATLAB engine in the pool!")
            raise
        finally:
            # 将引擎放回池中供其他任务使用
            self._pool.put(engine)
            logger.debug(f"Released MATLAB engine in thread {threading.get_ident()}")



ENGINE_POOL = MatlabEnginePool(settings.MATLAB_ENGINE_POOL_SIZE)
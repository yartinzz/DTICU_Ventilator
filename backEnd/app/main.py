# app/main.py
import uvicorn
import threading
import asyncio
import sys
import os

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from app.routers.ws_router import fastapp
from app.binlog.listener import binlog_listener, start_monitoring_active_params
from app.core.send_data import send_data_manager
from app.core.event_loop import main_event_loop
from app.matlab_engine.engine import ENGINE_POOL

if __name__ == "__main__":
    asyncio.set_event_loop(main_event_loop)

    ENGINE_POOL.preload_engines()
    
    monitor_thread = start_monitoring_active_params()
    
    # 启动 binlog 监听线程
    binlog_thread = threading.Thread(
        target=binlog_listener,
        name="BinlogListener",
        daemon=True
    )
    binlog_thread.start()
    
    config = uvicorn.Config(
        fastapp,
        host="0.0.0.0",
        port=8000,
        loop="asyncio",
        ws_ping_interval=3,
        ws_ping_timeout=3
    )
    
    server = uvicorn.Server(config)
    try:
        main_event_loop.run_until_complete(server.serve())
    finally:
        send_data_manager.shutdown()

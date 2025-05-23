
#!/usr/bin/env python
"""
Author: yadian zhao
Institution: Canterbury University
Description: This is the entry point of the application.
             It initializes the MATLAB engine pool, starts background threads for binlog listening and active
             parameter monitoring, and launches the FastAPI server using Uvicorn.
"""

import uvicorn
import threading
import asyncio
import sys
import os

# Set the project root path and add it to the Python path.
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

# Import the FastAPI application from the WebSocket router.
from app.routers.ws_router import fastapp
# Import binlog listener functions and active parameter monitoring.
from app.binlog.listener import binlog_listener, start_monitoring_active_params
# Import the send data manager for handling data events.
from app.core.send_data import send_data_manager
# Import the main event loop instance.
from app.core.event_loop import main_event_loop
# Import the MATLAB engine pool.
from app.matlab_engine.engine import ENGINE_POOL

if __name__ == "__main__":
    # Set the main event loop to be used by asyncio.
    asyncio.set_event_loop(main_event_loop)

    # Preload MATLAB engines for analysis.
    ENGINE_POOL.preload_engines()
    
    # Start a background thread to monitor active parameters.
    monitor_thread = start_monitoring_active_params()
    
    # Start the binlog listener in a separate daemon thread.

    binlog_thread = threading.Thread(
        target=binlog_listener,
        name="BinlogListener",
        daemon=True
    )
    binlog_thread.start()
    
    # Configure the Uvicorn server with FastAPI application settings.

    config = uvicorn.Config(
        fastapp,
        host="0.0.0.0",
        port=8000,
        loop="asyncio",
        ws_ping_interval=3,
        ws_ping_timeout=3
    )
    

    # Initialize the Uvicorn server with the given configuration.
    server = uvicorn.Server(config)
    try:
        # Run the Uvicorn server until it's stopped.
        main_event_loop.run_until_complete(server.serve())
    finally:
        # Shutdown the send data manager gracefully on exit.

        send_data_manager.shutdown()

#!/usr/bin/env python
"""
Author: yadian zhao
Institution: Canterbury University
Description: This module sets up the FastAPI websocket endpoint and router.
             It manages websocket connections by assigning unique user IDs,
             ensuring server capacity limits, and delegating connection handling
             to the designated handler function.
"""

import asyncio
import threading
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.websocket.handlers import handle_user
from config.settings import settings
from config.logger import logger

# Lock to protect access to the user ID counter.
user_id_lock = threading.Lock()
# Dictionary to keep track of active websocket tasks, mapping user_id to asyncio tasks.
user_threads = {}
# Global counter to assign a unique ID to each new user.
user_id_counter = 1

# Initialize the FastAPI application.
fastapp = FastAPI()

# Add CORS middleware to allow cross-origin requests.
fastapp.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Allow all origins.
    allow_credentials=True,
    allow_methods=["*"],      # Allow all HTTP methods.
    allow_headers=["*"],      # Allow all headers.
)

from fastapi import APIRouter

# Initialize an API router (this can be used to group related routes if needed).
router = APIRouter()

@fastapp.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for handling incoming websocket connections.
    
    This function performs the following steps:
      1. Assigns a unique user ID to the connection in a thread-safe manner.
      2. Checks if the current number of active connections exceeds the allowed maximum.
      3. Delegates the handling of the websocket connection to the 'handle_user' function.
      4. Ensures that resources associated with the connection are released upon disconnection.
      
    Parameters:
        websocket (WebSocket): The incoming websocket connection.
    """
    global user_id_counter
    # Acquire the lock to safely increment and assign the user ID.
    with user_id_lock:
        user_id = user_id_counter
        user_id_counter += 1

    # Check if the server has reached its maximum number of allowed websocket connections.
    if len(user_threads) >= settings.MAX_CONNECTIONS:
        logger.warning("Server capacity reached, rejecting connection")
        await websocket.close(code=4000, reason="Server overloaded")
        return

    try:
        # Create an asynchronous task to handle the user's websocket connection.
        task = asyncio.create_task(handle_user(websocket, user_id))
        # Store the task in the user_threads dictionary for tracking.
        user_threads[user_id] = task
        # Await the completion of the task handling the websocket connection.
        await task
    finally:
        # Once the connection is closed, remove the user's task from the tracking dictionary.
        user_threads.pop(user_id, None)
        logger.info(f"Released resources for user {user_id}")

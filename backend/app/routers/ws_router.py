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
from typing import Optional
from fastapi import FastAPI, HTTPException, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware


from app.websocket.handlers import handle_user
from config.settings import settings
from config.logger import logger
from app.database.queries import *

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
        task = asyncio.create_task(handle_user(websocket, user_id))
        user_threads[user_id] = task
        await task
    finally:
        user_threads.pop(user_id, None)
        logger.info(f"Released resources for user {user_id}")



@router.get("/patients")
def get_patients():
    return fetch_patients()

@router.get("/patients/{patient_id}")
def get_patient(patient_id: int):
    patient = fetch_patient_by_id(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@router.get("/patients/{patient_id}/records")
def get_patient_records_route(
    patient_id: int,
    record_type: Optional[str] = Query(None, description="type"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD")
):

    if record_type:
        records = fetch_patient_records_by_type(patient_id, record_type, start_date, end_date)
        return records
    else:
        all_records = fetch_patient_records(patient_id)
        return all_records

@router.get("/patients/{patient_id}/records/{record_id}")
def get_record_detail(patient_id: int, record_id: int):
    record = fetch_patient_record_detail(record_id)
    if not record or record["patient_id"] != patient_id:
        raise HTTPException(status_code=404, detail="Record not found")
    return record

@router.put("/patients/{patient_id}")
def update_patient(patient_id: int, patient_data: dict):
    rowcount = update_patient_info(patient_id, patient_data)
    if rowcount == 0:
        raise HTTPException(status_code=404, detail="Patient not found or no change")
    return {"msg": "Patient info updated successfully"}


@router.get("/patients/{patient_id}/peep_history")
def get_peep_history(patient_id: int):
    history = fetch_peep_history(patient_id)
    if history is None:
        raise HTTPException(status_code=404, detail="Peep history not found")
    return {"patient_id": patient_id, "history_peep": history}


fastapp.include_router(router)

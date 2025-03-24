#!/usr/bin/env python
"""
Author: yadian zhao
Institution: Canterbury University
Description: This module handles WebSocket connections and processes incoming messages.
             It supports actions such as fetching patient lists, subscribing to parameter updates,
             and performing MATLAB analysis (deltaPEEP analysis). It also manages active subscriptions
             and handles disconnections gracefully.
"""

import asyncio
from collections import defaultdict
import json
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime

from app.services.data_service import validate_analysis_params, process_matlab_analysis
from app.database.queries import fetch_patients
from config.logger import logger
from app.core.events import notifier
# Import the active parameters dictionary and its lock from the binlog listener module.
from app.binlog.listener import active_params, active_params_lock  

# Global dictionary to track active subscriptions.
# Structure: {websocket: {patient_id: param_types}}
global_current_tasks = defaultdict(dict)

async def handle_user(websocket: WebSocket, user_id):
    """
    Handle the communication with a connected WebSocket user.
    
    This function continuously listens for messages from the client and performs actions based on the message type:
      - "get_patients": Fetches the list of patients from the database.
      - "get_parameters": Checks the status of requested parameters and subscribes the user if active.
      - "analyze_deltaPEEP": Initiates MATLAB analysis for deltaPEEP.
      - "stop": Unsubscribes the user from all active subscriptions.
      
    In the case of disconnection, it ensures that the user's subscriptions are cleaned up.
    
    Parameters:
        websocket (WebSocket): The WebSocket connection instance.
        user_id (int): A unique identifier for the connected user.
    """
    await websocket.accept()
    logger.info(f"User {user_id} connected")
    
    try:
        while True:
            # Await a text message from the client.
            data = await websocket.receive_text()
            message = json.loads(data)
            logger.info(f"Received message from user {user_id}: {message['action']}")
            
            # Handle action to fetch patient list.
            if message["action"] == "get_patients":
                patients = fetch_patients()
                await websocket.send_text(json.dumps({
                    "type": "get_patient_list",
                    "status": "success",
                    "code": 200,
                    "message": "Patients fetched successfully",
                    "data": patients,
                    "timestamp": datetime.now().isoformat()
                }))
                logger.info(f"Sent patient list to user {user_id}")
            
            # Handle action to subscribe for parameter updates.
            if message["action"] == "get_parameters":
                patient_id = message["patient_id"]
                # Expected to be a list, e.g., ["pressure_flow", "ECG"]
                param_types = message["param_type"]
                
                # Check if each requested parameter is active.
                inactive = []
                with active_params_lock:
                    for param in param_types:
                        if (patient_id, param) not in active_params or not active_params[(patient_id, param)]["active"]:
                            inactive.append(param)
                
                if inactive:
                    # If any parameters are inactive, send a failure response.
                    await websocket.send_text(json.dumps({
                        "type": "get_parameters",
                        "param_type": param_types,
                        "status": "failure",
                        "code": 400,
                        "message": f"Current device not connected: {patient_id} -- {', '.join(inactive)} inactive",
                        "data": None,
                        "timestamp": datetime.now().isoformat()
                    }))
                    logger.info(f"Subscription rejected for patient {patient_id}: inactive parameters: {inactive}")
                else:
                    # Subscribe the websocket to active parameters.
                    notifier.subscribe(patient_id, param_types, websocket)
                    global_current_tasks[websocket][patient_id] = param_types
                    logger.info(f"Subscribed for patient {patient_id} with parameters {param_types}")
            
            # Handle action for MATLAB deltaPEEP analysis.
            elif message["action"] == "analyze_deltaPEEP":
                logger.info(f"Received deltaPEEP analysis request from user {user_id}")
                if not validate_analysis_params(message):
                    await websocket.send_text(json.dumps({
                        "type": "analyze_deltaPEEP",
                        "status": "failure",
                        "code": 400,  
                        "message": "Invalid parameters",
                        "data": None,
                        "timestamp": datetime.now().isoformat()
                    }))
                    continue
                
                # Create an asynchronous task to process MATLAB analysis.
                analysis_task = asyncio.create_task(
                    process_matlab_analysis(message, user_id, websocket)
                )
            
            # Handle action to stop all subscriptions.
            elif message["action"] == "stop":
                tasks = global_current_tasks.get(websocket, {})
                logger.info(f"Stopping tasks for user {user_id}: {list(tasks.keys())}")
                for pid in list(tasks.keys()):
                    notifier.unsubscribe(pid, [], websocket)
                if websocket in global_current_tasks:
                    del global_current_tasks[websocket]
                    
    except WebSocketDisconnect:
        # Clean up subscriptions when the client disconnects.
        if websocket in global_current_tasks:
            for pid in list(global_current_tasks[websocket].keys()):
                notifier.unsubscribe(pid, [], websocket)
            del global_current_tasks[websocket]
        logger.info(f"User {user_id} disconnected")

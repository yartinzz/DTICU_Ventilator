#!/usr/bin/env python
"""
Author: yadian zhao
Institution: Canterbury University
Description: This module provides services to process data analysis requests.
             It validates analysis parameters, communicates with MATLAB for analysis,
             and sends real-time feedback to clients via WebSocket.
"""

from datetime import datetime
import json
import uuid
from fastapi import WebSocket

from app.services.matlab_service import run_matlab_analysis
from config.logger import logger 

def validate_analysis_params(message):
    """
    Validate the analysis parameters received in the message.
    
    Checks for the presence of required keys and the expected length of data arrays.
    
    Parameters:
        message (dict): The analysis parameters received from the client.
        
    Returns:
        bool: True if the message contains valid parameters, False otherwise.
    """
    # Define the set of required keys.
    required = {"deltaPEEP", "pressureData", "flowData"}
    # Verify that all required keys are present.
    if not all(key in message for key in required):
        return False
    
    # Check that the data arrays have the expected length.
    if (len(message["pressureData"]) != 2501 or 
        len(message["flowData"]) != 2501):
        return False
    
    # Uncomment below to enforce type check for deltaPEEP if necessary.
    # if not isinstance(message["deltaPEEP"], int):
    #     return False
    
    return True

async def process_matlab_analysis(message, user_id, websocket: WebSocket):
    """
    Process MATLAB analysis for deltaPEEP analysis based on the provided parameters.
    
    This function performs the following steps:
      1. Generates a unique analysis ID.
      2. Sends a notification via WebSocket that the analysis has started.
      3. Validates and prepares the parameters for MATLAB analysis.
      4. Sends a progress update after data validation.
      5. Awaits the MATLAB analysis result.
      6. Sends a completion notification with the analysis result.
      7. Handles any exceptions and sends an error notification.
    
    Parameters:
        message (dict): The analysis parameters from the client.
        user_id (int or str): Identifier for the user requesting the analysis.
        websocket (WebSocket): The WebSocket connection for sending feedback messages.
    """
    analysis_id = str(uuid.uuid4())
    try:
        # Send initial notification indicating analysis has started.
        await websocket.send_text(json.dumps({
            "type": "analyze_deltaPEEP",
            "analysis_id": analysis_id,
            "status": "processing",
            "code": 200,
            "progress": 10,
            "message": "Analysis started",
            "data": None,
            "timestamp": datetime.now().isoformat()
        }))

        # Prepare parameters for MATLAB analysis.
        params = {
            "pressureData": message["pressureData"],
            "flowData": message["flowData"],
            "deltaPEEP": message["deltaPEEP"]
        }
        
        # Send progress update after data validation.
        await websocket.send_text(json.dumps({
            "type": "analyze_deltaPEEP",
            "analysis_id": analysis_id,
            "status": "processing",
            "code": 200,
            "progress": 20,
            "message": "Data validation passed",
            "data": None,
            "timestamp": datetime.now().isoformat()
        }))

        # Run MATLAB analysis asynchronously.
        result_dict = await run_matlab_analysis(params)
        
        # Send final notification indicating analysis completion with the result.
        await websocket.send_text(json.dumps({
            "type": "analyze_deltaPEEP",
            "analysis_id": analysis_id,
            "status": "success",
            "code": 200,
            "progress": 100,
            "message": "Analysis completed",
            "data": result_dict,
            "timestamp": datetime.now().isoformat()
        }))

    except Exception as e:
        # Log the error and notify the client about the failure.
        logger.error(f"Analysis failed for user {user_id}: {str(e)}")
        await websocket.send_text(json.dumps({
            "type": "analyze_deltaPEEP",
            "analysis_id": analysis_id,
            "status": "failure",
            "code": 500,
            "message": f"Analysis failed: {str(e)}",
            "data": None,
            "timestamp": datetime.now().isoformat()
        }))

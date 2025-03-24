#!/usr/bin/env python
"""
Author: yadian zhao
Institution: Canterbury University
Description: This module contains database query functions to fetch patient information and
             parameter data from the database. It uses a connection pool and handles potential
             errors during query execution.
"""

import json
from pymysql import OperationalError

from config.logger import logger
from app.database.connection import get_db_connection

def fetch_patients():
    """
    Fetch the list of patients from the database.
    
    This function retrieves the patient_id and name from the patient_info table.
    
    Returns:
        list: A list of tuples, where each tuple contains (patient_id, name) for a patient.
    
    Raises:
        OperationalError: If the database query fails.
    """
    logger.debug("Fetching patient list")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Execute SQL query to fetch patient information.
            cursor.execute("SELECT patient_id, name FROM patient_info")
            patients = cursor.fetchall()
        return patients
    except OperationalError as e:
        logger.error(f"Failed to fetch patients: {str(e)}")
        raise
    finally:
        # Always close the connection.
        conn.close()

def fetch_parameters(patient_id, last_checked_time):
    """
    Fetch the latest combined parameter data for a given patient.
    
    This function retrieves the latest record from the pressure_flow_params table for the specified
    patient_id, parses the JSON parameters, and returns the pressure and flow values along with the collection time.
    
    Parameters:
        patient_id: The unique identifier for the patient.
        last_checked_time: The last time the parameters were checked (currently not used in the query).
    
    Returns:
        tuple: A tuple containing:
               - A dictionary with keys "pressure", "flow", and "collection_time" if data is found,
                 or None if no data is available.
               - The collection time value or None.
    
    In case of errors (e.g., database issues, JSON parsing errors, or missing keys), the function logs the error and returns (None, None).
    """
    logger.debug(f"Fetching parameters for patient {patient_id}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            query = """
                SELECT 
                    parameters,
                    collection_time
                FROM pressure_flow_params
                WHERE patient_id = %s
                ORDER BY collection_time DESC
                LIMIT 1
            """
            # Execute the query with the specified patient_id.
            cursor.execute(query, (patient_id,))
            result = cursor.fetchone()
            
            # If no result is found, return None.
            if not result:
                return None, None
                
            # Parse the JSON data from the first column.
            params = json.loads(result[0])
            return {
                "pressure": params["pressure"]["values"],
                "flow": params["flow"]["values"],
                "collection_time": result[1]
            }, result[1]
    except (OperationalError, json.JSONDecodeError, KeyError) as e:
        logger.error(f"Error fetching parameters: {str(e)}")
        return None, None
    finally:
        # Always close the database connection.
        conn.close()

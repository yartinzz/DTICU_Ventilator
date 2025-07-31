#!/usr/bin/env python 
"""
Author: yadian zhao
Institution: Canterbury University
Description: This module listens to MySQL binlog events (specifically for pressure_flow_params, ecg_params, 
             mepap_sensor_params and other tables), processes incoming data rows, updates the data cache, 
             triggers data sending events, and monitors active parameters.
"""


# app/binlog/listener.py
import time
import json
from threading import Thread, Lock

from pymysqlreplication import BinLogStreamReader
from pymysqlreplication.row_event import WriteRowsEvent

from app.core.cache import data_cache
from app.core.send_data import send_data_manager
from config.logger import logger
from config.settings import settings
from app.core.events import notifier

# Dictionary to store active parameters and their last update timestamp.
# Structure: {(patient_id, param_type): {"active": bool, "last_update": timestamp}}
active_params = {}
# Lock for thread-safe access to active_params dictionary.
active_params_lock = Lock()


INACTIVITY_THRESHOLD = 20


def print_active_parameters():
    """
    Print the currently active parameters, grouped by patient ID.
    If there are no active parameters, log that no active devices are found.
    """
    grouped = {}
    with active_params_lock:
        # Group active parameters by patient_id.
        for (patient_id, param_type), info in active_params.items():
            if info["active"]:
                grouped.setdefault(patient_id, []).append(param_type)
    if not grouped:
        logger.info("Active device: No active parameters")
    else:
        for patient_id in sorted(grouped.keys()):
            params = grouped[patient_id]
            if params:
                logger.info(f"Active device: Patient {patient_id} --- " + ", ".join(params))
            else:
                logger.info(f"Active device: Patient {patient_id} --- None")


def monitor_active_params():
    """
    Continuously monitor the active parameters.
    If a parameter hasn't been updated within the INACTIVITY_THRESHOLD, mark it as inactive.
    Periodically prints the list of active parameters and logs subscription events.
    """
    while True:
        current_time = time.time()
        with active_params_lock:
            # Check each active parameter and update its status if needed.

            for key, info in list(active_params.items()):
                if info["active"] and (current_time - info["last_update"] > INACTIVITY_THRESHOLD):
                    logger.info(f"time: {current_time}, last_update: {info['last_update']}")
                    active_params[key]["active"] = False
                    logger.info(f"Active device: Patient {key[0]} --- {key[1]} is now inactive")
        print_active_parameters()
        # Log subscription events (using notifier).
        notifier._log_subscriptions()
        # Sleep for the threshold duration before next check.

        time.sleep(INACTIVITY_THRESHOLD)


def start_monitoring_active_params():
    """
    Start the monitoring thread for active parameters.
    
    Returns:
        Thread: The monitoring thread instance running in daemon mode.
    """

    monitor_thread = Thread(target=monitor_active_params, daemon=True)
    monitor_thread.start()
    return monitor_thread


def process_pressure_flow(values):
    param_type = "pressure_flow"
    raw_params = values["parameters"]
    
    decoded_params = {
        key.decode('utf-8'): {
            sub_key.decode('utf-8'): sub_val if not isinstance(sub_val, bytes)
            else sub_val.decode('utf-8')
            for sub_key, sub_val in value.items()
        }
        for key, value in raw_params.items()
    }

    pressure_values = [float(v) for v in decoded_params["pressure"]["values"]]
    flow_values = [float(v) for v in decoded_params["flow"]["values"]]
    
    data = {
        "pressure": {
            "unit": decoded_params["pressure"]["unit"],
            "values": pressure_values
        },
        "flow": {
            "unit": decoded_params["flow"]["unit"],
            "values": flow_values
        }
    }
    
    return param_type, data

def process_ecg(values):
    param_type = "ECG"
    raw_params = values["parameters"]
    
    decoded_params = {
        key.decode('utf-8'): {
            sub_key.decode('utf-8'): sub_val if not isinstance(sub_val, bytes)
            else sub_val.decode('utf-8')
            for sub_key, sub_val in value.items()
        }
        for key, value in raw_params.items()
    }
    
    ecg_values = [float(v) for v in decoded_params["ecg"]["values"]]
    emg_values = [float(v) for v in decoded_params["emg"]["values"]]
    impedance_values = [float(v) for v in decoded_params["impedance"]["values"]]
    eeg_values = [float(v) for v in decoded_params["eeg"]["values"]]
    
    data = {
        "ecg": {
            "unit": decoded_params["ecg"]["unit"],
            "values": ecg_values
        },
        "emg": {
            "unit": decoded_params["emg"]["unit"],
            "values": emg_values
        },
        "impedance": {
            "unit": decoded_params["impedance"]["unit"],
            "values": impedance_values
        },
        "eeg": {
            "unit": decoded_params["eeg"]["unit"],
            "values": eeg_values
        }
    }
    
    return param_type, data

def process_ella_sensor(values):
    param_type = "breath_cycle"
    raw_params = values["parameters"]
    
    if isinstance(raw_params, dict):
        decoded_params = raw_params
    elif isinstance(raw_params, bytes):
        decoded_params = json.loads(raw_params.decode('utf-8'))
    elif isinstance(raw_params, str):
        decoded_params = json.loads(raw_params)
    else:
        raise ValueError("Unsupported type for parameters in ella_sensor_params")
    
    return param_type, decoded_params

def process_mepap_sensor(values):
    """
    Process MePAP sensor data from the binlog event.
    
    Args:
        values: Dictionary containing the row values from mepap_sensor_params table
        
    Returns:
        tuple: (param_type, data) where param_type is "MePAP" and data contains 
               the expected and actual pressure values
    """
    param_type = "MePAP"
    raw_params = values["parameters"]
    
    # Handle different parameter formats (dict, bytes, string)
    if isinstance(raw_params, dict):
        decoded_params = raw_params
    elif isinstance(raw_params, bytes):
        decoded_params = json.loads(raw_params.decode('utf-8'))
    elif isinstance(raw_params, str):
        decoded_params = json.loads(raw_params)
    else:
        raise ValueError("Unsupported type for parameters in mepap_sensor_params")

    
    return param_type, decoded_params

def process_ecg_model(values):
    param_type = "ECG_QRS_INFO"
    
    raw_analysis = values["analysis_data"]
    if isinstance(raw_analysis, dict):
        analysis = raw_analysis
    elif isinstance(raw_analysis, bytes):
        analysis = json.loads(raw_analysis.decode('utf-8'))
    elif isinstance(raw_analysis, str):
        analysis = json.loads(raw_analysis)
    else:
        raise ValueError("Unsupported type for analysis_data")
    
    raw_vitals = values["vitals_data"]
    if isinstance(raw_vitals, dict):
        vitals = raw_vitals
    elif isinstance(raw_vitals, bytes):
        vitals = json.loads(raw_vitals.decode('utf-8'))
    elif isinstance(raw_vitals, str):
        vitals = json.loads(raw_vitals)
    else:
        raise ValueError("Unsupported type for vitals_data")
    
    data = {
        "analysis": analysis,
        "vitals": vitals
    }
    
    return param_type, data

def process_photodiode(values):
    param_type = "photodiode"
    raw_params = values["parameters"]

    
    if isinstance(raw_params, dict):
        params = raw_params
    elif isinstance(raw_params, bytes):
        params = json.loads(raw_params.decode('utf-8'))
    elif isinstance(raw_params, str):
        params = json.loads(raw_params)
    else:
        raise ValueError("Unsupported type for parameters in photodiode_params")
    
    return param_type, params

def process_binlog_event(event):
    if not isinstance(event, WriteRowsEvent):
        return
        
    for row in event.rows:
        try:
            values = row["values"]
            patient_id = values["patient_id"]
            collection_time = values["collection_time"]
            timestamp = collection_time.timestamp()
            
            handlers = {
                "pressure_flow_params": process_pressure_flow,
                "ecg_params": process_ecg,
                "ella_sensor_params": process_ella_sensor,
                "mepap_sensor_params": process_mepap_sensor,
                "ecg_model_output": process_ecg_model,
                "photodiode_params": process_photodiode
            }
            
            if event.table in handlers:
                param_type, data = handlers[event.table](values)
                
                data_cache.update_data(
                    patient_id=patient_id,
                    param_type=param_type,
                    data=data,
                    timestamp=timestamp
                )
                
                send_data_manager.add_event(
                    patient_id=patient_id,
                    param_type=param_type,
                    event_time=timestamp
                )
                
                with active_params_lock:
                    active_params[(patient_id, param_type)] = {
                        "active": True,
                        "last_update": timestamp
                    }
                    
        except KeyError as e:
            logger.error(f"Missing required field {str(e)} in {event.table} data")
        except UnicodeDecodeError as e:
            logger.error(f"Encoding error in {event.table}: {str(e)}")
        except ValueError as e:
            logger.error(f"Data conversion failed in {event.table}: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error processing {event.table}: {str(e)}")

def binlog_listener():
    """
    Listen to the MySQL binary log events and process WriteRowsEvent events.
    """
    stream = BinLogStreamReader(
        connection_settings={
            "host": settings.DB_HOST,
            "port": settings.DB_PORT,
            "user": settings.BINLOG_USER,
            "passwd": settings.BINLOG_PASSWORD
        },
        server_id=100,
        only_events=[WriteRowsEvent],
        blocking=True,
        resume_stream=True,
        only_tables=["pressure_flow_params", "ecg_params", "ella_sensor_params", 
                     "mepap_sensor_params", "ecg_model_output", "photodiode_params"] 
    )
    
    for event in stream:
        process_binlog_event(event)

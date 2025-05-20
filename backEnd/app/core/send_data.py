#!/usr/bin/env python
"""
Author: yadian zhao
Institution: Canterbury University
Description: This module manages sending data events to subscribed websockets.
             It uses a thread pool to process events from a queue and sends cached patient data
             to the appropriate websocket subscribers asynchronously.
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import queue
import base64

from app.core.events import notifier
from app.core.cache import data_cache
from config.logger import logger
from app.core.event_loop import main_event_loop

class SendDataManager:
    def __init__(self, max_workers=5):
        """
        Initialize the SendDataManager with a thread pool executor and an event queue.
        
        Parameters:
            max_workers (int): Maximum number of worker threads to process events.
        """
        self.queue = queue.Queue()
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.running = True
        # Start worker threads.
        for _ in range(max_workers):
            self.executor.submit(self.worker)

    def add_event(self, patient_id, param_type, event_time):
        """
        Add a data event to the queue if there are active websocket subscriptions
        for the given patient and parameter type.
        
        Parameters:
            patient_id: Unique identifier for the patient.
            param_type: The type of parameter (e.g., ECG, pressure_flow).
            event_time: Timestamp associated with the event.
        """
        # Only add the event if there are active subscriptions for the specified patient and parameter type.
        with notifier.lock:
            if (patient_id not in notifier.subscriptions or
                param_type not in notifier.subscriptions[patient_id] or
                not notifier.subscriptions[patient_id][param_type]):
                return
                
        event = {
            "patient_id": patient_id,
            "param_type": param_type,
            "event_time": event_time
        }
        self.queue.put(event)

    def worker(self):
        """
        Worker thread function to continuously process events from the queue.
        For each event, retrieve the corresponding cached data, build a message,
        and send it to all subscribed websockets asynchronously.
        """
        while self.running:
            try:
                event = self.queue.get(timeout=1)
                patient_id = event["patient_id"]
                param_type = event["param_type"]
                event_time = event["event_time"]
                
                # Retrieve the corresponding cached data using patient_id, param_type, and timestamp.
                cached_item = data_cache.get_data(
                    patient_id=patient_id,
                    param_type=param_type,
                    target_timestamp=event_time
                )
                
                if not cached_item:
                    continue



                def convert_bytes_keys(data):
                    if isinstance(data, dict):
                        return {str(k, 'utf-8') if isinstance(k, bytes) else k: convert_bytes_keys(v) for k, v in data.items()}
                    elif isinstance(data, list):
                        return [convert_bytes_keys(i) for i in data]
                    elif isinstance(data, bytes):
                        try:
                            return data.decode('utf-8')  
                        except UnicodeDecodeError:
                            return base64.b64encode(data).decode()  
                    else:
                        return data

                sanitized_data = convert_bytes_keys(cached_item["data"])


                sanitized_timestamp = (
                    cached_item["timestamp"].decode() 
                    if isinstance(cached_item["timestamp"], bytes) 
                    else cached_item["timestamp"]
                )

                subscribers = notifier.get_subscribers(patient_id, param_type)
                
                message = json.dumps({
                    "type": "get_parameters",
                    "param_type": param_type,
                    "status": "success",
                    "code": 200,
                    "message": "Data fetched successfully",
                    "data": sanitized_data,
                    "timestamp": sanitized_timestamp
                })

                for ws in subscribers:
                    asyncio.run_coroutine_threadsafe(
                        ws.send_text(message),
                        main_event_loop
                    )
                self.queue.task_done()


            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"Error in send_data worker: {str(e)}")
                continue

    def shutdown(self):
        self.running = False
        self.executor.shutdown(wait=True)

SEND_DATA_WORKERS = 5
send_data_manager = SendDataManager(max_workers=SEND_DATA_WORKERS)

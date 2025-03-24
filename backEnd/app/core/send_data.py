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
                
                # Get all subscribers for the given patient and parameter type.
                subscribers = notifier.get_subscribers(patient_id, param_type)
                
                # Build the JSON message to be sent to the subscriber.
                message = json.dumps({
                    "type": "get_parameters",
                    "param_type": param_type,
                    "status": "success",
                    "code": 200,
                    "message": "Data fetched successfully",
                    "data": cached_item["data"],
                    "timestamp": cached_item["timestamp"]
                })
                
                # Send the message to each subscribed websocket asynchronously.
                for ws in subscribers:
                    asyncio.run_coroutine_threadsafe(
                        ws.send_text(message),
                        main_event_loop
                    )
                # Mark the event as processed.
                self.queue.task_done()

            except queue.Empty:
                # No event in the queue; continue waiting.
                continue

    def shutdown(self):
        """
        Shutdown the SendDataManager by stopping the worker threads and shutting down the executor.
        """
        self.running = False
        self.executor.shutdown(wait=True)

# Global instance configuration and initialization.
SEND_DATA_WORKERS = 5
send_data_manager = SendDataManager(max_workers=SEND_DATA_WORKERS)

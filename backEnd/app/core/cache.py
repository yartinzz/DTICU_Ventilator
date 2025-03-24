#!/usr/bin/env python
"""
Author: yadian zhao
Institution: Canterbury University
Description: This module implements a caching system for patient data.
             It provides thread-safe operations to update and retrieve data for different parameters
             of a patient. The cache stores a fixed number of the latest records for each parameter.
"""

from collections import defaultdict, deque
from threading import Lock

class PatientDataCache:
    def __init__(self):
        # Initialize a nested dictionary cache:
        # Outer dict key: patient_id
        # Inner dict key: param_type, value: a deque with a maximum length of 10
        self._cache = defaultdict(lambda: defaultdict(lambda: deque(maxlen=10)))

        # Lock pool for thread-safe operations on each patient's parameter data.
        # Structure: {patient_id: {param_type: Lock}}
        self._lock_pool = defaultdict(lambda: defaultdict(Lock))
        # Dictionary to store the last updated timestamp for each patient parameter.
        self._last_updated = defaultdict(lambda: defaultdict(float))

    def update_data(self, patient_id, param_type, data, timestamp):
        """
        Update the cache with new data for a given patient and parameter type.
        
        Parameters:
            patient_id: Unique identifier for the patient.
            param_type: The type of parameter (e.g., ECG, pressure_flow).
            data: The data to store.
            timestamp: The time the data was recorded.
        """
        with self._lock_pool[patient_id][param_type]:
            # Append new data record with its timestamp to the deque.
            self._cache[patient_id][param_type].append({
                "data": data,
                "timestamp": timestamp
            })
            # Update the last updated timestamp for this parameter.
            self._last_updated[patient_id][param_type] = timestamp

    def get_data(self, patient_id, param_type, target_timestamp=None):
        """
        Retrieve data for a specific patient and parameter type.
        
        Parameters:
            patient_id: Unique identifier for the patient.
            param_type: The type of parameter.
            target_timestamp: Optional; if provided, returns the data with exactly this timestamp.
                              Otherwise, returns the latest data.
                              
        Returns:
            The data record matching the target timestamp, or the most recent record if no match is found.
            Returns None if no data exists.
        """
        with self._lock_pool[patient_id][param_type]:
            if not self._cache[patient_id][param_type]:
                return None
                
            # If no specific timestamp is provided, return the latest data record.
            if target_timestamp is None:
                return self._cache[patient_id][param_type][-1]
                
            # Iterate in reverse to find the record with the target timestamp.
            for item in reversed(self._cache[patient_id][param_type]):
                if item["timestamp"] == target_timestamp:
                    return item
            # If not found, return the most recent record.
            return self._cache[patient_id][param_type][-1]

    def get_last_timestamp(self, patient_id, param_type):
        """
        Retrieve the last updated timestamp for a given patient and parameter type.
        
        Parameters:
            patient_id: Unique identifier for the patient.
            param_type: The type of parameter.
            
        Returns:
            The last updated timestamp, or 0 if no record is found.
        """
        return self._last_updated[patient_id].get(param_type, 0)

# Global instance of the PatientDataCache for use across the application.
data_cache = PatientDataCache()

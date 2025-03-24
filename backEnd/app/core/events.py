#!/usr/bin/env python
"""
Author: yadian zhao
Institution: Canterbury University
Description: This module implements a notifier system for data updates.
             It manages subscriptions to patient data parameters over websockets,
             allowing clients to subscribe or unsubscribe to specific parameter updates.
             The notifier also logs subscription activities.
"""

from collections import defaultdict
import threading

from config.logger import logger


class DataUpdateNotifier:
    def __init__(self):
        # Three-level subscription structure:
        # patient_id -> param_type -> set of websockets subscribed to that parameter.
        self.subscriptions = defaultdict(lambda: defaultdict(set))
        # Lock to ensure thread-safe operations on the subscriptions dictionary.
        self.lock = threading.Lock()

    def subscribe(self, patient_id, param_types, websocket):
        """
        Subscribe a websocket to updates for specified parameter types of a patient.

        Parameters:
            patient_id: The unique identifier for the patient.
            param_types: A list of parameter types to subscribe to.
            websocket: The websocket connection to be subscribed.
        """
        with self.lock:
            for param in param_types:
                self.subscriptions[patient_id][param].add(websocket)
            logger.info(f"Subscribed: {patient_id}/{param_types}")
            # Log the current subscription list.
            self._log_subscriptions()

    def unsubscribe(self, patient_id, param_types, websocket):
        """
        Unsubscribe a websocket from updates for specified parameter types of a patient.
        If param_types is empty, unsubscribe from all parameters.

        Parameters:
            patient_id: The unique identifier for the patient.
            param_types: A list of parameter types to unsubscribe from. If empty, unsubscribe from all.
            websocket: The websocket connection to be unsubscribed.
        """
        with self.lock:
            # Handle unsubscribing from all parameters.
            if not param_types:
                for param in list(self.subscriptions[patient_id].keys()):
                    self._remove_subscription(patient_id, param, websocket)
                logger.info(f"{websocket} unsubscribed from all parameters")
                # Log the current subscription list.
                self._log_subscriptions()
                return

            # Handle unsubscribing from specified parameter types.
            for param in param_types:
                self._remove_subscription(patient_id, param, websocket)
                logger.info(f"{websocket} unsubscribed from {patient_id}/{param}")
            # Log the current subscription list.
            self._log_subscriptions()

    def _remove_subscription(self, patient_id, param_type, websocket):
        """
        Helper method to remove a websocket subscription for a given patient and parameter type.

        Parameters:
            patient_id: The unique identifier for the patient.
            param_type: The parameter type.
            websocket: The websocket connection to be removed.
        """
        if websocket in self.subscriptions[patient_id][param_type]:
            self.subscriptions[patient_id][param_type].remove(websocket)
            # Clean up empty sets.
            if not self.subscriptions[patient_id][param_type]:
                del self.subscriptions[patient_id][param_type]
            # Clean up patient record if no parameters remain.
            if not self.subscriptions[patient_id]:
                del self.subscriptions[patient_id]

    def get_subscribers(self, patient_id, param_type):
        """
        Retrieve a copy of the set of websockets subscribed to a specific patient's parameter.

        Parameters:
            patient_id: The unique identifier for the patient.
            param_type: The parameter type.

        Returns:
            A copy of the set containing the subscribed websockets.
        """
        with self.lock:
            return self.subscriptions[patient_id][param_type].copy()

    def _log_subscriptions(self):
        """
        Log the current subscriptions.
        Each line is formatted as: patient_id/param: websocket_id1, websocket_id2, ...
        """
        for patient_id, params in self.subscriptions.items():
            for param, websockets in params.items():
                ws_ids = [str(id(ws)) for ws in websockets]
                logger.info(f"{patient_id}/{param}: {', '.join(ws_ids)}")


# Global instance of the notifier for use across the application.
notifier = DataUpdateNotifier()

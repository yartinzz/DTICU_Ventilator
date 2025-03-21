# app/websocket/manager.py
from collections import defaultdict

class ConnectionManager:
    def __init__(self):
        self.active_connections = defaultdict(dict)

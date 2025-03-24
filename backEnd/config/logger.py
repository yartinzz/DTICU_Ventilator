#!/usr/bin/env python
"""
Author: yadian zhao
Institution: Canterbury University
Description: This module configures logging for the application.
             It sets up a rotating file handler and stream handler to capture log messages.
"""

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Create a directory for log files if it doesn't already exist.
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

# Configure the basic logging settings:
# - Log level is set to INFO.
# - Log format includes timestamp, log level, and the message.
# - Handlers: logs are written to a file and also output to the console.
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/medical_monitor.log'),
        logging.StreamHandler()
    ]
)

# Create a logger for this module.
logger = logging.getLogger(__name__)

#!/usr/bin/env python
"""
Author: yadian zhao
Institution: Canterbury University
Description: This module defines the application settings using environment variables.
             It uses pydantic-settings for type validation and dotenv to load environment variables.
"""

import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load environment variables from a .env file.
load_dotenv() 

class Settings(BaseSettings):
    # Database configuration
    DB_HOST: str = os.getenv("DB_HOST")
    DB_PORT: int = os.getenv("DB_PORT", 3306)
    DB_USER: str = os.getenv("DB_USER")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD")
    DB_NAME: str = os.getenv("DB_NAME")
    
    # MATLAB configuration: Path to MATLAB code.
    MATLAB_CODE_PATH: str = os.getenv("MATLAB_CODE_PATH")
    
    # Binlog configuration: Credentials for accessing the MySQL binlog.
    BINLOG_USER: str = os.getenv("BINLOG_USER")
    BINLOG_PASSWORD: str = os.getenv("BINLOG_PASSWORD")
    
    # Sampling rate for MATLAB analysis.
    SAMPLING_RATE: int = 125
    
    # Number of MATLAB engine instances to maintain in the pool.
    MATLAB_ENGINE_POOL_SIZE: int = 200
    
    # Maximum allowed WebSocket connections.
    MAX_CONNECTIONS: int = 1000
    

# Create a global settings instance to be used across the application.
settings = Settings()

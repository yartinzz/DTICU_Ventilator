# config/settings.py
import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv() 

class Settings(BaseSettings):
    DB_HOST: str = os.getenv("DB_HOST")
    DB_PORT: int = os.getenv("DB_PORT", 3306)
    DB_USER: str = os.getenv("DB_USER")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD")
    DB_NAME: str = os.getenv("DB_NAME")
    MATLAB_CODE_PATH: str = os.getenv("MATLAB_CODE_PATH")

    BINLOG_USER: str = os.getenv("BINLOG_USER")
    BINLOG_PASSWORD: str = os.getenv("BINLOG_PASSWORD")

    SAMPLING_RATE: int = 125
    MATLAB_ENGINE_POOL_SIZE: int = 200
    MAX_CONNECTIONS: int = 2000

    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY")


settings = Settings()
# config/logger.py
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

# 创建日志目录
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/medical_monitor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
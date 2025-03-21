import os
import json
from fastapi import WebSocket
import requests
from config.logger import logger
from datetime import datetime

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

async def handle_deepseek_request(message: str, websocket: WebSocket):
    try:
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "deepseek-chat",
            "messages": [{
                "role": "user",
                "content": message
            }],
            "temperature": 0.7
        }

        # 调用DeepSeek API
        response = requests.post(
            DEEPSEEK_API_URL,
            headers=headers,
            json=payload,
            timeout=30
        )
        response.raise_for_status()

        result = response.json()
        answer = result['choices'][0]['message']['content']

        # 通过WebSocket返回响应
        await websocket.send_text(json.dumps({
            "type": "deepseek_response",
            "status": "success",
            "code": 200,
            "message": "Success",
            "data": answer,
            "timestamp": datetime.now().isoformat()
        }))

    except requests.exceptions.RequestException as e:
        logger.error(f"DeepSeek API Error: {str(e)}")
        await websocket.send_text(json.dumps({
            "type": "deepseek_response",
            "status": "error",
            "code": 500,
            "message": f"API请求失败: {str(e)}",
            "data": None,
            "timestamp": datetime.now().isoformat()
        }))
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        await websocket.send_text(json.dumps({
            "type": "deepseek_response",
            "status": "error",
            "code": 500,
            "message": "内部服务器错误",
            "data": None,
            "timestamp": datetime.now().isoformat()
        }))
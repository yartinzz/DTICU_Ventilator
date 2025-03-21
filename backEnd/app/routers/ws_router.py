# app/routers/ws_router.py
import asyncio
import threading
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware


from app.websocket.handlers import handle_user
from config.settings import settings
from config.logger import logger


user_id_lock = threading.Lock()
user_threads = {}
user_id_counter = 1

fastapp = FastAPI()

fastapp.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import APIRouter

router = APIRouter()

@router.get("/ellaPage")
async def ellaPage():
    return {"message": "This is the new page!"}



@fastapp.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global user_id_counter
    with user_id_lock:
        user_id = user_id_counter
        user_id_counter += 1

    if len(user_threads) >= settings.MAX_CONNECTIONS:
        logger.warning("Server capacity reached, rejecting connection")
        await websocket.close(code=4000, reason="Server overloaded")
        return

    try:
        task = asyncio.create_task(handle_user(websocket, user_id))
        user_threads[user_id] = task
        await task
    finally:
        user_threads.pop(user_id, None)
        logger.info(f"Released resources for user {user_id}")
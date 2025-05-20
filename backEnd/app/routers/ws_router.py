# app/routers/ws_router.py
import asyncio
import threading
from typing import Optional
from fastapi import FastAPI, HTTPException, Query, WebSocket
from fastapi.middleware.cors import CORSMiddleware


from app.websocket.handlers import handle_user
from config.settings import settings
from config.logger import logger
from app.database.queries import *


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

# ==================== HTTP 路由 ====================

@router.get("/patients")
def get_patients():
    """
    获取所有患者列表
    """
    return fetch_patients()

@router.get("/patients/{patient_id}")
def get_patient(patient_id: int):
    """
    获取指定患者的基本信息
    """
    patient = fetch_patient_by_id(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@router.get("/patients/{patient_id}/records")
def get_patient_records_route(
    patient_id: int,
    record_type: Optional[str] = Query(None, description="记录类型，如 'diagnosis' 等"),
    start_date: Optional[str] = Query(None, description="起始时间，格式：YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束时间，格式：YYYY-MM-DD")
):
    """
    获取指定患者的记录列表：
      - 如果不传 record_type，则返回该患者所有类型的记录
      - 如果传了 record_type，可再用 start_date, end_date 做时间范围过滤
    """
    if record_type:
        # 根据类型和时间范围获取记录列表
        records = fetch_patient_records_by_type(patient_id, record_type, start_date, end_date)
        return records
    else:
        # 不分类型，返回所有记录
        all_records = fetch_patient_records(patient_id)
        return all_records

@router.get("/patients/{patient_id}/records/{record_id}")
def get_record_detail(patient_id: int, record_id: int):
    """
    获取某条记录的详细信息
    """
    record = fetch_patient_record_detail(record_id)
    if not record or record["patient_id"] != patient_id:
        raise HTTPException(status_code=404, detail="Record not found")
    return record

@router.put("/patients/{patient_id}")
def update_patient(patient_id: int, patient_data: dict):
    """
    更新指定患者的基本信息
    """
    rowcount = update_patient_info(patient_id, patient_data)
    if rowcount == 0:
        raise HTTPException(status_code=404, detail="Patient not found or no change")
    return {"msg": "Patient info updated successfully"}


@router.get("/patients/{patient_id}/peep_history")
def get_peep_history(patient_id: int):
    """
    获取指定患者的“peep”历史数据
    """
    # fetch_peep_history 由您在 app.database.queries 中实现
    history = fetch_peep_history(patient_id)
    if history is None:
        raise HTTPException(status_code=404, detail="Peep history not found")
    return {"patient_id": patient_id, "history_peep": history}




# 将 router 注册到 fastapp
fastapp.include_router(router)
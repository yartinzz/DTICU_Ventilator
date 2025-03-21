# app/websocket/handlers.py
import asyncio
from collections import defaultdict
import json
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime
from app.services.data_service import validate_analysis_params, process_matlab_analysis
from app.database.queries import fetch_patients
from app.services.deepseek_service import handle_deepseek_request
from config.logger import logger
from app.core.events import notifier
# 从 binlog 监听模块中引入活跃参数表及其锁
from app.binlog.listener import active_params, active_params_lock  

# 用于记录活跃订阅：结构 {websocket: {patient_id: param_types}}
global_current_tasks = defaultdict(dict)

async def handle_user(websocket: WebSocket, user_id):
    await websocket.accept()
    logger.info(f"User {user_id} connected")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            logger.info(f"Received message from user {user_id}: {message['action']}")
            
            if message["action"] == "get_patients":
                patients = fetch_patients()
                await websocket.send_text(json.dumps({
                    "type": "get_patient_list",
                    "status": "success",
                    "code": 200,
                    "message": "Patients fetched successfully",
                    "data": patients,
                    "timestamp": datetime.now().isoformat()
                }))
                logger.info(f"Sent patient list to user {user_id}")
            
            if message["action"] == "get_parameters":
                patient_id = message["patient_id"]
                param_types = message["param_type"]  # 期望为一个列表，例如 ["pressure_flow", "ECG"]
                
                # 检查每个请求的参数类型是否处于活跃状态
                inactive = []
                with active_params_lock:
                    for param in param_types:
                        if (patient_id, param) not in active_params or not active_params[(patient_id, param)]["active"]:
                            inactive.append(param)
                
                if inactive:
                    # 返回失败 JSON 信息
                    await websocket.send_text(json.dumps({
                        "type": "get_parameters",
                        "param_type": param_types,
                        "status": "failure",
                        "code": 400,
                        "message": f"Current device not connected: {patient_id} -- {', '.join(inactive)} inactive",
                        "data": None,
                        "timestamp": datetime.now().isoformat()
                    }))
                    logger.info(f"Subscription rejected for patient {patient_id}: inactive parameters: {inactive}")
                else:
                    # 若所有参数均处于活跃状态，则进行订阅
                    notifier.subscribe(patient_id, param_types, websocket)
                    global_current_tasks[websocket][patient_id] = param_types
                    logger.info(f"Subscribed for patient {patient_id} with parameters {param_types}")
            
            elif message["action"] == "analyze_deltaPEEP":
                logger.info(f"Received deltaPEEP analysis request from user {user_id}")
                if not validate_analysis_params(message):
                    await websocket.send_text(json.dumps({
                        "type": "analyze_deltaPEEP",
                        "status": "failure",
                        "code": 400,  
                        "message": "Invalid parameters",
                        "data": None,
                        "timestamp": datetime.now().isoformat()
                    }))
                    continue
                
                analysis_task = asyncio.create_task(
                    process_matlab_analysis(message, user_id, websocket)
                )
            
            elif message["action"] == "stop":
                tasks = global_current_tasks.get(websocket, {})
                logger.info(f"Stopping tasks for user {user_id}: {list(tasks.keys())}")
                for pid in list(tasks.keys()):
                    notifier.unsubscribe(pid, [], websocket)
                if websocket in global_current_tasks:
                    del global_current_tasks[websocket]



            elif message["action"] == "deepseek_chat":
                logger.info(f"Received DeepSeek request from user {user_id}")
                asyncio.create_task(
                    handle_deepseek_request(message["message"], websocket)
                )
                    
    except WebSocketDisconnect:
        if websocket in global_current_tasks:
            for pid in list(global_current_tasks[websocket].keys()):
                notifier.unsubscribe(pid, [], websocket)
            del global_current_tasks[websocket]

        logger.info(f"User {user_id} disconnected")

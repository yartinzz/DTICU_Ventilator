# app/websocket/handlers.py
import asyncio
from collections import defaultdict
import json
import random
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime, timedelta
from app.services.data_service import validate_analysis_params, process_matlab_analysis
from app.database.queries import fetch_patients, store_peep_snapshot, fetch_peep_history
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
                param_types = message["param_type"]  # 例如 ["pressure_flow", "ECG"] 或 ["breath_cycle"]
                
                # 检查请求的每个参数类型是否处于活跃状态
                inactive = []
                with active_params_lock:
                    for param in param_types:
                        if (patient_id, param) not in active_params or not active_params[(patient_id, param)]["active"]:
                            inactive.append(param)
                
                if inactive:
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


            elif message["action"] == "store_peep_snapshot":


                raw_rec_time = message.get("record_time")
                dt = datetime.fromisoformat(raw_rec_time.replace("Z", "+00:00"))
                rec_time_str = dt.strftime("%Y-%m-%d %H:%M:%S")

                pid      = message.get("patient_id")
                avg_cur  = message.get("avg_current_peep")
                avg_rec  = message.get("avg_recommended_peep")

                # 随机填充其余字段（或用 None）
                bg        = round(random.uniform(4.0, 8.0), 2)
                ph_val    = round(random.uniform(7.35, 7.45), 3)
                ins_sens  = round(random.uniform(0.5, 2.0), 4)
                total_bt  = random.randint(10, 20)
                abn_bt    = random.randint(0, 5)

                if avg_cur is not None or avg_rec is not None:
                    store_peep_snapshot(
                        patient_id=pid,
                        record_time=rec_time_str,
                        avg_current_peep=avg_cur,
                        avg_recommended_peep=avg_rec,
                        blood_glucose=bg,
                        ph=ph_val,
                        insulin_sensitivity=ins_sens,
                        total_breaths=total_bt,
                        abnormal_breaths=abn_bt
                    )
                else:
                    logger.info(f"Skipped storing PEEP snapshot for patient={pid} due to null values.")


                # 2) 取过去 12 小时的历史 PEEP
                history = fetch_peep_history(pid)

                # 3) 拆成三个数组
                times             = [h["record_time"]       for h in history]
                current_peeps     = [h["current_peep"]       for h in history]
                recommended_peeps = [h["recommended_peep"]   for h in history]

                # 4) 返回给前端
                await websocket.send_text(json.dumps({
                    "type":      "peep_history",
                    "status":    "success",
                    "code":      200,
                    "message":   "PEEP history (last 12h)",
                    "data": {
                        "times": times,
                        "current_peep": current_peeps,
                        "recommended_peep": recommended_peeps
                    },
                    "timestamp": datetime.now().isoformat()
                }))
                logger.info(f"Returned 12h PEEP history for patient {pid}")
                    
    except WebSocketDisconnect:
        if websocket in global_current_tasks:
            for pid in list(global_current_tasks[websocket].keys()):
                notifier.unsubscribe(pid, [], websocket)
            del global_current_tasks[websocket]
        logger.info(f"User {user_id} disconnected")


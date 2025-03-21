# app/services/data_service.py
from datetime import datetime
import json
import uuid
from fastapi import WebSocket


from app.services.matlab_service import run_matlab_analysis
from config.logger import logger 

# 新增辅助函数
def validate_analysis_params(message):
    """验证分析参数有效性"""
    required = {"deltaPEEP", "pressureData", "flowData"}
    if not all(key in message for key in required):
        return False
    
    if (len(message["pressureData"]) != 2501 or 
        len(message["flowData"]) != 2501):
        return False
    
    # if not isinstance(message["deltaPEEP"], int):
    #     return False
    
    return True

# ===== WebSocket反馈增强 =====
async def process_matlab_analysis(message, user_id, websocket: WebSocket):

    analysis_id = str(uuid.uuid4())
    try:
        # 发送分析开始通知
        await websocket.send_text(json.dumps({
            "type": "analyze_deltaPEEP",
            "analysis_id": analysis_id,
            "status": "processing",
            "code": 200,
            "progress": 10,
            "message": "Analysis started",
            "data": None,
            "timestamp": datetime.now().isoformat()
        }))

        params = {
            "pressureData": message["pressureData"],
            "flowData": message["flowData"],
            "deltaPEEP": message["deltaPEEP"]
        }
        
        # 发送进度更新
        await websocket.send_text(json.dumps({
            "type": "analyze_deltaPEEP",
            "analysis_id": analysis_id,
            "status": "processing",
            "code": 200,
            "progress": 20,
            "message": "Data validation passed",
            "data": None,
            "timestamp": datetime.now().isoformat()
        }))

        result_dict = await run_matlab_analysis(params)
        

        # 发送完成通知
        await websocket.send_text(json.dumps({
            "type": "analyze_deltaPEEP",
            "analysis_id": analysis_id,
            "status": "success",
            "code": 200,
            "progress": 100,
            "message": "Analysis completed",
            "data": result_dict,
            "timestamp": datetime.now().isoformat()
        }))

    except Exception as e:
        logger.error(f"Analysis failed for user {user_id}: {str(e)}")
        await websocket.send_text(json.dumps({
            "type": "analyze_deltaPEEP",
            "analysis_id": analysis_id,
            "status": "failure",
            "code": 500,
            "message": f"Analysis failed: {str(e)}",
            "data": None,
            "timestamp": datetime.now().isoformat()
        }))
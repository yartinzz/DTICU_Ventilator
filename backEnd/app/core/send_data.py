import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import queue
import base64

from app.core.events import notifier
from app.core.cache import data_cache
from config.logger import logger
from app.core.event_loop import main_event_loop

class SendDataManager:
    def __init__(self, max_workers=5):
        self.queue = queue.Queue()
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.running = True
        for _ in range(max_workers):
            self.executor.submit(self.worker)

    def add_event(self, patient_id, param_type, event_time):
        with notifier.lock:
            if (patient_id not in notifier.subscriptions or
                param_type not in notifier.subscriptions[patient_id] or
                not notifier.subscriptions[patient_id][param_type]):
                return
                
        event = {
            "patient_id": patient_id,
            "param_type": param_type,
            "event_time": event_time
        }
        self.queue.put(event)

    def worker(self):
        while self.running:
            try:
                event = self.queue.get(timeout=1)
                patient_id = event["patient_id"]
                param_type = event["param_type"]
                event_time = event["event_time"]
                
                # 获取数据
                cached_item = data_cache.get_data(
                    patient_id=patient_id,
                    param_type=param_type,
                    target_timestamp=event_time
                )
                
                if not cached_item:
                    continue



                def convert_bytes_keys(data):
                    if isinstance(data, dict):
                        # 将字节串键转换为字符串
                        return {str(k, 'utf-8') if isinstance(k, bytes) else k: convert_bytes_keys(v) for k, v in data.items()}
                    elif isinstance(data, list):
                        # 递归处理列表中的数据
                        return [convert_bytes_keys(i) for i in data]
                    elif isinstance(data, bytes):
                        # 如果是字节串，解码为字符串
                        try:
                            return data.decode('utf-8')  # 解码为 UTF-8 字符串
                        except UnicodeDecodeError:
                            return base64.b64encode(data).decode()  # 如果解码失败，使用 Base64 编码
                    else:
                        return data

                sanitized_data = convert_bytes_keys(cached_item["data"])


                
                # 处理 timestamp 字段，确保其是字符串
                sanitized_timestamp = (
                    cached_item["timestamp"].decode() 
                    if isinstance(cached_item["timestamp"], bytes) 
                    else cached_item["timestamp"]
                )


                # 获取订阅者
                subscribers = notifier.get_subscribers(patient_id, param_type)
                
                # 构建消息
                message = json.dumps({
                    "type": "get_parameters",
                    "param_type": param_type,
                    "status": "success",
                    "code": 200,
                    "message": "Data fetched successfully",
                    "data": sanitized_data,
                    "timestamp": sanitized_timestamp
                })

                # 发送消息
                for ws in subscribers:
                    asyncio.run_coroutine_threadsafe(
                        ws.send_text(message),
                        main_event_loop
                    )
                self.queue.task_done()


            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"Error in send_data worker: {str(e)}")
                continue

    def shutdown(self):
        self.running = False
        self.executor.shutdown(wait=True)

SEND_DATA_WORKERS = 5
send_data_manager = SendDataManager(max_workers=SEND_DATA_WORKERS)

import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import queue

from app.core.events import notifier
from app.core.cache import data_cache
from config.logger import logger
from app.core.event_loop import main_event_loop

class SendDataManager:
    def __init__(self, max_workers=5):
        self.queue = queue.Queue()
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.running = True
        # 启动工作线程
        for _ in range(max_workers):
            self.executor.submit(self.worker)

    def add_event(self, patient_id, param_type, event_time):
        # 仅当该 patient_id 下存在该 param_type 的 websocket 订阅时，才加入事件队列
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
                
                # 获取对应数据
                cached_item = data_cache.get_data(
                    patient_id=patient_id,
                    param_type=param_type,
                    target_timestamp=event_time
                )
                
                if not cached_item:
                    continue
                    
                subscribers = notifier.get_subscribers(patient_id, param_type)
                
                # 构建消息
                message = json.dumps({
                    "type": "get_parameters",
                    "param_type": param_type,
                    "status": "success",
                    "code": 200,
                    "message": "Data fetched successfully",
                    "data": cached_item["data"],
                    "timestamp": cached_item["timestamp"]
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

    def shutdown(self):
        self.running = False
        self.executor.shutdown(wait=True)

SEND_DATA_WORKERS = 5
send_data_manager = SendDataManager(max_workers=SEND_DATA_WORKERS)
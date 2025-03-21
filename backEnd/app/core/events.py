# app/core/events.py
from collections import defaultdict
import threading

from config.logger import logger


class DataUpdateNotifier:
    def __init__(self):
        # 三级订阅结构：patient_id -> param_type -> websockets
        self.subscriptions = defaultdict(lambda: defaultdict(set))
        self.lock = threading.Lock()

    def subscribe(self, patient_id, param_types, websocket):
        """订阅特定参数类型"""
        with self.lock:
            for param in param_types:
                self.subscriptions[patient_id][param].add(websocket)
            logger.info(f"Subscribed: {patient_id}/{param_types}")
            # 打印当前订阅列表
            self._log_subscriptions()

    def unsubscribe(self, patient_id, param_types, websocket):
        """取消订阅"""
        with self.lock:
            # 处理全部取消的情况
            if not param_types:
                for param in list(self.subscriptions[patient_id].keys()):
                    self._remove_subscription(patient_id, param, websocket)
                logger.info(f"{websocket} unsubscribed from all parameters")
                # 打印当前订阅列表
                self._log_subscriptions()
                return

            # 处理指定参数类型取消
            for param in param_types:
                self._remove_subscription(patient_id, param, websocket)
                logger.info(f"{websocket} unsubscribed from {patient_id}/{param}")
            # 打印当前订阅列表
            self._log_subscriptions()

    def _remove_subscription(self, patient_id, param_type, websocket):
        """实际移除订阅的辅助方法"""
        if websocket in self.subscriptions[patient_id][param_type]:
            self.subscriptions[patient_id][param_type].remove(websocket)
            # 清理空集合
            if not self.subscriptions[patient_id][param_type]:
                del self.subscriptions[patient_id][param_type]
            # 清理空患者记录
            if not self.subscriptions[patient_id]:
                del self.subscriptions[patient_id]

    def get_subscribers(self, patient_id, param_type):
        """获取指定参数的订阅者"""
        with self.lock:
            return self.subscriptions[patient_id][param_type].copy()

    def _log_subscriptions(self):
        """逐行打印当前订阅列表，每行格式： patient_id/param: websocket_id1, websocket_id2, ..."""
        for patient_id, params in self.subscriptions.items():
            for param, websockets in params.items():
                ws_ids = [str(id(ws)) for ws in websockets]
                logger.info(f"{patient_id}/{param}: {', '.join(ws_ids)}")


# 全局订阅器实例
notifier = DataUpdateNotifier()

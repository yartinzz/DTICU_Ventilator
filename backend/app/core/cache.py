# app/core/cache.py
from collections import defaultdict, deque
from threading import Lock

class PatientDataCache:
    def __init__(self):
        # 三级缓存结构：patient_id -> param_type -> deque(data)
        self._cache = defaultdict(lambda: defaultdict(lambda: deque(maxlen=10)))
        
        # 细粒度锁池：patient_id -> param_type -> Lock
        self._lock_pool = defaultdict(lambda: defaultdict(Lock))
        
        # 最后更新时间记录：patient_id -> param_type -> timestamp
        self._last_updated = defaultdict(lambda: defaultdict(float))

    def update_data(self, patient_id, param_type, data, timestamp):
        """更新缓存数据"""
        with self._lock_pool[patient_id][param_type]:
            self._cache[patient_id][param_type].append({
                "data": data,
                "timestamp": timestamp
            })
            self._last_updated[patient_id][param_type] = timestamp

    def get_data(self, patient_id, param_type, target_timestamp=None):
        """获取指定时间戳数据"""
        with self._lock_pool[patient_id][param_type]:
            if not self._cache[patient_id][param_type]:
                return None
                
            if target_timestamp is None:
                return self._cache[patient_id][param_type][-1]
                
            for item in reversed(self._cache[patient_id][param_type]):
                if item["timestamp"] == target_timestamp:
                    return item
            return self._cache[patient_id][param_type][-1]

    def get_last_timestamp(self, patient_id, param_type):
        """获取最后更新时间"""
        return self._last_updated[patient_id].get(param_type, 0)

# 全局缓存实例
data_cache = PatientDataCache()
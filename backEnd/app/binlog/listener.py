# app/binlog/listener.py
import time
import json
from threading import Thread, Lock

from pymysqlreplication import BinLogStreamReader
from pymysqlreplication.row_event import WriteRowsEvent

from app.core.cache import data_cache
from app.core.send_data import send_data_manager
from config.logger import logger
from config.settings import settings
from app.core.events import notifier

# 活跃参数字典及其锁，结构：{ (patient_id, param_type): {"active": bool, "last_update": timestamp} }
active_params = {}
active_params_lock = Lock()

# 定义不活动阈值（单位：秒），例如 20 秒未更新则标记为 inactive
INACTIVITY_THRESHOLD = 20


def print_active_parameters():
    """打印当前处于活跃状态的参数，按照病人ID分行"""
    grouped = {}
    with active_params_lock:
        for (patient_id, param_type), info in active_params.items():
            if info["active"]:
                grouped.setdefault(patient_id, []).append(param_type)
    if not grouped:
        logger.info("Active device: No active parameters")
    else:
        for patient_id in sorted(grouped.keys()):
            params = grouped[patient_id]
            if params:
                logger.info(f"Active device: Patient {patient_id} --- " + ", ".join(params))
            else:
                logger.info(f"Active device: Patient {patient_id} --- None")


def monitor_active_params():
    while True:
        current_time = time.time()
        with active_params_lock:
            for key, info in list(active_params.items()):
                if info["active"] and (current_time - info["last_update"] > INACTIVITY_THRESHOLD):
                    logger.info(f"time: {current_time}, last_update: {info['last_update']}")
                    active_params[key]["active"] = False
                    logger.info(f"Active device: Patient {key[0]} --- {key[1]} is now inactive")
        print_active_parameters()
        notifier._log_subscriptions()
        time.sleep(INACTIVITY_THRESHOLD)


def start_monitoring_active_params():
    """启动活跃参数监控线程，并返回线程实例"""
    monitor_thread = Thread(target=monitor_active_params, daemon=True)
    monitor_thread.start()
    return monitor_thread


def binlog_listener():
    stream = BinLogStreamReader(
        connection_settings={
            "host": settings.DB_HOST,
            "port": settings.DB_PORT,
            "user": settings.BINLOG_USER,
            "passwd": settings.BINLOG_PASSWORD
        },
        server_id=100,
        only_events=[WriteRowsEvent],
        blocking=True,
        resume_stream=True,
        # 监听 pressure_flow_params、ecg_params 和 ella_sensor_params 三张表
        only_tables=["pressure_flow_params", "ecg_params", "ella_sensor_params", "ecg_model_output"]
    )

    for event in stream:
        if isinstance(event, WriteRowsEvent):
            for row in event.rows:
                try:
                    values = row["values"]
                    patient_id = values["patient_id"]
                    collection_time = values["collection_time"]

                    if event.table == "pressure_flow_params":
                        param_type = "pressure_flow"
                        raw_params = values["parameters"]

                        # 将字节字符串转换为普通字符串，并解码为字典
                        decoded_params = {
                            key.decode('utf-8'): {
                                sub_key.decode('utf-8'): sub_val if not isinstance(sub_val, bytes)
                                else sub_val.decode('utf-8')
                                for sub_key, sub_val in value.items()
                            }
                            for key, value in raw_params.items()
                        }

                        pressure_values = [float(v) for v in decoded_params["pressure"]["values"]]
                        flow_values = [float(v) for v in decoded_params["flow"]["values"]]

                        data_cache.update_data(
                            patient_id=patient_id,
                            param_type=param_type,
                            data={
                                "pressure": {
                                    "unit": decoded_params["pressure"]["unit"],
                                    "values": pressure_values
                                },
                                "flow": {
                                    "unit": decoded_params["flow"]["unit"],
                                    "values": flow_values
                                }
                            },
                            timestamp=collection_time.timestamp()
                        )

                        send_data_manager.add_event(
                            patient_id=patient_id,
                            param_type=param_type,
                            event_time=collection_time.timestamp()
                        )

                    elif event.table == "ecg_params":
                        param_type = "ECG"
                        raw_params = values["parameters"]

                        decoded_params = {
                            key.decode('utf-8'): {
                                sub_key.decode('utf-8'): sub_val if not isinstance(sub_val, bytes)
                                else sub_val.decode('utf-8')
                                for sub_key, sub_val in value.items()
                            }
                            for key, value in raw_params.items()
                        }

                        ecg_values = [float(v) for v in decoded_params["ecg"]["values"]]

                        data_cache.update_data(
                            patient_id=patient_id,
                            param_type=param_type,
                            data={
                                "ecg": {
                                    "unit": decoded_params["ecg"]["unit"],
                                    "values": ecg_values
                                }
                            },
                            timestamp=collection_time.timestamp()
                        )

                        send_data_manager.add_event(
                            patient_id=patient_id,
                            param_type=param_type,
                            event_time=collection_time.timestamp()
                        )

                    elif event.table == "ella_sensor_params":
                        param_type = "breath_cycle"
                        raw_params = values["parameters"]
                        # 判断 raw_params 类型
                        if isinstance(raw_params, dict):
                            decoded_params = raw_params
                        elif isinstance(raw_params, bytes):
                            decoded_params = json.loads(raw_params.decode('utf-8'))
                        elif isinstance(raw_params, str):
                            decoded_params = json.loads(raw_params)
                        else:
                            raise ValueError("Unsupported type for parameters in ella_sensor_params")
                        
                        data_cache.update_data(
                            patient_id=patient_id,
                            param_type=param_type,
                            data=decoded_params,
                            timestamp=collection_time.timestamp()
                        )

                        send_data_manager.add_event(
                            patient_id=patient_id,
                            param_type=param_type,
                            event_time=collection_time.timestamp()
                        )


                                        # 新增：ecg_model_output
                    elif event.table == "ecg_model_output":
                        param_type = "ECG_QRS_INFO"

                        # 解码 analysis_data
                        raw_analysis = values["analysis_data"]
                        if isinstance(raw_analysis, dict):
                            analysis = raw_analysis
                        elif isinstance(raw_analysis, bytes):
                            analysis = json.loads(raw_analysis.decode('utf-8'))
                        elif isinstance(raw_analysis, str):
                            analysis = json.loads(raw_analysis)
                        else:
                            raise ValueError("Unsupported type for analysis_data")

                        # 解码 vitals_data
                        raw_vitals = values["vitals_data"]
                        if isinstance(raw_vitals, dict):
                            vitals = raw_vitals
                        elif isinstance(raw_vitals, bytes):
                            vitals = json.loads(raw_vitals.decode('utf-8'))
                        elif isinstance(raw_vitals, str):
                            vitals = json.loads(raw_vitals)
                        else:
                            raise ValueError("Unsupported type for vitals_data")

                        data_cache.update_data(
                            patient_id=patient_id,
                            param_type=param_type,
                            data={
                                "analysis": analysis,
                                "vitals": vitals
                            },
                            timestamp=collection_time.timestamp()
                        )
                        send_data_manager.add_event(
                            patient_id=patient_id,
                            param_type=param_type,
                            event_time=collection_time.timestamp()
                        )
                        

                    # 更新活跃参数状态
                    with active_params_lock:
                        active_params[(patient_id, param_type)] = {
                            "active": True,
                            "last_update": collection_time.timestamp()
                        }

                except KeyError as e:
                    logger.error(f"Missing required field {str(e)} in binlog data")
                except UnicodeDecodeError as e:
                    logger.error(f"Encoding error: {str(e)}")
                except ValueError as e:
                    logger.error(f"Data conversion failed: {str(e)}")
                except Exception as e:
                    logger.error(f"Unexpected error: {str(e)}")

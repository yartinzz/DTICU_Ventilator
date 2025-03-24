# app/database/queries.py

import json
from typing import Optional
from pymysql import OperationalError

from config.logger import logger
from app.database.connection import get_db_connection

def fetch_patients():
    """
    获取患者列表（仅示例返回 patient_id, name）
    """
    logger.debug("Fetching patient list")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # 只查询 patient_id, name
            cursor.execute("SELECT patient_id, name FROM patient_info")
            patients = cursor.fetchall()
            # MySQLdb / PyMySQL 默认返回元组，如 (1, '张三')
            # 可以转成 dict，或直接返回元组，根据前端需求决定
            result = []
            for row in patients:
                result.append({
                    "patient_id": row[0],
                    "name": row[1]
                })
            return result
    except OperationalError as e:
        logger.error(f"Failed to fetch patients: {str(e)}")
        raise
    finally:
        conn.close()

def fetch_patient_by_id(patient_id):
    """
    获取单个患者的完整信息
    """
    logger.debug(f"Fetching patient info for ID={patient_id}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            query = """
                SELECT patient_id, name, age, gender, admission_date,
                       ethnicity, marital_status, birth_date, admission_count, notes
                FROM patient_info
                WHERE patient_id = %s
            """
            cursor.execute(query, (patient_id,))
            row = cursor.fetchone()
            if not row:
                return None

            # 转成 dict
            return {
                "patient_id": row[0],
                "name": row[1],
                "age": row[2],
                "gender": row[3],
                "admission_date": row[4].strftime("%Y-%m-%d %H:%M:%S") if row[4] else None,
                "ethnicity": row[5],
                "marital_status": row[6],
                "birth_date": row[7].strftime("%Y-%m-%d") if row[7] else None,
                "admission_count": row[8],
                "notes": row[9] or ""
            }
    except OperationalError as e:
        logger.error(f"Failed to fetch patient by id: {str(e)}")
        raise
    finally:
        conn.close()

def update_patient_info(patient_id, patient_data: dict):
    """
    更新指定患者的基本信息
    patient_data 示例:
    {
      "name": "张三",
      "gender": "男",
      "age": 38,
      "admission_date": "2025-03-01",
      "ethnicity": "汉族",
      "marital_status": "已婚",
      "birth_date": "1985-01-01",
      "admission_count": 1,
      "notes": "备注..."
    }
    """
    logger.debug(f"Updating patient info for ID={patient_id} with data={patient_data}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            query = """
                UPDATE patient_info
                SET name = %s,
                    gender = %s,
                    age = %s,
                    admission_date = %s,
                    ethnicity = %s,
                    marital_status = %s,
                    birth_date = %s,
                    admission_count = %s,
                    notes = %s
                WHERE patient_id = %s
            """
            cursor.execute(query, (
                patient_data.get("name"),
                patient_data.get("gender"),
                patient_data.get("age"),
                patient_data.get("admission_date"),
                patient_data.get("ethnicity"),
                patient_data.get("marital_status"),
                patient_data.get("birth_date"),
                patient_data.get("admission_count"),
                patient_data.get("notes", ""),
                patient_id
            ))
            conn.commit()
            return cursor.rowcount  # 返回影响的行数
    except OperationalError as e:
        logger.error(f"Failed to update patient info: {str(e)}")
        raise
    finally:
        conn.close()



def fetch_parameters(patient_id, last_checked_time):
    """
    (示例：原有函数，保留不变)
    获取合并参数数据
    """
    logger.debug(f"Fetching parameters for patient {patient_id}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            query = """
                SELECT 
                    parameters,
                    collection_time
                FROM pressure_flow_params
                WHERE patient_id = %s
                ORDER BY collection_time DESC
                LIMIT 1
            """
            cursor.execute(query, (patient_id,))
            result = cursor.fetchone()
            
            if not result:
                return None, None
                
            # 解析JSON数据
            params = json.loads(result[0])
            return {
                "pressure": params["pressure"]["values"],
                "flow": params["flow"]["values"],
                "collection_time": result[1]
            }, result[1]
    except (OperationalError, json.JSONDecodeError, KeyError) as e:
        logger.error(f"Error fetching parameters: {str(e)}")
        return None, None
    finally:
        conn.close()


# ========================================
# 1. 获取患者列表
# ========================================
def fetch_patients():
    """
    获取所有患者列表，只返回 patient_id 和 name
    """
    logger.debug("Fetching patient list")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = "SELECT patient_id, name FROM patient_info"
            cursor.execute(sql)
            rows = cursor.fetchall()  # e.g. [(1, '张三'), (2, '李四')]
            result = []
            for row in rows:
                result.append({
                    "patient_id": row[0],
                    "name": row[1]
                })
            return result
    except OperationalError as e:
        logger.error(f"Failed to fetch patients: {str(e)}")
        raise
    finally:
        conn.close()


# ========================================
# 2. 获取单个患者信息
# ========================================
def fetch_patient_by_id(patient_id: int):
    """
    根据 patient_id 获取完整的患者信息
    """
    logger.debug(f"Fetching patient info for ID={patient_id}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = """
                SELECT patient_id, name, age, gender, admission_date, notes,
                       ethnicity, marital_status, birth_date, admission_count
                FROM patient_info
                WHERE patient_id = %s
            """
            cursor.execute(sql, (patient_id,))
            row = cursor.fetchone()
            if not row:
                return None
            
            return {
                "patient_id": row[0],
                "name": row[1],
                "age": row[2],
                "gender": row[3],
                # admission_date 可能带有时间，这里只取日期部分可自行决定
                "admission_date": row[4].strftime("%Y-%m-%d %H:%M:%S") if row[4] else None,
                "notes": row[5] or "",
                "ethnicity": row[6],
                "marital_status": row[7],
                "birth_date": row[8].strftime("%Y-%m-%d") if row[8] else None,
                "admission_count": row[9]
            }
    except OperationalError as e:
        logger.error(f"Failed to fetch patient by id: {str(e)}")
        raise
    finally:
        conn.close()


# ========================================
# 3. 更新患者信息
# ========================================
def update_patient_info(patient_id: int, patient_data: dict):
    """
    更新指定患者的基本信息
    patient_data 可能包含:
    {
      "name": "张三",
      "age": 30,
      "gender": "男",
      "admission_date": "2025-03-01",
      "notes": "...",
      "ethnicity": "...",
      "marital_status": "...",
      "birth_date": "1985-01-01",
      "admission_count": 2
    }
    """
    logger.debug(f"Updating patient info for ID={patient_id} with data={patient_data}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = """
                UPDATE patient_info
                SET name = %s,
                    age = %s,
                    gender = %s,
                    admission_date = %s,
                    notes = %s,
                    ethnicity = %s,
                    marital_status = %s,
                    birth_date = %s,
                    admission_count = %s
                WHERE patient_id = %s
            """
            cursor.execute(sql, (
                patient_data.get("name"),
                patient_data.get("age"),
                patient_data.get("gender"),
                patient_data.get("admission_date"),
                patient_data.get("notes"),
                patient_data.get("ethnicity"),
                patient_data.get("marital_status"),
                patient_data.get("birth_date"),
                patient_data.get("admission_count", 0),
                patient_id
            ))
            conn.commit()
            return cursor.rowcount  # 影响的行数
    except OperationalError as e:
        logger.error(f"Failed to update patient info: {str(e)}")
        conn.rollback()
        raise
    finally:
        conn.close()


# ========================================
# 4. 获取该患者所有记录（不分类型）
# ========================================
def fetch_patient_records(patient_id: int):
    """
    返回该患者所有记录，每条记录至少包含:
      - record_id
      - record_type
      - summary_content
      - created_time
    可在前端根据 record_type 再行区分
    """
    logger.debug(f"Fetching all records for patient_id={patient_id}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = """
                SELECT record_id, record_type, summary_content, created_time
                FROM patient_records
                WHERE patient_id = %s
                ORDER BY created_time DESC
            """
            cursor.execute(sql, (patient_id,))
            rows = cursor.fetchall()
            results = []
            for row in rows:
                results.append({
                    "record_id": row[0],
                    "record_type": row[1],
                    "summary_content": row[2] or "",
                    "created_time": row[3].strftime("%Y-%m-%d %H:%M:%S") if row[3] else None
                })
            return results
    except OperationalError as e:
        logger.error(f"Failed to fetch patient records: {str(e)}")
        raise
    finally:
        conn.close()


# ========================================
# 5. 按类型+时间范围获取记录列表
# ========================================
def fetch_patient_records_by_type(
    patient_id: int,
    record_type: str,
    start_date: Optional[str],
    end_date: Optional[str]
):
    """
    按照 record_type, start_date, end_date 筛选记录。
    返回 [{record_id, record_type, summary_content, created_time}, ...]
    如果 start_date / end_date 为空，则不加该条件
    """
    logger.info(f"Fetching {record_type} records for patient {patient_id} from {start_date} to {end_date}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            base_sql = """
                SELECT record_id, record_type, summary_content, created_time
                FROM patient_records
                WHERE patient_id = %s
                  AND record_type = %s
            """
            params = [patient_id, record_type]
            

            # 根据是否传入 start_date / end_date 动态拼接
            if start_date:
                base_sql += " AND created_time >= %s"
                params.append(start_date)
            if end_date:
                # 若想包含 end_date 当天全部时间，可做额外处理
                base_sql += " AND created_time <= %s"
                params.append(end_date)

            base_sql += " ORDER BY created_time DESC"

            cursor.execute(base_sql, params)
            rows = cursor.fetchall()

            results = []
            for row in rows:
                results.append({
                    "record_id": row[0],
                    "record_type": row[1],
                    "summary_content": row[2] or "",
                    "created_time": row[3].strftime("%Y-%m-%d %H:%M:%S") if row[3] else None
                })
            return results
    except OperationalError as e:
        logger.info(f"Failed to fetch patient records by type: {str(e)}")
        raise
    finally:
        conn.close()


# ========================================
# 6. 获取单条记录详情
# ========================================
def fetch_patient_record_detail(record_id: int):
    """
    获取某条记录的详细信息，返回:
    {
      "record_id": ...,
      "patient_id": ...,
      "record_type": ...,
      "summary_content": ...,
      "detail_content": ... (JSON),
      "department": ...,
      "ward": ...,
      "doctor_name": ...,
      "appendix_url": ...,
      "created_time": ...,
      "updated_time": ...
    }
    """
    logger.debug(f"Fetching detail for record_id={record_id}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = """
                SELECT record_id, patient_id, record_type,
                       summary_content,  detail_content,
                       department, ward, doctor_name, appendix_url,
                       created_time, updated_time
                FROM patient_records
                WHERE record_id = %s
            """
            cursor.execute(sql, (record_id,))
            row = cursor.fetchone()
            if not row:
                return None


            logger.info(row)
            return {
                "record_id": row[0],
                "patient_id": row[1],
                "record_type": row[2],
                "summary_content": row[3] or "",
                "detail_content": json.loads(row[4]) if row[4] else {},
                "department": row[5],
                "ward": row[6],
                "doctor_name": row[7],
                "appendix_url": row[8],
                "created_time": row[9].strftime("%Y-%m-%d %H:%M:%S") if row[9] else None,
                "updated_time": row[10].strftime("%Y-%m-%d %H:%M:%S") if row[10] else None
            }
    except OperationalError as e:
        logger.error(f"Failed to fetch patient record detail: {str(e)}")
        raise
    finally:
        conn.close()

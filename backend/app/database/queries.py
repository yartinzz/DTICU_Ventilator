#!/usr/bin/env python
"""
Author: yadian zhao
Institution: Canterbury University
Description: This module contains database query functions to fetch patient information and
             parameter data from the database. It uses a connection pool and handles potential
             errors during query execution.
"""

import json
from typing import Optional
from pymysql import OperationalError
from typing import List, Dict
from pymysql.err import IntegrityError

from config.logger import logger
from app.database.connection import get_db_connection

def fetch_patients():
    """
    Fetch the list of patients from the database.
    
    This function retrieves the patient_id and name from the patient_info table.
    
    Returns:
        list: A list of tuples, where each tuple contains (patient_id, name) for a patient.
    
    Raises:
        OperationalError: If the database query fails.
    """
    logger.debug("Fetching patient list")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:

            cursor.execute("SELECT patient_id, name FROM patient_info")
            patients = cursor.fetchall()

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
# patients list
# ========================================
def fetch_patients():

    logger.debug("Fetching patient list")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = "SELECT patient_id, name FROM patient_info"
            cursor.execute(sql)
            rows = cursor.fetchall()
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
# patient info
# ========================================
def fetch_patient_by_id(patient_id: int):
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


def update_patient_info(patient_id: int, patient_data: dict):

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
            return cursor.rowcount  
    except OperationalError as e:
        logger.error(f"Failed to update patient info: {str(e)}")
        conn.rollback()
        raise
    finally:
        conn.close()



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
            

            if start_date:
                base_sql += " AND created_time >= %s"
                params.append(start_date)
            if end_date:
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



def fetch_patient_record_detail(record_id: int):

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





def store_peep_snapshot(
    patient_id: str,
    record_time: str,
    avg_current_peep: float,
    avg_recommended_peep: float,
    blood_glucose: Optional[float] = None,
    ph: Optional[float] = None,
    insulin_sensitivity: Optional[float] = None,
    total_breaths: Optional[int] = None,
    abnormal_breaths: Optional[int] = None
) -> None:

    logger.debug(f"Storing PEEP snapshot for patient={patient_id} at {record_time}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = """
            INSERT INTO patient_vital_snapshot
              (patient_id, record_time, current_peep, recommended_peep,
               blood_glucose, ph, insulin_sensitivity, total_breaths, abnormal_breaths)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
              current_peep        = VALUES(current_peep),
              recommended_peep    = VALUES(recommended_peep),
              blood_glucose       = VALUES(blood_glucose),
              ph                  = VALUES(ph),
              insulin_sensitivity = VALUES(insulin_sensitivity),
              total_breaths       = VALUES(total_breaths),
              abnormal_breaths    = VALUES(abnormal_breaths)
            """
            cursor.execute(sql, (
                patient_id,
                record_time,
                avg_current_peep,
                avg_recommended_peep,
                blood_glucose,
                ph,
                insulin_sensitivity,
                total_breaths,
                abnormal_breaths
            ))
        conn.commit()
        logger.debug("PEEP snapshot committed or updated")
    except IntegrityError as e:
        # 如果还有别的唯一键冲突，也一并忽略
        logger.warning(f"Duplicate PEEP snapshot skipped for patient={patient_id} at {record_time}: {e}")
    except OperationalError as e:
        logger.error(f"Failed to store PEEP snapshot: {e}")
        raise
    finally:
        conn.close()


def fetch_peep_history(patient_id: str) -> list[dict]:
    """
    查询 patient_vital_snapshot 表中指定 patient_id，
    过去 12 小时（相对于数据库服务器的 UTC 时间）内的所有记录，
    按 record_time 升序返回。
    返回列表，每项为：
      {
        "record_time": "2025-04-19T02:30:00Z",
        "current_peep": 8.25,
        "recommended_peep": 9.0
      }
    """
    logger.info(f"Fetching last 12h PEEP history for patient={patient_id}")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            sql = """
            SELECT
              DATE_FORMAT(CONVERT_TZ(record_time, '+00:00', '+00:00'), '%%Y-%%m-%%dT%%H:%%i:%%sZ') AS record_time,
              current_peep,
              recommended_peep
            FROM patient_vital_snapshot
            WHERE patient_id = %s
              AND record_time >= UTC_TIMESTAMP() - INTERVAL 12 HOUR
            ORDER BY record_time ASC
            """
            cursor.execute(sql, (patient_id,))
            rows = cursor.fetchall()
            history = []
            for record_time, current_peep, recommended_peep in rows:
                history.append({
                    "record_time": record_time,  # e.g. '2025-04-19T02:30:00Z'
                    "current_peep": current_peep,
                    "recommended_peep": recommended_peep
                })

            logger.info(f"Fetched {len(history)} records for patient {patient_id}")
            return history
    except OperationalError as e:
        logger.error(f"Failed to fetch PEEP history: {e}")
        raise
    finally:
        conn.close()

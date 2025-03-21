# app/database/queries.py
import json
from pymysql import OperationalError


from config.logger import logger
from app.database.connection import get_db_connection

def fetch_patients():
    logger.debug("Fetching patient list")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT patient_id, name FROM patient_info")
            patients = cursor.fetchall()
        return patients
    except OperationalError as e:
        logger.error(f"Failed to fetch patients: {str(e)}")
        raise
    finally:
        conn.close()

def fetch_parameters(patient_id, last_checked_time):
    """获取合并参数数据"""
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
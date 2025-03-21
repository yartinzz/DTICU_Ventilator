# app/services/matlab_service.py
import asyncio
from concurrent.futures import ThreadPoolExecutor

import matlab.engine


from config.settings import settings
from config.logger import logger
from app.matlab_engine.engine import ENGINE_POOL

MATLAB_EXECUTOR = ThreadPoolExecutor(max_workers=settings.MATLAB_ENGINE_POOL_SIZE)

async def run_matlab_analysis(params):
    loop = asyncio.get_event_loop()
    try:
        # 在 MATLAB 线程池中异步执行
        result_dict = await loop.run_in_executor(
            MATLAB_EXECUTOR,
            _sync_matlab_wrapper,
            params["pressureData"],
            params["flowData"],
            params["deltaPEEP"]
        )

        return result_dict

    except Exception as e:
        logger.error(f"MATLAB Analysis Failed: {str(e)}")
        return None



def _sync_matlab_wrapper(pressure, flow, delta_peep):
    try:
        with ENGINE_POOL.get_engine(timeout=30) as engine:

            (P_predict_OD_all, V_predict_OD_all, OD_all, k2_all, Vfrc_all, MVpower_all, PEEP) = engine.BreathAnalysisAdapter(
                matlab.double(pressure),
                matlab.double(flow),
                settings.SAMPLING_RATE,
                matlab.double(delta_peep),
                nargout=7
            )

        P_predict_list = list(P_predict_OD_all)
        V_predict_list = list(V_predict_OD_all)
        OD_list = list(OD_all)
        k2_list = list(k2_all)
        Vfrc_list = list(Vfrc_all)
        MVpower_list = list(MVpower_all)

        delta_peep.append("baseline")

        result_list = []
        for i, delta in enumerate(delta_peep):
            wave_P = [float(row[0]) for row in P_predict_list[i]] if isinstance(P_predict_list[i], matlab.double) else list(P_predict_list[i])
            wave_V = [float(row[0]) for row in V_predict_list[i]] if isinstance(V_predict_list[i], matlab.double) else list(V_predict_list[i])

            result_list.append({
                "deltaPEEP": delta,
                "PEEP": float(PEEP),
                "waveforms": {
                    "P_predict_OD": wave_P,
                    "V_predict_OD": wave_V,
                },
                "parameters": {
                    "OD": float(list(OD_list[i])[0]),
                    "K2": float(list(k2_list[i])[0]),
                    "Vfrc": float(list(Vfrc_list[i])[0]),
                    "MVpower": float(list(MVpower_list[i])[0]),
                }
            })

        return result_list

    except matlab.engine.MatlabExecutionError as e:
        logger.error(f"MATLAB execution error: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected MATLAB error: {str(e)}")
        raise

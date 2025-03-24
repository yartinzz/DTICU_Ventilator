#!/usr/bin/env python
"""
Author: yadian zhao
Institution: Canterbury University
Description: This module provides services to run MATLAB analysis asynchronously.
             It leverages a thread pool executor and a MATLAB engine pool to run MATLAB functions
             without blocking the main event loop.
"""

import asyncio
from concurrent.futures import ThreadPoolExecutor

import matlab.engine

from config.settings import settings
from config.logger import logger
from app.matlab_engine.engine import ENGINE_POOL

# Create a ThreadPoolExecutor with the number of workers equal to the MATLAB engine pool size.
MATLAB_EXECUTOR = ThreadPoolExecutor(max_workers=settings.MATLAB_ENGINE_POOL_SIZE)

async def run_matlab_analysis(params):
    """
    Run MATLAB analysis asynchronously.
    
    This function wraps a synchronous MATLAB call in an asynchronous context by delegating
    the computation to a ThreadPoolExecutor. It extracts the necessary parameters and invokes
    the MATLAB analysis function.
    
    Parameters:
        params (dict): Dictionary containing 'pressureData', 'flowData', and 'deltaPEEP'.
        
    Returns:
        result_dict: The result of the MATLAB analysis, or None if an error occurs.
    """
    loop = asyncio.get_event_loop()
    try:
        # Execute the MATLAB analysis in the MATLAB thread pool asynchronously.
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
    """
    Synchronous wrapper to call MATLAB analysis.
    
    This function uses a MATLAB engine from the pool to call the MATLAB function 'BreathAnalysisAdapter'.
    It converts the input lists into MATLAB compatible types, retrieves the analysis results, converts the
    outputs back to Python types, and packages them into a result list.
    
    Parameters:
        pressure: List of pressure data.
        flow: List of flow data.
        delta_peep: List of deltaPEEP values.
    
    Returns:
        result_list (list): A list of dictionaries containing analysis results for each deltaPEEP value.
    
    Raises:
        matlab.engine.MatlabExecutionError: If MATLAB function execution fails.
        Exception: For any other unexpected errors.
    """
    try:
        # Acquire a MATLAB engine from the pool with a timeout of 30 seconds.
        with ENGINE_POOL.get_engine(timeout=30) as engine:
            # Call the MATLAB function 'BreathAnalysisAdapter' with the provided parameters.
            (P_predict_OD_all, V_predict_OD_all, OD_all, k2_all, Vfrc_all, MVpower_all, PEEP) = engine.BreathAnalysisAdapter(
                matlab.double(pressure),
                matlab.double(flow),
                settings.SAMPLING_RATE,
                matlab.double(delta_peep),
                nargout=7
            )

        # Convert MATLAB output to Python lists.
        P_predict_list = list(P_predict_OD_all)
        V_predict_list = list(V_predict_OD_all)
        OD_list = list(OD_all)
        k2_list = list(k2_all)
        Vfrc_list = list(Vfrc_all)
        MVpower_list = list(MVpower_all)

        # Append a "baseline" to the delta_peep list for analysis.
        delta_peep.append("baseline")

        result_list = []
        # Iterate over each deltaPEEP value and build the corresponding result.
        for i, delta in enumerate(delta_peep):
            # Extract and convert waveform data for pressure and flow.
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

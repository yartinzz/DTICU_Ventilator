"use client";

/**
 * Author: yadian zhao
 * Institution: Canterbury University
 * Description: This component serves as the main page for the client-side application.
 * It establishes a WebSocket connection to the server, handles data visualization with ECharts,
 * and provides interactive controls (e.g., patient selection, parameter slider) for monitoring and analysis.
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  initPressureChart, 
  initFlowChart,
  updateChart,
  initPVLoopChart,
  updatePVLoopChart,
  initLineChart,
  updateParamChart
} from "./echartsConfig";

import { Select, MenuItem, InputLabel, FormControl, Slider } from '@mui/material';
import { Typography, Box } from '@mui/material';
import Paper from '@mui/material/Paper';
import { debounce } from "lodash";

// Fixed constant definitions
const DEFAULT_UPDATE_POINTS = 3;
const INITIAL_DATA_POINTS = 2501;
const POINT_INTERVAL_MS = 8;
const CHART_UPDATE_INTERVAL_MS = 24;

// WebSocket URL configuration
// Uncomment the following line to use local development server
// const WebSocketUrl = "ws://localhost:8000/ws";
const WebSocketUrl = "ws://132.181.62.177:10188/ws";

// Slider marks configuration for deltaPEEP selection
const marks = [
  { value: -2, label: "-2" },
  { value: 0, label: "0" },
  { value: 2, label: "2" },
  { value: 4, label: "4" },
  { value: 6, label: "6" },
  { value: 8, label: "8" },
  { value: 10, label: "10" },
];

// PatientSelector component renders a dropdown for selecting a patient from the list.
const PatientSelector = ({ patients, selectedPatient, onChange }) => {
  return (
    <FormControl fullWidth>
      <InputLabel id="patient-select-label">Select Patient</InputLabel>
      <Select
        labelId="patient-select-label"
        value={selectedPatient || ""}
        onChange={onChange}
        label="Select Patient"
      >
        <MenuItem value="">Select Patient</MenuItem>
        {patients.map((patient) => (
          <MenuItem key={patient.patient_id} value={patient.patient_id}>
            {patient.patient_id} - {patient.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

// Helper function to initialize a WebSocket connection with provided callbacks.
const initializeWebSocket = (url, onOpen, onMessage, onClose) => {
  const socket = new WebSocket(url);
  socket.onopen = onOpen;
  socket.onmessage = onMessage;
  socket.onclose = onClose;
  return socket;
};

export default function HomePage() {
  // React state declarations
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [ws, setWs] = useState(null);
  const [isBufferReady, setIsBufferReady] = useState(false);
  const [deltaPEEP, setDeltaPEEP] = useState(0); // Holds slider value for deltaPEEP
  const [BestPEEP, setBestPEEP] = useState(0);
  const [CurrentPEEP, setCurrentPEEP] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);

  // Reference to control update frequency for charts
  const updatePoints = useRef(DEFAULT_UPDATE_POINTS);

  // Chart container refs for ECharts instances
  const pressureChartRef = useRef(null);
  const flowChartRef = useRef(null);
  const PVLoopchartRef = useRef(null);
  const workerRef = useRef(null);

  // References for parameter charts (e.g., K2, ODI, MVpower, Vfrc)
  const paramChartNames = ["K2", "ODI", "MVpower", "Vfrc"];
  const paramChartRefs = useRef(
    paramChartNames.map(() => ({ current: null, chart: null }))
  );

  // Data buffers for incoming pressure and flow data
  const pressureBuffer = useRef([]);
  const flowBuffer = useRef([]);

  // Initial data arrays for chart display (filled with zeros)
  const pressureData = useRef(new Array(INITIAL_DATA_POINTS).fill(0)); 
  const flowData = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
  // Initialize time axis with intervals (in seconds) based on POINT_INTERVAL_MS.
  const timeData = useRef(
    Array.from({ length: INITIAL_DATA_POINTS }, (_, index) => index * POINT_INTERVAL_MS / 1000)
  );

  // Establish WebSocket connection and set up event handlers on component mount.
  useEffect(() => {
    // Initialize PV Loop Chart instance.
    PVLoopchartRef.current = initPVLoopChart(PVLoopchartRef);
    // Create WebSocket connection.
    const socket = initializeWebSocket(
      WebSocketUrl,
      () => {
        console.log("[INFO] WebSocket connected");
        setWs(socket);
        // Request patient list upon connection.
        socket.send(JSON.stringify({ action: "get_patients" }));
      },
      (message) => {
        console.log(message.data);
        const data = JSON.parse(message.data);
        if (data && typeof data === "object") {
          // Process patient list data.
          if (data.type === "get_patient_list" && data.status === "success") {
            if (Array.isArray(data.data)) {
              const patientList = data.data.map(([patient_id, name]) => ({
                patient_id,
                name,
              }));
              setPatients(patientList);
            } else {
              console.error("Invalid patient list format:", data.message);
            }
            return;
          }
          // Process deltaPEEP analysis result.
          if (data.type === "analyze_deltaPEEP" && data.status === "success") {
            console.log("Received analysis result:", data.data);
            if (data.data) {
              setAnalysisResult(data.data);
            } else {
              console.error("Missing analysis result:", data);
            }
            return;
          }
          // Process parameter update response.
          if (data.type === "get_parameters" && data.status === "success") {
            if (typeof data.data === "object" && data.data !== null) {
              Object.entries(data.data).forEach(([label, paramData]) => {
                if (typeof paramData === "object" && paramData !== null && Array.isArray(paramData.values)) {
                  if (label === "pressure") {
                    pressureBuffer.current.push(...paramData.values);
                    if (pressureBuffer.current.length > 500) {
                      pressureBuffer.current.splice(0, pressureBuffer.current.length - 500);
                    }
                  }
                  if (label === "flow") {
                    flowBuffer.current.push(...paramData.values);
                    if (flowBuffer.current.length > 500) {
                      flowBuffer.current.splice(0, flowBuffer.current.length - 500);
                    }
                  }
                } else {
                  console.error(`Invalid format for ${label}:`, paramData);
                }
              });
              // Mark buffers as ready once enough data has been received.
              if (!isBufferReady) {
                if (flowBuffer.current.length > 200 && pressureBuffer.current.length > 200) {
                  setIsBufferReady(true);
                }
              }
            } else {
              console.error("Invalid parameter data format:", data.message);
            }
            return;
          }
          // Handle failure in retrieving parameters.
          if (data.type === "get_parameters" && data.status === "failure") {
            setSelectedPatient(null);
            alert(data.message);
          }
          console.warn("Unhandled data type:", data);
        } else {
          console.error("Invalid data format:", data);
        }        
      },
      () => {
        console.log("[INFO] WebSocket disconnected");
        setIsBufferReady(false);
        setWs(null);
      }
    );

    // Clean up WebSocket connection on component unmount.
    return () => socket.close();
  }, []);

  // Set up charts and resize handling when buffers are ready.
  useEffect(() => {
    const pressureChart = initPressureChart(pressureChartRef, timeData, pressureData);
    const flowChart = initFlowChart(flowChartRef, timeData, flowData);

    // Initialize parameter charts.
    paramChartRefs.current.forEach((ref, index) => {
      if (ref.current && !ref.chart) {
        ref.chart = initLineChart(ref.current, paramChartNames[index]);
      }
    });

    console.log(paramChartRefs.current);
  
    // Handle window resize events with debouncing.
    const handleResize = debounce(() => {
      pressureChart.resize();
      flowChart.resize();
      paramChartRefs.current.forEach((item) => {
        if (item.chart) item.chart.resize();
      });
      if (PVLoopchartRef.current) {
        PVLoopchartRef.current.resize();
      }
    }, 300);
  
    // Create a Web Worker to update charts periodically.
    const workerCode = `
        let interval = null;
        const CHART_UPDATE_INTERVAL_MS = ${CHART_UPDATE_INTERVAL_MS};
        self.onmessage = function (e) {
            if (e.data === "start") {
                if (!interval) {
                    interval = setInterval(() => {
                        self.postMessage("tick");
                    }, CHART_UPDATE_INTERVAL_MS);
                }
            } else if (e.data === "stop") {
                clearInterval(interval);
                interval = null;
            }
        };
    `;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    workerRef.current = new Worker(URL.createObjectURL(blob));

    // On each tick from the worker, update the charts if buffers are ready.
    workerRef.current.onmessage = () => {
        if (isBufferReady) {
            updateChart(
              pressureChart, 
              flowChart, 
              pressureBuffer, 
              flowBuffer, 
              pressureData, 
              flowData, 
              timeData, 
              updatePoints
            );
        }
    };

    // Start the worker.
    workerRef.current.postMessage("start");

    // Add event listener for window resizing.
    window.addEventListener("resize", handleResize);
  
    // Cleanup on component unmount.
    return () => {
      pressureChart.dispose();
      flowChart.dispose();
      workerRef.current.postMessage("stop");
      workerRef.current.terminate();
      window.removeEventListener("resize", handleResize);
    };
  }, [isBufferReady]);

  // Periodically send MATLAB analysis requests when buffers are ready.
  useEffect(() => {
    if (!ws || !isBufferReady) return;
    const intervalId = setInterval(() => {
      const action = {
        action: "analyze_deltaPEEP",
        deltaPEEP: [-2, 0, 2, 4, 6, 8, 10],
        pressureData: pressureData.current,
        flowData: flowData.current,
      };
      console.log("Periodic analysis action:", action);
      ws.send(JSON.stringify(action));
    }, 10000); // Every 10 seconds.
    return () => clearInterval(intervalId);
  }, [isBufferReady, ws]);
  
  // Calculate the suggested best PEEP value based on analysis parameters.
  const calculateBestPEEP = (k2, od, vfrc, mvpower, deltaPEEPs, PEEP) => {
    if (od.length === 0 || vfrc.length < 2) return 0;
  
    let PEEP1 = 0;
    let minDiff = Infinity;
    let index1 = -1;
    od.forEach((value, i) => {
      const diff = Math.abs(value - 0.8);
      if (diff < minDiff) {
        minDiff = diff;
        index1 = i;
      }
    });
    if (index1 !== -1) PEEP1 = deltaPEEPs[index1];
  
    let PEEP2 = 0;
    let vfrcDiff = vfrc.map((val, i, arr) => i > 0 ? val - arr[i - 1] : 0).slice(1);
    let index2 = -1;
    for (let i = 1; i < vfrcDiff.length; i++) {
      if (vfrcDiff[i] < vfrcDiff[i - 1] * 0.9) {
        index2 = i;
        break;
      }
    }
    if (index2 !== -1) {
      PEEP2 = deltaPEEPs[index2];
    }
    return (PEEP1 + PEEP2) / 2 + PEEP;
  };
  
  // Update parameter charts when analysis results are received.
  useEffect(() => {
    if (analysisResult) {
      const paramData = {};
      analysisResult.forEach(item => {
        paramData[item.deltaPEEP] = item.parameters;
        paramData["PEEP"] = item.PEEP;
      });
      setCurrentPEEP(paramData["PEEP"]);
      updateParamChart(paramChartNames, paramChartRefs, paramData);

      const deltaPEEPs = [-2, 0, 2, 4, 6, 8, 10];
      const k2 = [];
      const od = [];
      const vfrc = [];
      const mvpower = [];
      
      deltaPEEPs.forEach(key => {
        const data = paramData[key];
        if (data) {
          k2.push(data.K2);
          od.push(data.OD);
          vfrc.push(data.Vfrc);
          mvpower.push(data.MVpower);
        }
      });
  
      const wave2 = analysisResult.find(item => item.deltaPEEP === deltaPEEP);
      const baseline = analysisResult.find(item => item.deltaPEEP === "baseline");

      if (wave2 && baseline && isBufferReady) {
        updatePVLoopChart(PVLoopchartRef.current, { 
          waveforms: { "selected": wave2.waveforms, "baseline": baseline.waveforms }, 
          deltaPEEP: deltaPEEP 
        });
      }

      const bestPEEP = calculateBestPEEP(k2, od, vfrc, mvpower, deltaPEEPs, paramData["PEEP"]);
      setBestPEEP(bestPEEP);
      console.log(bestPEEP);
    }
  }, [analysisResult]);
  
  // Handle patient selection change events.
  const handlePatientChange = (event) => {
    const selectedPatientId = event.target.value;
    setSelectedPatient(selectedPatientId);
    setIsBufferReady(false);
    if (ws) {
      // Stop any previous subscriptions.
      ws.send(JSON.stringify({ 
        action: "stop",
        patient_id: selectedPatientId
      }));
      // Request parameters for the selected patient.
      ws.send(
        JSON.stringify({
          action: "get_parameters",
          patient_id: selectedPatientId,
          param_type: ["pressure_flow"],
        })
      );
      
      // Reset chart data buffers.
      pressureData.current.fill(0);
      flowData.current.fill(0);
      pressureBuffer.current.fill(0);
      flowBuffer.current.fill(0);
    }
  };

  // Handle changes in the deltaPEEP slider.
  const handleDeltaPEEPChange = (event, newValue) => {
    setDeltaPEEP(newValue);
    if (analysisResult) {
      const selectedWave = analysisResult.find(item => item.deltaPEEP === newValue);
      const baselineWave = analysisResult.find(item => item.deltaPEEP === "baseline");
      if (selectedWave && baselineWave) {
        updatePVLoopChart(PVLoopchartRef.current, { 
          waveforms: { "selected": selectedWave.waveforms, "baseline": baselineWave.waveforms }, 
          deltaPEEP: newValue 
        });
      } else {
        console.warn("analysisResult=", analysisResult);
      }
    }
  };

  // Layout configuration for the dashboard components.
  const layoutConfig = {
    left: [
      { name: "PatientSelector", height: 80, component: PatientSelector, noPaper: true },
      { height: 60, component: "CurrentPEEP" },
      { height: 300, ref: pressureChartRef },
      { height: 300, ref: flowChartRef },
    ],
    middle: [
      { name: "Delta PEEP", height: 80, component: "slider", noPaper: true },
      { height: 60, component: "bestPEEP" },
      { height: 600 + 32, ref: PVLoopchartRef },
    ],
    right: paramChartNames.map((name, index) => ({
      name,
      height: 191,
      ref: (el) => (paramChartRefs.current[index].current = el),
    })),
  };

  // Render a component based on the layout item configuration.
  const renderComponent = (item) => {
    if (item.component === PatientSelector) {
      return (
        <PatientSelector
          patients={patients}
          selectedPatient={selectedPatient}
          onChange={handlePatientChange}
        />
      );
    }
    if (item.component === "slider") {
      return (
        <Slider
          value={deltaPEEP}
          min={-2}
          max={10}
          step={2}
          onChange={handleDeltaPEEPChange}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => value.toFixed(0)}
          marks={marks}
          sx={{
            height: 4,
            "& .MuiSlider-thumb": { height: 20, width: 20 },
            "& .MuiSlider-track": { height: 6 },
            "& .MuiSlider-rail": { height: 6 },
          }}
        />
      );
    }
    if (item.component === "bestPEEP") {
      return (
        <Box
          elevation={3}
          sx={{
            p: 2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderRadius: 1,
            height: "100%",
          }}
        >
          <Typography variant="body1" sx={{ textAlign: "left", flex: 2, fontSize: "20px" }}>
            Suggested Best PEEP =
          </Typography>
          <Typography variant="body1" sx={{ textAlign: "right", flex: 1, fontSize: "24px" }}>
            {BestPEEP}
          </Typography>
        </Box>
      );
    }
    if (item.component === "CurrentPEEP") {
      return (
        <Box
          elevation={3}
          sx={{
            p: 2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderRadius: 1,
            height: "100%",
          }}
        >
          <Typography variant="body1" sx={{ textAlign: "left", flex: 2, fontSize: "20px" }}>
            Current PEEP =
          </Typography>
          <Typography variant="body1" sx={{ textAlign: "right", flex: 1, fontSize: "24px" }}>
            {CurrentPEEP}
          </Typography>
        </Box>
      );
    }
    return <Box ref={item.ref} sx={{ width: "100%", height: "100%" }} />;
  };

  // Main render function for the dashboard layout.
  return (
    <Box sx={{ display: "flex", height: "100vh", width: "80vw", gap: 4, p: 4 }}>
      {/* Left region */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {layoutConfig.left.map((item, index) =>
          item.noPaper ? (
            <Box key={index} sx={{ height: item.height }}>
              <Typography variant="h6">{item.name}</Typography>
              {renderComponent(item)}
            </Box>
          ) : (
            <Paper key={index} elevation={3} sx={{ height: item.height, p: 2 }}>
              <Typography variant="h6">{item.name}</Typography>
              {renderComponent(item)}
            </Paper>
          )
        )}
      </Box>
  
      {/* Middle region */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {layoutConfig.middle.map((item, index) =>
          item.noPaper ? (
            <Box key={index} sx={{ height: item.height }}>
              <Typography variant="h6">{item.name}</Typography>
              {renderComponent(item)}
            </Box>
          ) : (
            <Paper key={index} elevation={3} sx={{ height: item.height, p: 2 }}>
              <Typography variant="h6">{item.name}</Typography>
              {renderComponent(item)}
            </Paper>
          )
        )}
      </Box>
  
      {/* Right region */}
      <Box sx={{ flex: 1.2, display: "flex", flexDirection: "column", gap: 3 }}>
        {layoutConfig.right.map((item, index) => (
          <Paper key={index} elevation={3} sx={{ height: item.height, p: 2 }}>
            <Typography variant="h6">{item.name}</Typography>
            {renderComponent(item)}
          </Paper>
        ))}
      </Box>
    </Box>
  );
}

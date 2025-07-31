"use client";

/**
 * Author: yadian zhao
 * Institution: Canterbury University
 * Description: This component renders the MePAP monitoring page.
 * It establishes a WebSocket connection to fetch patient and MePAP data,
 * provides a patient selector, initializes a single chart for both expected 
 * and actual pressure comparison, and uses a Web Worker to periodically 
 * update the chart with new sensor data.
 */

import React, { useState, useEffect, useRef } from "react";
import { initMePAPChart, updateMePAPChart } from "./mepapEchartsConfig.js";
import { Select, MenuItem, InputLabel, FormControl } from "@mui/material";
import { Typography, Box, Paper, Grid } from "@mui/material";
import { debounce } from "lodash";

const SAMPLE_RATE = 10; // MePAP采样率10Hz
const INITIAL_DATA_POINTS = 101; // 10秒的数据 (10Hz * 10s + 1)
const CHART_UPDATE_INTERVAL_MS = 100; // 图表更新间隔200ms，适合低采样率
const PRESSURE_DIFFERENCE_THRESHOLD = 2.0; // 压力差阈值，用于警告显示

const POINT_INTERVAL_MS = 1000/SAMPLE_RATE; // 100ms per point
const DEFAULT_UPDATE_POINTS = CHART_UPDATE_INTERVAL_MS/POINT_INTERVAL_MS; // 2 points per update

const WebSocketUrl = "ws://132.181.62.177:10188/ws";

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

// Generic function to initialize a WebSocket connection and bind event handlers.
const initializeWebSocket = (url, onOpen, onMessage, onClose) => {
  const socket = new WebSocket(url);
  socket.onopen = onOpen;
  socket.onmessage = onMessage;
  socket.onclose = onClose;
  return socket;
};

export default function MePAPPage() {
  // State to hold patient list, selected patient, WebSocket instance, and buffer readiness.
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [ws, setWs] = useState(null);
  const [isBufferReady, setIsBufferReady] = useState(false);
  const [pressureStats, setPressureStats] = useState({
    expectedMean: 0,
    actualMean: 0,
    pressureDifference: 0,
    isWarning: false
  });

  // Ref for controlling the number of data points to update on the chart.
  const updatePoints = useRef(DEFAULT_UPDATE_POINTS);

  // Refs for chart instance and Web Worker.
  const mepapChartRef = useRef(null);
  const workerRef = useRef(null);

  // Data buffers to accumulate incoming MePAP data from the backend.
  const expectedPressureBuffer = useRef([]);
  const actualPressureBuffer = useRef([]);
  
  // Data for the chart (initialized with zeros)
  const expectedPressureData = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
  const actualPressureData = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
  
  // Time axis data in seconds based on the number of data points.
  const timeData = useRef(
    Array.from({ length: INITIAL_DATA_POINTS }, (_, index) => (index * POINT_INTERVAL_MS) / 1000)
  );

  // Calculate pressure statistics
  const calculatePressureStats = (expectedData, actualData) => {
    if (expectedData.length === 0 || actualData.length === 0) return;
    
    const expectedMean = expectedData.reduce((sum, val) => sum + val, 0) / expectedData.length;
    const actualMean = actualData.reduce((sum, val) => sum + val, 0) / actualData.length;
    const pressureDifference = Math.abs(expectedMean - actualMean);
    const isWarning = pressureDifference > PRESSURE_DIFFERENCE_THRESHOLD;
    
    setPressureStats({
      expectedMean: expectedMean,
      actualMean: actualMean,
      pressureDifference: pressureDifference,
      isWarning: isWarning
    });
  };

  // Establish WebSocket connection and handle messages from the backend.
  useEffect(() => {
    const socket = initializeWebSocket(
      WebSocketUrl,
      () => {
        console.log("[INFO] WebSocket connected");
        setWs(socket);
        // Request the patient list upon connection.
        socket.send(JSON.stringify({ action: "get_patients" }));
      },
      (message) => {
        console.log("[INFO] Received message:", message.data);
        const data = JSON.parse(message.data);
        if (data && typeof data === "object") {
          // Handle patient list response.
          if (data.type === "get_patient_list" && data.status === "success") {
            if (Array.isArray(data.data)) {
              const patientList = data.data.map(({ patient_id, name }) => ({
                patient_id,
                name,
              }));
              setPatients(patientList);
            } else {
              console.error("Invalid patient list format:", data.message);
            }
            return;
          }
          
          // Handle successful MePAP data parameter update - 适配新的数据格式
          if (data.type === "get_parameters" && data.status === "success" && data.param_type === "MePAP") {
            if (data.data && data.data.expected_pressure && data.data.actual_pressure) {
              // 新数据格式：data.data直接包含expected_pressure和actual_pressure数组
              if (Array.isArray(data.data.expected_pressure)) {
                expectedPressureBuffer.current.push(...data.data.expected_pressure);
                // 保持缓冲区大小不超过100个数据点
                if (expectedPressureBuffer.current.length > 100) {
                  expectedPressureBuffer.current.splice(0, expectedPressureBuffer.current.length - 100);
                }
              }
              
              if (Array.isArray(data.data.actual_pressure)) {
                actualPressureBuffer.current.push(...data.data.actual_pressure);
                // 保持缓冲区大小不超过100个数据点
                if (actualPressureBuffer.current.length > 100) {
                  actualPressureBuffer.current.splice(0, actualPressureBuffer.current.length - 100);
                }
              }
              
              // Calculate and update pressure statistics
              calculatePressureStats(
                data.data.expected_pressure,
                data.data.actual_pressure
              );
              
              // Mark the buffer as ready once it has accumulated enough data.
              if (!isBufferReady && expectedPressureBuffer.current.length > 10) {
                setIsBufferReady(true);
                console.log("[INFO] MePAP Buffer is ready");
              }
            }
            return;
          }
          
          // Handle failure response for parameter subscription.
          if (data.type === "get_parameters" && data.status === "failure") {
            setSelectedPatient(null);
            alert(data.message);
          }
          console.warn("Unhandled message:", data);
        }
      },
      () => {
        console.log("[INFO] WebSocket disconnected");
        setIsBufferReady(false);
        setWs(null);
      }
    );

    // Cleanup WebSocket connection on component unmount.
    return () => {
      socket.close();
    };
  }, []);

  // Initialize the MePAP chart and set up a Web Worker for periodic chart updates.
  useEffect(() => {
    // Initialize chart instance with expected and actual pressure data
    const mepapChart = initMePAPChart(
      mepapChartRef, 
      timeData, 
      expectedPressureData, 
      actualPressureData, 
      "MePAP Pressure Monitor"
    );

    // Debounced resize handler for chart responsiveness.
    const handleResize = debounce(() => {
      mepapChart.resize();
    }, 300);
    window.addEventListener("resize", handleResize);

    // Create a Web Worker dynamically using a Blob.
    const workerCode = `
      let interval = null;
      const CHART_UPDATE_INTERVAL_MS = ${CHART_UPDATE_INTERVAL_MS};
      self.onmessage = function(e) {
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

    // When the worker sends a tick message, update the chart if the buffer is ready.
    workerRef.current.onmessage = () => {
      if (isBufferReady) {
        updateMePAPChart(
          mepapChart, 
          expectedPressureBuffer, 
          actualPressureBuffer,
          expectedPressureData, 
          actualPressureData, 
          timeData, 
          updatePoints
        );
      }
    };

    // Start the Web Worker.
    workerRef.current.postMessage("start");

    // Cleanup on component unmount.
    return () => {
      window.removeEventListener("resize", handleResize);
      mepapChart.dispose();
      workerRef.current.postMessage("stop");
      workerRef.current.terminate();
    };
  }, [isBufferReady]);

  // Handler for changes in the patient selector.
  const handlePatientChange = (event) => {
    const selectedId = event.target.value;
    setSelectedPatient(selectedId);
    setIsBufferReady(false);

    // Request the backend to stop current data and fetch new MePAP data for the selected patient.
    if (ws) {
      ws.send(JSON.stringify({ action: "stop", patient_id: selectedId }));
      ws.send(
        JSON.stringify({
          action: "get_parameters",
          patient_id: selectedId,
          param_type: ["MePAP"],
        })
      );
    }

    // Reset the data and buffers.
    expectedPressureData.current.fill(0);
    actualPressureData.current.fill(0);
    expectedPressureBuffer.current = [];
    actualPressureBuffer.current = [];
    
    // Reset pressure statistics
    setPressureStats({
      expectedMean: 0,
      actualMean: 0,
      pressureDifference: 0,
      isWarning: false
    });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2, height: "100vh", width: "80vw" }}>
      {/* Patient Selector and Pressure Statistics */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box sx={{ width: "30%" }}>
          <PatientSelector 
            patients={patients} 
            selectedPatient={selectedPatient} 
            onChange={handlePatientChange} 
          />
        </Box>
        <Box sx={{ display: "flex", gap: 4, alignItems: "center" }}>
          <Typography variant="h6">
            Expected: {pressureStats.expectedMean.toFixed(2)} cmH₂O
          </Typography>
          <Typography variant="h6">
            Actual: {pressureStats.actualMean.toFixed(2)} cmH₂O
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              color: pressureStats.isWarning ? 'error.main' : 'text.primary',
              fontWeight: pressureStats.isWarning ? 'bold' : 'normal'
            }}
          >
            Difference: {pressureStats.pressureDifference.toFixed(2)} cmH₂O
            {pressureStats.isWarning && " ⚠️"}
          </Typography>
        </Box>
      </Box>

      {/* MePAP Chart */}
      <Grid container spacing={2} sx={{ flex: 1 }}>
        <Grid item xs={12} sx={{ height: "80%" }}>
          <Paper elevation={3} sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}>
            <Box ref={mepapChartRef} sx={{ width: "100%", flex: 1 }} />
          </Paper>
        </Grid>
      </Grid>

      {/* Device Status and Information */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Sampling Rate: {SAMPLE_RATE}Hz | Update Interval: {CHART_UPDATE_INTERVAL_MS}ms
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            color: isBufferReady ? 'success.main' : 'warning.main',
            fontWeight: 'bold'
          }}
        >
          Status: {isBufferReady ? 'Connected & Receiving Data' : 'Waiting for Data...'}
        </Typography>
      </Box>
    </Box>
  );
}

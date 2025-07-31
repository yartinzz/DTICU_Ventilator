"use client"; 

/**
 * Author: yadian zhao
 * Institution: Canterbury University
 * Description: This component renders the Photodiode monitoring page.
 * It establishes a WebSocket connection to fetch patient and photodiode data,
 * provides a patient selector, initializes four charts for PD1-4 channels,
 * and uses a Web Worker to periodically update the charts with new sensor data.
 * Updated to include both raw and filtered signals display.
 */

import React, { useState, useEffect, useRef } from "react";
import { initPhotodiodeChart, updatePhotodiodeChart } from "./echartsConfig.js";
import { Select, MenuItem, InputLabel, FormControl } from "@mui/material";
import { Typography, Box, Paper, Grid } from "@mui/material";
import { debounce } from "lodash";

const SAMPLE_RATE = 250;
const INITIAL_DATA_POINTS = 2501; // 10 seconds of data at 250Hz
const CHART_UPDATE_INTERVAL_MS = 80;
const FILTER_CUTOFF_FREQUENCY = 5;

const POINT_INTERVAL_MS = 1000/SAMPLE_RATE; 
const DEFAULT_UPDATE_POINTS = CHART_UPDATE_INTERVAL_MS/POINT_INTERVAL_MS;

const WebSocketUrl = "ws://132.181.62.177:10188/ws";

// Simple low-pass filter implementation (Butterworth-like)
const createLowPassFilter = (cutoffFreq, sampleRate) => {
  const RC = 1.0 / (cutoffFreq * 2 * Math.PI);
  const dt = 1.0 / sampleRate;
  const alpha = dt / (RC + dt);
  
  let previousOutput = 0;
  
  return (input) => {
    const output = previousOutput + alpha * (input - previousOutput);
    previousOutput = output;
    return output;
  };
};

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

export default function PhotodiodePage() {
  // State to hold patient list, selected patient, WebSocket instance, and buffer readiness.
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [ws, setWs] = useState(null);
  const [isBufferReady, setIsBufferReady] = useState(false);
  const [vitals, setVitals] = useState({ SaO2: 0, SvO2: 0, O2ER: 0 });

  // Ref for controlling the number of data points to update on the chart.
  const updatePoints = useRef(DEFAULT_UPDATE_POINTS);

  // Refs for chart instances and Web Worker.
  const pd1ChartRef = useRef(null);
  const pd2ChartRef = useRef(null);
  const pd3ChartRef = useRef(null);
  const pd4ChartRef = useRef(null);
  const workerRef = useRef(null);

  // Data buffers to accumulate incoming photodiode data from the backend.
  const pd1Buffer = useRef([]);
  const pd2Buffer = useRef([]);
  const pd3Buffer = useRef([]);
  const pd4Buffer = useRef([]);
  
  // Data for the charts (initialized with zeros) - Raw data
  const pd1Data = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
  const pd2Data = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
  const pd3Data = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
  const pd4Data = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
  
  // Data for the charts (initialized with zeros) - Filtered data
  const pd1FiltData = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
  const pd2FiltData = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
  const pd3FiltData = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
  const pd4FiltData = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
  
  // Low-pass filters for each channel (cutoff frequency: 5Hz)
  const pd1Filter = useRef(createLowPassFilter(FILTER_CUTOFF_FREQUENCY, SAMPLE_RATE));
  const pd2Filter = useRef(createLowPassFilter(FILTER_CUTOFF_FREQUENCY, SAMPLE_RATE));
  const pd3Filter = useRef(createLowPassFilter(FILTER_CUTOFF_FREQUENCY, SAMPLE_RATE));
  const pd4Filter = useRef(createLowPassFilter(FILTER_CUTOFF_FREQUENCY, SAMPLE_RATE));
  
  // Time axis data in seconds based on the number of data points.
  const timeData = useRef(
    Array.from({ length: INITIAL_DATA_POINTS }, (_, index) => (index * POINT_INTERVAL_MS) / 1000)
  );

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
          // Handle successful photodiode data parameter update.
          if (data.type=== "get_parameters" && data.status === "success" && data.param_type === "photodiode") {
            if (data.data && data.data.sensor_data) {
              // Update vitals data
              setVitals({
                SaO2: data.data.SaO2 || 0,
                SvO2: data.data.SvO2 || 0,
                O2ER: data.data.O2ER || 0
              });
              
              // Append new sensor values to the buffers
              if (Array.isArray(data.data.sensor_data.PD1)) {
                pd1Buffer.current.push(...data.data.sensor_data.PD1);
                if (pd1Buffer.current.length > 2500) {
                  pd1Buffer.current.splice(0, pd1Buffer.current.length - 2500);
                }
              }
              
              if (Array.isArray(data.data.sensor_data.PD2)) {
                pd2Buffer.current.push(...data.data.sensor_data.PD2);
                if (pd2Buffer.current.length > 2500) {
                  pd2Buffer.current.splice(0, pd2Buffer.current.length - 2500);
                }
              }
              
              if (Array.isArray(data.data.sensor_data.PD3)) {
                pd3Buffer.current.push(...data.data.sensor_data.PD3);
                if (pd3Buffer.current.length > 2500) {
                  pd3Buffer.current.splice(0, pd3Buffer.current.length - 2500);
                }
              }
              
              if (Array.isArray(data.data.sensor_data.PD4)) {
                pd4Buffer.current.push(...data.data.sensor_data.PD4);
                if (pd4Buffer.current.length > 2500) {
                  pd4Buffer.current.splice(0, pd4Buffer.current.length - 2500);
                }
              }
              
              // Mark the buffer as ready once it has accumulated enough data.
              if (!isBufferReady && pd1Buffer.current.length > 100) {
                setIsBufferReady(true);
                console.log("[INFO] Buffer is ready");
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

  // Initialize the photodiode charts and set up a Web Worker for periodic chart updates.
  useEffect(() => {
    // Initialize chart instances with both raw and filtered data
    const pd1Chart = initPhotodiodeChart(pd1ChartRef, timeData, pd1Data, pd1FiltData, "PD1");
    const pd2Chart = initPhotodiodeChart(pd2ChartRef, timeData, pd2Data, pd2FiltData, "PD2");
    const pd3Chart = initPhotodiodeChart(pd3ChartRef, timeData, pd3Data, pd3FiltData, "PD3");
    const pd4Chart = initPhotodiodeChart(pd4ChartRef, timeData, pd4Data, pd4FiltData, "PD4");

    // Debounced resize handler for chart responsiveness.
    const handleResize = debounce(() => {
      pd1Chart.resize();
      pd2Chart.resize();
      pd3Chart.resize();
      pd4Chart.resize();
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

    // When the worker sends a tick message, update the charts if the buffer is ready.
    workerRef.current.onmessage = () => {
      if (isBufferReady) {
        updatePhotodiodeChart(pd1Chart, pd1Buffer, pd1Data, pd1FiltData, timeData, updatePoints, pd1Filter.current, "PD1");
        updatePhotodiodeChart(pd2Chart, pd2Buffer, pd2Data, pd2FiltData, timeData, updatePoints, pd2Filter.current, "PD2");
        updatePhotodiodeChart(pd3Chart, pd3Buffer, pd3Data, pd3FiltData, timeData, updatePoints, pd3Filter.current, "PD3");
        updatePhotodiodeChart(pd4Chart, pd4Buffer, pd4Data, pd4FiltData, timeData, updatePoints, pd4Filter.current, "PD4");
      }
    };

    // Start the Web Worker.
    workerRef.current.postMessage("start");

    // Cleanup on component unmount.
    return () => {
      window.removeEventListener("resize", handleResize);
      pd1Chart.dispose();
      pd2Chart.dispose();
      pd3Chart.dispose();
      pd4Chart.dispose();
      workerRef.current.postMessage("stop");
      workerRef.current.terminate();
    };
  }, [isBufferReady]);

  // Handler for changes in the patient selector.
  const handlePatientChange = (event) => {
    const selectedId = event.target.value;
    setSelectedPatient(selectedId);
    setIsBufferReady(false);

    // Request the backend to stop current data and fetch new photodiode data for the selected patient.
    if (ws) {
      ws.send(JSON.stringify({ action: "stop", patient_id: selectedId }));
      ws.send(
        JSON.stringify({
          action: "get_parameters",
          patient_id: selectedId,
          param_type: ["photodiode"],
        })
      );
    }

    // Reset the data and buffers.
    pd1Data.current.fill(0);
    pd2Data.current.fill(0);
    pd3Data.current.fill(0);
    pd4Data.current.fill(0);
    pd1FiltData.current.fill(0);
    pd2FiltData.current.fill(0);
    pd3FiltData.current.fill(0);
    pd4FiltData.current.fill(0);
    pd1Buffer.current = [];
    pd2Buffer.current = [];
    pd3Buffer.current = [];
    pd4Buffer.current = [];
    
    // Reset filters
    pd1Filter.current = createLowPassFilter(10, SAMPLE_RATE);
    pd2Filter.current = createLowPassFilter(10, SAMPLE_RATE);
    pd3Filter.current = createLowPassFilter(10, SAMPLE_RATE);
    pd4Filter.current = createLowPassFilter(10, SAMPLE_RATE);
    
    setVitals({ SaO2: 0, SvO2: 0, O2ER: 0 });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2, height: "100vh", width: "80vw" }}>
      {/* Patient Selector and Vitals */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ width: "30%" }}>
          <PatientSelector patients={patients} selectedPatient={selectedPatient} onChange={handlePatientChange} />
        </Box>
        <Box sx={{ display: "flex", gap: 4 }}>
          <Typography variant="h6">SaO2: {vitals.SaO2.toFixed(1)}%</Typography>
          <Typography variant="h6">SvO2: {vitals.SvO2.toFixed(1)}%</Typography>
          <Typography variant="h6">O2ER: {vitals.O2ER.toFixed(1)}%</Typography>
        </Box>
      </Box>

      {/* Photodiode Charts */}
      <Grid container spacing={2} sx={{ flex: 1 }}>
        <Grid item xs={12} sx={{ height: "22%" }}>
          <Paper elevation={3} sx={{ p: 1, height: "100%" }}>
            <Typography variant="subtitle1">PD1 Channel</Typography>
            <Box ref={pd1ChartRef} sx={{ width: "100%", height: "85%" }} />
          </Paper>
        </Grid>
        <Grid item xs={12} sx={{ height: "22%" }}>
          <Paper elevation={3} sx={{ p: 1, height: "100%" }}>
            <Typography variant="subtitle1">PD2 Channel</Typography>
            <Box ref={pd2ChartRef} sx={{ width: "100%", height: "85%" }} />
          </Paper>
        </Grid>
        <Grid item xs={12} sx={{ height: "22%" }}>
          <Paper elevation={3} sx={{ p: 1, height: "100%" }}>
            <Typography variant="subtitle1">PD3 Channel</Typography>
            <Box ref={pd3ChartRef} sx={{ width: "100%", height: "85%" }} />
          </Paper>
        </Grid>
        <Grid item xs={12} sx={{ height: "22%" }}>
          <Paper elevation={3} sx={{ p: 1, height: "100%" }}>
            <Typography variant="subtitle1">PD4 Channel</Typography>
            <Box ref={pd4ChartRef} sx={{ width: "100%", height: "85%" }} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
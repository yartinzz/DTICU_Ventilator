"use client";

/**
 * Author: yadian zhao
 * Institution: Canterbury University
 * Description: This component renders the ECG monitoring page.
 * It establishes a WebSocket connection to fetch patient and ECG data,
 * provides a patient selector, initializes an ECG chart, and uses a Web Worker
 * to periodically update the chart with new ECG data.
 */

import React, { useState, useEffect, useRef } from "react";
import { initECGChart, updateECGChart } from "./echartsECGConfig.js";
import { Select, MenuItem, InputLabel, FormControl } from "@mui/material";
import { Typography, Box, Paper } from "@mui/material";
import { debounce } from "lodash";


const DEFAULT_UPDATE_POINTS = 18;
const INITIAL_DATA_POINTS = 7201;
const POINT_INTERVAL_MS = 1000/360; 
const CHART_UPDATE_INTERVAL_MS = 50; 
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

export default function ECGPage() {
  // State to hold patient list, selected patient, WebSocket instance, and buffer readiness.
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [ws, setWs] = useState(null);
  const [isBufferReady, setIsBufferReady] = useState(false);

  // Ref for controlling the number of data points to update on the chart.
  const updatePoints = useRef(DEFAULT_UPDATE_POINTS);

  // Refs for chart instance and Web Worker.
  const ecgChartRef = useRef(null);
  const workerRef = useRef(null);

  // Data buffer to accumulate incoming ECG data from the backend.
  const ecgBuffer = useRef([]);
  // Data for the chart (initialized with zeros).
  const ecgData = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
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
          // Handle successful ECG data parameter update.
          if (data.type === "get_parameters" && data.status === "success" && data.param_type === "ECG") {
            if (data.data && Array.isArray(data.data.ecg.values)) {
              // Append new ECG values to the buffer.
              ecgBuffer.current.push(...data.data.ecg.values);
              // Limit the buffer size to 2500 values.
              if (ecgBuffer.current.length > 2500) {
                ecgBuffer.current.splice(0, ecgBuffer.current.length - 2500);
              }
              // Mark the buffer as ready once it has accumulated enough data.
              if (!isBufferReady && ecgBuffer.current.length > 200) {
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

  // Initialize the ECG chart and set up a Web Worker for periodic chart updates.
  useEffect(() => {
    // Initialize the ECG chart instance.
    const ecgChart = initECGChart(ecgChartRef, timeData, ecgData);

    // Debounced resize handler for chart responsiveness.
    const handleResize = debounce(() => {
      ecgChart.resize();
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
        updateECGChart(ecgChart, ecgBuffer, ecgData, timeData, updatePoints);
      }
    };

    // Start the Web Worker.
    workerRef.current.postMessage("start");

    // Cleanup on component unmount.
    return () => {
      window.removeEventListener("resize", handleResize);
      ecgChart.dispose();
      workerRef.current.postMessage("stop");
      workerRef.current.terminate();
    };
  }, [isBufferReady]);

  // Handler for changes in the patient selector.
  const handlePatientChange = (event) => {
    const selectedId = event.target.value;
    setSelectedPatient(selectedId);
    setIsBufferReady(false);

    // Request the backend to stop current data and fetch new ECG data for the selected patient.
    if (ws) {
      ws.send(JSON.stringify({ action: "stop", patient_id: selectedId }));
      ws.send(
        JSON.stringify({
          action: "get_parameters",
          patient_id: selectedId,
          param_type: ["ECG"],
        })
      );
    }

    // Reset the ECG data and buffer.
    ecgData.current.fill(0);
    ecgBuffer.current.fill(0);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4, p: 4, height: "80vh", width: "80vw" }}>
      {/* Patient Selector */}
      <Box>
        <PatientSelector patients={patients} selectedPatient={selectedPatient} onChange={handlePatientChange} />
      </Box>

      {/* ECG Dynamic Chart */}
      <Paper elevation={3} sx={{ flex: 1, p: 2 }}>
        <Typography variant="h6">ECG Data</Typography>
        <Box ref={ecgChartRef} sx={{ width: "100%", height: "100%" }} />
      </Paper>
    </Box>
  );
}

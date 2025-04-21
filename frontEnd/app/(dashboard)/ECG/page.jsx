"use client";

import React, { useState, useEffect, useRef } from "react";
import { initECGChart, updateECGChart } from "./echartsECGConfig.js";
import { Select, MenuItem, InputLabel, FormControl } from "@mui/material";
import { Typography, Box, Paper } from "@mui/material";
import { debounce } from "lodash";


// 固定值常量定义
const DEFAULT_UPDATE_POINTS = 18;
const INITIAL_DATA_POINTS = 7201;
const POINT_INTERVAL_MS = 1000/360; // 时间刻度间隔（秒）
const CHART_UPDATE_INTERVAL_MS = 50; // 图表更新周期
const WebSocketUrl = "ws://132.181.62.177:10188/ws";

// 病人选择器组件
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

// 初始化 WebSocket 连接的通用函数
const initializeWebSocket = (url, onOpen, onMessage, onClose) => {
  const socket = new WebSocket(url);
  socket.onopen = onOpen;
  socket.onmessage = onMessage;
  socket.onclose = onClose;
  return socket;
};

export default function ECGPage() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [ws, setWs] = useState(null);
  const [isBufferReady, setIsBufferReady] = useState(false);


  // 用于控制图表更新的参数
  const updatePoints = useRef(DEFAULT_UPDATE_POINTS);

  // 图表与 Worker 引用
  const ecgChartRef = useRef(null);
  const workerRef = useRef(null);

  // 数据缓存（ECG 数据从后端逐步追加）
  const ecgBuffer = useRef([]);
  // 用于图表显示的数据（初始化为 0）
  const ecgData = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
  // 时间刻度数据（单位：秒）
  const timeData = useRef(
    Array.from({ length: INITIAL_DATA_POINTS }, (_, index) => (index * POINT_INTERVAL_MS) / 1000)
  );

  // 建立 WebSocket 连接，并处理后端返回的数据
  useEffect(() => {
    const socket = initializeWebSocket(
      WebSocketUrl,
      () => {
        console.log("[INFO] WebSocket connected");
        setWs(socket);
        socket.send(JSON.stringify({ action: "get_patients" }));
      },
      (message) => {
        console.log("[INFO] Received message:", message.data);
        const data = JSON.parse(message.data);
        if (data && typeof data === "object") {
          // 处理获取病人列表的消息
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
          if (data.type === "get_parameters" && data.status === "success" && data.param_type === "ECG") {
            if (data.data && Array.isArray(data.data.ecg.values)) {
              ecgBuffer.current.push(...data.data.ecg.values);
              if (ecgBuffer.current.length > 2500) {
                ecgBuffer.current.splice(0, ecgBuffer.current.length - 2500);
              }
              if (!isBufferReady && ecgBuffer.current.length > 200) {
                setIsBufferReady(true);
                console.log("[INFO] Buffer is ready");
              }
            }
            return;
          }


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

    return () => {
      socket.close();
    };
  }, []); 

  // 初始化 ECG 图表，并使用 Web Worker 定时更新图表
  useEffect(() => {
    const ecgChart = initECGChart(ecgChartRef, timeData, ecgData);

    // **监听窗口大小变化，触发 ECG 图表 resize**
    const handleResize = debounce(() => {
      ecgChart.resize();
    }, 300);
    window.addEventListener("resize", handleResize);

    // 创建 Web Worker（通过 Blob 动态构造）
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

    workerRef.current.onmessage = () => {
      if (isBufferReady) {
        updateECGChart(ecgChart, ecgBuffer, ecgData, timeData, updatePoints);
      }
    };

    workerRef.current.postMessage("start");

    return () => {
      window.removeEventListener("resize", handleResize);
      ecgChart.dispose();
      workerRef.current.postMessage("stop");
      workerRef.current.terminate();
    };
  }, [isBufferReady]);

  // 病人选择器变化处理
  const handlePatientChange = (event) => {
    const selectedId = event.target.value;
    setSelectedPatient(selectedId);
    setIsBufferReady(false);

    // 请求后端停止当前数据，并请求新病人的 ECG 数据
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

    ecgData.current.fill(0);
    ecgBuffer.current.fill(0);  
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4, p: 4, height: "80vh", width: "80vw" }}>
      {/* 病人选择器 */}
      <Box>
        <PatientSelector patients={patients} selectedPatient={selectedPatient} onChange={handlePatientChange} />
      </Box>

      {/* ECG 动态图表 */}
      <Paper elevation={3} sx={{ flex: 1, p: 2 }}>
        <Typography variant="h6">ECG Data</Typography>
        <Box ref={ecgChartRef} sx={{ width: "100%", height: "100%" }} />
      </Paper>
    </Box>
  );
}
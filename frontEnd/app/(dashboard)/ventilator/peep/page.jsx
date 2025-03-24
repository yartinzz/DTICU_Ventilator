"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  initPressureChart, 
  initFlowChart,
  updateChart,
  initPVLoopChart,
  updatePVLoopChart,
  initLineChart,
  updateParamChart,
  initHistoryPEEPChart,
} from "./echartsConfig";

import { Select, MenuItem, InputLabel, FormControl, Slider } from '@mui/material';
import { Typography, Box } from '@mui/material';
import Paper from '@mui/material/Paper';
import { debounce } from "lodash";

// 固定值常量定义
const DEFAULT_UPDATE_POINTS = 3;
const INITIAL_DATA_POINTS = 2501;
const POINT_INTERVAL_MS = 8;
const CHART_UPDATE_INTERVAL_MS = 24;

//const WebSocketUrl = "ws://localhost:8000/ws";
const WebSocketUrl = "ws://132.181.62.177:10188/ws";

const marks = [
  { value: -2, label: "-2" },
  { value: 0, label: "0" },
  { value: 2, label: "2" },
  { value: 4, label: "4" },
  { value: 6, label: "6" },
  { value: 8, label: "8" },
  { value: 10, label: "10" },
];

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

const initializeWebSocket = (url, onOpen, onMessage, onClose) => {
  const socket = new WebSocket(url);
  socket.onopen = onOpen;
  socket.onmessage = onMessage;
  socket.onclose = onClose;
  return socket;
};


function generateHourlyLabels(startHour = 9, hours = 12) {
  const labels = [];
  for (let i = 0; i < hours; i++) {
    const hour = (startHour + i) % 24;
    labels.push(hour.toString().padStart(2, '0') + ':00');
  }
  return labels;
}

function generateRandomPEEPData(count = 12, min = 0, max = 20) {
  const options = [];
  for (let i = min; i <= max; i += 2) {
    options.push(i);
  }
  const data = [];
  let lastValue = null; // 记录上一次生成的数
  for (let i = 0; i < count; i++) {
    let newValue;
    if (lastValue !== null && Math.random() < 0.4) {
      newValue = lastValue;
    } else {
      newValue = options[Math.floor(Math.random() * options.length)];
    }
    data.push(newValue);
    lastValue = newValue;
  }
  return data;
}


export default function HomePage() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [ws, setWs] = useState(null);
  const [isBufferReady, setIsBufferReady] = useState(false);
  const [deltaPEEP, setDeltaPEEP] = useState(0); // 用于保存滑动条的值
  const [BestPEEP, setBestPEEP] = useState(0); 
  const [CurrentPEEP, setCurrentPEEP] = useState(0);

  const updatePoints = useRef(DEFAULT_UPDATE_POINTS);

  const pressureChartRef = useRef(null);
  const flowChartRef = useRef(null);
  const PVLoopchartRef = useRef(null);
  const workerRef = useRef(null);


  const historyPEEPChartRef = useRef(null);
  const [historyPEEPData, setHistoryPEEPData] = useState({
    xAxis: [],
    yAxis: [],
  });




  const paramChartNames = ["K2", "ODI", "MVpower", "Vfrc"];
  const paramChartRefs = useRef(
    paramChartNames.map(() => ({ current: null, chart: null }))
  );


  const [analysisResult, setAnalysisResult] = useState(null);

  const pressureBuffer = useRef([]); // Pressure data buffer
  const flowBuffer = useRef([]); // Flow data buffer

  const pressureData = useRef(new Array(INITIAL_DATA_POINTS).fill(0)); 
  const flowData = useRef(new Array(INITIAL_DATA_POINTS).fill(0)); // Initialize data points as 0
  const timeData = useRef(
    Array.from({ length: INITIAL_DATA_POINTS }, (_, index) => index * POINT_INTERVAL_MS / 1000) // Initialize time as 8ms intervals
  );

  useEffect(() => {
    PVLoopchartRef.current = initPVLoopChart(PVLoopchartRef);
    // Initialize WebSocket
    const socket = initializeWebSocket(
      WebSocketUrl,
      () => {
        console.log("[INFO] WebSocket connected");
        setWs(socket);
        socket.send(JSON.stringify({ action: "get_patients" }));
      },
      (message) => {
        console.log(message.data);
        const data = JSON.parse(message.data);
        if (data && typeof data === "object") {
          // 处理获取病人列表
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
          
        
          // 处理 deltaPEEP 预测结果
          if (data.type === "analyze_deltaPEEP" && data.status === "success") {
            console.log(data.data);
            if (data.data) {
              console.log("Received analysis result:", data.data);
              setAnalysisResult(data.data);
            } else {
              console.error("Missing analysis result:", data);
            }
            return;
          }
        
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

    return () => socket.close();
  }, []);

  useEffect(() => {
    const xAxis = generateHourlyLabels(9, 12);
    const yAxis = generateRandomPEEPData(12, 2, 12);
    setHistoryPEEPData({ xAxis, yAxis });
  }, []);



  useEffect(() => {
    const pressureChart = initPressureChart(pressureChartRef, timeData, pressureData);
    const flowChart = initFlowChart(flowChartRef, timeData, flowData);


    paramChartRefs.current.forEach((ref, index) => {
      if (ref.current && !ref.chart) {
        ref.chart = initLineChart(ref.current, paramChartNames[index]);
      }
    });

    console.log(paramChartRefs.current)
  
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

    workerRef.current.onmessage = () => {
        if (isBufferReady) {
            updateChart(pressureChart, flowChart, pressureBuffer, flowBuffer, pressureData, flowData, timeData, updatePoints);
        }
    };

    workerRef.current.postMessage("start");

    window.addEventListener("resize", handleResize);
  
    return () => {
      pressureChart.dispose();
      flowChart.dispose();

      workerRef.current.postMessage("stop");
      workerRef.current.terminate();
      window.removeEventListener("resize", handleResize);
    };
  }, [isBufferReady]);

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
    }, 10000); // 每10秒一次
    return () => clearInterval(intervalId);
  }, [isBufferReady, ws]);
  
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
        updatePVLoopChart(PVLoopchartRef.current, { waveforms: { "selected": wave2.waveforms, "baseline": baseline.waveforms }, deltaPEEP: deltaPEEP });
      }

      const bestPEEP = calculateBestPEEP(k2, od, vfrc, mvpower, deltaPEEPs , paramData["PEEP"]);
      setBestPEEP(bestPEEP);
      console.log(bestPEEP);
    }
  }, [analysisResult]);
  


  useEffect(() => {
    if (!historyPEEPData.xAxis.length) return;
  
    // 初始化历史PEEP图表
    const historyChart = initHistoryPEEPChart(
      historyPEEPChartRef,
      historyPEEPData.xAxis,
      historyPEEPData.yAxis
    );
  
    // 监听窗口大小改变，进行图表自适应
    const handleResize = debounce(() => {
      if (historyChart) {
        historyChart.resize();
      }
    }, 300);
    window.addEventListener("resize", handleResize);
  
    return () => {
      window.removeEventListener("resize", handleResize);
      historyChart && historyChart.dispose();
    };
  }, [historyPEEPData]);




  const handlePatientChange = (event) => {
    const selectedPatientId = event.target.value;
    setSelectedPatient(selectedPatientId);
    setIsBufferReady(false);
    if (ws) {
      ws.send(JSON.stringify({ 
        action: "stop",
        patient_id: selectedPatientId
      }));
      ws.send(
        JSON.stringify({
          action: "get_parameters",
          patient_id: selectedPatientId,
          param_type: ["pressure_flow"],
        })
      );
      
      pressureData.current.fill(0);
      flowData.current.fill(0);

      pressureBuffer.current.fill(0);
      flowBuffer.current.fill(0);

    }
  };

  const handleDeltaPEEPChange = (event, newValue) => {
    setDeltaPEEP(newValue);
    if (analysisResult) {
      const selectedWave = analysisResult.find(item => item.deltaPEEP === newValue);
      const baselineWave = analysisResult.find(item => item.deltaPEEP === "baseline");
      if (selectedWave && baselineWave) {
        updatePVLoopChart(PVLoopchartRef.current, { waveforms: { "selected": selectedWave.waveforms, "baseline": baselineWave.waveforms }, deltaPEEP: newValue });
      } else {
        console.warn("analysisResult=", analysisResult);
      }
    }
  };
  

const layoutConfig = {
  left: [
    { name: "PatientSelector", height: 80, component: PatientSelector, noPaper: true },
    { height: 60, component: "CurrentPEEP"},
    { height: 280, ref: pressureChartRef },
    { height: 280, ref: flowChartRef },
  ],
  middle: [
    { name: "Delta PEEP", height: 80, component: "slider", noPaper: true },
    { height: 60, component: "bestPEEP"},
    { height: 560 + 32, ref: PVLoopchartRef },
  ],
  right: paramChartNames.map((name, index) => ({
    name,
    height: 181 +63,
    ref: (el) => (paramChartRefs.current[index].current = el),
  })),
};

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
        <Typography variant="body1" sx={{ textAlign: "left", flex: 2, fontSize: "20px"  }}>
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
          <Typography variant="body1" sx={{ textAlign: "left", flex: 2, fontSize: "20px"  }}>
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

  
return (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: "2fr 1fr", // 左侧较宽，右侧较窄（可根据需要调整）
      gap: 4,
      p: 4,
      height: "100vh",
      width: "80vw",
    }}
  >
    {/* 左侧列 */}
    <Box
      sx={{
        display: "grid",
        gridTemplateRows: "796px", // 上下两行
        gap: 4,
      }}
    >
      {/* 上行：将原有左侧和中间区域放在2列中 */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 4,
        }}
      >
        {/* 原有左侧内容 */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {layoutConfig.left.map((item, index) =>
            item.noPaper ? (
              <Box key={index} sx={{ height: item.height }}>
                {item.name && <Typography variant="h6">{item.name}</Typography>}
                {renderComponent(item)}
              </Box>
            ) : (
              <Paper key={index} elevation={3} sx={{ height: item.height, p: 2 }}>
                {item.name && <Typography variant="h6">{item.name}</Typography>}
                {renderComponent(item)}
              </Paper>
            )
          )}
        </Box>
        {/* 原有中间内容 */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {layoutConfig.middle.map((item, index) =>
            item.noPaper ? (
              <Box key={index} sx={{ height: item.height }}>
                {item.name && <Typography variant="h6">{item.name}</Typography>}
                {renderComponent(item)}
              </Box>
            ) : (
              <Paper key={index} elevation={3} sx={{ height: item.height, p: 2 }}>
                {item.name && <Typography variant="h6">{item.name}</Typography>}
                {renderComponent(item)}
              </Paper>
            )
          )}
        </Box>
      </Box>
      {/* 下行：历史PEEP图表，整行展示 */}
      <Box>
        <Paper elevation={3} sx={{ height: 181 +63, p: 2 }}>
          <Box ref={historyPEEPChartRef} sx={{ width: "100%", height: "100%" }} />
        </Paper>
      </Box>
    </Box>

    {/* 右侧列：原有的参数图表 */}
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
"use client";

import React, { useState, useEffect, useRef } from "react";
import { debounce } from "lodash";
import {
  Box,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Grid,
} from "@mui/material";

import {
  initGaugePressureChart,
  initFlowChart,
  initVolumeChart,
  initComplianceChart,
  initResistanceChart,
  initMuscularEffortChart,
  updateGaugePressureChart,
  updateFlowChart,
  updateVolumeChart,
  updateComplianceChart,
  updateResistanceChart,
  updateMuscularEffortChart,
} from "./echartsConfig";

// ===================【 固定参数 】=================== //
const WEBSOCKET_URL = "ws://132.181.62.177:10188/ws"; // 示例
const BUFFER_SIZE = 2000;            // 缓冲区最大容量
const MAX_DISPLAY_POINTS = 5000;     // 图表最大显示点数（可根据需求调整）
const POINT_INTERVAL_MS = 25;       // 推送到图表的时间间隔（ms）
const PUSH_COUNT = 8;               // 每次推送的数据点数量

// 颜色（与MATLAB近似）
const COLOR_PURPLE = "rgb(126,47,142)";
const COLOR_ORANGE = "rgb(217,83,25)";
const COLOR_GREEN  = "rgb(119,172,48)";
const COLOR_YELLOW = "rgb(237,177,32)";
const COLOR_PINK   = "rgb(162,20,47)";
const COLOR_BLUE   = "rgb(0,0,255)";
const COLOR_GRAY   = "rgb(204,204,204)";
const COLOR_BLACK  = "rgb(0,0,0)";

// ===============【 病人选择组件 】=================== //
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

export default function BreathCyclePage() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [ws, setWs] = useState(null);

  // ===============【 图表引用和实例 】================ //
  const gaugePressureRef = useRef(null);
  const flowRef = useRef(null);
  const volumeRef = useRef(null);
  const complianceRef = useRef(null);
  const resistanceRef = useRef(null);
  const muscularEffortRef = useRef(null);

  const charts = useRef({
    gaugePressure: null,
    flow: null,
    volume: null,
    compliance: null,
    resistance: null,
    muscularEffort: null,
  });

  // ===============【 数据区（显示用） 】================ //
  // 下面这些存放“当前正在显示”的数据（队列形式），长度不可超过 MAX_DISPLAY_POINTS
  const timeData = useRef(new Array(MAX_DISPLAY_POINTS).fill(0));
  const gaugePressureData = useRef(new Array(MAX_DISPLAY_POINTS).fill(0));
  const flowData = useRef(new Array(MAX_DISPLAY_POINTS).fill(0));
  const smoothFlowData = useRef(new Array(MAX_DISPLAY_POINTS).fill(0));
  const volumeData = useRef(new Array(MAX_DISPLAY_POINTS).fill(0));
  // 对于 compliance/resistance/muscularEffort，因数据多为单点或少量点，采用同样的队列方式
  // 也可只存储最近一次的值，但这里统一成数组便于扩展
  const cREOData = useRef([]);
  const cOCCData = useRef([]);
  const rREOData = useRef([]);
  const rOCCData = useRef([]);
  const inspWOBData = useRef([]);

  // ===============【 标记时间区（显示用） 】================ //
  // 存储需要标记的时间点（inspTime, pipTime, expTime, pepTime, endTime, occTime）
  // 注意：它们往往是数组形式，每个周期可能出现若干个时间点
  const inspTimeArray = useRef([]);
  const pipTimeArray = useRef([]);
  const expTimeArray = useRef([]);
  const pepTimeArray = useRef([]);
  const endTimeArray = useRef([]);
  const occTimeArray = useRef([]);

  // ===============【 数据缓冲区 】================ //
  // 用于暂存后端推送来的数据（队列方式），再以固定速率推送到图表
  const dataBuffer = useRef({
    time: [],
    gaugePressure: [],
    flow: [],
    smoothFlow: [],
    volume: [],
    inspTime: [],
    pipTime: [],
    expTime: [],
    pepTime: [],
    endTime: [],
    occTime: [],
    cREO: [],
    cOCC: [],
    rREO: [],
    rOCC: [],
    inspWOB: [],
  });

  // ===============【 WebSocket 连接 】================ //
  useEffect(() => {
    const socket = new WebSocket(WEBSOCKET_URL);
    socket.onopen = () => {
      console.log("[INFO] WebSocket 连接成功");
      setWs(socket);
      // 请求病人列表
      socket.send(JSON.stringify({ action: "get_patients" }));
    };
    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      // 获取病人列表
      if (data.type === "get_patient_list" && data.status === "success") {
        setPatients(data.data);
      }
      // 获取呼吸周期数据
      if (
        data.type === "get_parameters" &&
        data.status === "success" &&
        data.param_type === "breath_cycle"
      ) {
        // 将接收到的 JSON 数据放入缓冲区
        handleIncomingBreathCycle(data.data);
      }
      if (data.type === "get_parameters" && data.status === "failure") {
        alert(data.message);
      }
    };
    socket.onclose = () => {
      console.log("[INFO] WebSocket 连接断开");
      setWs(null);
    };
    return () => {
      socket.close();
    };
  }, []);


  function toArray(data) {
    if (Array.isArray(data)) return data;
    if (data === null || data === undefined) return [];
    // 如果是单个值，就包一下
    return [data];
  }

  // ===============【 处理后端发来的 JSON 】================ //
  const handleIncomingBreathCycle = (incomingData) => {
    const {
      time = [],
      gaugePressure = [],
      flow = [],
      smoothFlow = [],
      volume = [],
      inspTime = [],
      pipTime = [],
      expTime = [],
      pepTime = [],
      endTime = [],
      occTime = [],
      cREO = [],
      cOCC = [],
      rREO = [],
      rOCC = [],
      inspWOB = [],
    } = incomingData;

    // 将数据转换为数组
    const inspTimeArrayt = toArray(inspTime);
    const pipTimeArrayt = toArray(pipTime);
    const expTimeArrayt = toArray(expTime);
    const pepTimeArrayt = toArray(pepTime);
    const endTimeArrayt = toArray(endTime);
    const inspWOBArrayt = toArray(inspWOB);
    const cREOArrayt = toArray(cREO);
    const cOCCArrayt = toArray(cOCC);
    const rREOArrayt = toArray(rREO);
    const rOCCArrayt = toArray(rOCC);

    // 将数组数据合并到 dataBuffer
    dataBuffer.current.time.push(...time);
    dataBuffer.current.gaugePressure.push(...gaugePressure);
    dataBuffer.current.flow.push(...flow);
    dataBuffer.current.smoothFlow.push(...smoothFlow);
    dataBuffer.current.volume.push(...volume);
    dataBuffer.current.occTime.push(...occTime);
    dataBuffer.current.inspTime.push(...inspTimeArrayt);
    dataBuffer.current.pipTime.push(...pipTimeArrayt);
    dataBuffer.current.expTime.push(...expTimeArrayt);
    dataBuffer.current.pepTime.push(...pepTimeArrayt);
    dataBuffer.current.endTime.push(...endTimeArrayt);

    if (cOCC !== undefined) dataBuffer.current.cOCC.push(...cOCCArrayt);
    if (rOCC !== undefined) dataBuffer.current.rOCC.push(...rOCCArrayt);
    if (inspWOB !== undefined) dataBuffer.current.inspWOB.push(...inspWOBArrayt);

    if (cREO !== undefined) dataBuffer.current.cREO.push(...cREOArrayt);
    if (rREO !== undefined) dataBuffer.current.rREO.push(...rREOArrayt);

    // 如果缓冲区超出容量，移除多余数据
    const trimBuffer = (arr) => {
      if (arr.length > BUFFER_SIZE) {
        arr.splice(0, arr.length - BUFFER_SIZE);
      }
    };
    Object.keys(dataBuffer.current).forEach((key) => {
      trimBuffer(dataBuffer.current[key]);
    });
  };

  // ===============【 初始化图表 】================ //
  useEffect(() => {
    charts.current.gaugePressure = initGaugePressureChart(
      gaugePressureRef,
      timeData,
      gaugePressureData
    );
    charts.current.flow = initFlowChart(flowRef, timeData, flowData, smoothFlowData);
    charts.current.volume = initVolumeChart(volumeRef, timeData, volumeData);
    charts.current.compliance = initComplianceChart(complianceRef);
    charts.current.resistance = initResistanceChart(resistanceRef);
    charts.current.muscularEffort = initMuscularEffortChart(muscularEffortRef);

    // 监听窗口大小变化
    const handleResize = debounce(() => {
      Object.values(charts.current).forEach((chart) => {
        if (chart) chart.resize();
      });
    }, 300);

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      // 销毁图表实例
      Object.values(charts.current).forEach((chart) => {
        if (chart) chart.dispose();
      });
    };
  }, []);

  // ===============【 定时器：将缓冲区数据推到图表 】================ //
  useEffect(() => {
    const timer = setInterval(() => {
      pushDataToCharts();
    }, POINT_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, []);


  /**
   * 清理过期的时间索引和对应的参数数据
   * 过期数据：任何时间索引早于 timeData 最早时间点的数据
   */
  const cleanExpiredData = () => {
    // 如果没有时间数据，则直接返回
    if (timeData.current.length === 0) return;
    
    // 获取当前显示的最早时间点
    const minDisplayTime = timeData.current[0];
    
    // 清理 inspTime 及其对应的 cREO, rREO, inspWOB 数据
    cleanTimeIndexedData(inspTimeArray.current, minDisplayTime, [
      { array: cREOData.current },
      { array: rREOData.current },
      { array: inspWOBData.current }
    ]);
    
    // 清理 occTime 及其对应的 cOCC, rOCC 数据
    cleanTimeIndexedData(occTimeArray.current, minDisplayTime, [
      { array: cOCCData.current },
      { array: rOCCData.current }
    ]);
    
    // 清理其他时间索引（不需要同步清理值数据）
    cleanTimeIndexedData(pipTimeArray.current, minDisplayTime);
    cleanTimeIndexedData(expTimeArray.current, minDisplayTime);
    cleanTimeIndexedData(pepTimeArray.current, minDisplayTime);
    cleanTimeIndexedData(endTimeArray.current, minDisplayTime);
  };

  /**
   * 清理特定时间索引数组及其关联的数据数组
   * @param {Array} timeArray - 时间索引数组
   * @param {number} minTime - 最小有效时间点
   * @param {Array} linkedArrays - 与时间索引关联的数据数组列表
   */
  const cleanTimeIndexedData = (timeArray, minTime, linkedArrays = []) => {
    let deleteCount = 0;
    
    // 计算需要删除的数据点数量
    for (let i = 0; i < timeArray.length; i++) {
      if (timeArray[i] < minTime) {
        deleteCount++;
      } else {
        break; // 时间数组应该是有序的，一旦找到大于等于 minTime 的点就可以停止
      }
    }
    
    // 如果没有需要删除的点，直接返回
    if (deleteCount === 0) return;
    
    // 删除时间索引中的过期数据
    timeArray.splice(0, deleteCount);
    
    // 同步删除所有关联数组中的对应数据
    linkedArrays.forEach(item => {
      if (item.array && Array.isArray(item.array)) {
        item.array.splice(0, deleteCount);
      }
    });
  };





  const pushDataToCharts = () => {
    // 如果缓冲区中没有数据，则不推送
    if (dataBuffer.current.time.length === 0) return;

    // 每次从缓冲区取 PUSH_COUNT 个点
    const newTime = dataBuffer.current.time.splice(0, PUSH_COUNT);
    const newGaugePressure = dataBuffer.current.gaugePressure.splice(0, PUSH_COUNT);
    const newFlow = dataBuffer.current.flow.splice(0, PUSH_COUNT);
    const newSmoothFlow = dataBuffer.current.smoothFlow.splice(0, PUSH_COUNT);
    const newVolume = dataBuffer.current.volume.splice(0, PUSH_COUNT);

    // 标记时间点（这些大多是离散点，可能比 PUSH_COUNT 少）
    const newInspTime = dataBuffer.current.inspTime.splice(0, PUSH_COUNT);
    const newPipTime = dataBuffer.current.pipTime.splice(0, PUSH_COUNT);
    const newExpTime = dataBuffer.current.expTime.splice(0, PUSH_COUNT);
    const newPepTime = dataBuffer.current.pepTime.splice(0, PUSH_COUNT);
    const newEndTime = dataBuffer.current.endTime.splice(0, PUSH_COUNT);
    const newOccTime = dataBuffer.current.occTime.splice(0, PUSH_COUNT);

    // 对于 compliance/resistance/muscularEffort 只要把值拿出来即可（若 PUSH_COUNT>1，会依次取多个）
    const newCREO = dataBuffer.current.cREO.splice(0, PUSH_COUNT);
    const newCOCC = dataBuffer.current.cOCC.splice(0, PUSH_COUNT);
    const newRREO = dataBuffer.current.rREO.splice(0, PUSH_COUNT);
    const newROCC = dataBuffer.current.rOCC.splice(0, PUSH_COUNT);
    const newInspWOB = dataBuffer.current.inspWOB.splice(0, PUSH_COUNT);

    // 将新数据 push 到“显示数组”尾部，超出最大长度则 shift 掉前面的数据
    appendQueue(timeData.current, newTime);
    appendQueue(gaugePressureData.current, newGaugePressure);
    appendQueue(flowData.current, newFlow);
    appendQueue(smoothFlowData.current, newSmoothFlow);
    appendQueue(volumeData.current, newVolume);

    // 标记时间点也需要进行合并存储
    appendQueue(inspTimeArray.current, newInspTime);
    appendQueue(pipTimeArray.current, newPipTime);
    appendQueue(expTimeArray.current, newExpTime);
    appendQueue(pepTimeArray.current, newPepTime);
    appendQueue(endTimeArray.current, newEndTime);
    appendQueue(occTimeArray.current, newOccTime);

    // compliance, resistance, muscularEffort
    appendQueue(cREOData.current, newCREO);
    appendQueue(cOCCData.current, newCOCC);
    appendQueue(rREOData.current, newRREO);
    appendQueue(rOCCData.current, newROCC);
    appendQueue(inspWOBData.current, newInspWOB);

    cleanExpiredData();


    // 更新图表
    if (charts.current.gaugePressure) {
      updateGaugePressureChart(
        charts.current.gaugePressure,
        timeData.current,
        gaugePressureData.current,
        {
          inspTime: inspTimeArray.current,
          pipTime: pipTimeArray.current,
          expTime: expTimeArray.current,
          pepTime: pepTimeArray.current,
          endTime: endTimeArray.current,
        },
        {
          purple: COLOR_PURPLE,
          orange: COLOR_ORANGE,
          green: COLOR_GREEN,
          yellow: COLOR_YELLOW,
          pink: COLOR_PINK,
          black: COLOR_BLACK,
        }
      );
    }

    if (charts.current.flow) {
      updateFlowChart(
        charts.current.flow,
        timeData.current,
        flowData.current,
        smoothFlowData.current,
        {
          inspTime: inspTimeArray.current,
          pipTime: pipTimeArray.current,
          expTime: expTimeArray.current,
          pepTime: pepTimeArray.current,
          endTime: endTimeArray.current,
        },
        {
          purple: COLOR_PURPLE,
          orange: COLOR_ORANGE,
          green: COLOR_GREEN,
          yellow: COLOR_YELLOW,
          pink: COLOR_PINK,
          black: COLOR_BLACK,
          gray: COLOR_GRAY,
        }
      );
    }

    if (charts.current.volume) {
      updateVolumeChart(
        charts.current.volume,
        timeData.current,
        volumeData.current
      );
    }

    if (charts.current.compliance) {
      updateComplianceChart(
        charts.current.compliance,
        timeData.current,
        cREOData.current,
        cOCCData.current,
        {
          purple: COLOR_PURPLE,
          orange: COLOR_ORANGE,
          pink: COLOR_PINK,
        },
        {
          // 需要 occTime 画 cOCC，inspTime(1) 画 cREO
          occTime: occTimeArray.current,
          inspTime: inspTimeArray.current,
        }
      );
    }

    if (charts.current.resistance) {
      updateResistanceChart(
        charts.current.resistance,
        timeData.current,
        rREOData.current,
        rOCCData.current,
        {
          orange: COLOR_ORANGE,
          pink: COLOR_PINK,
        },
        {
          occTime: occTimeArray.current,
          inspTime: inspTimeArray.current,
        }
      );
    }

    if (charts.current.muscularEffort) {
      updateMuscularEffortChart(
        charts.current.muscularEffort,
        timeData.current,
        inspWOBData.current,
        {
          blue: COLOR_BLUE,
        },
        {
          inspTime: inspTimeArray.current,
        }
      );
    }
  };

  // 将新数据追加到队列，若超出 MAX_DISPLAY_POINTS，则删除头部多余数据
  const appendQueue = (queueArray, newData) => {
    queueArray.push(...newData);
    if (queueArray.length > MAX_DISPLAY_POINTS) {
      queueArray.splice(0, queueArray.length - MAX_DISPLAY_POINTS);
    }
  };

  // ===============【 选择病人处理 】================ //
  const handlePatientChange = (event) => {
    const selectedId = event.target.value;
    setSelectedPatient(selectedId);

    // 1. 清空显示数据
    timeData.current.fill(0);
    gaugePressureData.current.fill(0);
    flowData.current.fill(0);
    smoothFlowData.current.fill(0);
    volumeData.current.fill(0);

    cREOData.current = [];
    cOCCData.current = [];
    rREOData.current = [];
    rOCCData.current = [];
    inspWOBData.current = [];

    inspTimeArray.current = [];
    pipTimeArray.current = [];
    expTimeArray.current = [];
    pepTimeArray.current = [];
    endTimeArray.current = [];
    occTimeArray.current = [];

    // 2. 清空缓冲区
    Object.keys(dataBuffer.current).forEach((key) => {
      dataBuffer.current[key] = [];
    });

    // 3. 请求新的病人数据
    if (ws) {
      ws.send(JSON.stringify({ action: "stop", patient_id: selectedId }));
      ws.send(
        JSON.stringify({
          action: "get_parameters",
          patient_id: selectedId,
          param_type: ["breath_cycle"],
        })
      );
    }
  };


  const chartheight = 300;
  return (
    <Box sx={{ p: 2, width: "100%vw", height: "100vh", overflow: "auto" }}>
      <Box sx={{ mb: 2 }}>
        <PatientSelector
          patients={patients}
          selectedPatient={selectedPatient}
          onChange={handlePatientChange}
        />
      </Box>
  
      {/* 使用 Grid 布局实现 3 行 2 列的图表排列 */}
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Paper sx={{ p: 1 }}>
            <Box ref={gaugePressureRef} sx={{ width: "100%", height: chartheight }} />
          </Paper>
        </Grid>

        <Grid item xs={6}>
          <Paper sx={{ p: 1 }}>
            <Box ref={complianceRef} sx={{ width: "100%", height: chartheight }} />
          </Paper>
        </Grid>
  
  
        <Grid item xs={6}>
          <Paper sx={{ p: 1 }}>
            <Box ref={flowRef} sx={{ width: "100%", height: chartheight }} />
          </Paper>
        </Grid>


        <Grid item xs={6}>
          <Paper sx={{ p: 1 }}>
            <Box ref={resistanceRef} sx={{ width: "100%", height: chartheight }} />
          </Paper>
        </Grid>


  
        <Grid item xs={6}>
          <Paper sx={{ p: 1 }}>
            <Box ref={volumeRef} sx={{ width: "100%", height: chartheight }} />
          </Paper>
        </Grid>

  
        <Grid item xs={6}>
          <Paper sx={{ p: 1 }}>
            <Box ref={muscularEffortRef} sx={{ width: "100%", height: chartheight }} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
  
}

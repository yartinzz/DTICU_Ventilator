"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    initECGChart,
    updateECGChart,
    initEMGChart,
    updateEMGChart,
    initImpedanceChart,
    updateImpedanceChart,
    initEEGChart,
    updateEEGChart,
    initRPeakChart,
    updateRPeakChart,
    initRFeatureChart,
    updateRFeatureChart
} from "./echartsConfig.js";
import {
  Box,
  Grid,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Avatar,
  Chip,
  Stack,
  Card, CardContent,
} from "@mui/material";
import PersonIcon from '@mui/icons-material/Person';
import InfoIcon from '@mui/icons-material/Info';
import { debounce } from "lodash";
import { useTranslation } from "react-i18next";

// --- Constants ---
const DEFAULT_UPDATE_POINTS = 10;
const INITIAL_DATA_POINTS = 2501;
const POINT_INTERVAL_MS = 1000 / 250;
const CHART_UPDATE_INTERVAL_MS = 40;
const WebSocketUrl = "ws://132.181.62.177:10188/ws";


// --- Patient Selector Component ---
const PatientSelector = ({ patients, selectedPatient, onChange }) => {
  const { t } = useTranslation();
  return (
    <FormControl variant="outlined" fullWidth>
      <InputLabel id="patient-select-label">{t('patientSelector.select')}</InputLabel>
      <Select
        labelId="patient-select-label"
        value={selectedPatient || ""}
        onChange={onChange}
        label={t('patientSelector.select')}
      >
        <MenuItem value="">
          <em>{t('patientSelector.none')}</em>
        </MenuItem>
        {patients.map((p) => (
          <MenuItem key={p.patient_id} value={p.patient_id}>
            {t('patientSelector.patientItem', { id: p.patient_id, name: p.name })}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default function VentModePage() {
  const { t } = useTranslation();

  const modeConfig = {
    S: {
      bg: 'success.light',
      textColor: 'success.contrastText',
      label: t('mode.S'),
      divider: 'success.light',
      chipColor: 'success',
    },
    O: {
      bg: 'primary.main',
      textColor: 'common.white',
      label: t('mode.O'),
      divider: 'primary.light',
      chipColor: 'primary',
    },
    A: {
      bg: 'warning.light',
      textColor: 'warning.contrastText',
      label: t('mode.A'),
      divider: 'warning.light',
      chipColor: 'warning',
    },
    C: {
      bg: 'error.light',
      textColor: 'error.contrastText',
      label: t('mode.C'),
      divider: 'error.light',
      chipColor: 'error',
    },
  };

  // --- State & Refs ---
  const [patients, setPatients]     = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [ws, setWs]                 = useState(null);
  const [isBufferReady, setIsBufferReady] = useState(false);

  const updatePoints = useRef(DEFAULT_UPDATE_POINTS);
  const timeData     = useRef(Array.from({ length: INITIAL_DATA_POINTS }, (_, i) => (i * POINT_INTERVAL_MS) / 1000));

  // --- State & Refs for waveforms ---
  const ecgChartRef       = useRef(null);
  const emgChartRef       = useRef(null);
  const impChartRef       = useRef(null);
  const eegChartRef       = useRef(null);

  const ecgData           = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
  const emgData           = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
  const impData           = useRef(new Array(INITIAL_DATA_POINTS).fill(0));
  const eegData           = useRef(new Array(INITIAL_DATA_POINTS).fill(0));

  const ecgBuffer         = useRef([]);
  const emgBuffer         = useRef([]);
  const impBuffer         = useRef([]);
  const eegBuffer         = useRef([]);



  const rPeakChartRef    = useRef(null);
  const rFeatureChartRef = useRef(null);
  const [suggestedMode, setSuggestedMode] = useState("O");
  const [baseInfo, setBaseInfo] = useState({ sap: null, dap: null, map: null, hr: null, rr: null, spo2: null, t: null, po2: null, pco2: null, ph: null, gender: '', age: null, height: null, weight: null });

  const { bg, textColor, label, divider, chipColor } = modeConfig[suggestedMode] || modeConfig['O'];

  // --- WebSocket Setup ---
  useEffect(() => {
    rPeakChartRef.current = initRPeakChart(rPeakChartRef);
    rFeatureChartRef.current = initRFeatureChart(rFeatureChartRef);

    const socket = initializeWebSocket(
      WebSocketUrl,
      () => {
        console.log("[WS] Connected");
        setWs(socket);
        socket.send(JSON.stringify({ action: "get_patients" }));
      },
      (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.type === "get_patient_list" && msg.status === "success") {
          setPatients(Array.isArray(msg.data) ? msg.data.map(({ patient_id, name }) => ({ patient_id, name })) : []);
          return;
        }

        if (msg.type === "get_parameters" && msg.status === "success") {
          switch (msg.param_type) {
            case "ECG":

              ecgBuffer.current.push(...msg.data.ecg.values);
              if (ecgBuffer.current.length > 2500) ecgBuffer.current.splice(0, ecgBuffer.current.length - 2500);

              emgBuffer.current.push(...msg.data.emg.values);
              if (emgBuffer.current.length > 2500) emgBuffer.current.splice(0, emgBuffer.current.length - 2500);

              impBuffer.current.push(...msg.data.impedance.values);
              if (impBuffer.current.length > 2500) impBuffer.current.splice(0, impBuffer.current.length - 2500);

              eegBuffer.current.push(...msg.data.eeg.values);
              if (eegBuffer.current.length > 2500) eegBuffer.current.splice(0, eegBuffer.current.length - 2500);

              break;
            case "ECG_QRS_INFO":
              const analysis = msg.data.analysis_data || msg.data.analysis;
              const vitals   = msg.data.vitals_data   || msg.data.vitals;
              updateRPeakChart(rPeakChartRef.current, analysis.Signal_filter_index, analysis.ecg_filter, analysis.E1);
              updateRFeatureChart(rFeatureChartRef.current, analysis.Signal_mean_index, analysis.Signal_mean, analysis.ecg_mean);
              setSuggestedMode(vitals.ventilator_mode);
              setBaseInfo({ sap: vitals.SAP, dap: vitals.DAP, map: vitals.MAP, hr: vitals.HR, rr: vitals.RR, spo2: vitals.SpO2, t: vitals.T, po2: vitals.PO2, pco2: vitals.PCO2, ph: vitals.pH, gender: vitals.gender, age: vitals.age, height: vitals.height, weight: vitals.weight });
              break;
            default:
              break;
          }
          if (!isBufferReady && ecgBuffer.current.length > 200) setIsBufferReady(true);
          return;
        }

        if (msg.type === "get_parameters" && msg.status === "failure") {
          alert(msg.message);
          setSelectedPatient(null);
        }
      },
      () => {
        console.log("[WS] Disconnected");
        setWs(null);
        setIsBufferReady(false);
      }
    );
    return () => socket.close();
  }, []);

  // --- Chart Init & Update ---
  useEffect(() => {
    if (!selectedPatient || !isBufferReady || !ecgChartRef.current || !rPeakChartRef.current || !rFeatureChartRef.current) return;

    const ecgChart = initECGChart(ecgChartRef, timeData, ecgData);
    const emgChart = initEMGChart(emgChartRef, timeData, emgData);
    const impChart = initImpedanceChart(impChartRef, timeData, impData);
    const eegChart = initEEGChart(eegChartRef, timeData, eegData);



    const resizeHandler = debounce(() => { 
      ecgChart.resize(); 
      emgChart.resize();
      impChart.resize();
      eegChart.resize();
      rPeakChartRef.current?.resize(); 
      rFeatureChartRef.current?.resize(); }, 300);
    window.addEventListener("resize", resizeHandler);

    const blob = new Blob([`let interval = null; self.onmessage = e => { if (e.data === 'start' && !interval) { interval = setInterval(() => self.postMessage('tick'), ${CHART_UPDATE_INTERVAL_MS}); } if (e.data === 'stop') { clearInterval(interval); interval = null; } };`], { type: "application/javascript" });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = () => {
      updateECGChart(ecgChart, ecgBuffer, ecgData, timeData, updatePoints);
      updateEMGChart(emgChart, emgBuffer, emgData, timeData, updatePoints);
      updateImpedanceChart(impChart, impBuffer, impData, timeData, updatePoints);
      updateEEGChart(eegChart, eegBuffer, eegData, timeData, updatePoints);
    };
    worker.postMessage("start");
    return () => { window.removeEventListener("resize", resizeHandler); ecgChart.dispose(); worker.postMessage("stop"); worker.terminate(); };
  }, [selectedPatient, isBufferReady]);

  const handlePatientChange = (e) => {
    const pid = e.target.value;
    setSelectedPatient(pid);
    setIsBufferReady(false);
    ecgData.current.fill(0);
    ecgBuffer.current = [];
    if (ws) {
      ws.send(JSON.stringify({ action: "stop", patient_id: pid }));
      ws.send(JSON.stringify({ action: "get_parameters", patient_id: pid, param_type: ["ECG", "ECG_QRS_INFO"] }));
    }
  };

  const LEFT_WIDTH = 17;
  const RIGHT_WIDTH = 7;
  const CHART_SPACING = 2;
  const SUB_CHART_GAP = 2;
  const CHART_HEIGHT = 240;


  return (
    <Box sx={{ p: 2, height: '100vh', width: '80vw' }}>
      <Grid container alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Grid item xs={4}>
          <PatientSelector patients={patients} selectedPatient={selectedPatient} onChange={handlePatientChange} />
        </Grid>
      </Grid>

      <Grid container spacing={CHART_SPACING} columns={24}>
        {/* Left: Dynamic Charts */}
        <Grid item xs={LEFT_WIDTH}>
          {/* Top 2×2 chart grid with bottom margin */}
          <Grid container spacing={CHART_SPACING} sx={{ mb: SUB_CHART_GAP }}>
            {[
              { ref: ecgChartRef, title: t('chart.ecgWaveform') },
              { ref: emgChartRef, title: t('chart.emgWaveform') },
              { ref: impChartRef, title: t('chart.impWaveform') },
              { ref: eegChartRef, title: t('chart.eegWaveform') }
            ].map(({ ref, title }, i) => (
              <Grid item xs={6} key={i}>
                <Paper elevation={2} sx={{ p: 1, height: CHART_HEIGHT }}>
                  <Typography variant="subtitle1" gutterBottom>{title}</Typography>
                  <Box ref={ref} sx={{ width: '100%', height: '85%' }} />
                </Paper>
              </Grid>
            ))}
          </Grid>

          {/* Sub charts below top grid */}
          <Paper elevation={2} sx={{ mb: 2, p: 2, height: CHART_HEIGHT }}>
            <Typography variant="subtitle1">{t('chart.rPeak')}</Typography>
            <Box ref={rPeakChartRef} sx={{ width: '100%', height: '100%' }} />
          </Paper>

          <Paper elevation={2} sx={{ p: 2, height: CHART_HEIGHT }}>
            <Typography variant="subtitle1">{t('chart.rFeature')}</Typography>
            <Box ref={rFeatureChartRef} sx={{ width: '100%', height: '100%' }} />
          </Paper>
        </Grid>

        {/* Right: Parameter Display */}
        <Grid item xs={RIGHT_WIDTH}>
          <Paper elevation={1} sx={{ mb: 2, height: 496, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3 }}>
            <Stack spacing={2} alignItems="center">
              <Typography variant="h5" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 }}>{t('suggestMode.title')}</Typography>
              <Avatar sx={{ width: 150, height: 150, bgcolor: bg, boxShadow: 3 }}>
                <Typography variant="h1" component="span" sx={{ color: textColor, fontWeight: 'bold' }}>{suggestedMode}</Typography>
              </Avatar>
              <Typography variant="h6" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, color: bg }}>{label}</Typography>
              <Divider sx={{ width: '120%', borderColor: divider, my: 2 }} />
              <Chip label={t('suggestMode.optimal')} color={chipColor} size="medium" sx={{ textTransform: 'uppercase', fontWeight: 500 }} />
            </Stack>
          </Paper>

          <Paper elevation={1} sx={{ p: 2, height: 496, overflowY: 'auto' }}>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <InfoIcon sx={{ fontSize: 30 }} />
                  <Typography variant="h5" sx={{ fontWeight: 500 }}>
                    {t('baseInfo.title')}
                  </Typography>
                </Stack>

                {/* Demographics */}
                <Stack spacing={1}>
                  <Typography variant="h6" sx={{ fontWeight: 400 }}>
                    {t('demographics.title')}
                  </Typography>
                  <Card variant="outlined">
                    <CardContent>
                      <Grid container spacing={1}>
                        {[
                          ['age', '岁'],
                          ['gender', ''],
                          ['height', 'cm'],
                          ['weight', 'kg'],
                        ].map(([key, unit]) => (
                          <Grid item xs={6} key={key}>
                            <Box
                              display="flex"
                              justifyContent="space-between"
                              sx={{ px: 1 }}
                            >
                              <Typography color="text.secondary">
                                {t(`demographics.${key}`)}
                              </Typography>
                              <Typography>
                                {baseInfo[key] != null
                                  ? `${baseInfo[key]} ${unit}`
                                  : '-'}
                              </Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </Card>
                </Stack>

                {/* Vitals */}
                <Stack spacing={1}>
                  <Typography variant="h6" sx={{ fontWeight: 400 }}>
                    {t('vitals.title')}
                  </Typography>
                  <Card variant="outlined">
                    <CardContent>
                      <Grid container spacing={1}>
                        {[
                          ['sap', 'mmHg'],
                          ['dap', 'mmHg'],
                          ['map', 'mmHg'],
                          ['hr', 'bpm'],
                          ['rr', 'breaths/min'],
                          ['spo2', '%'],
                          ['t', '°C'],
                          ['po2', 'mmHg'],
                          ['pco2', 'mmHg'],
                          ['ph', ''],
                        ].map(([key, unit]) => (
                          <Grid item xs={6} key={key}>
                            <Box
                              display="flex"
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{ px: 1 }}
                            >
                              <Typography
                                color="text.secondary"
                                sx={{ fontSize: '1rem' }}
                              >
                                {t(`vitals.${key}`)}
                              </Typography>
                              <Typography sx={{ fontSize: '1rem' }}>
                                {baseInfo[key] != null
                                  ? `${baseInfo[key]} ${unit}`
                                  : '-'}
                              </Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </Card>
                </Stack>
              </Stack>
            </Paper>


        </Grid>
      </Grid>
    </Box>
  );
}

function initializeWebSocket(url, onOpen, onMessage, onClose) {
  const socket = new WebSocket(url);
  socket.onopen = onOpen;
  socket.onmessage = onMessage;
  socket.onclose = onClose;
  return socket;
}

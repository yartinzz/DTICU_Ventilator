"use client";
import React, { useState } from 'react';
import {
  Grid,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider
} from '@mui/material';
import ReactECharts from 'echarts-for-react';

import { Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';


export default function GlycemiaPage() {

  const { t } = useTranslation();
  // 选择患者
  const [patient, setPatient] = useState('');

  // 四个滑动条示例数值
  const [insulinRate, setInsulinRate] = useState(3);    // 例如：3 mL/h
  const [maintainRate, setMaintainRate] = useState(75); // 例如：75 mL/h
  const [enteralRate, setEnteralRate] = useState(20);   // 例如：20 mL/h
  const [dextroseShot, setDextroseShot] = useState(12.5); // 例如：12.5 g

  // 下拉框事件
  const handleChangePatient = (event) => {
    setPatient(event.target.value);
  };

  // ------------------ 血糖图表配置 ------------------
  const glucoseOption = {
    title: { text: t('Blood glucose levels (last 12 hours)'), left: 'center', top: 10, textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: [t('Actual'), t('Predicted Min'), t('Predicted Max')], top: 40, left: 'center' },
    xAxis: { type: 'category', boundaryGap: false, data: [
      t('9:00 AM'), t('10:00 AM'), t('11:00 AM'), t('12:00 PM'),
      t('1:00 PM'), t('2:00 PM'), t('3:00 PM'), t('4:00 PM'),
      t('5:00 PM'), t('6:00 PM'), t('7:00 PM'), t('8:00 PM'),
    ]},
    yAxis: { type: 'value', name: t('mg/dL'), min: 100, max: 200 },
    series: [
      { name: t('Actual'), type: 'line', smooth: true, data: [120, 125, 130, 140, 150, 155, 158, 160, null, null, null, null] },
      { name: t('Predicted Min'), type: 'line', smooth: true, lineStyle: { type: 'dashed' }, data: [null, null, null, null, null, null, null, 160, 155, 150, 147, 145] },
      { name: t('Predicted Max'), type: 'line', smooth: true, lineStyle: { type: 'dashed' }, data: [null, null, null, null, null, null, null, 160, 162, 166, 172, 176] }
    ]
  };

  // ------------------ 胰岛素敏感性图表配置 ------------------
  const insulinSensitivityOption = {
    title: { text: t('Insulin Sensitivity (last 12 hours)'), left: 'center', top: 10, textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', boundaryGap: false, data: [
      t('9:00 AM'), t('10:00 AM'), t('11:00 AM'), t('12:00 PM'),
      t('1:00 PM'), t('2:00 PM'), t('3:00 PM'), t('4:00 PM'),
      t('5:00 PM'), t('6:00 PM'), t('7:00 PM'), t('8:00 PM'),
    ]},
    yAxis: { type: 'value', name: t('Value') },
    series: [ { data: [5,4.8,4.5,4.2,4,3.8,3.5,3.2], type: 'line', smooth: true, name: t('Insulin Sensitivity') } ]
  };

  const InfusionCard = ({ title, lines, sliderValue, onChangeSlider, sliderMin = 0, sliderMax = 100 }) => (
    <Card sx={{ width: '100%', height: 230, mb: 1, p: 1, borderRadius: 1, boxShadow: 3, transition:'transform 0.2s', '&:hover':{transform:'scale(1.02)'} }}>
      <CardContent>
        <Typography variant="h6" align="center" sx={{ color: '#1B4F72', fontWeight:'bold' }}>{title}</Typography>
        <Divider sx={{ borderColor:'#1B4F72', my:1 }} />
        {lines.map((line,idx)=>(<Typography key={idx} variant="body1" sx={{ fontSize:'1rem' }}>{line}</Typography>))}
        <Slider value={sliderValue} min={sliderMin} max={sliderMax} step={1} onChange={(e,val)=>onChangeSlider(val)} sx={{ mt:2 }} />
      </CardContent>
    </Card>
  );

  return (
    <Grid container spacing={2} sx={{ p:2 }}>
      <Grid item xs={12}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="patient-select-label">{t('Select Patient')}</InputLabel>
          <Select
            labelId="patient-select-label"
            id="patient-select"
            label={t('Select Patient')}
            value={patient}
            onChange={handleChangePatient}
          >
            <MenuItem value=""><em>{t('Please select')}</em></MenuItem>
            <MenuItem value="patient1">1 - {t('testPatient1')}</MenuItem>
            <MenuItem value="patient2">{t('patient')} 2</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} container spacing={2}>
        <Grid item xs={12} md={2} container spacing={0}>
          <InfusionCard
            title={t('Insulin Infusion')}
            lines={[
              `${t('Rate')}: ${insulinRate} mL/h`,
              `${t('Concentration')}: 1 U/mL`,
              `${t('Route')}: IV`,
              `${t('Constant')}: ${t('No')}`
            ]}
            sliderValue={insulinRate} onChangeSlider={setInsulinRate} sliderMin={0} sliderMax={8}
          />
          <InfusionCard
            title={t('Maintenance Nutrition')}
            lines={[
              `${t('Rate')}: ${maintainRate} mL/h`,
              `${t('Constant')}: ${t('Yes')}`,
              `${t('Type')}: 30% ${t('glucose')}`
            ]}
            sliderValue={maintainRate} onChangeSlider={setMaintainRate} sliderMin={0} sliderMax={100}
          />
          <InfusionCard
            title={t('Enteral Nutrition')}
            lines={[
              `${t('Rate')}: ${enteralRate} mL/h (100%)`,
              `${t('Constant')}: ${t('No')}`,
              `${t('Type')}: ${t('Peptamen AF')}`
            ]}
            sliderValue={enteralRate} onChangeSlider={setEnteralRate} sliderMin={0} sliderMax={50}
          />
          <InfusionCard
            title={t('Dextrose Shot')}
            lines={[
              `${t('Size')}: ${dextroseShot} ml`,
              `${t('Carbs')}: 300 g/L`,
              `${t('Calories')}: 1200 kcal/L`,
              `${t('Administered at')}: 3:00 PM`
            ]}
            sliderValue={dextroseShot} onChangeSlider={setDextroseShot} sliderMin={0} sliderMax={25}
          />
        </Grid>

        <Grid item xs={12} md={9}>
          <Grid container spacing={2}>
            <Grid item xs={12}><ReactECharts option={glucoseOption} style={{ height: '470px' }} /></Grid>
            <Grid item xs={12}><ReactECharts option={insulinSensitivityOption} style={{ height: '470px' }} /></Grid>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
}

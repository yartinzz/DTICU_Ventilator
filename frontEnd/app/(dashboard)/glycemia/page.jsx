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

export default function GlycemiaPage() {
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
    title: {
      text: 'Blood glucose levels (last 12 hours)',
      left: 'center',
      top: 10,
      textStyle: {
        fontSize: 14
      }
    },
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['Actual', 'Predicted Min', 'Predicted Max'],
      top: 40,
      left: 'center'
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [
        '9:00 AM',
        '10:00 AM',
        '11:00 AM',
        '12:00 PM',
        '1:00 PM',
        '2:00 PM',
        '3:00 PM',
        '4:00 PM',
        '5:00 PM',
        '6:00 PM',
        '7:00 PM',
        '8:00 PM'
      ]
    },
    yAxis: {
      type: 'value',
      name: 'mg/dL',
      min: 100,
      max: 200
    },
    series: [
      {
        name: 'Actual',
        type: 'line',
        smooth: true,
        data: [120, 125, 130, 140, 150, 155, 158, 160, null, null, null, null]
      },
      {
        name: 'Predicted Min',
        type: 'line',
        smooth: true,
        lineStyle: {
          type: 'dashed'
        },
        data: [null, null, null, null, null, null, null, 160, 155, 150, 147, 145]
      },
      {
        name: 'Predicted Max',
        type: 'line',
        smooth: true,
        lineStyle: {
          type: 'dashed'
        },
        data: [null, null, null, null, null, null, null, 160, 162, 166, 172, 176]
      }
    ]
  };

  // ------------------ 胰岛素敏感性图表配置 ------------------
  const insulinSensitivityOption = {
    title: {
      text: 'Insulin Sensitivity (last 12 hours)',
      left: 'center',
      top: 10,
      textStyle: {
        fontSize: 14
      }
    },
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [
        '9:00 AM',
        '10:00 AM',
        '11:00 AM',
        '12:00 PM',
        '1:00 PM',
        '2:00 PM',
        '3:00 PM',
        '4:00 PM',
        '5:00 PM',
        '6:00 PM',
        '7:00 PM',
        '8:00 PM'
      ]
    },
    yAxis: {
      type: 'value',
      name: 'Value'
    },
    series: [
      {
        data: [5, 4.8, 4.5, 4.2, 4, 3.8, 3.5, 3.2],
        type: 'line',
        smooth: true,
        name: 'Insulin Sensitivity'
      }
    ]
  };

  // 公共卡片组件，方便复用
  const InfusionCard = ({
    title,
    lines,
    sliderValue,
    onChangeSlider,
    sliderMin = 0,
    sliderMax = 100
  }) => (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          {title}
        </Typography>
        {lines.map((line, idx) => (
          <Typography key={idx} variant="body2">
            {line}
          </Typography>
        ))}
        {/* 滑动条 */}
        <Slider
          value={sliderValue}
          min={sliderMin}
          max={sliderMax}
          step={1}
          onChange={(e, newVal) => onChangeSlider(newVal)}
          sx={{ mt: 2 }}
        />
      </CardContent>
    </Card>
  );

  return (
    <Grid container spacing={2} sx={{ p: 2 }}>
      {/* 顶部：选择患者 */}
      <Grid item xs={12}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="patient-select-label">选择患者</InputLabel>
          <Select
            labelId="patient-select-label"
            id="patient-select"
            label="选择患者"
            value={patient}
            onChange={handleChangePatient}
          >
            <MenuItem value="">
              <em>请选择</em>
            </MenuItem>
            <MenuItem value="patient1">患者 1</MenuItem>
            <MenuItem value="patient2">患者 2</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      {/* 主体布局：左侧四个卡片（垂直堆叠），右侧三张图表 */}
      <Grid item xs={12} container spacing={2}>
        {/* 左侧卡片列：xs=12 在移动端独占一行 */}
        <Grid item xs={12} md={3}>
          <InfusionCard
            title="Insulin Infusion"
            lines={[
              `Rate: ${insulinRate} mL/h`,
              'Concentration: 1 U/mL',
              'Type: 50% Dilution'
            ]}
            sliderValue={insulinRate}
            onChangeSlider={setInsulinRate}
            sliderMin={0}
            sliderMax={10}
          />
          <InfusionCard
            title="Maintenance Nutrition"
            lines={[
              `Rate: ${maintainRate} mL/h`,
              'Concentration: 1:1',
              'Type: 3PN glucose'
            ]}
            sliderValue={maintainRate}
            onChangeSlider={setMaintainRate}
            sliderMin={0}
            sliderMax={200}
          />
          <InfusionCard
            title="Enteral Nutrition"
            lines={[
              `Rate: ${enteralRate} mL/h`,
              'Concentration: 1:1',
              'Type: Peptamen AF'
            ]}
            sliderValue={enteralRate}
            onChangeSlider={setEnteralRate}
            sliderMin={0}
            sliderMax={50}
          />
          <InfusionCard
            title="Dextrose Shot"
            lines={[
              `Carbs: ${dextroseShot} g`,
              'Injection time: 1:30 PM'
            ]}
            sliderValue={dextroseShot}
            onChangeSlider={setDextroseShot}
            sliderMin={0}
            sliderMax={25}
          />
        </Grid>

        {/* 右侧图表区域：图表垂直排列 */}
        <Grid item xs={12} md={9}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <ReactECharts option={glucoseOption} style={{ height: '450px' }} />
            </Grid>
            <Grid item xs={12}>
              <ReactECharts option={insulinSensitivityOption} style={{ height: '450px' }} />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
}


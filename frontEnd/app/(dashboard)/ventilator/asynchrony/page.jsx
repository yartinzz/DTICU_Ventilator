"use client";

import * as React from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button
} from '@mui/material';
import ReactECharts from 'echarts-for-react';

export default function AsynchronyPage() {
  // ---------------------------
  // 数据部分：可根据实际需要调整
  // ---------------------------

  // 结果信息
  const breathNumber = 634;
  const asynchronyBreath = 121;
  const noiseBreath = 2;
  const totalBreath = 757;
  const asynchronyIndex = 15.98; // AI

  // 图表数据
  const chartData = [
    { value: breathNumber, name: 'Normal' },
    { value: asynchronyBreath, name: 'Asynchrony' },
    { value: noiseBreath, name: 'Noise' }
  ];

  // 表格数据
  const mechanicsData = [
    {
      parameter: 'Ers (cmH2O/L)',
      median: '38.5',
      iqr: '12',
      fifthNinetyFifth: '20.5 - 71.2',
      minMax: '11 - 83'
    },
    {
      parameter: 'Rrs (cmH2O/L/s)',
      median: '7.7',
      iqr: '3.9',
      fifthNinetyFifth: '2.8 - 18.3',
      minMax: '2 - 27'
    },
    {
      parameter: 'PIP (cmH2O)',
      median: '29',
      iqr: '9',
      fifthNinetyFifth: '21 - 41',
      minMax: '11 - 45'
    },
    {
      parameter: 'PEEP (cmH2O)',
      median: '11',
      iqr: '4',
      fifthNinetyFifth: '8 - 12',
      minMax: '3 - 15'
    },
    {
      parameter: 'Vt (ml)',
      median: '458',
      iqr: '125',
      fifthNinetyFifth: '376 - 732',
      minMax: '316 - 800'
    },
    {
      parameter: 'PIP-PEEP (cmH2O)',
      median: '19',
      iqr: '6',
      fifthNinetyFifth: '13 - 29',
      minMax: '9 - 33'
    }
  ];

  // ---------------------------
  // ECharts 配置
  // ---------------------------
  const pieOption = {
    title: {
      text: 'Breath Condition Distribution',
      left: 'center'
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b} : {c} ({d}%)'
    },
    legend: {
      orient: 'horizontal',
      bottom: '0%',
      left: 'center'
    },
    series: [
      {
        name: 'Distribution',
        type: 'pie',
        radius: '50%',
        label: {
          formatter: '{b}: {d}%'
        },
        data: chartData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  };

  return (
    <Box sx={{ p: 2 , gap: 4,  
      height: "100vh",
      width: "80vw",}}>
      {/* 标题行 */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          Asynchrony Analysis
        </Typography>
        {/* 按钮：Rerun Analysis、AI Model Management */}
        <Button variant="contained" color="primary" sx={{ mr: 2 }}>
          Rerun Analysis
        </Button>
        <Button variant="outlined" color="primary">
          AI Model Management
        </Button>
      </Box>

      {/* 上方内容：左侧Results + 右侧Graph */}
      <Grid container spacing={2}>
        {/* 左侧：Results */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
              Results:
            </Typography>
            <Typography>Breath number: {breathNumber}</Typography>
            <Typography>Asynchrony breath: {asynchronyBreath}</Typography>
            <Typography>Noise breath: {noiseBreath}</Typography>
            <Typography>Total: {totalBreath}</Typography>
            <Typography sx={{ mt: 1, fontWeight: 'bold' }}>
              Asynchrony Index (AI): {asynchronyIndex}
            </Typography>
          </Paper>
        </Grid>

        {/* 右侧：Pie Chart */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
              Graph:
            </Typography>
            <ReactECharts option={pieOption} style={{ height: 450 }} />
          </Paper>
        </Grid>
      </Grid>

      {/* 下方表格：Respiratory Mechanics */}
      <Box sx={{ mt: 2 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
            Respiratory Mechanics
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Parameter</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Median</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>IQR</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>5<sup>th</sup>-95<sup>th</sup> perc.</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Min - Max</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mechanicsData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.parameter}</TableCell>
                    <TableCell>{row.median}</TableCell>
                    <TableCell>{row.iqr}</TableCell>
                    <TableCell>{row.fifthNinetyFifth}</TableCell>
                    <TableCell>{row.minMax}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Box>
  );
}

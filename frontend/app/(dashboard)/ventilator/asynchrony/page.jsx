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
import { useTranslation } from 'react-i18next';


export default function AsynchronyPage() {

    const { t } = useTranslation();

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
    { value: breathNumber, name: t('Normal') },
    { value: asynchronyBreath, name: t('Asynchrony') },
    { value: noiseBreath, name: t('Noise') }
  ];


  // 表格数据
  const mechanicsData = [
    {
      parameter: 'Ers (cmH2O/L)',
      median: '38.5',
      iqr: '37.7 - 39.8',
      fifthNinetyFifth: '35.9 - 42.2',
      minMax: '-30.3 - 95.6'
    },
    {
      parameter: 'Rrs (cmH2O/L/s)',
      median: '12.6',
      iqr: '11.3 - 14',
      fifthNinetyFifth: '10.5 - 22.3',
      minMax: '-23.6 - 77'
    },
    {
      parameter: 'PIP (cmH2O)',
      median: '29.7',
      iqr: '29.3 - 30.1',
      fifthNinetyFifth: '28.5 - 32.6',
      minMax: '17.3 - 40'
    },
    {
      parameter: 'PEEP (cmH2O)',
      median: '11',
      iqr: '10 - 11',
      fifthNinetyFifth: '10 - 12',
      minMax: '8 - 12'
    },
    {
      parameter: 'Vt (ml)',
      median: '458',
      iqr: '456 - 459',
      fifthNinetyFifth: '453 - 468',
      minMax: '97 - 946'
    },
    {
      parameter: 'PIP-PEEP (cmH2O)',
      median: '18.7',
      iqr: '18.3 - 19.1',
      fifthNinetyFifth: '17.5 - 21.6',
      minMax: '8.1 - 35.9'
    }
  ];

  // ECharts 配置
  const pieOption = {
    title: {
      text: t('Breath Condition Distribution'),
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
        name: t('Distribution'),
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
    <Box sx={{ p: 2, gap: 4, height: '100vh', width: '80vw' }}>
      {/* 标题行 */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          {t('Asynchrony Analysis')}
        </Typography>
        <Button variant="contained" color="primary" sx={{ mr: 2 }}>
          {t('Rerun Analysis')}
        </Button>
        <Button variant="outlined" color="primary">
          {t('AI Model Management')}
        </Button>
      </Box>

      {/* 上方内容：左侧Results + 右侧Graph */}
      <Grid container spacing={2}>
        {/* 左侧：Results */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
              {t('Results:')}
            </Typography>
            <Typography>
              {t('Breath number:')} {breathNumber}
            </Typography>
            <Typography>
              {t('Asynchrony breath:')} {asynchronyBreath}
            </Typography>
            <Typography>
              {t('Noise breath:')} {noiseBreath}
            </Typography>
            <Typography>
              {t('Total')}：{totalBreath}
            </Typography>
            <Typography sx={{ mt: 1, fontWeight: 'bold' }}>
              {t('Asynchrony Index (AI):')} {asynchronyIndex}
            </Typography>
          </Paper>
        </Grid>

        {/* 右侧：Pie Chart */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
              {t('Graph:')}
            </Typography>
            <ReactECharts option={pieOption} style={{ height: 450 }} />
          </Paper>
        </Grid>
      </Grid>

      {/* 下方表格：Respiratory Mechanics */}
      <Box sx={{ mt: 2 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
            {t('Respiratory Mechanics')}
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>{t('Parameter')}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{t('Median')}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{t('IQR')}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{t('5th-95th perc.')}</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{t('Min - Max')}</TableCell>
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
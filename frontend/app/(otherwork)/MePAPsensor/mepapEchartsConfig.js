/**
 * Author: yadian zhao
 * Institution: Canterbury University
 * Description: ECharts configuration and update functions for MePAP pressure monitoring.
 * This module handles the initialization and real-time updates of pressure comparison charts
 * showing both expected and actual pressure values.
 */

import * as echarts from 'echarts';

/**
 * Initialize a MePAP pressure comparison chart
 * @param {React.RefObject} chartRef - Reference to the DOM element for the chart
 * @param {React.RefObject} timeData - Reference to time axis data
 * @param {React.RefObject} expectedData - Reference to expected pressure data
 * @param {React.RefObject} actualData - Reference to actual pressure data
 * @param {string} title - Chart title
 * @returns {Object} ECharts instance
 */
export const initMePAPChart = (chartRef, timeData, expectedData, actualData, title) => {
  const chart = echarts.init(chartRef.current);
  
  const option = {
    title: {
      text: title,
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      formatter: function (params) {
        let result = `Time: ${parseFloat(params[0].axisValue).toFixed(2)}s<br/>`;
        params.forEach(param => {
          const value = parseFloat(param.value).toFixed(3);
          result += `${param.seriesName}: ${value} cmH₂O<br/>`;
        });
        if (params.length === 2) {
          const diff = Math.abs(parseFloat(params[0].value) - parseFloat(params[1].value));
          result += `<span style="color: ${diff > 2 ? '#ff4d4f' : '#52c41a'}">Difference: ${diff.toFixed(3)} cmH₂O</span>`;
        }
        return result;
      },
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#6a7985'
        }
      }
    },
    legend: {
      data: ['Expected Pressure', 'Actual Pressure'],
      top: 30,
      left: 'center'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: timeData.current,
      name: 'Time (s)',
      nameLocation: 'middle',
      nameGap: 25,
      axisLabel: {
        formatter: function (value) {
          return parseFloat(value).toFixed(1);
        }
      }
    },
    yAxis: {
      type: 'value',
      name: 'Pressure (cmH₂O)',
      nameLocation: 'middle',
      nameGap: 40,
      axisLabel: {
        formatter: function (value) {
          return value.toFixed(1);
        }
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
          opacity: 0.5
        }
      }
    },
    series: [
      {
        name: 'Expected Pressure',
        type: 'line',
        data: expectedData.current,
        smooth: false,
        symbol: 'none',
        lineStyle: {
          color: '#1890ff',
          width: 2
        },
        areaStyle: {
          opacity: 0.1,
          color: '#1890ff'
        }
      },
      {
        name: 'Actual Pressure',
        type: 'line',
        data: actualData.current,
        smooth: false,
        symbol: 'none',
        lineStyle: {
          color: '#ff4d4f',
          width: 2
        },
        areaStyle: {
          opacity: 0.1,
          color: '#ff4d4f'
        }
      }
    ],
    animation: false
    // 移除dataZoom配置，不显示时间选择条
  };

  chart.setOption(option);
  return chart;
};

/**
 * Update MePAP chart with new data points
 * @param {Object} chart - ECharts instance
 * @param {React.RefObject} expectedBuffer - Expected pressure data buffer
 * @param {React.RefObject} actualBuffer - Actual pressure data buffer
 * @param {React.RefObject} expectedData - Expected pressure chart data
 * @param {React.RefObject} actualData - Actual pressure chart data
 * @param {React.RefObject} timeData - Time axis data
 * @param {React.RefObject} updatePoints - Number of points to update
 */
export const updateMePAPChart = (
  chart, 
  expectedBuffer, 
  actualBuffer, 
  expectedData, 
  actualData, 
  timeData, 
  updatePoints
) => {
  const pointsToUpdate = Math.floor(updatePoints.current);
  
  // Check if there's enough data in both buffers
  if (expectedBuffer.current.length < pointsToUpdate || actualBuffer.current.length < pointsToUpdate) {
    return;
  }

  // Extract data points from buffers
  const newExpectedPoints = expectedBuffer.current.splice(0, pointsToUpdate);
  const newActualPoints = actualBuffer.current.splice(0, pointsToUpdate);

  // Update data arrays by shifting old data and adding new data
  for (let i = 0; i < pointsToUpdate; i++) {
    // Shift existing data to the left
    expectedData.current.shift();
    actualData.current.shift();
    
    // Add new data points at the end
    expectedData.current.push(newExpectedPoints[i]);
    actualData.current.push(newActualPoints[i]);
  }

  // Update time axis to maintain moving window
  const timeStep = timeData.current[1] - timeData.current[0];
  for (let i = 0; i < pointsToUpdate; i++) {
    timeData.current.shift();
    timeData.current.push(timeData.current[timeData.current.length - 1] + timeStep);
  }

  // Calculate dynamic Y-axis range based on current data
  const allPressureValues = [...expectedData.current, ...actualData.current];
  const validValues = allPressureValues.filter(val => !isNaN(val) && val !== null);
  
  if (validValues.length > 0) {
    const minPressure = Math.min(...validValues);
    const maxPressure = Math.max(...validValues);
    const pressureRange = maxPressure - minPressure;
    const margin = Math.max(pressureRange * 0.1, 1); // 10% margin or minimum 1 unit

    // Update chart with new data
    chart.setOption({
      xAxis: {
        data: timeData.current
      },
      yAxis: {
        min: minPressure - margin,
        max: maxPressure + margin
      },
      series: [
        {
          data: expectedData.current
        },
        {
          data: actualData.current
        }
      ]
    }, false); // Use false to avoid complete re-render for better performance
  }
};

/**
 * Create a specialized tooltip formatter for pressure difference analysis
 * @param {Array} params - Tooltip parameters from ECharts
 * @returns {string} Formatted tooltip HTML
 */
export const createPressureTooltipFormatter = (params) => {
  if (!params || params.length === 0) return '';
  
  let result = `<div style="padding: 8px;">`;
  result += `<div><strong>Time: ${parseFloat(params[0].axisValue).toFixed(2)}s</strong></div>`;
  
  params.forEach(param => {
    const color = param.color;
    const value = parseFloat(param.value).toFixed(3);
    result += `<div style="margin: 4px 0;">`;
    result += `<span style="display: inline-block; width: 10px; height: 10px; background-color: ${color}; margin-right: 8px;"></span>`;
    result += `${param.seriesName}: ${value} cmH₂O`;
    result += `</div>`;
  });
  
  if (params.length === 2) {
    const diff = Math.abs(parseFloat(params[0].value) - parseFloat(params[1].value));
    const diffColor = diff > 2 ? '#ff4d4f' : '#52c41a';
    result += `<div style="margin-top: 8px; padding-top: 4px; border-top: 1px solid #eee;">`;
    result += `<span style="color: ${diffColor}; font-weight: bold;">`;
    result += `Pressure Difference: ${diff.toFixed(3)} cmH₂O`;
    result += `</span></div>`;
  }
  
  result += `</div>`;
  return result;
};

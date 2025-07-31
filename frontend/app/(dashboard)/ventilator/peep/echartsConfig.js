import * as echarts from 'echarts';

// 设定常量
const MAX_FLOW_BUFFER_LENGTH = 251;
const MIN_FLOW_BUFFER_LENGTH = 120;
const DEFAULT_UPDATE_POINTS = 3;
const MAX_UPDATE_POINTS = 4;
const MIN_UPDATE_POINTS = 2;

// 初始化压力图表
export const initPressureChart = (chartRef) => {
  return echarts.init(chartRef.current);
};

// 初始化流量图表
export const initFlowChart = (chartRef) => {
  return echarts.init(chartRef.current);
};

export function initLineChart(dom, title) {
  if (!dom) return null;
  const chart = echarts.init(dom);
  chart.setOption({
    // title: { text: title },
    xAxis: { type: "category", data: [] },
    yAxis: { type: "value" },
    series: [{ type: "line", data: [] }],
    grid: {
      left: "5%",
      right: "5%",
      top: "5%",
      bottom: "10%",
      containLabel: true,
    },
  });
  return chart;
}

// 通用计算差值比例的函数
const calculateRatios = (data) => {
  if (data.length < 3) return data.map(() => 0);
  
  const ratios = [];
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      // 第一个点：无法计算比例，设为0
      ratios.push(0);
    } else if (i === data.length - 1) {
      // 最后一个点：无法计算比例，设为0
      ratios.push(0);
    } else {
      // 计算差分和比例
      const diff1 = data[i] - data[i - 1];     // 上一个点到当前点的差值
      const diff2 = data[i + 1] - data[i];     // 当前点到下一个点的差值
      
      if (Math.abs(diff2) < 0.001) {
        // 避免除零错误
        ratios.push(diff1 > 0 ? 999 : -999);
      } else {
        ratios.push(diff1 / diff2);
      }
    }
  }
  return ratios;
};

// 获取数据点的颜色和强调样式 - 针对OD和MVpower
const getPointStyle = (value, paramName) => {
  let color = 'rgba(245, 158, 11, 1)'; // 默认黄色
  
  if (paramName === 'OD') {
    if (value >= 0 && value <= 0.8) {
      color = 'rgba(34, 197, 94, 1)';  // 绿色 - 正常范围
    } else if (value > 1.5 || value < 0) {
      color = 'rgba(239, 68, 68, 1)';  // 红色 - 警惕范围
    } else {
      color = 'rgba(245, 158, 11, 1)';  // 黄色 - 中等范围
    }
  } else if (paramName === 'MVpower') {
    if (value >= 0 && value <= 12) {
      color = 'rgba(34, 197, 94, 1)';  // 绿色 - 正常范围
    } else if (value > 17 || value < 0) {
      color = 'rgba(239, 68, 68, 1)';  // 红色 - 警惕范围
    } else {
      color = 'rgba(245, 158, 11, 1)';  // 黄色 - 中等范围
    }
  }
  
  return { color, symbolSize: 10 };
};

// 获取比例数据的颜色样式
const getRatioStyle = (ratio) => {
  let color = 'rgba(245, 158, 11, 1)'; // 默认黄色
  
  if (Math.abs(ratio) > 1.5) {
    color = 'rgba(239, 68, 68, 1)';  // 红色 - 变化剧烈
  } else if (Math.abs(ratio) > 1.0) {
    color = 'rgba(245, 158, 11, 1)';  // 黄色 - 中等变化
  } else {
    color = 'rgba(34, 197, 94, 1)';  // 绿色 - 变化平缓
  }
  
  return { color, symbolSize: 8 };
};

// 更新参数图表 - 支持所有6个参数：OD, MVpower, K2, K2end, Cdyn, Vfrc
export const updateParamChart = (paramChartNames, paramChartRefs, parameters) => {
  // 提取 deltaPEEP 的所有数据点
  const deltaPEEPs = [-2, 0, 2, 4, 6, 8, 10];
  
  // 生成参数数据，以 deltaPEEP 作为横坐标，支持所有6个参数
  const paramData = {
    K2: deltaPEEPs.map(peep => parameters[peep]?.K2 || 0),
    K2end: deltaPEEPs.map(peep => parameters[peep]?.K2end || 0),
    Cdyn: deltaPEEPs.map(peep => parameters[peep]?.Cdyn || 0),
    OD: deltaPEEPs.map(peep => parameters[peep]?.OD || 0),
    Vfrc: deltaPEEPs.map(peep => parameters[peep]?.Vfrc || 0),
    MVpower: deltaPEEPs.map(peep => parameters[peep]?.MVpower || 0),
  };

  const colors = {
    // 正常范围（绿色）
    normal: {
      solid: 'rgba(34, 197, 94, 1)',
      background: 'rgba(34, 197, 94, 0.15)',
      light: 'rgba(34, 197, 94, 0.1)'
    },
    // 警告范围（黄色）
    warning: {
      solid: 'rgba(245, 158, 11, 1)',
      background: 'rgba(245, 158, 11, 0.2)',
      light: 'rgba(245, 158, 11, 0.1)'
    },
    // 异常范围（红色）
    danger: {
      solid: 'rgba(239, 68, 68, 1)',
      background: 'rgba(239, 68, 68, 0.2)',
      light: 'rgba(239, 68, 68, 0.1)'
    }
  };

  // 给deltaPEEPs的每一个元素都加上parameters["PEEP"]的值
  const newPEEPs = deltaPEEPs.map(val => val + parameters["PEEP"]);

  paramChartNames.forEach((name, index) => {
    const chartInstance = paramChartRefs.current[index]?.chart;
    if (chartInstance && paramData[name]) {
      
      let series = [];
      let yAxisConfig = {
        type: "value",
        splitNumber: 4,  
        axisLine: { show: true }, 
        axisTick: { show: true }, 
        splitLine: {
          show: true, 
          lineStyle: {
            type: "dashed", 
            color: "#ddd", 
          },
        },
      };

      // 针对OD和MVpower的特殊处理
      if (name === 'OD' || name === 'MVpower') {
        // 定义范围配置
        let normalRange, warningThreshold, yMax, yMin;
        if (name === 'OD') {
          normalRange = [0, 0.8];
          warningThreshold = 1.5;
          
          // 处理负值情况
          const minValue = Math.min(...paramData[name]);
          yMin = minValue < 0 ? Math.floor(minValue * 1.2) : 0;
          yMax = Math.ceil(Math.max(2.0, Math.max(...paramData[name]) * 1.2));
        } else { // MVpower
          normalRange = [0, 12];
          warningThreshold = 17;
          yMin = 0;
          yMax = Math.ceil(Math.max(20, Math.max(...paramData[name]) * 1.2));
        }

        // 修复markArea数据结构，正确显示三个区域
        const markAreaData = [];
        
        // 异常范围（负值区域，只对OD有效）
        if (name === 'OD' && yMin < 0) {
          markAreaData.push([
            { yAxis: yMin, itemStyle: { color: colors.danger.light } },
            { yAxis: 0 }
          ]);
        }
        
        // 正常范围
        markAreaData.push([
          { yAxis: Math.max(0, yMin), itemStyle: { color: colors.normal.light } },
          { yAxis: normalRange[1] }
        ]);
        
        // 警告范围
        markAreaData.push([
          { yAxis: normalRange[1], itemStyle: { color: colors.warning.light } },
          { yAxis: warningThreshold }
        ]);
        
        // 危险范围
        markAreaData.push([
          { yAxis: warningThreshold, itemStyle: { color: colors.danger.light } },
          { yAxis: yMax }
        ]);

        // 添加数据散点 - 中空圆圈，统一大小
        const scatterData = paramData[name].map((value, idx) => {
          const style = getPointStyle(value, name);
          return {
            value: [newPEEPs[idx], value],
            itemStyle: {
              color: 'transparent',        // 填充透明
              borderColor: style.color,    // 边框颜色
              borderWidth: 2,              // 边框宽度
            },
            symbolSize: style.symbolSize,  // 统一大小10
          };
        });

        // 主数据系列
        series.push({
          name: name,
          type: "scatter",
          data: scatterData,
          symbol: 'circle',              // 确保是圆形
          label: {
            show: true,
            position: "top",
            fontSize: 11,
            color: "#000",
            formatter: function(params) {
              return params.value[1].toFixed(2);
            },
          },
          markArea: {
            silent: true,
            data: markAreaData
          },
          z: 10,
        });

        
        // 正常范围
        series.push({
          name: name === 'OD' ? 'Normal' : 'Normal',
          type: 'line',
          data: [],
          lineStyle: { color: colors.normal.solid, width: 0 },
          itemStyle: { color: colors.normal.solid },
          symbol: 'rect',
          symbolSize: [15, 3],
          showInLegend: true,
        });
        
        // 警告范围
        series.push({
          name: name === 'OD' ? 'Warning' : 'Warning',
          type: 'line',
          data: [],
          lineStyle: { color: colors.warning.solid, width: 0 },
          itemStyle: { color: colors.warning.solid },
          symbol: 'rect',
          symbolSize: [15, 3],
          showInLegend: true,
        });
        
        // 危险范围
        series.push({
          name: name === 'OD' ? 'Danger' : 'Danger',
          type: 'line',
          data: [],
          lineStyle: { color: colors.danger.solid, width: 0 },
          itemStyle: { color: colors.danger.solid },
          symbol: 'rect',
          symbolSize: [15, 3],
          showInLegend: true,
        });

        yAxisConfig.max = yMax;
        yAxisConfig.min = yMin;

        chartInstance.setOption({
          tooltip: {
            trigger: "item",
            formatter: function(params) {
              if (params.seriesName.includes('数据')) {
                return `${params.seriesName}<br/>PEEP: ${params.value[0]}<br/>数值: ${params.value[1].toFixed(3)}`;
              }
              return null; // 不显示虚拟系列的tooltip
            },
          },
          legend: {
            show: true,
            top: '5%',
            textStyle: { fontSize: 10 },
            selectedMode: false,
          },
          xAxis: {
            type: "value",
            name: 'PEEP',
            nameLocation: 'middle',
            nameGap: 25,
            min: 0 > newPEEPs[0] - 1 ? 0 : newPEEPs[0] - 1,
            max: newPEEPs[newPEEPs.length - 1] + 1,
          },
          yAxis: yAxisConfig,
          series: series,
        });

      } else if (['Vfrc', 'K2', 'K2end', 'Cdyn'].includes(name)) {
        // Vfrc, K2, K2end, Cdyn特殊处理：显示差值比例，保持折线，排除首尾点
        const ratios = calculateRatios(paramData[name]);
        
        // 排除第一个和最后一个点（无意义的点）
        const validIndices = [];
        const validRatios = [];
        const validPEEPs = [];
        
        for (let i = 1; i < ratios.length - 1; i++) {
          validIndices.push(i);
          validRatios.push(ratios[i]);
          validPEEPs.push(newPEEPs[i]);
        }
        
        // 根据比例值设置颜色的折线数据
        const lineData = validRatios.map((ratio, idx) => {
          const style = getRatioStyle(ratio);
          return {
            value: ratio,
            itemStyle: { color: style.color },
            symbolSize: style.symbolSize,
          };
        });

        // 主数据系列
        series.push({
          name: name + " 比例",
          type: "line",
          data: lineData,
          xAxisIndex: 0,
          lineStyle: {
            color: "#FF4500",
            width: 2,
          },
          label: {
            show: true,
            position: "top",
            fontSize: 11,
            color: "#000",
            formatter: function(params) {
              return params.value.toFixed(2);
            },
          },
        });

        const maxVal = Math.max(...validRatios) * 1.1;
        const minVal = Math.min(...validRatios) * 0.9;

        yAxisConfig.max = Math.ceil(maxVal * 10) / 10;
        yAxisConfig.min = Math.floor(minVal * 10) / 10;

        // 为了保持X轴范围一致，需要特殊处理xAxis
        chartInstance.setOption({
          tooltip: {
            trigger: "axis",
            formatter: function(params) {
              // 过滤掉虚拟系列和参考线
              const validParams = params.filter(p => 
                p.seriesName.includes('比例') || p.seriesName.includes('参考线')
              );
              
              if (validParams.length === 0) return '';
              
              // 由于排除了首尾点，需要调整索引
              const realIndex = validParams[0].dataIndex + 1; // 加1因为排除了第一个点
              const realPEEP = newPEEPs[realIndex];
              
              return validParams.map(p => {
                if (p.seriesName.includes('参考线')) {
                  return `${p.seriesName}: ${p.value}`;
                }
                return `${p.seriesName}<br/>PEEP: ${realPEEP}<br/>比例: ${p.value.toFixed(3)}`;
              }).join('<br/>');
            },
          },
          legend: {
            show: true,
            top: '0%',
            textStyle: { fontSize: 10 },
            selectedMode: false, // 禁用图例点击
          },
          xAxis: {
            type: "category",
            data: validPEEPs.map(peep => peep.toString()),
            name: 'PEEP',
            nameLocation: 'middle',
            nameGap: 25,
            // 通过设置边界来保持完整的X轴范围视觉效果
            boundaryGap: ['10%', '10%'],
          },
          yAxis: yAxisConfig,
          series: series,
        });
      }
    }
  });
};

// 提取公共图表配置
export const getCommonChartOptions = (timeData, yAxisLabel, xAxisType = 'category') => {
  return {
    title: {
      left: 'center',
      textStyle: { fontSize: 16, color: '#333' },
    },
    tooltip: {
      trigger: "axis",
      show: true,
    },
    legend: {
      top: '10%',
      textStyle: { color: '#555' },
    },
    xAxis: {
      type: xAxisType,
      data: timeData.current,
      boundaryGap: false,
      name: 'Time (s)',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: { fontSize: 14, color: '#333' },
      axisLabel: { 
        formatter: "{value}",
        interval: 124,
      },
      splitLine: { show: false },
      position: 'bottom',
      axisLine: {
        show: true,
        onZero: false,
      },
    },
    yAxis: {
      type: 'value',
      splitLine: {
        show: true,
        lineStyle: { color: 'rgba(200, 200, 200, 0.5)', width: 1, type: 'dashed' },
      },
      axisLabel: { formatter: '{value}' },
      name: yAxisLabel,
      nameLocation: 'middle',
      nameGap: 40,
      nameTextStyle: { fontSize: 14, color: '#333' },
    },
    grid: {
      left: "5%",
      right: "5%",
      top: "5%",
      bottom: "10%",
      containLabel: true,
    },
  };
};

// 更新图表的函数
export const updateChart = (pressureChart, flowChart, pressureBuffer, flowBuffer, pressureData, flowData, timeData, updatePoints) => {
  // 更新压力数据
  if (pressureBuffer.current.length > updatePoints.current) {
    const pressureBatch = pressureBuffer.current.splice(0, updatePoints.current);
    pressureData.current.push(...pressureBatch);
    pressureData.current.splice(0, updatePoints.current); 
  }

  // 更新流量数据
  if (flowBuffer.current.length > updatePoints.current) {
    const flowBatch = flowBuffer.current.splice(0, updatePoints.current);
    flowData.current.push(...flowBatch);
    flowData.current.splice(0, updatePoints.current);  
  }

  // 计算最大值和最小值
  const getYRange = (data) => {
    const maxValue = Math.max(...data);
    const minValue = Math.min(...data);
    const maxRange = Math.ceil((maxValue + 50) / 100) * 100;
    const minRange = Math.floor((minValue - 50) / 100) * 100;
    return { min: minRange, max: maxRange };
  };

  const pressureRange = getYRange(pressureData.current);
  const flowRange = getYRange(flowData.current);

  // 更新压力图表
  pressureChart.setOption({
    ...getCommonChartOptions(timeData, 'Pressure'),
    series: [{
      name: "Pressure",
      type: "line",
      data: pressureData.current,
      showSymbol: false,
      lineStyle: {
        color: "rgba(75, 192, 192, 1)",
        width: 2,
      },
      smooth: true,
    }],
    yAxis: {
      ...getCommonChartOptions(timeData, 'Pressure').yAxis,
      min: 0,
      max: pressureRange.max,
      axisLabel: {
        formatter: function (value) {
          return (value / 10).toFixed(1); 
        }
      },
      interval: 100,
    }
  }, true);

  // 更新流量图表
  flowChart.setOption({
    ...getCommonChartOptions(timeData, 'Flow'),
    series: [{
      name: "Flow",
      type: "line",
      data: flowData.current,
      showSymbol: false,
      lineStyle: {
        color: "rgba(153, 102, 255, 1)",
        width: 2,
      },
      smooth: true,
    }],
    yAxis: {
      ...getCommonChartOptions(timeData, 'Flow').yAxis,
      min: flowRange.min - 100,
      max: flowRange.max + 100,
      axisLabel: {
        formatter: function (value) {
          return (value / 10 / 60 * 1000).toFixed(0); 
        }
      },
      interval: 300, 
    }
  }, true);
};

// 历史PEEP图表初始化函数
export function initHistoryPEEPChart(containerRef) {
  if (!containerRef.current) return null;
  const chart = echarts.init(containerRef.current);

  const option = {
    title: {
      text: 'History PEEP（Last 12h）',
      left: 'center',
    },
    legend: {
      top: 40,
      data: ['Current PEEP', 'Recommended PEEP'],
      textStyle: { fontSize: 12 }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    grid: {
      left: '5%',
      right: '5%',
      bottom: '15%',
      top: 60,
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      min: Date.now() - 12 * 3600 * 1000,
      max: Date.now(),
      axisLabel: {
        formatter: value => {
          const d = new Date(value);
          return (d.getMinutes() === 0 && d.getSeconds() === 0)
            ? d.getHours().toString().padStart(2, '0') + ':00'
            : '';
        }
      }
    },
    yAxis: {
      type: 'value',
      name: 'PEEP (cmH₂O)',
      min: 0,
      max: 20,
    },
    series: [
      {
        name: 'Current PEEP',
        type: 'scatter',
        data: [],
      },
      {
        name: 'Recommended PEEP',
        type: 'scatter',
        data: [],
      }
    ]
  };

  chart.setOption(option);
  return chart;
}

// 更新历史PEEP图表
export function updateHistoryPEEPChart(chart, times, currentPEEP, recommendedPEEP) {
  const ts = times.map(t => new Date(t).getTime());
  const data1 = ts.map((t,i) => [t, currentPEEP[i]]);
  const data2 = ts.map((t,i) => [t, recommendedPEEP[i]]);

  chart.setOption({
    xAxis: {
      min: Date.now() - 12 * 3600 * 1000,
      max: Date.now(),
    },
    series: [
      {
        name: 'Current PEEP',
        type: 'line',
        step: 'end',
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 6,
        data: data1
      },
      {
        name: 'Recommended PEEP',
        type: 'line',
        step: 'end',
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 6,
        data: data2
      }
    ]
  });
}

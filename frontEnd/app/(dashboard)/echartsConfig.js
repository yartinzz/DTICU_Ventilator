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
      top: "15%",
      bottom: "15%",
      containLabel: true,
    },
  });
  return chart;
}


export const updateParamChart = (paramChartNames, paramChartRefs, parameters) => {
  // 提取 deltaPEEP 的所有数据点
  const deltaPEEPs = [-2, 0, 2, 4, 6, 8, 10];
  
  // 生成参数数据，以 deltaPEEP 作为横坐标
  const paramData = {
    K2: deltaPEEPs.map(peep => parameters[peep]?.K2 || 0),
    ODI: deltaPEEPs.map(peep => parameters[peep]?.OD || 0),
    Vfrc: deltaPEEPs.map(peep => parameters[peep]?.Vfrc || 0),
    MVpower: deltaPEEPs.map(peep => parameters[peep]?.MVpower || 0),
  };

  // 给deltaPEEPs的每一个元素都加上parameters["PEEP"]的值
  const newPEEPs = deltaPEEPs.map(val => val + parameters["PEEP"]);

  paramChartNames.forEach((name, index) => {
    const chartInstance = paramChartRefs.current[index]?.chart;
    if (chartInstance) {
      chartInstance.setOption({
        tooltip: {
          trigger: "axis",
        },
        xAxis: {
          type: "category",
          data: newPEEPs.map(peep => peep.toString()), // 以 deltaPEEP 作为 X 轴
        },
        yAxis: {
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
        },
        
        series: [
          {
            name: name + " (Bar)",
            type: "bar",
            data: paramData[name],
            barWidth: "25%",
            itemStyle: {
              color: "#6495ED", // 选择合适的柱状图颜色
              borderRadius: [5, 5, 0, 0], // 圆角柱子
            },
          },
          {
            name: name + " (Line)",
            type: "line",
            data: paramData[name],
            itemStyle: {
              color: "#FF4500", // 选择折线颜色
            },
            lineStyle: {
              width: 2,
            },
            label: {
              show: true,         // 显示数值
              position: "top",    // 位置：柱子顶部
              fontSize: 12,       // 字体大小
              color: "#000",      // 颜色
              formatter: "{c}",   // 直接显示 Y 轴的数值
            },
          },
        ],
      });
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
        interval: 124,  // Ensure all labels are displayed
      },
      splitLine: { show: false },
      position: 'bottom',  // Always place x-axis at the bottom
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
      top: "10%",
      bottom: "10%",
      containLabel: true,
    },
  };
};

// 更新图表的函数
export const updateChart = (pressureChart, flowChart, pressureBuffer, flowBuffer, pressureData, flowData, timeData, updatePoints) => {
  // Adjust updatePoints based on the buffer size
  // if (flowBuffer.current.length > MAX_FLOW_BUFFER_LENGTH) {
  //   updatePoints.current = MAX_UPDATE_POINTS;
  // } else if (flowBuffer.current.length < MIN_FLOW_BUFFER_LENGTH) {
  //   updatePoints.current = MIN_UPDATE_POINTS;
  // } else {
  //   updatePoints.current = DEFAULT_UPDATE_POINTS;
  // }

  // 更新压力数据
  if (pressureBuffer.current.length > updatePoints.current) {
    const pressureBatch = pressureBuffer.current.splice(0, updatePoints.current);
    pressureData.current.push(...pressureBatch);
    pressureData.current.splice(0, updatePoints.current); 
  } else {
    // console.log("[INFO] pressureBuffer empty");
  }

  // 更新流量数据
  if (flowBuffer.current.length > updatePoints.current) {
    const flowBatch = flowBuffer.current.splice(0, updatePoints.current);
    flowData.current.push(...flowBatch);
    flowData.current.splice(0, updatePoints.current);  
  } else {
    // console.log("[INFO] flowBuffer empty");
  }

  // 计算最大值和最小值
  const getYRange = (data) => {
    const maxValue = Math.max(...data);
    const minValue = Math.min(...data);

    // 计算最大值和最小值的调整范围
    const maxRange = Math.ceil((maxValue + 50) / 100) * 100;  // 向上取整为100的倍数
    const minRange = Math.floor((minValue - 50) / 100) * 100;  // 向下取整为100的倍数

    return { min: minRange, max: maxRange };
  };

  // 调整纵坐标范围
  const pressureRange = getYRange(pressureData.current);
  const flowRange = getYRange(flowData.current);

  // 更新压力图表
  pressureChart.setOption({
    ...getCommonChartOptions(timeData, 'Pressure'),
    series: [{
      name: "Pressure",
      type: "line",
      data: pressureData.current,
      showSymbol: false, // Hide the points
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
      interval: 100,  // 每100一个刻度
    }
  }, true);

  // 更新流量图表
  flowChart.setOption({
    ...getCommonChartOptions(timeData, 'Flow'),
    series: [{
      name: "Flow",
      type: "line",
      data: flowData.current,
      showSymbol: false, // Hide the points
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


export const initPVLoopChart = (chartRef) => {
  const chart = echarts.init(chartRef.current);
  if (chart && typeof chart.setOption === 'function') {
    console.log("Chart initialized", chart);
    return chart;
  } else {
    console.error("ECharts initialization failed or returned an invalid instance.");
    return null;  // 返回 null 或者抛出错误
  }
};

export const updatePVLoopChart = (chart, data) => {
  if (!chart) {
    console.error("Chart instance is not available.");
    return;
  }

  const { waveforms, deltaPEEP } = data;
  if (!waveforms || !waveforms.baseline || !waveforms.selected) {
    console.error("Missing baseline or selected waveforms in data:", data);
    return;
  }

  // 提取 baseline 波形数据（对应原来 P_i, V_i）
  const baseline_P = waveforms.baseline.P_predict_OD || [];
  const baseline_V = waveforms.baseline.V_predict_OD || [];

  // 提取预测波形数据（对应选定 deltaPEEP 的 P_predict_OD, V_predict_OD）
  const predicted_P = waveforms.selected.P_predict_OD || [];
  const predicted_V = waveforms.selected.V_predict_OD || [];

  // 计算 X/Y 轴范围
  const rawMaxX = Math.max(...baseline_P, ...predicted_P, 0);
  const rawMaxY = Math.max(...baseline_V, ...predicted_V, 0) + 0.1;
  const maxX = Math.ceil(rawMaxX / 10) * 10;
  const maxY = Math.ceil(rawMaxY / 0.1) * 0.1;

  // 构造系列数据
  const seriesData = [
    {
      name: 'Baseline',
      type: 'line',
      data: baseline_P.map((p, index) => [p, baseline_V[index]]),
      itemStyle: { color: 'rgba(75, 192, 192, 1)' },
    },
    {
      name: `Predicted (ΔPEEP=${deltaPEEP})`,
      type: 'line',
      data: predicted_P.map((p, index) => [p, predicted_V[index]]),
      itemStyle: { color: 'rgba(153, 102, 255, 1)' },
    },
  ];

  // 更新图表配置
  chart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: function (params) {
        return `P: ${params.value[0].toFixed(2)}<br/>V: ${params.value[1].toFixed(2)}`;
      },
    },
    legend: {
      top: '10%',
      textStyle: { color: '#555' },
    },
    xAxis: {
      type: 'value',
      name: 'Pressure (cmH2O)',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: { fontSize: 14, color: '#333' },
      min: 0,
      max: maxX,
    },
    yAxis: {
      type: 'value',
      name: 'Volume (L)',
      nameTextStyle: { fontSize: 14, color: '#333' },
      min: 0,
      max: maxY,
    },
    series: seriesData,
  });
};


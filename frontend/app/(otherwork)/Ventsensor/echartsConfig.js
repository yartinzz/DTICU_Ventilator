import * as echarts from "echarts";

const MAX_TIME_RANGE = 15;

/**
 * 工具函数：找出给定时间在 timeData 数组中的索引，然后获取相应的 y 值
 * @param {Array<number>} timeArr    - 全部时间数组
 * @param {Array<number>} valueArr   - 与 timeArr 对应的数值数组
 * @param {number} t                 - 需要查找的时间
 * @returns { [t, value] | null }
 */
function getPointAtTime(timeArr, valueArr, t) {
  const idx = timeArr.indexOf(t);
  if (idx >= 0 && idx < valueArr.length) {
    return [t, valueArr[idx]];
  }
  return null;
}

/**
 * 根据 markerTimeArr 中的时间点，在 timeArr 找到对应索引，从 valueArr 中取值
 * 返回 ECharts 所需的 [x, y] 数组。
 */
function generateScatterData(timeArr, valueArr, markerTimeArr) {
  if (!Array.isArray(markerTimeArr)) return [];

  return markerTimeArr
    .map((markerTime) => {
      const idx = timeArr.indexOf(markerTime);
      // 如果 timeArr 中存在该时间点，则返回对应的 [time, gaugePressure]
      if (idx !== -1 && idx < valueArr.length) {
        return [markerTime, valueArr[idx]];
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * markerStyle 用于给散点设置形状、大小、颜色等
 */
function markerStyle(color, size, shape = "circle") {
  return {
    type: "scatter",
    symbolSize: size,
    symbol: shape,       // "circle" | "rect" | "diamond" | "pin" | "arrow" | "x" ...
    itemStyle: { color },
    showSymbol: true,
  };
}

/**
 * 计算数据的最小值和最大值
 */
function calculateDataRange(data) {
  if (!data || data.length === 0) return { min: 0, max: 0 };
  return {
    min: Math.min(...data),
    max: Math.max(...data)
  };
}

/**
 * 根据指定的间隔计算合适的Y轴范围
 * @param {number} min - 数据最小值
 * @param {number} max - 数据最大值
 * @param {number} interval - 刻度间隔
 * @param {number} minPadding - 最小值的向下补偿
 * @param {number} maxPadding - 最大值的向上补偿
 * @returns {{min: number, max: number}} - 调整后的Y轴范围
 */
function calculateYAxisRange(min, max, interval, minPadding, maxPadding) {
  // 计算范围，确保是间隔的整数倍
  const adjustedMin = Math.floor((min - minPadding) / interval) * interval;
  const adjustedMax = Math.ceil((max + maxPadding) / interval) * interval;
  
  return {
    min: adjustedMin,
    max: adjustedMax
  };
}

/**
 * 创建基础图表配置
 */
function createBaseChartOption(xAxisName, yAxisName, title) {
  return {
    animation: false,
    tooltip: { trigger: "axis" },
    title: {
      text: title || yAxisName,
      left: 'center',
      top: 0,
    },
    xAxis: {
      type: "value",
      name: xAxisName || "Time (s)",
      nameLocation: 'end', // 名称显示在右侧
      nameGap: 5,  // 名称与轴线之间的距离
      boundaryGap: false,
      axisLabel: {
        show: true,
        formatter: (value) => Math.floor(value)
      }
    },
    yAxis: {
      type: "value",
      name: "",  // 移除y轴名称，改为标题
      axisLabel: {
        show: true,  // 显示刻度值
        inside: false
      }
    },
    grid: {
      left: '5%',   // 为Y轴刻度值留出空间
      right: '5%',
      top: '15%',    // 为标题留出空间
      bottom: '10%'
    },
    series: [],
  };
}

/**
 * 创建并初始化图表
 */
function initChart(chartRef, option) {
  const chart = echarts.init(chartRef.current);
  chart.setOption(option);
  return chart;
}

/**
 * 计算时间轴范围
 */
function calculateTimeRange(timeArr) {
  const maxTime = Math.max(...timeArr);
  const minTime = maxTime - MAX_TIME_RANGE;
  return { minTime, maxTime };
}

/**
 * 创建时间轴配置
 */
function createTimeAxisOption(minTime, maxTime) {
  return {
    type: "value",
    min: minTime,
    max: maxTime,
    nameLocation: 'end',
    nameGap: 5,
    axisLabel: {
      formatter: (value) => Math.floor(value) // 只显示整数
    }
  };
}

/**
 * 将数据转换为 ECharts [x,y] 格式
 */
function createXYData(timeArr, valueArr) {
  return timeArr.map((t, i) => [t, valueArr[i]]);
}

/**
 * 创建标记点系列
 */
function createMarkerSeries(markerTimes, timeArr, valueArr, colors) {
  const series = [];
  
  // 定义标记点类型和颜色的映射
  const markerConfig = [
    { name: "InspTime", key: "inspTime", color: colors.purple, size: 15 },
    { name: "PipTime", key: "pipTime", color: colors.orange, size: 15 },
    { name: "ExpTime", key: "expTime", color: colors.green, size: 15 },
    { name: "PepTime", key: "pepTime", color: colors.yellow, size: 15 },
    { name: "EndTime", key: "endTime", color: colors.pink, size: 15 },
  ];

  // 为每种标记点创建系列
  markerConfig.forEach(config => {
    const points = generateScatterData(
      timeArr, 
      valueArr, 
      markerTimes[config.key]
    );
    
    if (points.length > 0) {
      series.push({
        type: 'scatter',
        symbol: 'path://M-10 -10 L10 10 M10 -10 L-10 10',

        symbolSize: config.size || 6,
        itemStyle: {
          color: 'none',  // 不填充
          borderColor: config.color,
          borderWidth: 4,
          opacity: 1,
          size: config.size || 12,
        },
        name: config.name,
        data: points,
      });
    }
  });

  return series;
}



/**
 * 创建单值散点系列 (如 cREO, rREO 等)
 */
function createSingleValueSeries(value, time, name, color, size = 8) {
  if (value !== undefined && time !== undefined) {
    return {
      name,
      type: "scatter",
      symbol: "circle",
      symbolSize: size,
      itemStyle: { color },
      data: [[time, value]],
    };
  }
  return null;
}

/**
 * 创建多值散点系列 (如 cOCC, rOCC 等)
 */
function createMultiValueSeries(valuesArr, timesArr, name, color, size = 5) {
  if (!Array.isArray(valuesArr) || !Array.isArray(timesArr) || valuesArr.length === 0 || timesArr.length === 0) {
    return null;
  }

  const len = Math.min(valuesArr.length, timesArr.length);
  const data = [];
  
  for (let i = 0; i < len; i++) {
    data.push([timesArr[i], valuesArr[i]]);
  }

  return {
    name,
    type: "scatter",
    symbol: "circle",
    symbolSize: size,
    itemStyle: { color },
    data,
  };
}

// =====================【 Gauge Pressure 】===================== //
export const initGaugePressureChart = (chartRef, timeData, gaugePressureData) => {
  const option = createBaseChartOption("Time (s)", "", "Gauge Pressure [cmH₂O]");
  option.series = [{
    name: "GaugePressure",
    type: "line",
    showSymbol: false,
    data: gaugePressureData.current,
    lineStyle: { color: "#000000", width: 1.5}, // black
  }];
  
  return initChart(chartRef, option);
};

export const updateGaugePressureChart = (
  chart,
  timeArr,
  gaugePressureArr,
  markerTimes,
  colors
) => {
  const { minTime, maxTime } = calculateTimeRange(timeArr);
  const timeAxisOption = createTimeAxisOption(minTime, maxTime);
  const xyData = createXYData(timeArr, gaugePressureArr);
  const markerSeries = createMarkerSeries(markerTimes, timeArr, gaugePressureArr, colors);
  
  // 计算数据范围
  const { min, max } = calculateDataRange(gaugePressureArr);
  
  // 计算y轴范围：刻度间隔为2，向下扩展2，向上扩展2
  const yAxisRange = calculateYAxisRange(min, max, 2, 2, 2);
  
  chart.setOption({
    xAxis: timeAxisOption,
    yAxis: {
      min: yAxisRange.min,
      max: yAxisRange.max,
      interval: 2,  // 每2一个刻度
    },
    series: [
      {
        name: "GaugePressure",
        type: "line",
        showSymbol: false,
        lineStyle: { color: colors.black, width: 1.5},
        data: xyData,
      },
      ...markerSeries,
    ],
  });
};

// =====================【 Flow 】===================== //
export const initFlowChart = (chartRef, timeData, flowData, smoothFlowData) => {
  const option = createBaseChartOption("Time (s)", "", "Flow [L s⁻¹]");
  
  const useSmooth = smoothFlowData.current.length && smoothFlowData.current.some(x => x !== 0);
  
  option.series = [
    // 背景散点
    {
      name: "FlowScatter",
      type: "scatter",
      data: createXYData(timeData.current, flowData.current),
      symbolSize: 2,
      itemStyle: { color: "rgb(200,200,200)" },
    },
    // 主线（smoothFlow优先，否则用flow）
    {
      name: "SmoothFlow",
      type: "line",
      showSymbol: false,
      data: useSmooth 
        ? createXYData(timeData.current, smoothFlowData.current)
        : createXYData(timeData.current, flowData.current),
      lineStyle: { color: "#000000", width: 1.5 },
    },
  ];
  
  return initChart(chartRef, option);
};

export const updateFlowChart = (
  chart,
  timeArr,
  flowArr,
  smoothFlowArr,
  markerTimes,
  colors
) => {
  const { minTime, maxTime } = calculateTimeRange(timeArr);
  const timeAxisOption = createTimeAxisOption(minTime, maxTime);
  
  // 判断主线数据
  const mainLineDataArr = smoothFlowArr.some(x => x !== 0) ? smoothFlowArr : flowArr;
  // 主线数据和背景散点
  const mainLineData = createXYData(timeArr, mainLineDataArr);
  const flowScatterData = createXYData(timeArr, flowArr);
  
  // 生成标记点系列
  const markerSeries = createMarkerSeries(markerTimes, timeArr, mainLineDataArr, colors);
  
  // 计算数据范围
  const { min, max } = calculateDataRange(mainLineDataArr);
  
  // 计算y轴范围：刻度间隔为0.5，向下扩展0.5，向上扩展0.5
  const yAxisRange = calculateYAxisRange(min, max, 0.5, 0.5, 0.5);
  
  chart.setOption({
    xAxis: timeAxisOption,
    yAxis: {
      min: yAxisRange.min,
      max: yAxisRange.max,
      interval: 0.5,  // 每0.5一个刻度
    },
    series: [
      {
        name: "SmoothFlow",
        data: mainLineData,
      },
      ...markerSeries,
    ],
  });
};

// =====================【 Volume 】===================== //
export const initVolumeChart = (chartRef, timeData, volumeData) => {
  const option = createBaseChartOption("Time (s)", "", "Tidal Volume [L]");
  option.yAxis.min = 0;
  option.series = [{
    name: "Volume",
    type: "line",
    showSymbol: false,
    data: createXYData(timeData.current, volumeData.current),
    lineStyle: { color: "#000000", width: 1.5 },
  }];
  
  return initChart(chartRef, option);
};

export const updateVolumeChart = (chart, timeArr, volumeArr) => {
  const { minTime, maxTime } = calculateTimeRange(timeArr);
  const timeAxisOption = createTimeAxisOption(minTime, maxTime);
  const volumeData = createXYData(timeArr, volumeArr);
  
  // 计算数据范围
  const { max } = calculateDataRange(volumeArr);
  
  // 计算y轴范围：刻度间隔为0.1，最小值固定为0，向上扩展0.1
  const yAxisRange = calculateYAxisRange(0, max, 0.1, 0, 0.1);
  
  chart.setOption({
    xAxis: timeAxisOption,
    yAxis: {
      min: 0,  // 始终从0开始
      max: yAxisRange.max,
      interval: 0.1,  // 每0.1一个刻度
    },
    series: [
      {
        name: "Volume",
        data: volumeData,
      },
    ],
  });
};

// ... 前面的公共函数保持不变 ...

// =====================【 Compliance 】===================== //
export const initComplianceChart = (chartRef) => {
  const option = createBaseChartOption("Time (s)", "", "Compliance [cmH₂O⁻¹ L]");
  option.tooltip.trigger = "axis";  // 改回 axis 触发
  option.yAxis.min = 0;
  option.yAxis.max = 0.1;  // MATLAB 中固定 [0, 0.1]
  option.yAxis.interval = 0.02; // 设置合理的刻度间隔
  option.grid.left = '12%';
  option.series = []; // 初始化为空数组，稍后填充数据
  
  return initChart(chartRef, option);
};

export const updateComplianceChart = (
  chart,
  timeArr,
  cREOArr,
  cOCCArr,
  colors,
  markerTimes
) => {
  const { minTime, maxTime } = calculateTimeRange(timeArr);
  const timeAxisOption = createTimeAxisOption(minTime, maxTime);
  
  const series = [];
  
  // 1. 处理 cREO 数据 - 使用粉色线图，显示所有点
  if (cREOArr.length > 0 && markerTimes.inspTime && markerTimes.inspTime.length > 0) {
    // 确保两个数组长度一致
    const len = Math.min(cREOArr.length, markerTimes.inspTime.length);
    const cREOData = [];
    
    for (let i = 0; i < len; i++) {
      cREOData.push([markerTimes.inspTime[i], cREOArr[i]]);
    }
    
    series.push({
      name: "cREO",
      type: "line",  // 使用线图而非散点图
      symbol: "circle",  // 每个数据点处显示圆圈
      symbolSize: 8,
      showSymbol: true,  // 确保显示数据点
      smooth: false,     // 不使用平滑曲线
      lineStyle: { 
        color: colors.pink,
        width: 2
      },
      itemStyle: { 
        color: colors.pink,
        borderColor: colors.pink,
        borderWidth: 2
      },
      data: cREOData
    });
  }
  
  // 2. 处理 cOCC 数据 - 使用橙色点
  if (markerTimes.occTime && markerTimes.occTime.length > 0 && 
      cOCCArr && cOCCArr.length > 0) {
    
    const occData = [];
    const len = Math.min(markerTimes.occTime.length, cOCCArr.length);
    
    for (let i = 0; i < len; i++) {
      occData.push([markerTimes.occTime[i], cOCCArr[i]]);
    }
    
    series.push({
      name: "cOCC",
      type: "scatter",
      symbol: "circle",
      symbolSize: 5,
      itemStyle: { color: colors.orange },
      data: occData
    });
  }
  
  chart.setOption({
    xAxis: timeAxisOption,
    yAxis: {
      min: 0,
      max: 0.1, // 固定范围 [0, 0.1]
      interval: 0.02
    },
    series: series
  });
};

// =====================【 Resistance 】===================== //
export const initResistanceChart = (chartRef) => {
  const option = createBaseChartOption("Time (s)", "", "Resistance [cmH₂O L s⁻¹]");
  option.tooltip.trigger = "axis";  // 改回 axis 触发
  option.grid.left = '12%';
  option.series = []; // 初始化为空数组，稍后填充数据
  
  return initChart(chartRef, option);
};

export const updateResistanceChart = (
  chart,
  timeArr,
  rREOArr,
  rOCCArr,
  colors,
  markerTimes
) => {
  const { minTime, maxTime } = calculateTimeRange(timeArr);
  const timeAxisOption = createTimeAxisOption(minTime, maxTime);
  
  const series = [];
  
  // 1. 处理 rREO 数据 - 使用粉色线图，显示所有点
  if (rREOArr.length > 0 && markerTimes.inspTime && markerTimes.inspTime.length > 0) {
    // 确保两个数组长度一致
    const len = Math.min(rREOArr.length, markerTimes.inspTime.length);
    const rREOData = [];
    
    for (let i = 0; i < len; i++) {
      rREOData.push([markerTimes.inspTime[i], rREOArr[i]]);
    }
    
    series.push({
      name: "rREO",
      type: "line",  // 使用线图而非散点图
      symbol: "circle",  // 每个数据点处显示圆圈
      symbolSize: 8,
      showSymbol: true,  // 确保显示数据点
      smooth: false,     // 不使用平滑曲线
      lineStyle: { 
        color: colors.pink,
        width: 2
      },
      itemStyle: { 
        color: colors.pink,
        borderColor: colors.pink,
        borderWidth: 2
      },
      data: rREOData
    });
  }
  
  // 2. 处理 rOCC 数据 - 使用橙色点
  if (markerTimes.occTime && markerTimes.occTime.length > 0 && 
      rOCCArr && rOCCArr.length > 0) {
    
    const occData = [];
    const len = Math.min(markerTimes.occTime.length, rOCCArr.length);
    
    for (let i = 0; i < len; i++) {
      occData.push([markerTimes.occTime[i], rOCCArr[i]]);
    }
    
    series.push({
      name: "rOCC",
      type: "scatter",
      symbol: "circle",
      symbolSize: 5,
      itemStyle: { color: colors.orange },
      data: occData
    });
  }
  
  // 调整 Y 轴范围以适配数据
  let yMin = 0, yMax = 10; // 默认范围
  
  // 如果有数据，计算适当的范围
  if (series.length > 0) {
    const allValues = [];
    series.forEach(s => {
      s.data.forEach(point => {
        if (point && point.length >= 2) {
          allValues.push(point[1]);
        }
      });
    });
    
    if (allValues.length > 0) {
      const min = Math.min(...allValues);
      const max = Math.max(...allValues);
      yMin = Math.max(0, Math.floor(min - 1));
      yMax = Math.ceil(max + 1);
      
      // 确保间隔为整数
      const range = yMax - yMin;
      const interval = range <= 5 ? 1 : Math.ceil(range / 5);
      yMax = yMin + Math.ceil(range / interval) * interval;
    }
  }
  
  chart.setOption({
    xAxis: timeAxisOption,
    yAxis: {
      min: yMin,
      max: yMax,
      interval: (yMax - yMin) / 5 // 设置适当的间隔
    },
    series: series
  });
};

// =====================【 Muscular Effort 】===================== //
export const initMuscularEffortChart = (chartRef) => {
  const option = createBaseChartOption("Time (s)", "", "Muscular Effort [cmH₂O L]");
  option.tooltip.trigger = "axis";  // 改回 axis 触发
  option.grid.left = '12%';
  option.series = []; // 初始化为空数组，稍后填充数据
  
  return initChart(chartRef, option);
};

// =====================【 Muscular Effort 】===================== //
export const updateMuscularEffortChart = (
  chart,
  timeArr,
  inspWOBArr,
  colors,
  markerTimes
) => {
  const { minTime, maxTime } = calculateTimeRange(timeArr);
  const timeAxisOption = createTimeAxisOption(minTime, maxTime);
  
  const series = [];
  
  // 处理 WOB 数据 - 使用蓝色线图(取绝对值)
  if (inspWOBArr.length > 0 && markerTimes.inspTime && markerTimes.inspTime.length > 0) {
    // 确保两个数组长度一致
    const len = Math.min(inspWOBArr.length, markerTimes.inspTime.length);
    const wobData = [];
    
    for (let i = 0; i < len; i++) {
      wobData.push([markerTimes.inspTime[i], Math.abs(inspWOBArr[i])]); // 取绝对值
    }
    
    series.push({
      name: "inspWOB",
      type: "line",  // 使用线图而非散点图
      symbol: "circle",  // 每个数据点处显示圆圈
      symbolSize: 8,
      showSymbol: true,  // 确保显示数据点
      smooth: false,     // 不使用平滑曲线
      lineStyle: { 
        color: colors.pink,
        width: 2
      },
      itemStyle: { 
        color: colors.pink, 
        borderColor: colors.pink,
        borderWidth: 2
      },
      data: wobData
    });
  }
  
  // 调整 Y 轴范围以适配数据
  let yMin = 0, yMax = 5; // 默认范围
  
  // 如果有数据，计算适当的范围
  if (series.length > 0 && series[0].data.length > 0) {
    const allValues = series[0].data.map(point => point[1]);
    if (allValues.length > 0) {
      const max = Math.max(...allValues);
      yMax = Math.ceil(max * 1.5); // 确保数据点不会太接近顶部
      
      // 确保间隔为合理值
      if (yMax <= 1) {
        yMax = 1;
      } else if (yMax <= 5) {
        yMax = Math.ceil(yMax);
      } else {
        yMax = Math.ceil(yMax / 5) * 5;
      }
    }
  }
  
  chart.setOption({
    xAxis: timeAxisOption,
    yAxis: {
      min: yMin,
      max: yMax,
      interval: yMax / 5 // 设置适当的间隔
    },
    series: series
  });
};
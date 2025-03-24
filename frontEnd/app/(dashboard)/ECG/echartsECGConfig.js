// 假设 getCommonChartOptions 已经在 echartsConfig 中定义
// 示例中直接引用 getCommonChartOptions，用于生成公共配置
import * as echarts from "echarts";
const getCommonChartOptions = (timeData, yAxisLabel, xAxisType = 'category') => {
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
      nameTextStyle: { fontSize: 14, color: '#333' },
      axisLabel: { 
        formatter: "{value}",
        interval: 359,  // Ensure all labels are displayed
      },
      splitLine: { show: false },
      position: 'bottom',  // Always place x-axis at the bottom
      axisLine: {
        show: true,  // 显示坐标轴
        onZero: false,  // 禁止横轴总是与0点交叉
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
      nameTextStyle: { fontSize: 14, color: '#333' },
    },
    grid: {
      left: "5%",
      right: "5%",
      top: "15%",
      bottom: "15%",
      containLabel: true,
    },
  };
};

/**
 * 初始化 ECG 图表
 * @param {Object} chartRef - 指向容器 DOM 元素的 ref 对象
 * @param {Object} timeData - 包含时间数据的 ref 对象
 * @param {Object} ecgData - 包含 ECG 数据的 ref 对象
 * @returns {Object} echarts 实例
 */
export const initECGChart = (chartRef, timeData, ecgData) => {
  const ecgChart = echarts.init(chartRef.current);
  const options = {
    ...getCommonChartOptions(timeData, "ECG (mV)"),
    series: [
      {
        name: "ECG",
        type: "line",
        data: ecgData.current,
        showSymbol: false, // 隐藏散点
        lineStyle: {
          color: "rgba(255, 99, 132, 1)", // 例如红色
          width: 2,
        },
        smooth: true,
      },
    ],
  };
  ecgChart.setOption(options);
  return ecgChart;
};

export const updateECGChart = (ecgChart, ecgBuffer, ecgData, timeData, updatePoints) => {
  // 如果缓冲区数据足够，则取出一批更新到 ecgData 中
  if (ecgBuffer.current.length > updatePoints.current) {
    const ecgBatch = ecgBuffer.current.splice(0, updatePoints.current);
    ecgData.current.push(...ecgBatch);
    ecgData.current.splice(0, updatePoints.current);
  } else {
    // console.log("[INFO] ecgBuffer empty");
  }

  // 计算 ECG 数据的 Y 轴范围
  const getYRange = (data) => {
    const maxValue = Math.max(...data);
    const minValue = Math.min(...data);
    const margin = 0.5; // 根据 ECG 振幅设置一个合适的边际（单位：mV）
    return { min: minValue - margin, max: maxValue + margin };
  };

  const ecgRange = getYRange(ecgData.current);

  // 更新图表配置
  ecgChart.setOption(
    {
      ...getCommonChartOptions(timeData, "ECG (mV)"),
      series: [
        {
          name: "ECG",
          type: "line",
          data: ecgData.current,
          showSymbol: false,
          lineStyle: {
            color: "rgba(255, 99, 132, 1)",
            width: 2,
          },
          smooth: true,
        },
      ],
      yAxis: {
        ...getCommonChartOptions(timeData, "ECG (mV)").yAxis,
        min: ecgRange.min,
        max: ecgRange.max,
        axisLabel: {
          formatter: (value) => value.toFixed(2) + " mV",
        },
        // 设置刻度间隔为整体范围的 1/5，可根据需要调整
        interval: (ecgRange.max - ecgRange.min) / 5,
      },
    },
    true
  );
};

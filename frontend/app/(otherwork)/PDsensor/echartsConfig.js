/**
 * Configuration and utility functions for photodiode charts using ECharts.
 * Updated to support both raw and filtered signal display.
 */
import * as echarts from "echarts";

/**
 * Initializes a photodiode chart with the given configuration.
 * 
 * @param {React.RefObject} chartRef - Reference to the chart container element.
 * @param {React.MutableRefObject} timeData - Reference to the time axis data.
 * @param {React.MutableRefObject} rawData - Reference to the raw sensor data.
 * @param {React.MutableRefObject} filteredData - Reference to the filtered sensor data.
 * @param {string} channelName - Name of the channel (e.g., "PD1").
 * @returns {echarts.ECharts} The initialized ECharts instance.
 */
export const initPhotodiodeChart = (chartRef, timeData, rawData, filteredData, channelName) => {
  const chart = echarts.init(chartRef.current);
  
  const option = {
    animation: false,
    grid: {
      top: 40,
      left: 50,
      right: 20,
      bottom: 30
    },
    legend: {
      data: [`${channelName} Raw`, `${channelName} Filtered`],
      top: 5,
      textStyle: {
        fontSize: 12
      }
    },
    xAxis: {
      type: "value",
      name: "Time (s)",
      nameLocation: "middle",
      nameGap: 25,
      min: 0,
      max: 10, // 10 seconds window
      axisLabel: {
        formatter: "{value} s"
      }
    },
    yAxis: {
      type: "value",
      name: "Amplitude",
      nameLocation: "middle",
      nameGap: 35,
      scale: true // Enable auto-scaling based on data values
    },
    series: [
      {
        name: `${channelName} Raw`,
        type: "line",
        showSymbol: false,
        data: timeData.current.map((time, index) => [time, rawData.current[index]]),
        lineStyle: {
          color: getChannelColor(channelName, 'raw'),
          width: 1.5,
          opacity: 0.7
        }
      },
      {
        name: `${channelName} Filtered`,
        type: "line",
        showSymbol: false,
        data: timeData.current.map((time, index) => [time, filteredData.current[index]]),
        lineStyle: {
          color: getChannelColor(channelName, 'filtered'),
          width: 2.5
        }
      }
    ],
    tooltip: {
      trigger: "axis",
      formatter: function (params) {
        let result = `Time: ${params[0].value[0].toFixed(2)}s<br/>`;
        params.forEach(param => {
          result += `${param.seriesName}: ${param.value[1].toFixed(3)}<br/>`;
        });
        return result;
      }
    }
  };
  
  chart.setOption(option);
  return chart;
};

/**
 * Updates a photodiode chart with new data from the buffer.
 * 
 * @param {echarts.ECharts} chart - The ECharts instance to update.
 * @param {React.MutableRefObject} buffer - Buffer containing new raw data points.
 * @param {React.MutableRefObject} rawData - Raw data array for the chart.
 * @param {React.MutableRefObject} filteredData - Filtered data array for the chart.
 * @param {React.MutableRefObject} timeData - Time axis data.
 * @param {React.MutableRefObject} updatePoints - Number of points to update.
 * @param {Function} filter - Low-pass filter function.
 * @param {string} channelName - Name of the channel.
 */
export const updatePhotodiodeChart = (chart, buffer, rawData, filteredData, timeData, updatePoints, filter, channelName) => {
  // Skip if buffer is empty
  if (buffer.current.length === 0) return;
  
  // Get the number of points to update (limited by buffer size)
  const points = Math.min(updatePoints.current, buffer.current.length);
  
  if (points > 0) {
    // Get new raw data points from buffer
    const newRawPoints = buffer.current.slice(0, points);
    
    // Apply filter to new points to get filtered data
    const newFilteredPoints = newRawPoints.map(rawPoint => filter(rawPoint));
    
    // Shift raw data array to make room for new points
    rawData.current.splice(0, points);
    // Add new raw points
    rawData.current.push(...newRawPoints);
    
    // Shift filtered data array to make room for new points
    filteredData.current.splice(0, points);
    // Add new filtered points
    filteredData.current.push(...newFilteredPoints);
    
    // Remove processed points from the buffer
    buffer.current.splice(0, points);
    
    // Update chart with new data
    chart.setOption({
      series: [
        {
          name: `${channelName} Raw`,
          data: timeData.current.map((time, index) => [time, rawData.current[index]]),
          lineStyle: {
            color: getChannelColor(channelName, 'raw'),
            width: 1.5,
            opacity: 0.7
          }
        },
        {
          name: `${channelName} Filtered`,
          data: timeData.current.map((time, index) => [time, filteredData.current[index]]),
          lineStyle: {
            color: getChannelColor(channelName, 'filtered'),
            width: 2.5
          }
        }
      ]
    });
  }
};

/**
 * Returns a color for the given channel name and signal type.
 * 
 * @param {string} channelName - Name of the channel.
 * @param {string} signalType - Type of signal ('raw' or 'filtered').
 * @returns {string} Color code.
 */
function getChannelColor(channelName, signalType = 'filtered') {
  const colorMap = {
    "PD1": {
      raw: "#FF8A9B", // Light red for raw signal
      filtered: "#FF4560" // Red for filtered signal
    },
    "PD2": {
      raw: "#7FFFD4", // Light green for raw signal
      filtered: "#00E396" // Green for filtered signal
    },
    "PD3": {
      raw: "#87CEEB", // Light blue for raw signal
      filtered: "#008FFB" // Blue for filtered signal
    },
    "PD4": {
      raw: "#FFD700", // Light orange for raw signal
      filtered: "#FEB019" // Orange for filtered signal
    }
  };
  
  return colorMap[channelName]?.[signalType] || "#7A5195"; // Default purple
}
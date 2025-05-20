// WebSocketContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // 创建全局 WebSocket 连接
    const ws = new WebSocket("ws://192.168.148.129:8000/ws");

    ws.addEventListener('open', () => {
      console.log("[Global WS] Connected");
    });

    ws.addEventListener('close', () => {
      console.log("[Global WS] Disconnected");
    });

    setSocket(ws);

    // 连接关闭时清理
    return () => {
      ws.close();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={socket}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);

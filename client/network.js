// client/network.js
import { io } from 'socket.io-client';

// 經濟系統事件處理
export const EconomyEvents = {
  MONEY_UPDATED: 'money_updated',
  PURCHASE_REQUEST: 'purchase_request',
  PURCHASE_RESPONSE: 'purchase_response'
};

export function connect(token) {
  // 自動檢測服務器地址
  const protocol = window.location.protocol;
  const hostname = window.location.hostname || 'localhost';
  const port = window.location.port || '3000';
  const serverUrl = `${protocol}//${hostname}:${port}`;

  console.log('[Network] Connecting to server:', serverUrl);

  const socket = io(serverUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
    forceNew: true
  });

  // 監聽連接狀態
  socket.on('connect', () => {
    console.log('[Network] Connected to server:', serverUrl);
  });

  socket.on('connect_error', (error) => {
    console.error('[Network] Connection error:', error.message);
  });

  return socket;
}

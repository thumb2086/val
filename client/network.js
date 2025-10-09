// client/network.js
import { io } from 'socket.io-client';

export function connect(token) {
  const socket = io('/', {
    auth: { token },
    transports: ['websocket', 'polling'], // 允許降級到 polling
    upgrade: true,                        // 允許傳輸協議升級
    reconnection: true,                  // 啟用自動重連
    reconnectionAttempts: 5,            // 最多嘗試重連 5 次
    reconnectionDelay: 1000,            // 重連延遲 1 秒
    timeout: 20000,                     // 連接超時時間 20 秒
    forceNew: true                      // 強制建立新連接
  });
  return socket;
}

// client/network.js
import { io } from 'socket.io-client';

export function connect(token) {
  const socket = io('/', {
    auth: { token },
    transports: ['websocket'],
    upgrade: false,
  });
  return socket;
}

import { io, Socket } from 'socket.io-client';
import { StatAlertPayload } from '../types';

let socket: Socket | null = null;

const WS_URL =
  import.meta.env.VITE_WS_URL || 'http://localhost:3000/triage-ws';

export const initWebSocket = (
  token: string,
  onQueueUpdated: (data: any) => void,
  onStatAlert: (data: StatAlertPayload) => void,
): Socket => {
  if (socket) {
    socket.disconnect();
  }

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[WebSocket] Connected to Triage Gateway:', socket?.id);
  });

  socket.on('queue_updated', (data) => {
    console.log('[WebSocket] queue_updated received:', data);
    onQueueUpdated(data);
  });

  socket.on('stat_alert_received', (data: StatAlertPayload) => {
    console.warn('[WebSocket] STAT ALERT received:', data);
    onStatAlert(data);
  });

  socket.on('connect_error', (err) => {
    console.error('[WebSocket] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[WebSocket] Disconnected:', reason);
  });

  return socket;
};

export const disconnectWebSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

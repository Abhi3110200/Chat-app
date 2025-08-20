// API and WebSocket configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.106:8000';
const WS_BASE_URL = process.env.EXPO_PUBLIC_WS_URL || 'http://192.168.1.106:8000';

const API_URL = `${API_BASE_URL}${API_BASE_URL.endsWith('/api') ? '' : '/api'}`;
// For Socket.IO, we use the base URL without the /api prefix
const SOCKET_URL = WS_BASE_URL.replace(/\/$/, '');

export { API_URL, SOCKET_URL };

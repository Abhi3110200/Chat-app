import { io, Socket as BaseSocket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

// Extend the Socket type to include userId
interface CustomSocket extends BaseSocket {
  userId?: string;
  isConnected?: boolean;
  reconnectAttempts?: number;
}

const API_URL = "https://chat-app-tvkg.onrender.com";
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000; // 3 seconds

let socket: CustomSocket;
let reconnectTimeout: NodeJS.Timeout | null = null;

const connectSocket = async (): Promise<CustomSocket> => {
  const token = await SecureStore.getItemAsync('token');
  const userData = await SecureStore.getItemAsync('user');
  let userId: string | null = null;
  
  if (userData) {
    try {
      const parsedUser = JSON.parse(userData);
      userId = parsedUser._id || parsedUser.id;
    } catch (error) {
      console.error('Error parsing user data:', error);
      throw error;
    }
  }
  
  if (!token || !userId) {
    throw new Error('No authentication token or user ID found');
  }

  const newSocket = io(API_URL, {
    auth: { token },
    query: { userId },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: RECONNECT_DELAY,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket'],
  }) as CustomSocket;

  newSocket.userId = userId;
  newSocket.isConnected = false;
  newSocket.reconnectAttempts = 0;

  newSocket.on('connect', () => {
    console.log('Socket connected:', newSocket.id);
    newSocket.isConnected = true;
    newSocket.reconnectAttempts = 0;
    
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    // Notify server about the connection with a small delay to ensure socket is fully connected
    setTimeout(() => {
      if (newSocket.connected && userId) {
        console.log('Emitting user:connect for userId:', userId);
        newSocket.emit('user:connect', userId, (response: any) => {
          console.log('Server acknowledged user connection:', response);
        });
      }
    }, 100);
  });

  newSocket.on('disconnect', (reason: string) => {
    console.log('Socket disconnected:', reason);
    newSocket.isConnected = false;
    
    if (reason === 'io server disconnect') {
      // the disconnection was initiated by the server, you need to reconnect manually
      if (!reconnectTimeout) {
        reconnectTimeout = setTimeout(() => {
          newSocket.connect();
        }, 1000) as unknown as NodeJS.Timeout;
      }
    }
  });

  newSocket.on('connect_error', (error: Error) => {
    console.error('Socket connection error:', error.message);
    if (newSocket.reconnectAttempts && newSocket.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.min(1000 * Math.pow(2, newSocket.reconnectAttempts), 30000);
      console.log(`Will attempt to reconnect in ${delay}ms`);
    }
  });

  return newSocket;
};

const getSocket = async (): Promise<CustomSocket> => {
  if (!socket || !socket.connected) {
    try {
      if (socket) {
        // Clean up old socket
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.disconnect();
      }
      
      socket = await connectSocket();
    } catch (error) {
      console.error('Failed to create socket connection:', error);
      throw error;
    }
  }
  
  if (socket.disconnected) {
    socket.connect();
  }
  
  return socket;
};

export default getSocket;

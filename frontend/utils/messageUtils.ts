import { Message } from "@/types/message";
import { Ionicons } from "@expo/vector-icons";

export const getMessageStatus = (message: Message) => {
  if (message.status === 'error') return 'error';
  if (message.read) return 'read';
  if (message.delivered) return 'delivered';
  if (message.status === 'sent') return 'sent';
  return message.status || 'sending';
};

type StatusIconReturn = {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
};

export const getStatusIcon = (status: string, isOnline: boolean = false): StatusIconReturn => {
  // For sent messages, show different icons based on read status and online status
  if (status === 'sent') {
    // If recipient is online, show single checkmark in blue
    if (isOnline) {
      return { name: 'checkmark', color: '#007AFF' };
    }
    // If recipient is offline, show single gray checkmark
    return { name: 'checkmark', color: '#888' };
  }
  
  // For delivered messages, show double checkmarks in blue if read, gray if not read
  if (status === 'delivered') {
    return { 
      name: 'checkmark-done', 
      color: isOnline ? '#007AFF' : '#888' 
    };
  }
  
  // For read messages, show double blue checkmarks
  if (status === 'read') {
    return { name: 'checkmark-done', color: '#007AFF' };
  }
  
  // For errors, show error icon
  if (status === 'error') {
    return { name: 'alert-circle', color: '#FF3B30' };
  }
  
  // Default to clock icon for sending/unknown status
  return { name: 'time', color: '#888' }
}

export const markMessageAsDelivered = async (messageId: string, authToken: string) => {
  try {
    const response = await fetch(`http://192.168.1.106:8000/message-status/${messageId}/delivered`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to mark message as delivered');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error marking message as delivered:', error);
    return null;
  }
};

export const markMessageAsRead = async (messageId: string, authToken: string) => {
  try {
    const response = await fetch(`http://192.168.1.106:8000/message-status/${messageId}/read`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to mark message as read');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error marking message as read:', error);
    return null;
  }
};

export const markAllMessagesAsRead = async (conversationId: string, authToken: string) => {
  try {
    const response = await fetch(`http://192.168.1.106:8000/message-status/conversation/${conversationId}/read-all`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to mark messages as read');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return null;
  }
};

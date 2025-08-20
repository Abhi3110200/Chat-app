export interface Message {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  conversationId: string;
  timestamp: string;
  read?: boolean;
  delivered?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  readBy?: Array<{ user: string }>;
}

export interface TypingEvent {
  userId: string;
  conversationId: string;
  isTyping: boolean;
}

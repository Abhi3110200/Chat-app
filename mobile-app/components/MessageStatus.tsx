import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '../app/chat/[id]';

type StatusIcon = {
  name: 'time' | 'checkmark' | 'checkmark-done' | 'alert-circle';
  color: string;
};

export const getMessageStatus = (message: Message): string => {
  if (message.status === 'error') return 'error';
  if (message.read) return 'read';
  if (message.delivered) return 'delivered';
  if (message.status === 'sent') return 'sent';
  return 'sending';
};

export const getStatusIcon = (status: string): StatusIcon => {
  switch (status) {
    case 'read':
      return { name: 'checkmark-done', color: '#34B7F1' }; // Blue checkmarks
    case 'delivered':
      return { name: 'checkmark-done', color: '#888' }; // Gray checkmarks
    case 'sent':
      return { name: 'checkmark', color: '#888' }; // Single gray checkmark
    case 'error':
      return { name: 'alert-circle', color: '#FF3B30' }; // Red error icon
    default:
      return { name: 'time', color: '#888' }; // Clock icon for sending
  }
};

interface MessageStatusProps {
  message: Message;
  isCurrentUser: boolean;
}

export const MessageStatus = ({ message, isCurrentUser }: MessageStatusProps) => {
  if (!isCurrentUser) return null;

  const status = getMessageStatus(message);
  const icon = getStatusIcon(status);

  return (
    <View style={styles.statusContainer}>
      {message.status === 'sending' && (
        <Ionicons
          name="time"
          size={14}
          color="#888"
          style={styles.sendingIndicator}
        />
      )}
      <Ionicons
        name={icon.name}
        size={14}
        color={icon.color}
        style={styles.statusIcon}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  sendingIndicator: {
    marginRight: 4,
  },
  statusIcon: {
    marginLeft: 2,
  },
});

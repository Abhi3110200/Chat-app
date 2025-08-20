import { Message } from '../models/message.model.js';
import { Conversation } from '../models/conversation.model.js';

// Update message status to 'delivered'
export const markAsDelivered = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findOneAndUpdate(
      { 
        _id: messageId,
        receiver: userId,
        delivered: { $ne: true } // Only update if not already delivered
      },
      { 
        $set: { 
          delivered: true,
          deliveredAt: new Date(),
          status: 'delivered' 
        } 
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found or already delivered' });
    }

    // Update conversation's last activity
    await Conversation.findByIdAndUpdate(
      message.conversationId,
      { $set: { updatedAt: new Date() } }
    );

    // Emit socket event for real-time update
    req.io.to(`user_${userId}`).emit('message:status', {
      messageId: message._id,
      status: 'delivered',
      deliveredAt: message.deliveredAt
    });

    res.json({ success: true, message: 'Message marked as delivered', data: message });
  } catch (error) {
    console.error('Error marking message as delivered:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update message status to 'read'
export const markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findOneAndUpdate(
      { 
        _id: messageId,
        receiver: userId,
        read: { $ne: true } // Only update if not already read
      },
      { 
        $set: { 
          read: true,
          readAt: new Date(),
          status: 'read',
          $addToSet: { 
            readBy: { 
              user: userId,
              readAt: new Date() 
            } 
          }
        } 
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found or already read' });
    }

    // Update conversation's last activity
    await Conversation.findByIdAndUpdate(
      message.conversationId,
      { 
        $set: { updatedAt: new Date() },
        $inc: { 'unreadCounts.$[elem].count': -1 }
      },
      {
        arrayFilters: [{ 'elem.user': userId }]
      }
    );

    // Emit socket event for real-time update
    req.io.to(`user_${userId}`).emit('message:status', {
      messageId: message._id,
      status: 'read',
      readAt: message.readAt
    });

    res.json({ success: true, message: 'Message marked as read', data: message });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Mark all messages in a conversation as read
export const markAllAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Mark all unread messages in the conversation as read
    const result = await Message.updateMany(
      {
        conversationId,
        receiver: userId,
        read: false
      },
      {
        $set: {
          read: true,
          readAt: new Date(),
          status: 'read',
          $addToSet: {
            readBy: {
              user: userId,
              readAt: new Date()
            }
          }
        }
      }
    );

    if (result.modifiedCount === 0) {
      return res.json({ success: true, message: 'No unread messages to mark as read' });
    }

    // Reset unread count for this conversation
    await Conversation.updateOne(
      { _id: conversationId },
      {
        $set: { updatedAt: new Date() },
        $inc: { 'unreadCounts.$[elem].count': -result.modifiedCount }
      },
      {
        arrayFilters: [{ 'elem.user': userId }]
      }
    );

    // Emit socket event for real-time update
    req.io.to(`user_${userId}`).emit('conversation:read', {
      conversationId,
      readCount: result.modifiedCount
    });

    res.json({ 
      success: true, 
      message: `${result.modifiedCount} messages marked as read`,
      readCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

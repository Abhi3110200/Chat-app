import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { 
  markAsDelivered, 
  markAsRead, 
  markAllAsRead 
} from '../controllers/messageStatus.controller.js';

const router = express.Router();

// Mark a message as delivered
router.put('/:messageId/delivered', protect, markAsDelivered);

// Mark a message as read
router.put('/:messageId/read', protect, markAsRead);

// Mark all messages in a conversation as read
router.put('/conversation/:conversationId/read-all', protect, markAllAsRead);

export default router;

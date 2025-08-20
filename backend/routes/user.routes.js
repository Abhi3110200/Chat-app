import express from 'express';
import { Message } from '../models/message.model.js';
import { User } from '../models/user.model.js';
import { protect } from '../middleware/auth.middleware.js';
const router = express.Router();

// Get user by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users with their online status and last message
router.get('/', protect, async (req, res) => {
  try {
    // Get all users except the current user
    const users = await User.find({ _id: { $ne: req.user.id } }).select('-password');
    
    // Get the last message for each conversation
    const usersWithLastMessage = await Promise.all(users.map(async (user) => {
      const lastMessage = await Message.findOne({
        $or: [
          { sender: req.user.id, receiver: user._id },
          { sender: user._id, receiver: req.user.id }
        ]
      }).sort({ createdAt: -1 }).limit(1);
      
      return {
        ...user.toObject(),
        lastMessage: lastMessage ? lastMessage.text : 'No messages yet',
        lastMessageTime: lastMessage ? lastMessage.createdAt : null
      };
    }));
    
    res.json(usersWithLastMessage);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

router.get("/:id/messages", protect, async (req, res) => {
  const messages = await Message.find({
    $or: [
      { sender: req.user.id, receiver: req.params.id },
      { sender: req.params.id, receiver: req.user.id }
    ]
  }).sort({ createdAt: 1 });
  res.json(messages);
});

export default router;

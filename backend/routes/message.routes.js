import express from 'express';
import { User } from '../models/user.model.js';
import { Message } from '../models/message.model.js';
import { protect } from '../middleware/auth.middleware.js';
const router = express.Router();

// Get all users except current user
router.get("/", protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } }).select("-password");
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get messages between current user and another user
router.get("/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    // Find messages where either:
    // - current user is sender and userId is receiver, OR
    // - current user is receiver and userId is sender
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ]
    }).sort({ createdAt: 1 }); // Sort by creation time, oldest first

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

export default router;

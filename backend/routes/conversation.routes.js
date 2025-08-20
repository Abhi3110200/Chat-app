import express from "express";
import { User } from "../models/user.model.js";
import { Message } from "../models/message.model.js";
import { protect } from "../middleware/auth.middleware.js";
const router = express.Router();

// Get users + last message with them
router.get("/", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all users except self
    const users = await User.find({ _id: { $ne: userId } });

    // For each user, get last message exchanged
    const userList = await Promise.all(
      users.map(async (user) => {
        const lastMessage = await Message.findOne({
          $or: [
            { sender: userId, receiver: user._id },
            { sender: user._id, receiver: userId },
          ],
        })
          .sort({ createdAt: -1 })
          .limit(1);

        return {
          id: user._id,
          username: user.username,
          online: user.online,
          lastMessage: lastMessage ? lastMessage.text : null,
        };
      })
    );

    res.json(userList);
  } catch (err) {
    res.status(500).json({ error: "Failed to load conversations" });
  }
});

export default router;


import dotenv from "dotenv";
dotenv.config();

import cors from "cors";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import messageRoutes from "./routes/message.routes.js";
import { Message } from "./models/message.model.js";
import { User } from "./models/user.model.js";
import { Conversation } from "./models/conversation.model.js";
import conversationRoutes from "./routes/conversation.routes.js";
import messageStatusRoutes from "./routes/messageStatus.routes.js";



const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: "*",
    methods: ["GET", "POST"]
  } 
});

// Attach io to app
app.set('io', io);

app.use(express.json());
app.use(cors());
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/messages", messageRoutes);
app.use("/conversations", conversationRoutes);
app.use("/message-status", messageStatusRoutes);


// Track connected users
const connectedUsers = new Map();

// Function to update user's online status
const updateUserOnlineStatus = async (userId, isOnline) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId, 
      { 
        online: isOnline,
        lastSeen: isOnline ? null : new Date()
      }, 
      { new: true }
    );
    
    if (!user) {
      console.log(`User ${userId} not found`);
      return false;
    }
    
    console.log(`User ${userId} is now ${isOnline ? 'online' : 'offline'}`);
    return true;
  } catch (error) {
    console.error('Error updating user status:', error);
    return false;
  }
};

io.on("connection", (socket) => {
  console.log("New socket connection:", socket.id);

  // Handle user connection
  socket.on('user:connect', async (userId) => {
    if (!userId) {
      console.log('No userId provided for connection');
      return;
    }
    
    console.log(`User ${userId} connected on socket ${socket.id}`);
    
    // Store socket ID with user ID
    socket.userId = userId;
    connectedUsers.set(userId, socket.id);
    
    // Update user's online status
    const success = await updateUserOnlineStatus(userId, true);
    
    if (success) {
      // Notify other users about this user's online status
      socket.broadcast.emit('user:status', { 
        userId, 
        online: true,
        lastSeen: null
      });
      
      // Send the user's current status back to them
      socket.emit('user:status', { 
        userId,
        online: true,
        lastSeen: null
      });
    }
  });

  // Handle user disconnection
  socket.on('disconnect', async (reason) => {
    console.log(`User disconnected (${reason}):`, socket.id);
    
    if (socket.userId) {
      const userId = socket.userId;
      connectedUsers.delete(socket.id);
      
      // Check if user has any other active connections
      const hasOtherConnections = Array.from(connectedUsers.entries())
        .some(([uid, sid]) => uid === userId && sid !== socket.id);
      
      // Only update status if this was the last connection
      if (!hasOtherConnections) {
        const success = await updateUserOnlineStatus(userId, false);
        
        if (success) {
          // Notify other users about this user's offline status
          io.emit('user:status', { 
            userId,
            online: false,
            lastSeen: new Date()
          });
        }
      } else {
        console.log(`User ${userId} still has other active connections`);
      }
      
      // Remove any pending reconnection timeouts for this socket
      if (socket.reconnectTimeout) {
        clearTimeout(socket.reconnectTimeout);
      }
    }
  });
  
  // Handle user status check
  socket.on('user:status', async ({ userId }) => {
    try {
      const user = await User.findById(userId);
      if (user) {
        socket.emit('user:status', { 
          userId, 
          online: user.online,
          lastSeen: user.lastSeen || null
        });
      }
    } catch (error) {
      console.error('Error checking user status:', error);
    }
  });
  
  // Handle typing events
  socket.on('typing', async ({ chatId, isTyping, userId, userName }) => {
    try {
      if (!chatId || !userId) {
        console.log('Missing required fields for typing event:', { chatId, userId });
        return;
      }
      
      console.log(`User ${userId} ${isTyping ? 'started' : 'stopped'} typing in chat ${chatId}`);
      
      // Get the room ID for this conversation
      const roomId = [userId, chatId].sort().join('_');
      
      // Emit to all in the room except the sender
      socket.to(roomId).emit('typing', {
        userId,
        chatId,
        isTyping,
        userName,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Error handling typing event:', error);
    }
  });

  // Handle user joining a conversation
  socket.on("join", async ({ userId, chatUserId }) => {
    if (userId) {
      // Join the user's personal room
      socket.join(userId);
      console.log(`User ${userId} joined their room`);
      
      // Join the conversation room
      if (chatUserId) {
        const roomId = [userId, chatUserId].sort().join('_');
        socket.join(roomId);
        console.log(`User ${userId} joined conversation ${roomId}`);
        
        // Mark messages as read when user joins the chat
        try {
          // Update all messages from this chat that are addressed to the current user
          const result = await Message.updateMany(
            {
              receiver: userId,
              sender: chatUserId,
              read: false
            },
            {
              $set: { 
                status: 'read',
                read: true,
                readAt: new Date() 
              },
              $push: { 
                readBy: { 
                  user: userId, 
                  readAt: new Date() 
                } 
              }
            }
          );
          
          // Notify other participant that messages were read
          if (result.modifiedCount > 0) {
            io.to(chatUserId).emit('messages:read', {
              readerId: userId,
              chatId: chatUserId,
              readAt: new Date()
            });
          }
        } catch (error) {
          console.error('Error marking messages as read:', error);
        }
      }
    }
  });

  // Handle user leaving a conversation
  socket.on("leave", ({ userId, chatUserId }) => {
    if (userId && chatUserId) {
      const roomId = [userId, chatUserId].sort().join('_');
      socket.leave(roomId);
      console.log(`User ${userId} left conversation ${roomId}`);
    }
  });

  // Handle sending a new message with retry logic
  socket.on("message:send", async (data, callback) => {
    console.log('Received message request:', data);
    
    const sendMessageWithRetry = async (retryCount = 0) => {
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        const { senderId, receiverId, text } = data;
        
        if (!senderId || !receiverId || !text) {
          throw new Error('Missing required fields');
        }
        
        // 1️⃣ Find or create conversation first
        const participants = [senderId, receiverId].sort();
        let conversation = await Conversation.findOne({
          participants: { $all: participants }
        }).session(session);
        
        // Create conversation if it doesn't exist
        if (!conversation) {
          conversation = new Conversation({
            participants,
            lastMessageAt: new Date()
          });
          await conversation.save({ session });
        }
        
        // 2️⃣ Create message with the conversation ID
        const message = new Message({
          sender: senderId,
          receiver: receiverId,
          text,
          conversationId: conversation._id,
          type: 'sender',
          status: 'sent',
          read: false,
          delivered: false,
          createdAt: new Date(),
          readBy: []
        });
        
        await message.save({ session });
        
        // 3️⃣ Update conversation with the new message
        conversation.lastMessage = message._id;
        conversation.lastMessageAt = new Date();
        await conversation.save({ session });
        
        // 4️⃣ Commit the transaction
        await session.commitTransaction();
        
        // 5️⃣ Populate and send the message
        const savedMessage = await Message.findById(message._id)
          .populate('sender', 'name')
          .populate('receiver', 'name');
        
        const messageData = savedMessage.toObject();
        const roomId = [senderId, receiverId].sort().join('_');
        
        // Emit to the room that a new message was sent
        io.to(roomId).emit("message:new", {
          ...messageData,
          type: messageData.sender._id.toString() === senderId ? 'sender' : 'receiver'
        });
        
        // Check if receiver is online and in the chat
        const receiverSocketId = connectedUsers.get(receiverId);
        if (receiverSocketId) {
          // If receiver is online, mark as delivered
          const updatedMessage = await Message.findByIdAndUpdate(
            message._id,
            {
              $set: { 
                status: 'delivered',
                delivered: true,
                deliveredAt: new Date() 
              }
            },
            { new: true }
          );
          
          // Notify sender that message was delivered
          io.to(socket.id).emit('message:status', {
            messageId: message._id,
            status: 'delivered',
            delivered: true,
            deliveredAt: updatedMessage.deliveredAt
          });
        }
        
        if (callback) callback({ success: true });
        
      } catch (error) {
        await session.abortTransaction();
        
        // Retry on WriteConflict error (code 112)
        if (error.code === 112 && retryCount < 3) {
          console.log(`Retrying message send (attempt ${retryCount + 1})...`);
          // Add a small delay before retry
          await new Promise(resolve => setTimeout(resolve, 100 * (retryCount + 1)));
          return sendMessageWithRetry(retryCount + 1);
        }
        
        console.error('Error sending message:', error);
        if (callback) {
          const errorMessage = error.code === 112 
            ? 'Message conflict. Please try again.' 
            : error.message || 'Failed to send message';
            
          callback({ 
            error: errorMessage,
            code: error.code
          });
        }
      } finally {
        session.endSession().catch(console.error);
      }
    };
    
    // Start the message sending process
    sendMessageWithRetry().catch(console.error);
  });
  
});


const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

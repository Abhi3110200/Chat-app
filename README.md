# Real-time Chat Application

A full-stack real-time chat application built with React Native (Expo) and Node.js (Express + Socket.IO).

## Features

- **Authentication**: JWT-based registration and login
- **Real-time Messaging**: Instant message delivery using Socket.IO
- **User List**: View all registered users
- **Chat Features**:
  - Typing indicators
  - Online/offline status
  - Message read receipts
  - Message history

## Tech Stack

- **Frontend**: React Native (Expo)
- **Backend**: Node.js, Express
- **Real-time**: Socket.IO
- **Database**: MongoDB
- **Authentication**: JWT

## Project Structure
```bash
chat/ ├── mobile-app/ # React Native mobile app
      └── backend/ # Node.js + Express backend
```


## Prerequisites

- Node.js (v16 or later)
- npm or yarn
- MongoDB Atlas account or local MongoDB instance
- Expo CLI (for mobile development)

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:

```bash
cd backend
```

2. Install dependencies:

```bash
npm install
```

3. Create a .env file in the backend directory with the following variables:

```bash
PORT=8000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://abhijeetdrv:StNmq4kbwppNxAfc@cluster0.icwh8fa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

# JWT
JWT_SECRET=zskjbabskjdw7832buwi8w3rkwjdn938rbk
JWT_EXPIRES_IN=30d
JWT_COOKIE_EXPIRES=30

# CORS
CORS_ORIGIN=*
```

4. Start the development server:

```bash
npm start
```

### Mobile App Setup

1. Navigate to the mobile app directory:

```bash
cd mobile-app
```

2. Install dependencies:

```bash
npm install
```

3. Create a .env file in the mobile-app directory with your backend URL:

```bash
EXPO_PUBLIC_API_URL=https://chat-app-tvkg.onrender.com
EXPO_PUBLIC_WS_URL=https://chat-app-tvkg.onrender.com
```

4. Start the development server:

```bash
npm start
```

# API Endpoints
## Authentication
```bash
POST /auth/register - Register a new user
POST /auth/login - Login user
```

## Users
```bash
GET /users - Get all users
```

## Conversations
```bash
GET /users/:conversationId - Get conversation messages
```

# Socket.IO Events
## Client Emits
```bash
message:send - Send a new message
typing:start - User started typing
typing:stop - User stopped typing
message:read - Mark message as read
```

## Server Emits
```bash
message:new - New message received
user:online - User is online
user:offline - User is offline
typing:status - Typing status update
```

# Environment Variables
## Backend
```bash
PORT - Server port (default: 3001)
MONGODB_URI - MongoDB connection string
JWT_SECRET - Secret key for JWT
```

## Mobile App
```bash
API_URL - Backend API URL
```

# Contributing
```bash
Fork the repository
Create your feature branch (git checkout -b feature/AmazingFeature)
Commit your changes (git commit -m 'Add some AmazingFeature')
Push to the branch (git push origin feature/AmazingFeature)
Open a Pull Request
```

# License
```bash
This project is licensed under the MIT License - see the LICENSE file for details.
```

<video controls src="Chat-app Video.mp4" title="Title"></video>
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getOrCreateChatRoom,
  getMyChatRooms,
  sendMessage,
  getMessages,
  markAsRead,
} = require('../controllers/chatController');

// All chat routes require authentication
router.use(authenticate);

// POST /api/chat/room - Get or create a chat room
router.post('/room', getOrCreateChatRoom);

// GET /api/chat/rooms - Get user's chat rooms
router.get('/rooms', getMyChatRooms);

// POST /api/chat/message - Send a message
router.post('/message', sendMessage);

// GET /api/chat/:chatRoomId/messages - Get messages
router.get('/:chatRoomId/messages', getMessages);

// PUT /api/chat/:chatRoomId/read - Mark messages as read
router.put('/:chatRoomId/read', markAsRead);

module.exports = router;

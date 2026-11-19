const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Protect all chat routes
router.use(authenticate);

// Chat messaging endpoints
router.post('/message', chatController.sendMessage);
router.post('/messages', chatController.sendMessage);
router.post('/stream', chatController.streamMessage);
router.get('/:conversationId/history', chatController.getConversationHistory);

module.exports = router;


const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Protect all conversation routes
router.use(authenticate);

// Conversation CRUD
router.post('/', chatController.createConversation);
router.get('/', chatController.getConversations);
router.get('/:id', chatController.getConversation);
router.patch('/:id', chatController.updateConversationTitle);
router.delete('/:id', chatController.deleteConversation);

module.exports = router;


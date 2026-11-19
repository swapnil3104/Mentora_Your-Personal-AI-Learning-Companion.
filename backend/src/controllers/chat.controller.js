const chatService = require('../services/chat.service');
const { success, error } = require('../utils/api-response');

/**
 * Controller handling Conversation Management and AI Study Chatbot interactions
 */
class ChatController {
  /**
   * Create a new conversation
   * POST /api/conversations
   */
  async createConversation(req, res, next) {
    try {
      const { title } = req.body;
      const conversation = await chatService.createConversation(req.user.id, title);
      return success(res, conversation, 'Conversation created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * List all student conversations
   * GET /api/conversations
   */
  async getConversations(req, res, next) {
    try {
      const conversations = await chatService.getUserConversations(req.user.id);
      return success(res, conversations, 'Conversations retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get single conversation with full message history and verified source citations
   * GET /api/conversations/:id
   */
  async getConversation(req, res, next) {
    try {
      const conversation = await chatService.getConversationById(req.user.id, req.params.id);
      return success(res, conversation, 'Conversation retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update conversation title
   * PATCH /api/conversations/:id
   */
  async updateConversationTitle(req, res, next) {
    try {
      const { title } = req.body;
      if (!title || !title.trim()) {
        return error(res, 'Title is required', 400);
      }
      const updated = await chatService.updateConversationTitle(req.user.id, req.params.id, title);
      return success(res, updated, 'Conversation title updated successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete conversation and cascade messages
   * DELETE /api/conversations/:id
   */
  async deleteConversation(req, res, next) {
    try {
      const result = await chatService.deleteConversation(req.user.id, req.params.id);
      return success(res, result, 'Conversation deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Send a chat message with document grounding and multi-turn persistence
   * POST /api/chat/message
   */
  async sendMessage(req, res, next) {
    try {
      const { conversationId, content, message, documentId, documentIds, mode } = req.body;
      const messageContent = content || message;

      if (!messageContent) {
        return error(res, 'Message content is required', 400);
      }

      const result = await chatService.sendMessage(req.user.id, {
        conversationId,
        content: messageContent,
        documentId,
        documentIds,
        mode,
      });

      return success(res, result, 'Message processed successfully', 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Stream a chat response via Server-Sent Events (SSE)
   * POST /api/chat/stream
   */
  async streamMessage(req, res, next) {
    try {
      const { conversationId, content, message, documentId, documentIds, mode } = req.body;
      const messageContent = content || message;

      await chatService.streamMessage(
        req.user.id,
        {
          conversationId,
          content: messageContent,
          documentId,
          documentIds,
          mode,
        },
        res
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieve conversation history
   * GET /api/chat/:conversationId/history
   */
  async getConversationHistory(req, res, next) {
    try {
      const conversation = await chatService.getConversationById(req.user.id, req.params.conversationId);
      return success(res, {
        conversationId: conversation.id,
        title: conversation.title,
        messages: conversation.messages,
      }, 'Conversation history retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ChatController();


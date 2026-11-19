const prisma = require('../config/database');
const aiService = require('./ai.service');

class ChatService {
  /**
   * Create a new conversation for a student
   */
  async createConversation(userId, title) {
    return await prisma.conversation.create({
      data: {
        userId,
        title: title?.trim() || 'New Conversation',
      },
    });
  }

  /**
   * List all conversations for a student
   */
  async getUserConversations(userId) {
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            content: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    return conversations.map((conv) => ({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messageCount: conv._count.messages,
      lastMessage: conv.messages[0] || null,
    }));
  }

  /**
   * Retrieve a conversation with full message history and verified source citations
   */
  async getConversationById(userId, conversationId) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sources: {
              include: {
                document: {
                  select: {
                    id: true,
                    filename: true,
                    fileType: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      const error = new Error('Conversation not found');
      error.statusCode = 404;
      throw error;
    }

    if (conversation.userId !== userId) {
      const error = new Error('Access denied: You do not own this conversation');
      error.statusCode = 403;
      throw error;
    }

    return conversation;
  }

  /**
   * Update conversation title
   */
  async updateConversationTitle(userId, conversationId, title) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      const error = new Error('Conversation not found');
      error.statusCode = 404;
      throw error;
    }

    if (conversation.userId !== userId) {
      const error = new Error('Access denied: You do not own this conversation');
      error.statusCode = 403;
      throw error;
    }

    return await prisma.conversation.update({
      where: { id: conversationId },
      data: { title: title.trim() },
    });
  }

  /**
   * Delete conversation (cascades to messages and sources)
   */
  async deleteConversation(userId, conversationId) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      const error = new Error('Conversation not found');
      error.statusCode = 404;
      throw error;
    }

    if (conversation.userId !== userId) {
      const error = new Error('Access denied: You do not own this conversation');
      error.statusCode = 403;
      throw error;
    }

    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    return { id: conversationId, deleted: true };
  }

  /**
   * Send a chat message with document grounding and multi-turn persistence
   */
  async sendMessage(userId, { conversationId, content, documentId, documentIds, mode = 'standard' }) {
    if (!content || !content.trim()) {
      const error = new Error('Message content is required');
      error.statusCode = 400;
      throw error;
    }

    let conversation;
    let isNewConv = false;

    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        const error = new Error('Conversation not found');
        error.statusCode = 404;
        throw error;
      }

      if (conversation.userId !== userId) {
        const error = new Error('Access denied: You do not own this conversation');
        error.statusCode = 403;
        throw error;
      }
    } else {
      // Derive title from question
      const cleanContent = content.trim();
      const initialTitle = cleanContent.length > 40
        ? cleanContent.substring(0, 40) + '...'
        : cleanContent;

      conversation = await prisma.conversation.create({
        data: {
          userId,
          title: initialTitle,
        },
      });
      isNewConv = true;
    }

    // Verify document scope if provided
    let targetDocId = documentId || null;
    let targetDocIds = documentIds || null;

    if (targetDocId) {
      const doc = await prisma.document.findUnique({
        where: { id: targetDocId },
      });
      if (!doc || doc.userId !== userId) {
        const error = new Error('Specified document does not exist or does not belong to you');
        error.statusCode = 403;
        throw error;
      }
    }

    if (targetDocIds && targetDocIds.length > 0) {
      const docs = await prisma.document.findMany({
        where: {
          id: { in: targetDocIds },
          userId,
        },
      });
      if (docs.length !== targetDocIds.length) {
        const error = new Error('One or more selected documents do not belong to you');
        error.statusCode = 403;
        throw error;
      }
    }

    // 1. Save student message
    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: content.trim(),
      },
    });

    // 2. Fetch recent conversation history (last 6 messages = 3 turns)
    const recentMessages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        id: { not: userMessage.id },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const conversationHistory = recentMessages.reverse().map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 3. Call AI Service Chat/RAG endpoint
    const aiPayload = {
      query: content.trim(),
      user_id: userId,
      conversation_id: conversation.id,
      document_id: targetDocId,
      document_ids: targetDocIds,
      conversation_history: conversationHistory,
      mode: mode === 'simple_explanation' ? 'simple_explanation' : 'standard',
    };

    const aiResult = await aiService.generateChatResponse(aiPayload);

    // 4. Save AI Assistant Message
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: aiResult.answer,
      },
    });

    // 5. Save verified source citations
    const savedSources = [];
    if (aiResult.sources && aiResult.sources.length > 0) {
      for (const src of aiResult.sources) {
        // Ensure document still exists in PostgreSQL
        try {
          const doc = await prisma.document.findUnique({
            where: { id: src.document_id },
          });

          if (doc) {
            const savedSrc = await prisma.messageSource.create({
              data: {
                messageId: assistantMessage.id,
                documentId: src.document_id,
                pageNumber: src.page_number,
                chunkId: src.chunk_id,
                relevanceScore: src.relevance_score,
                snippet: src.snippet,
              },
              include: {
                document: {
                  select: {
                    id: true,
                    filename: true,
                    fileType: true,
                  },
                },
              },
            });
            savedSources.push(savedSrc);
          }
        } catch (err) {
          // Continue if individual source fails
        }
      }
    }

    // 6. Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return {
      conversation: {
        id: conversation.id,
        title: conversation.title,
      },
      userMessage,
      assistantMessage: {
        ...assistantMessage,
        sources: savedSources,
        suggestedFollowUps: aiResult.suggested_follow_ups || [],
        insufficientContext: aiResult.insufficient_context || false,
        latencyMs: aiResult.latency_ms,
      },
    };
  }

  /**
   * Stream chat message response using Server-Sent Events (SSE)
   */
  async streamMessage(userId, { conversationId, content, documentId, documentIds, mode = 'standard' }, res) {
    if (!content || !content.trim()) {
      res.status(400).json({ status: 'fail', message: 'Message content is required' });
      return;
    }

    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!conversation || conversation.userId !== userId) {
        res.status(403).json({ status: 'fail', message: 'Access denied: Invalid conversation' });
        return;
      }
    } else {
      const cleanContent = content.trim();
      const initialTitle = cleanContent.length > 40
        ? cleanContent.substring(0, 40) + '...'
        : cleanContent;

      conversation = await prisma.conversation.create({
        data: {
          userId,
          title: initialTitle,
        },
      });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // 1. Save user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: content.trim(),
      },
    });

    // Send initial conversation metadata event
    res.write(`event: init\ndata: ${JSON.stringify({
      conversationId: conversation.id,
      conversationTitle: conversation.title,
      userMessageId: userMessage.id,
    })}\n\n`);

    // 2. Fetch history
    const recentMessages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        id: { not: userMessage.id },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const conversationHistory = recentMessages.reverse().map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // 3. Initiate AI Service stream
    try {
      const streamResponse = await aiService.streamChatRequest({
        query: content.trim(),
        user_id: userId,
        conversation_id: conversation.id,
        document_id: documentId || null,
        document_ids: documentIds || null,
        conversation_history: conversationHistory,
        mode: mode === 'simple_explanation' ? 'simple_explanation' : 'standard',
      });

      let accumulatedAnswer = '';
      let receivedSources = [];
      let followUps = [];

      streamResponse.on('data', (chunk) => {
        const text = chunk.toString();
        // Forward SSE chunks directly to client
        res.write(text);

        // Parse chunk lines to capture sources and full token answer
        const lines = text.split('\n');
        let currentEvent = 'message';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.replace('event: ', '').trim();
          } else if (line.startsWith('data: ')) {
            try {
              const dataObj = JSON.parse(line.replace('data: ', '').trim());
              if (currentEvent === 'token' && dataObj.token) {
                accumulatedAnswer += dataObj.token;
              } else if (currentEvent === 'sources' && dataObj.sources) {
                receivedSources = dataObj.sources;
              } else if (currentEvent === 'done' && dataObj.suggested_follow_ups) {
                followUps = dataObj.suggested_follow_ups;
              }
            } catch (e) {
              // ignore partial lines
            }
          }
        }
      });

      streamResponse.on('end', async () => {
        try {
          if (accumulatedAnswer.trim()) {
            // Save Assistant Message
            const assistantMsg = await prisma.message.create({
              data: {
                conversationId: conversation.id,
                role: 'assistant',
                content: accumulatedAnswer,
              },
            });

            // Save sources
            for (const src of receivedSources) {
              try {
                const doc = await prisma.document.findUnique({
                  where: { id: src.document_id },
                });
                if (doc) {
                  await prisma.messageSource.create({
                    data: {
                      messageId: assistantMsg.id,
                      documentId: src.document_id,
                      pageNumber: src.page_number,
                      chunkId: src.chunk_id,
                      relevanceScore: src.relevance_score,
                      snippet: src.snippet,
                    },
                  });
                }
              } catch (e) {}
            }

            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { updatedAt: new Date() },
            });
          }
        } catch (dbErr) {
          console.error('Error persisting streamed message:', dbErr);
        } finally {
          res.end();
        }
      });

      streamResponse.on('error', (err) => {
        res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      });
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
}

module.exports = new ChatService();


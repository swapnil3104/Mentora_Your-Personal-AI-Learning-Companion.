import api from './api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const chatService = {
  /**
   * Get all conversations for current student
   */
  async getConversations() {
    const res = await api.get('/conversations');
    return res.data?.data || [];
  },

  /**
   * Get a conversation by ID with all messages and citations
   */
  async getConversation(id) {
    const res = await api.get(`/conversations/${id}`);
    return res.data?.data;
  },

  /**
   * Create a new blank conversation
   */
  async createConversation(title = 'New Conversation') {
    const res = await api.post('/conversations', { title });
    return res.data?.data;
  },

  /**
   * Rename a conversation
   */
  async updateConversationTitle(id, title) {
    const res = await api.patch(`/conversations/${id}`, { title });
    return res.data?.data;
  },

  /**
   * Delete a conversation
   */
  async deleteConversation(id) {
    const res = await api.delete(`/conversations/${id}`);
    return res.data?.data;
  },

  /**
   * Send a question / message with document grounding (Synchronous RAG)
   */
  async sendMessage({ conversationId, content, documentId, documentIds, mode = 'standard' }) {
    const res = await api.post('/chat/message', {
      conversationId,
      content,
      documentId,
      documentIds,
      mode,
    });
    return res.data?.data;
  },

  /**
   * Stream a chat response using fetch ReadableStream / SSE
   */
  async streamMessage({
    conversationId,
    content,
    documentId,
    documentIds,
    mode = 'standard',
    onInit,
    onToken,
    onSources,
    onDone,
    onError,
  }) {
    const token = localStorage.getItem('mentora_token');
    try {
      const response = await fetch(`${API_BASE_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          conversationId,
          content,
          documentId,
          documentIds,
          mode,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Chat stream error (${response.status}): ${errorText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep last incomplete line

        let currentEvent = 'message';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.replace('event: ', '').trim();
          } else if (line.startsWith('data: ')) {
            const jsonStr = line.replace('data: ', '').trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);
              if (currentEvent === 'init' && onInit) {
                onInit(data);
              } else if (currentEvent === 'token' && onToken) {
                onToken(data.token);
              } else if (currentEvent === 'sources' && onSources) {
                onSources(data.sources);
              } else if (currentEvent === 'done' && onDone) {
                onDone(data);
              } else if (currentEvent === 'error' && onError) {
                onError(data.error);
              }
            } catch (err) {
              console.error('Error parsing SSE data chunk:', err);
            }
          }
        }
      }
    } catch (err) {
      if (onError) onError(err.message || 'Stream connection failed');
      else throw err;
    }
  },
};

export default chatService;


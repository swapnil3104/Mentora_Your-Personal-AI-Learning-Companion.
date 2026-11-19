const config = require('./environment');

const aiConfig = {
  baseUrl: config.aiServiceUrl,
  endpoints: {
    health: '/ai/health',
    processDocument: '/ai/documents/process',
    documentStatus: (id) => `/ai/documents/${id}/status`,
    deleteDocument: (id) => `/ai/documents/${id}`,
    ragQuery: '/ai/rag/query',
    ragRetrieve: '/ai/rag/retrieve',
    ragExplainSimply: '/ai/rag/explain-simply',
    ragHealth: '/ai/rag/health',
    chatGenerate: '/ai/chat/generate',
    chatStream: '/ai/chat/stream',
    visualizationGenerate: '/ai/visualization/generate',
    visualizationValidate: '/ai/visualization/validate',
  },
  timeoutMs: 180000,
};

module.exports = aiConfig;


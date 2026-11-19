const http = require('http');
const https = require('https');
const { URL } = require('url');
const aiConfig = require('../config/ai.config');

/**
 * Lightweight HTTP client for internal communication with Python FastAPI AI Service
 */
const requestAiService = (endpoint, method = 'GET', data = null) => {
  return new Promise((resolve, reject) => {
    try {
      const fullUrl = new URL(endpoint, aiConfig.baseUrl);
      const isHttps = fullUrl.protocol === 'https:';
      const transport = isHttps ? https : http;

      const bodyData = data ? JSON.stringify(data) : null;

      const options = {
        hostname: fullUrl.hostname,
        port: fullUrl.port || (isHttps ? 443 : 80),
        path: fullUrl.pathname + fullUrl.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(bodyData ? { 'Content-Length': Buffer.byteLength(bodyData) } : {}),
        },
        timeout: aiConfig.timeoutMs,
      };

      const req = transport.request(options, (res) => {
        let responseBody = '';

        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = responseBody ? JSON.parse(responseBody) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`AI Service error (${res.statusCode}): ${parsed.message || responseBody}`));
            }
          } catch (e) {
            resolve({ raw: responseBody, statusCode: res.statusCode });
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Could not connect to AI service at ${aiConfig.baseUrl}: ${err.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`AI Service request timed out after ${aiConfig.timeoutMs}ms`));
      });

      if (bodyData) {
        req.write(bodyData);
      }
      req.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Check AI Service Health
 */
const checkAiHealth = async () => {
  try {
    return await requestAiService(aiConfig.endpoints.health, 'GET');
  } catch (error) {
    return { status: 'unreachable', error: error.message };
  }
};

/**
 * Execute RAG Query via AI Service
 */
const executeRagQuery = async (queryData) => {
  return await requestAiService(aiConfig.endpoints.ragQuery, 'POST', queryData);
};

/**
 * Semantic Retrieval via AI Service
 */
const semanticRetrieve = async (retrieveData) => {
  return await requestAiService(aiConfig.endpoints.ragRetrieve, 'POST', retrieveData);
};

/**
 * Simple Explanation RAG Query
 */
const explainConceptSimply = async (queryData) => {
  return await requestAiService(aiConfig.endpoints.ragExplainSimply, 'POST', queryData);
};

/**
 * Generate Chat Response via AI Service
 */
const generateChatResponse = async (chatData) => {
  return await requestAiService(aiConfig.endpoints.chatGenerate, 'POST', chatData);
};

/**
 * Initiate an SSE stream request to the AI Service
 */
const streamChatRequest = (chatData) => {
  return new Promise((resolve, reject) => {
    try {
      const fullUrl = new URL(aiConfig.endpoints.chatStream, aiConfig.baseUrl);
      const isHttps = fullUrl.protocol === 'https:';
      const transport = isHttps ? https : http;

      const bodyData = JSON.stringify(chatData);

      const options = {
        hostname: fullUrl.hostname,
        port: fullUrl.port || (isHttps ? 443 : 80),
        path: fullUrl.pathname + fullUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Content-Length': Buffer.byteLength(bodyData),
        },
        timeout: aiConfig.timeoutMs,
      };

      const req = transport.request(options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res);
        } else {
          let errBody = '';
          res.on('data', (d) => { errBody += d; });
          res.on('end', () => {
            reject(new Error(`AI Service stream error (${res.statusCode}): ${errBody}`));
          });
        }
      });

      req.on('error', (err) => {
        reject(new Error(`Could not connect to AI service stream at ${aiConfig.baseUrl}: ${err.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`AI Service stream request timed out after ${aiConfig.timeoutMs}ms`));
      });

      req.write(bodyData);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Generate Structured Visualization via AI Service
 */
const generateVisualization = async (visualizationData) => {
  return await requestAiService(aiConfig.endpoints.visualizationGenerate, 'POST', visualizationData);
};

/**
 * Validate Visualization via AI Service
 */
const validateVisualization = async (validationData) => {
  return await requestAiService(aiConfig.endpoints.visualizationValidate, 'POST', validationData);
};

module.exports = {
  requestAiService,
  checkAiHealth,
  executeRagQuery,
  semanticRetrieve,
  explainConceptSimply,
  generateChatResponse,
  streamChatRequest,
  generateVisualization,
  validateVisualization,
};


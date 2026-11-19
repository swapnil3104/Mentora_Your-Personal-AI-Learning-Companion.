import api from './api';

export const visualizationService = {
  /**
   * Generate structured study visualization using RAG knowledge engine
   */
  async generate({
    visualizationType,
    topic,
    documentId,
    documentIds,
    conversationId,
    chatResponseContext,
    sources,
    model,
  }) {
    const res = await api.post('/visualizations/generate', {
      visualizationType,
      topic,
      documentId: documentId || null,
      documentIds: documentIds || null,
      conversationId: conversationId || null,
      chatResponseContext: chatResponseContext || null,
      sources: sources || null,
      model: model || null,
    });
    return res.data?.data;
  },

  /**
   * List all visualizations saved by the student
   */
  async getVisualizations(params = {}) {
    const res = await api.get('/visualizations', { params });
    return res.data?.data || { visualizations: [], pagination: {} };
  },

  /**
   * Get single visualization by ID
   */
  async getVisualization(id) {
    const res = await api.get(`/visualizations/${id}`);
    return res.data?.data;
  },

  /**
   * Update visualization (e.g. edited nodes/edges, title)
   */
  async updateVisualization(id, data) {
    const res = await api.put(`/visualizations/${id}`, data);
    return res.data?.data;
  },

  /**
   * Delete visualization
   */
  async deleteVisualization(id) {
    const res = await api.delete(`/visualizations/${id}`);
    return res.data?.data;
  },
};

export default visualizationService;

import api from './api';

export const documentService = {
  /**
   * Fetch all documents for current user
   */
  async getDocuments(search = '', status = '') {
    const params = {};
    if (search) params.search = search;
    if (status) params.status = status;
    const response = await api.get('/documents', { params });
    return response.data;
  },

  /**
   * Get single document
   */
  async getDocument(id) {
    const response = await api.get(`/documents/${id}`);
    return response.data;
  },

  /**
   * Upload single document with progress monitoring
   */
  async uploadDocument(file, onUploadProgress) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onUploadProgress(percentCompleted);
        }
      },
    });

    return response.data;
  },

  /**
   * Delete document by ID
   */
  async deleteDocument(id) {
    const response = await api.delete(`/documents/${id}`);
    return response.data;
  },

  /**
   * Retry processing for failed document
   */
  async retryProcessing(id) {
    const response = await api.post(`/documents/${id}/retry`);
    return response.data;
  },
};

export default documentService;

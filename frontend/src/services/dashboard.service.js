import api from './api';

export const dashboardService = {
  /**
   * Fetch aggregated dashboard metrics, recent study materials,
   * recent conversations, and system health status.
   */
  async getDashboardData() {
    const res = await api.get('/dashboard');
    return res.data?.data;
  },

  /**
   * Fetch quick stats only
   */
  async getStats() {
    const res = await api.get('/dashboard/stats');
    return res.data?.data?.stats;
  },
};

export default dashboardService;

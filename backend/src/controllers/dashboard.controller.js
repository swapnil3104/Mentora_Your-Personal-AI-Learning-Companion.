const prisma = require('../config/database');
const { checkAiHealth } = require('../services/ai.service');
const { success } = require('../utils/api-response');

/**
 * Get aggregated dashboard data for the authenticated student:
 * - Real-time counts: documents, conversations, visualizations
 * - Recent study materials (up to 5)
 * - Recent conversations (up to 5)
 * - AI engine and database health status
 */
const getDashboardData = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [
      documentsCount,
      conversationsCount,
      visualizationsCount,
      recentDocuments,
      recentConversations,
      aiHealth,
    ] = await Promise.all([
      prisma.document.count({ where: { userId } }),
      prisma.conversation.count({ where: { userId } }),
      prisma.visualization.count({ where: { userId } }),
      prisma.document.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          filename: true,
          fileType: true,
          fileSize: true,
          pageCount: true,
          processingStatus: true,
          createdAt: true,
        },
      }),
      prisma.conversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { messages: true },
          },
        },
      }),
      checkAiHealth().catch(() => ({ status: 'offline' })),
    ]);

    const isAiOnline = aiHealth && (aiHealth.status === 'online' || aiHealth.raw);

    return success(
      res,
      {
        stats: {
          documentsCount,
          conversationsCount,
          visualizationsCount,
          aiStatus: isAiOnline ? 'online' : 'offline',
          databaseStatus: 'healthy',
          aiDetails: aiHealth.dependencies || null,
        },
        recentDocuments,
        recentConversations,
      },
      'Dashboard data retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardData,
};

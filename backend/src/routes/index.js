const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const documentRoutes = require('./document.routes');
const conversationRoutes = require('./conversation.routes');
const chatRoutes = require('./chat.routes');
const visualizationRoutes = require('./visualization.routes');
const dashboardRoutes = require('./dashboard.routes');
const { checkAiHealth } = require('../services/ai.service');
const prisma = require('../config/database');
const { success } = require('../utils/api-response');

// Health check endpoint
router.get('/health', async (req, res) => {
  let dbStatus = 'healthy';
  let dbLatencyMs = null;
  const startDb = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - startDb;
  } catch (err) {
    dbStatus = 'unreachable';
  }

  const aiStatus = await checkAiHealth();

  const isHealthy = dbStatus === 'healthy' && (aiStatus.status === 'online' || aiStatus.raw);
  const isDegraded = dbStatus === 'healthy' && !isHealthy;
  const overallStatus = isHealthy ? 'healthy' : (isDegraded ? 'degraded' : 'unhealthy');

  const statusCode = dbStatus === 'unreachable' ? 503 : 200;

  return res.status(statusCode).json({
    success: statusCode === 200,
    status: overallStatus,
    message: 'Mentora API is operational',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    memoryUsage: {
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
    data: {
      status: overallStatus,
      services: {
        database: dbStatus,
        databaseLatencyMs: dbLatencyMs,
        aiService: aiStatus.status || (aiStatus.raw ? 'online' : 'offline'),
        aiDetails: aiStatus.dependencies || null,
      },
    },
    services: {
      database: dbStatus,
      databaseLatencyMs: dbLatencyMs,
      aiService: aiStatus.status || (aiStatus.raw ? 'online' : 'offline'),
      aiDetails: aiStatus.dependencies || null,
    },
  });
});

// Authentication routes
router.use('/auth', authRoutes);

// Document management routes
router.use('/documents', documentRoutes);

// Conversation and Chat routes
router.use('/conversations', conversationRoutes);
router.use('/chat', chatRoutes);

// Visual Learning Studio routes
router.use('/visualizations', visualizationRoutes);

// Dashboard routes
router.use('/dashboard', dashboardRoutes);

module.exports = router;


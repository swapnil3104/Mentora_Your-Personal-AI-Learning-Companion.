const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// All dashboard routes require authentication
router.use(requireAuth);

// Aggregated dashboard metrics & recent activities
router.get('/', dashboardController.getDashboardData);
router.get('/stats', dashboardController.getDashboardData);

module.exports = router;

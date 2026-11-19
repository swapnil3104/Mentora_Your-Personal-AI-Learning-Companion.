const express = require('express');
const router = express.Router();
const visualizationController = require('../controllers/visualization.controller');
const { authenticate } = require('../middleware/auth.middleware');

// All visualization endpoints require authentication
router.use(authenticate);

// Generate visualization
router.post('/generate', visualizationController.generate.bind(visualizationController));
router.post('/', visualizationController.generate.bind(visualizationController));

// List and get
router.get('/', visualizationController.list.bind(visualizationController));
router.get('/:id', visualizationController.getById.bind(visualizationController));

// Update (editing) and delete
router.put('/:id', visualizationController.update.bind(visualizationController));
router.patch('/:id', visualizationController.update.bind(visualizationController));
router.delete('/:id', visualizationController.delete.bind(visualizationController));

module.exports = router;

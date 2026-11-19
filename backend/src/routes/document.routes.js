const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// All document routes require authentication
router.use(requireAuth);

// Upload document
router.post('/upload', upload.single('file'), documentController.uploadDocument);

// Get user documents
router.get('/', documentController.getDocuments);

// Get specific document
router.get('/:id', documentController.getDocument);

// Delete document
router.delete('/:id', documentController.deleteDocument);

// Retry document processing
router.post('/:id/retry', documentController.retryProcessing);

module.exports = router;

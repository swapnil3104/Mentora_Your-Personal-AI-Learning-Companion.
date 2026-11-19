const documentService = require('../services/document.service');
const { success, error, notFound } = require('../utils/api-response');
const { validateFileType } = require('../utils/file-validation');

/**
 * Handle single document upload
 */
const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return error(res, 'No file was uploaded', 400);
    }

    const { originalname, path: storagePath, size, mimetype } = req.file;
    const validation = validateFileType(originalname, mimetype);

    if (!validation.valid) {
      return error(res, validation.error, 400);
    }

    // 1. Create document record in PostgreSQL
    const document = await documentService.createDocument({
      userId: req.user.id,
      filename: originalname,
      fileType: validation.fileType,
      storagePath,
      fileSize: size,
    });

    // 2. Trigger asynchronous document extraction & vector indexing in AI service
    // We launch processing in the background and respond immediately with UPLOADED document
    documentService
      .triggerProcessing(document)
      .catch((err) => {
        console.error(`Background ingestion error for doc ${document.id}:`, err.message);
      });

    return success(
      res,
      document,
      'Document uploaded successfully. Processing started.',
      201
    );
  } catch (err) {
    next(err);
  }
};

/**
 * List all documents for the current user
 */
const getDocuments = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const documents = await documentService.getUserDocuments(req.user.id, {
      search,
      status,
    });

    return success(res, documents, 'Documents retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Get document details by ID
 */
const getDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const document = await documentService.getDocumentById(id, req.user.id);

    if (!document) {
      return notFound(res, 'Document not found or access denied');
    }

    return success(res, document, 'Document details retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a document
 */
const deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await documentService.deleteDocument(id, req.user.id);

    if (!deleted) {
      return notFound(res, 'Document not found or access denied');
    }

    return success(res, { id }, 'Document deleted successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Retry processing for a failed document
 */
const retryProcessing = async (req, res, next) => {
  try {
    const { id } = req.params;
    const document = await documentService.getDocumentById(id, req.user.id);

    if (!document) {
      return notFound(res, 'Document not found or access denied');
    }

    // Trigger processing
    documentService
      .triggerProcessing(document)
      .catch((err) => {
        console.error(`Retry ingestion error for doc ${document.id}:`, err.message);
      });

    return success(res, { id, status: 'PROCESSING' }, 'Document reprocessing started');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadDocument,
  getDocuments,
  getDocument,
  deleteDocument,
  retryProcessing,
};

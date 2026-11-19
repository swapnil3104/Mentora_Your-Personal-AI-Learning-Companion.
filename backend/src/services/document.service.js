const fs = require('fs');
const path = require('path');
const prisma = require('../config/database');
const { requestAiService } = require('./ai.service');
const aiConfig = require('../config/ai.config');

/**
 * Register a newly uploaded document in the database
 */
const createDocument = async ({ userId, filename, fileType, storagePath, fileSize }) => {
  const document = await prisma.document.create({
    data: {
      userId,
      filename,
      fileType,
      storagePath,
      fileSize,
      processingStatus: 'UPLOADED',
    },
  });

  return document;
};

/**
 * Trigger AI document processing pipeline asynchronously
 */
const triggerProcessing = async (document) => {
  try {
    // Update status to PROCESSING
    await prisma.document.update({
      where: { id: document.id },
      data: { processingStatus: 'PROCESSING' },
    });

    const absolutePath = path.resolve(document.storagePath);

    // Call FastAPI AI Service
    const aiResponse = await requestAiService(aiConfig.endpoints.processDocument, 'POST', {
      document_id: document.id,
      user_id: document.userId,
      filename: document.filename,
      file_path: absolutePath,
      file_type: document.fileType,
    });

    // Update document with completion status and page count
    const updated = await prisma.document.update({
      where: { id: document.id },
      data: {
        processingStatus: aiResponse.status || 'COMPLETED',
        pageCount: aiResponse.page_count || document.pageCount || 0,
      },
    });

    return updated;
  } catch (error) {
    console.error(`Document processing failed for ${document.id}:`, error.message);
    try {
      await prisma.document.update({
        where: { id: document.id },
        data: { processingStatus: 'FAILED' },
      });
    } catch (_) {
      // Document may have already been deleted by user during processing
    }
    throw error;
  }
};

/**
 * Get all documents owned by user with search and filtering
 */
const getUserDocuments = async (userId, { search = '', status = '' } = {}) => {
  const where = {
    userId,
    ...(status ? { processingStatus: status.toUpperCase() } : {}),
    ...(search
      ? {
          filename: {
            contains: search,
            mode: 'insensitive',
          },
        }
      : {}),
  };

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return documents;
};

/**
 * Get single document by ID and verify ownership
 */
const getDocumentById = async (id, userId) => {
  const document = await prisma.document.findFirst({
    where: { id, userId },
  });

  return document;
};

/**
 * Delete a document, clean up storage and vector index
 */
const deleteDocument = async (id, userId) => {
  const document = await prisma.document.findFirst({
    where: { id, userId },
  });

  if (!document) {
    return null;
  }

  // 1. Delete vectors in AI service (ChromaDB)
  try {
    await requestAiService(aiConfig.endpoints.deleteDocument(id), 'DELETE', {
      user_id: userId,
    });
  } catch (err) {
    console.warn(`AI vector deletion notice for doc ${id}:`, err.message);
  }

  // 2. Delete physical file from storage if it exists
  try {
    const filePath = path.resolve(document.storagePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`File removal notice for doc ${id}:`, err.message);
  }

  // 3. Delete database record (cascades per Prisma schema)
  await prisma.document.delete({
    where: { id },
  });

  return document;
};

/**
 * Update document status
 */
const updateDocumentStatus = async (id, status, pageCount = null) => {
  const data = { processingStatus: status };
  if (pageCount !== null) {
    data.pageCount = pageCount;
  }

  return await prisma.document.update({
    where: { id },
    data,
  });
};

module.exports = {
  createDocument,
  triggerProcessing,
  getUserDocuments,
  getDocumentById,
  deleteDocument,
  updateDocumentStatus,
};

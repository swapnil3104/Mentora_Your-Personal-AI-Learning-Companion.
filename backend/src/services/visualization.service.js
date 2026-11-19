const prisma = require('../config/database');
const { generateVisualization: callAiGenerateVisualization } = require('./ai.service');

const VALID_VISUALIZATION_TYPES = [
  'infographic',
  'concept_map',
  'flowchart',
  'mind_map',
  'process_diagram',
  'architecture_diagram',
];

/**
 * Service managing visualization generation, persistence, retrieval, and updates in PostgreSQL.
 */
class VisualizationService {
  /**
   * Generate structured study visualization using AI service and persist in PostgreSQL
   */
  async generate(userId, params) {
    const {
      visualizationType,
      topic,
      documentId,
      documentIds,
      conversationId,
      chatResponseContext,
      sources,
      model,
    } = params;

    if (!topic || !topic.trim()) {
      throw new Error('A topic or prompt is required to generate a visualization.');
    }

    if (!visualizationType || !VALID_VISUALIZATION_TYPES.includes(visualizationType)) {
      throw new Error(
        `Invalid visualization type '${visualizationType}'. Supported types: ${VALID_VISUALIZATION_TYPES.join(', ')}`
      );
    }

    // Verify document ownership if documentId provided
    if (documentId) {
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
      });
      if (!doc || doc.userId !== userId) {
        throw new Error('Selected document not found or access denied.');
      }
    }

    // Verify conversation ownership if conversationId provided
    if (conversationId) {
      const conv = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!conv || conv.userId !== userId) {
        throw new Error('Selected conversation not found or access denied.');
      }
    }

    // Format sources from frontend / chat history to consistent snake_case schema
    let formattedSources = undefined;
    if (Array.isArray(sources) && sources.length > 0) {
      formattedSources = sources.map((s) => ({
        chunk_id: s.chunk_id || s.chunkId || `${s.document_id || s.documentId || 'doc'}_chunk`,
        document_id: s.document_id || s.documentId || (documentId || ''),
        document_name: s.document_name || s.documentName || s.document?.filename || 'Document',
        page_number: s.page_number || s.pageNumber || 1,
        relevance_score: s.relevance_score !== undefined ? s.relevance_score : (s.relevanceScore !== undefined ? s.relevanceScore : 0.8),
        snippet: s.snippet || '',
      }));
    }

    // Prepare payload for Python AI Service
    const aiPayload = {
      query: topic.trim(),
      user_id: userId,
      visualization_type: visualizationType,
      document_id: documentId || null,
      document_ids: Array.isArray(documentIds) && documentIds.length ? documentIds : null,
      conversation_id: conversationId || null,
      chat_response_context: chatResponseContext || null,
      sources: formattedSources,
      model: model || null,
    };

    const aiResult = await callAiGenerateVisualization(aiPayload);

    // Persist in PostgreSQL
    const visualization = await prisma.visualization.create({
      data: {
        userId,
        documentId: documentId || null,
        conversationId: conversationId || null,
        visualizationType,
        title: aiResult.title || topic.trim(),
        generatedData: {
          ...aiResult.generated_data,
          topic: topic.trim(),
          sources: (aiResult.sources && aiResult.sources.length > 0)
            ? aiResult.sources
            : (Array.isArray(sources) ? sources : []),
          insufficientContext: aiResult.insufficient_context || false,
          latencyMs: aiResult.latency_ms,
          model: aiResult.model,
        },
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileType: true,
            pageCount: true,
          },
        },
        conversation: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return visualization;
  }

  /**
   * List user's visualizations with optional filtering and pagination
   */
  async list(userId, { documentId, type, page = 1, limit = 20 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {
      userId,
      ...(documentId ? { documentId } : {}),
      ...(type && VALID_VISUALIZATION_TYPES.includes(type) ? { visualizationType: type } : {}),
    };

    const [total, visualizations] = await Promise.all([
      prisma.visualization.count({ where }),
      prisma.visualization.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          document: {
            select: {
              id: true,
              filename: true,
              fileType: true,
              pageCount: true,
            },
          },
          conversation: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
    ]);

    return {
      visualizations,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Get single visualization by ID with ownership verification
   */
  async getById(id, userId) {
    const visualization = await prisma.visualization.findUnique({
      where: { id },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileType: true,
            pageCount: true,
          },
        },
        conversation: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!visualization || visualization.userId !== userId) {
      return null;
    }

    return visualization;
  }

  /**
   * Update visualization (supports updating title or diagram node/edge changes from canvas editor)
   */
  async update(id, userId, { title, generatedData }) {
    const existing = await this.getById(id, userId);
    if (!existing) {
      return null;
    }

    const updated = await prisma.visualization.update({
      where: { id },
      data: {
        ...(title ? { title: title.trim() } : {}),
        ...(generatedData ? { generatedData } : {}),
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileType: true,
            pageCount: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Delete visualization with ownership verification
   */
  async delete(id, userId) {
    const existing = await this.getById(id, userId);
    if (!existing) {
      return null;
    }

    await prisma.visualization.delete({
      where: { id },
    });

    return true;
  }
}

module.exports = new VisualizationService();

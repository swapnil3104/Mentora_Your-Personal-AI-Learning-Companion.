const visualizationService = require('../services/visualization.service');
const { success, created, badRequest, notFound, error } = require('../utils/api-response');

/**
 * Controller handling HTTP endpoints for Visual Learning Studio.
 */
class VisualizationController {
  /**
   * POST /api/visualizations/generate
   */
  async generate(req, res) {
    try {
      const userId = req.user.id;
      const {
        visualizationType,
        topic,
        documentId,
        documentIds,
        conversationId,
        chatResponseContext,
        sources,
        model,
      } = req.body;

      if (!topic || !topic.trim()) {
        return badRequest(res, 'Topic is required to generate a visualization.');
      }

      if (!visualizationType) {
        return badRequest(res, 'visualizationType is required.');
      }

      const result = await visualizationService.generate(userId, {
        visualizationType,
        topic,
        documentId,
        documentIds,
        conversationId,
        chatResponseContext,
        sources,
        model,
      });

      return created(res, result, 'Visualization generated and saved successfully.');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * GET /api/visualizations
   */
  async list(req, res) {
    try {
      const userId = req.user.id;
      const { documentId, type, page, limit } = req.query;

      const result = await visualizationService.list(userId, {
        documentId,
        type,
        page,
        limit,
      });

      return success(res, result, 'Visualizations retrieved successfully.');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * GET /api/visualizations/:id
   */
  async getById(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const visualization = await visualizationService.getById(id, userId);
      if (!visualization) {
        return notFound(res, 'Visualization not found or access denied.');
      }

      return success(res, visualization, 'Visualization retrieved successfully.');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * PUT /api/visualizations/:id
   */
  async update(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { title, generatedData } = req.body;

      const updated = await visualizationService.update(id, userId, {
        title,
        generatedData,
      });

      if (!updated) {
        return notFound(res, 'Visualization not found or access denied.');
      }

      return success(res, updated, 'Visualization updated successfully.');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * DELETE /api/visualizations/:id
   */
  async delete(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const deleted = await visualizationService.delete(id, userId);
      if (!deleted) {
        return notFound(res, 'Visualization not found or access denied.');
      }

      return success(res, null, 'Visualization deleted successfully.');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new VisualizationController();

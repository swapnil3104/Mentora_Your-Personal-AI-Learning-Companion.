from fastapi import APIRouter, HTTPException, status
from app.schemas.visualization_schema import (
    VisualizationGenerateRequest,
    VisualizationGenerateResponse,
    VisualizationValidateRequest,
    VisualizationValidateResponse,
)
from app.visualization.generator import visualization_generator
from app.visualization.validator import visualization_validator
from app.core.logging import logger

router = APIRouter(prefix="/ai/visualization", tags=["Visualization"])

@router.post(
    "/generate",
    response_model=VisualizationGenerateResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate structured graphical study visualization using RAG",
)
async def generate_visualization(request: VisualizationGenerateRequest):
    """
    Generates structured diagram or infographic data grounded in student course documents.
    Supports Infographics, Concept Maps, Flowcharts, Mind Maps, Process Diagrams, and Architecture Diagrams.
    """
    try:
        response = visualization_generator.generate(request)
        return response
    except Exception as e:
        logger.error(f"Error in generate_visualization route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Visualization generation failed: {str(e)}",
        )

@router.post(
    "/validate",
    response_model=VisualizationValidateResponse,
    status_code=status.HTTP_200_OK,
    summary="Validate diagram JSON structure and node/edge integrity",
)
async def validate_visualization(request: VisualizationValidateRequest):
    """
    Validates diagram JSON structure, required fields, node uniqueness,
    edge referential integrity, and sanitizes dangerous markup.
    """
    try:
        is_valid, errors, repaired = visualization_validator.validate(
            request.data,
            request.visualization_type,
        )
        return VisualizationValidateResponse(
            valid=is_valid,
            errors=errors,
            repaired_data=repaired if is_valid else None,
        )
    except Exception as e:
        logger.error(f"Error in validate_visualization route: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Validation error: {str(e)}",
        )

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
import json
from app.schemas.chat_schema import ChatGenerateRequest, ChatGenerateResponse
from app.chatbot.chat_service import chat_service
from app.core.logging import logger

router = APIRouter(prefix="/ai/chat", tags=["AI Study Chatbot"])

@router.post("/generate", response_model=ChatGenerateResponse)
async def generate_chat_response(request: ChatGenerateRequest):
    """
    Primary endpoint for AI study chat response generation.
    Retrieves grounded context, executes LLM generation, provides verified citations,
    and returns contextual follow-up questions.
    """
    try:
        response = chat_service.chat(request)
        return response
    except TimeoutError as e:
        logger.error(f"Chat generation timeout: {e}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Inference timed out: {str(e)}"
        )
    except ConnectionError as e:
        logger.error(f"Ollama connection error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"LLM service unavailable: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Chat generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat generation error: {str(e)}"
        )

@router.post("/stream")
async def stream_chat_response(request: ChatGenerateRequest):
    """
    Server-Sent Events (SSE) streaming endpoint for live token generation.
    Streams citation metadata, token stream, and completion status.
    """
    def event_generator():
        try:
            for item in chat_service.stream_chat(request):
                event_name = item.get("event", "message")
                data_str = json.dumps(item.get("data", {}))
                yield f"event: {event_name}\ndata: {data_str}\n\n"
        except Exception as e:
            err_data = json.dumps({"error": str(e)})
            yield f"event: error\ndata: {err_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )


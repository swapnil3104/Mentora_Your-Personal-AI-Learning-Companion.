from typing import Dict, Any, Optional, Generator, List
import requests
import json
import time
from app.core.config import settings
from app.core.logging import logger

class OllamaClient:
    """
    Reusable HTTP client for local Ollama LLM inference.
    Specifically configured for Qwen 3.5 4B with 4096 context window and 0.2 temperature.
    """
    def __init__(
        self,
        base_url: str = None,
        default_model: str = None,
        timeout: int = None
    ):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.default_model = default_model or settings.LLM_MODEL
        self.timeout = timeout or settings.LLM_TIMEOUT_SECONDS

    def check_health(self) -> Dict[str, Any]:
        """
        Verifies connectivity to Ollama server and checks if the configured model is installed.
        """
        try:
            url = f"{self.base_url}/api/tags"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                model_ready = any(
                    self.default_model in m or m.startswith(self.default_model.split(":")[0])
                    for m in models
                )
                return {
                    "status": "healthy" if model_ready else "degraded",
                    "reachable": True,
                    "model": self.default_model,
                    "model_available": model_ready,
                    "installed_models": models,
                }
            return {
                "status": "unhealthy",
                "reachable": True,
                "model_available": False,
                "error": f"Ollama HTTP {response.status_code}",
            }
        except Exception as e:
            logger.warning(f"Ollama health check failed: {e}")
            return {
                "status": "unreachable",
                "reachable": False,
                "model_available": False,
                "error": str(e),
            }

    def _build_options(self, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Constructs standard generation parameters strictly respecting RULES.md:
        - num_ctx: 4096 tokens
        - temperature: 0.2
        - num_predict: configurable (default 1500 to accommodate reasoning models)
        """
        opts = {
            "temperature": settings.LLM_TEMPERATURE,
            "num_ctx": settings.LLM_NUM_CTX,
            "num_predict": settings.LLM_NUM_PREDICT,
            "top_p": 0.9,
        }
        if overrides:
            opts.update(overrides)
        return opts

    def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        model: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None,
        timeout: Optional[int] = None,
        format: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executes a non-streaming completion request.
        Returns a dict containing:
        - text: generated response string
        - thinking: internal reasoning trace (if generated)
        - duration_s: time taken
        - done_reason: completion reason
        """
        target_model = model or self.default_model
        req_timeout = timeout or self.timeout
        opts = self._build_options(options)

        payload: Dict[str, Any] = {
            "model": target_model,
            "prompt": prompt,
            "stream": False,
            "options": opts,
        }
        if system:
            payload["system"] = system
        if format:
            payload["format"] = format

        url = f"{self.base_url}/api/generate"
        t0 = time.time()
        logger.info(f"Ollama generation started with model='{target_model}' (ctx={opts.get('num_ctx')})")

        try:
            response = requests.post(url, json=payload, timeout=req_timeout)
            duration = round(time.time() - t0, 3)

            if response.status_code != 200:
                logger.error(f"Ollama returned status {response.status_code}: {response.text}")
                raise RuntimeError(f"Ollama error {response.status_code}: {response.text}")

            data = response.json()
            response_text = data.get("response", "").strip()
            thinking_trace = data.get("thinking", "").strip() or None
            done_reason = data.get("done_reason", "unknown")

            # Resilient fallback: if reasoning model exhausts tokens while thinking, fallback to standard LLM
            if not response_text and done_reason == "length" and target_model != "qwen2.5:3b":
                logger.warning(
                    f"Model '{target_model}' reached token limit before generating response text. "
                    f"Attempting resilient fallback to 'qwen2.5:3b'..."
                )
                try:
                    fallback_opts = dict(opts)
                    fallback_opts["num_predict"] = 500
                    return self.generate(
                        prompt=prompt,
                        system=system,
                        model="qwen2.5:3b",
                        options=fallback_opts,
                        timeout=30,
                        format=format,
                    )
                except Exception as fb_err:
                    logger.warning(f"Fallback to qwen2.5:3b failed: {fb_err}")

            logger.info(f"Ollama generation completed in {duration}s (done_reason={done_reason})")
            return {
                "text": response_text,
                "thinking": thinking_trace,
                "duration_s": duration,
                "done_reason": done_reason,
                "model": target_model,
                "prompt_eval_count": data.get("prompt_eval_count", 0),
                "eval_count": data.get("eval_count", 0),
            }
        except requests.exceptions.Timeout:
            logger.warning(f"Ollama request timed out after {req_timeout}s for model '{target_model}'")
            if target_model != "qwen2.5:3b":
                logger.info("Attempting resilient fallback to 'qwen2.5:3b'...")
                try:
                    return self.generate(
                        prompt=prompt,
                        system=system,
                        model="qwen2.5:3b",
                        options=options,
                        timeout=45,
                        format=format,
                    )
                except Exception as fb_err:
                    logger.error(f"Fallback to qwen2.5:3b also failed: {fb_err}")
            raise TimeoutError(f"Ollama request timed out after {req_timeout} seconds.")
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Could not connect to Ollama at {self.base_url}: {e}")
            raise ConnectionError(f"Could not connect to Ollama server at {self.base_url}")
        except Exception as e:
            logger.error(f"Ollama generation failed: {e}")
            raise

    def generate_stream(
        self,
        prompt: str,
        system: Optional[str] = None,
        model: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None,
        timeout: Optional[int] = None,
    ) -> Generator[str, None, None]:
        """
        Executes a streaming generation request yielding tokens as they arrive.
        """
        target_model = model or self.default_model
        req_timeout = timeout or self.timeout
        opts = self._build_options(options)

        payload: Dict[str, Any] = {
            "model": target_model,
            "prompt": prompt,
            "stream": True,
            "options": opts,
        }
        if system:
            payload["system"] = system

        url = f"{self.base_url}/api/generate"
        try:
            with requests.post(url, json=payload, stream=True, timeout=req_timeout) as response:
                if response.status_code != 200:
                    raise RuntimeError(f"Ollama stream error {response.status_code}: {response.text}")

                for line in response.iter_lines():
                    if line:
                        chunk_data = json.loads(line.decode("utf-8"))
                        token = chunk_data.get("response", "")
                        if token:
                            yield token
                        if chunk_data.get("done", False):
                            break
        except Exception as e:
            logger.error(f"Ollama streaming failed: {e}")
            raise

    def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None,
        timeout: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Executes a structured chat completion.
        messages format: [{'role': 'system'|'user'|'assistant', 'content': '...'}]
        """
        target_model = model or self.default_model
        req_timeout = timeout or self.timeout
        opts = self._build_options(options)

        payload = {
            "model": target_model,
            "messages": messages,
            "stream": False,
            "options": opts,
        }

        url = f"{self.base_url}/api/chat"
        t0 = time.time()
        try:
            response = requests.post(url, json=payload, timeout=req_timeout)
            duration = round(time.time() - t0, 3)

            if response.status_code != 200:
                raise RuntimeError(f"Ollama chat error {response.status_code}: {response.text}")

            data = response.json()
            msg = data.get("message", {})
            return {
                "text": msg.get("content", "").strip(),
                "thinking": msg.get("thinking", "").strip() or None,
                "role": msg.get("role", "assistant"),
                "duration_s": duration,
                "done_reason": data.get("done_reason", "unknown"),
                "model": target_model,
            }
        except Exception as e:
            logger.error(f"Ollama chat failed: {e}")
            raise

ollama_client = OllamaClient()


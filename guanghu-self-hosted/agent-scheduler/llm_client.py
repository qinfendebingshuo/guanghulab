"""GH-SCHED-001 · LLM Client
Unified wrapper for OpenAI-compatible LLM APIs.
Supports retry, timeout, and dual-model routing stub.
Part of HLDP-ARCH-001 L1 preparation.
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

from config import LLMConfig

logger = logging.getLogger("agent-scheduler.llm")


@dataclass
class LLMResponse:
    """Structured LLM response."""
    content: str
    model: str
    usage_prompt_tokens: int = 0
    usage_completion_tokens: int = 0
    latency_ms: float = 0.0
    success: bool = True
    error: str = ""


class LLMClient:
    """Async LLM client with retry and dual-model stub."""

    def __init__(self, config: LLMConfig):
        self.config = config
        self._client: Optional[Any] = None

    async def _ensure_client(self) -> Any:
        if self._client is None:
            if not HAS_HTTPX:
                raise RuntimeError("httpx is required. Install via: pip install httpx")
            self._client = httpx.AsyncClient(
                base_url=self.config.base_url,
                timeout=httpx.Timeout(self.config.timeout_seconds),
                headers={
                    "Authorization": "Bearer " + self.config.api_key,
                    "Content-Type": "application/json",
                },
            )
        return self._client

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        target_model = model or self.config.model
        payload = {
            "model": target_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        last_error = ""
        for attempt in range(1, self.config.max_retries + 1):
            start = time.monotonic()
            try:
                client = await self._ensure_client()
                resp = await client.post("/chat/completions", json=payload)
                latency = (time.monotonic() - start) * 1000

                if resp.status_code == 200:
                    data = resp.json()
                    choice = data.get("choices", [{}])[0]
                    content = choice.get("message", {}).get("content", "")
                    usage = data.get("usage", {})
                    logger.info(
                        "LLM call success: model=%s attempt=%d latency=%.0fms tokens=%d",
                        target_model, attempt, latency,
                        usage.get("total_tokens", 0),
                    )
                    return LLMResponse(
                        content=content,
                        model=target_model,
                        usage_prompt_tokens=usage.get("prompt_tokens", 0),
                        usage_completion_tokens=usage.get("completion_tokens", 0),
                        latency_ms=latency,
                    )
                else:
                    last_error = "HTTP " + str(resp.status_code) + ": " + resp.text[:200]
                    logger.warning(
                        "LLM call failed: attempt=%d/%d error=%s",
                        attempt, self.config.max_retries, last_error,
                    )
            except Exception as exc:
                latency = (time.monotonic() - start) * 1000
                last_error = str(exc)
                logger.warning(
                    "LLM call exception: attempt=%d/%d latency=%.0fms error=%s",
                    attempt, self.config.max_retries, latency, last_error,
                )

            if attempt < self.config.max_retries:
                wait = 2 ** attempt
                logger.info("Retrying in %ds...", wait)
                await asyncio.sleep(wait)

        logger.error("LLM call exhausted all %d retries. Last error: %s", self.config.max_retries, last_error)
        return LLMResponse(
            content="",
            model=target_model,
            success=False,
            error=last_error,
        )

    async def generate_code(
        self,
        task_description: str,
        constraints: str,
        file_path: str,
        context: str = "",
    ) -> LLMResponse:
        system_msg = (
            "You are a senior Python developer working on the GuangHu self-hosted platform. "
            "Generate clean, well-documented Python code. "
            "Follow all constraints strictly. "
            "Output ONLY the code, no markdown fences, no explanations."
        )
        user_msg = (
            "Task: " + task_description + "\n\n"
            "Target file: " + file_path + "\n\n"
            "Constraints: " + constraints + "\n"
        )
        if context:
            user_msg += "\nContext:\n" + context

        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ]
        return await self.chat(messages, temperature=0.3)

    async def route_expression(self, messages: List[Dict[str, str]]) -> LLMResponse:
        model = self.config.expression_model or self.config.model
        logger.info("Dual-model route: expression -> %s", model)
        return await self.chat(messages, model=model)

    async def route_reasoning(self, messages: List[Dict[str, str]]) -> LLMResponse:
        model = self.config.reasoning_model or self.config.model
        logger.info("Dual-model route: reasoning -> %s", model)
        return await self.chat(messages, model=model)

    async def close(self):
        if self._client is not None:
            await self._client.aclose()
            self._client = None

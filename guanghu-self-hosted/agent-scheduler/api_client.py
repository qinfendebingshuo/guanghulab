"""GH-INTG-001 · Work Order API Client
Async httpx client for the Work Order Claim API (GH-API-001).
Replaces direct DB access in Agent Scheduler with REST API calls.

Endpoints consumed:
  GET  /api/v1/orders/pending      查询待领取工单
  GET  /api/v1/orders/{id}         查询工单详情
  POST /api/v1/orders/{id}/claim   领取工单
  PATCH /api/v1/orders/{id}/status 更新工单状态
  POST /api/v1/orders/{id}/log     写入执行日志
  GET  /api/v1/health              健康检查

Part of HLDP-ARCH-001 L5 · Agent Dev Hub.
编号前缀: GH-INTG · 培园A04
"""

import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False

logger = logging.getLogger("agent-scheduler.api-client")


class APIClientError(Exception):
    """Base exception for API client errors."""
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class APIClientConnectionError(APIClientError):
    """Connection error (API unreachable)."""


class APIClientAuthError(APIClientError):
    """Authentication / authorization error."""


def _extract_detail(resp) -> str:
    """Extract error detail from response body."""
    try:
        body = resp.json()
        return body.get("detail", body.get("error", resp.text[:200]))
    except Exception:
        return resp.text[:200] if resp.text else "no body"


class WorkOrderAPIClient:
    """Async HTTP client for Work Order API.

    Provides the same logical interface as WorkOrderDB but communicates
    via REST instead of direct PostgreSQL access.

    Usage:
        client = WorkOrderAPIClient(
            base_url="http://localhost:8001",
            api_key="sk-py-a04-secret",
        )
        async with client:
            orders = await client.fetch_pending_orders("PY-A04")
    """

    def __init__(
        self,
        base_url: str,
        api_key: str,
        timeout_seconds: float = 30.0,
        max_retries: int = 3,
        retry_delay_seconds: float = 2.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.retry_delay_seconds = retry_delay_seconds
        self._client: Optional[Any] = None

        if not HAS_HTTPX:
            logger.warning("httpx not installed; API client will raise on all calls")

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def connect(self):
        """Create the underlying httpx.AsyncClient."""
        if not HAS_HTTPX:
            raise APIClientError("httpx is required but not installed")
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={"X-Agent-Key": self.api_key},
            timeout=httpx.Timeout(self.timeout_seconds),
        )
        logger.info("API client connected to %s", self.base_url)

    async def close(self):
        """Close the underlying httpx.AsyncClient."""
        if self._client:
            await self._client.aclose()
            self._client = None
            logger.info("API client closed")

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_client(self):
        if self._client is None:
            raise APIClientError("API client not connected. Call connect() first.")

    async def _request_with_retry(
        self,
        method: str,
        path: str,
        json_body: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """Execute an HTTP request with retry and exponential backoff."""
        self._ensure_client()
        last_exc: Optional[Exception] = None
        delay = self.retry_delay_seconds

        for attempt in range(1, self.max_retries + 1):
            try:
                start = time.monotonic()
                resp = await self._client.request(
                    method, path, json=json_body, params=params,
                )
                elapsed_ms = (time.monotonic() - start) * 1000
                logger.debug(
                    "API %s %s -> %d (%.0fms, attempt %d)",
                    method, path, resp.status_code, elapsed_ms, attempt,
                )

                if resp.status_code in (401, 403):
                    detail = _extract_detail(resp)
                    raise APIClientAuthError(
                        "Auth error: " + str(resp.status_code) + " " + detail,
                        status_code=resp.status_code,
                    )

                if resp.status_code >= 500:
                    detail = _extract_detail(resp)
                    last_exc = APIClientError(
                        "Server error: " + str(resp.status_code) + " " + detail,
                        status_code=resp.status_code,
                    )
                    if attempt < self.max_retries:
                        logger.warning(
                            "Retry %d/%d after server error on %s %s",
                            attempt, self.max_retries, method, path,
                        )
                        await asyncio.sleep(delay)
                        delay *= 2
                        continue
                    raise last_exc

                return resp

            except APIClientAuthError:
                raise
            except APIClientError:
                if attempt >= self.max_retries:
                    raise
            except Exception as exc:
                last_exc = APIClientConnectionError(
                    "Connection failed: " + str(exc)
                )
                if attempt < self.max_retries:
                    logger.warning(
                        "Retry %d/%d after connection error on %s %s: %s",
                        attempt, self.max_retries, method, path, exc,
                    )
                    await asyncio.sleep(delay)
                    delay *= 2
                    continue
                raise last_exc

        raise last_exc or APIClientError("Request failed after all retries")

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    async def health_check(self) -> Dict[str, Any]:
        """Check API health. Returns parsed JSON body."""
        resp = await self._request_with_retry("GET", "/api/v1/health")
        return resp.json()

    async def is_healthy(self) -> bool:
        """Quick boolean health check (no exception on failure)."""
        try:
            data = await self.health_check()
            return data.get("status") == "ok" and data.get("db_connected", False)
        except Exception as exc:
            logger.warning("Health check failed: %s", exc)
            return False

    # ------------------------------------------------------------------
    # Work Order operations (mirrors WorkOrderDB interface)
    # ------------------------------------------------------------------

    async def fetch_pending_orders(self, agent_id: str) -> List[Dict[str, Any]]:
        """Fetch pending work orders assigned to this agent.

        Mirrors WorkOrderDB.fetch_pending_orders() but uses REST API.
        """
        resp = await self._request_with_retry(
            "GET", "/api/v1/orders/pending",
            params={"agent_id": agent_id},
        )
        if resp.status_code == 200:
            data = resp.json()
            orders = data.get("orders", [])
            logger.info("Fetched %d pending orders for %s", len(orders), agent_id)
            return orders
        detail = _extract_detail(resp)
        logger.warning("fetch_pending_orders failed: %d %s", resp.status_code, detail)
        return []

    async def get_order_detail(self, order_id: int) -> Optional[Dict[str, Any]]:
        """Get order detail by ID."""
        resp = await self._request_with_retry(
            "GET", "/api/v1/orders/" + str(order_id),
        )
        if resp.status_code == 200:
            return resp.json()
        if resp.status_code == 404:
            return None
        detail = _extract_detail(resp)
        raise APIClientError(
            "get_order_detail failed: " + str(resp.status_code) + " " + detail,
            status_code=resp.status_code,
        )

    async def claim_order(self, order_id: int, agent_code: Optional[str] = None) -> Dict[str, Any]:
        """Claim a pending work order.

        Returns claim response dict with keys:
          claimed, order_id, order_code, agent_code, new_status, message
        """
        body: Dict[str, Any] = {}
        if agent_code:
            body["agent_code"] = agent_code
        resp = await self._request_with_retry(
            "POST", "/api/v1/orders/" + str(order_id) + "/claim",
            json_body=body if body else None,
        )
        if resp.status_code == 200:
            data = resp.json()
            logger.info(
                "Claimed order %d -> %s",
                order_id, data.get("new_status", "?"),
            )
            return data
        detail = _extract_detail(resp)
        raise APIClientError(
            "claim_order failed: " + str(resp.status_code) + " " + detail,
            status_code=resp.status_code,
        )

    async def update_order_status(
        self,
        order_id: int,
        status: str,
        self_check_result: Optional[str] = None,
        review_result: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Update work order status.

        Mirrors WorkOrderDB.update_order_status() but uses REST API.
        """
        body: Dict[str, Any] = {"status": status}
        if self_check_result is not None:
            body["self_check_result"] = self_check_result
        if review_result is not None:
            body["review_result"] = review_result
        resp = await self._request_with_retry(
            "PATCH", "/api/v1/orders/" + str(order_id) + "/status",
            json_body=body,
        )
        if resp.status_code == 200:
            data = resp.json()
            logger.info(
                "Updated order %d status -> %s",
                order_id, data.get("new_status", status),
            )
            return data
        detail = _extract_detail(resp)
        raise APIClientError(
            "update_order_status failed: " + str(resp.status_code) + " " + detail,
            status_code=resp.status_code,
        )

    async def write_execution_log(
        self,
        order_id: int,
        agent_id: str,
        log_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Write execution log entry.

        Mirrors WorkOrderDB.write_execution_log() but uses REST API.
        """
        body = {
            "level": log_data.get("level", "INFO"),
            "message": log_data.get("message", json.dumps(log_data, ensure_ascii=False)[:2000]),
            "step": log_data.get("step"),
            "metadata": {k: v for k, v in log_data.items() if k not in ("level", "message", "step")},
        }
        resp = await self._request_with_retry(
            "POST", "/api/v1/orders/" + str(order_id) + "/log",
            json_body=body,
        )
        if resp.status_code == 200:
            return resp.json()
        detail = _extract_detail(resp)
        logger.warning("write_execution_log failed: %d %s", resp.status_code, detail)
        return {"logged": False, "order_id": order_id}


# ---------------------------------------------------------------------------
# Fallback wrapper: tries API first, falls back to direct DB
# ---------------------------------------------------------------------------

class HybridOrderSource:
    """Wrapper that tries WorkOrderAPIClient first, falls back to WorkOrderDB.

    This allows a gradual migration: if the API is available, use it;
    if the API is down, fall back to direct DB access for resilience.

    Usage:
        hybrid = HybridOrderSource(api_client=api, db_fallback=db)
        orders = await hybrid.fetch_pending_orders(agent_id)
    """

    def __init__(self, api_client: WorkOrderAPIClient, db_fallback: Optional[Any] = None):
        self.api = api_client
        self.db = db_fallback
        self._api_healthy = True

    async def fetch_pending_orders(self, agent_id: str) -> List[Dict[str, Any]]:
        """Fetch pending orders: API first, DB fallback."""
        if self._api_healthy:
            try:
                result = await self.api.fetch_pending_orders(agent_id)
                return result
            except APIClientConnectionError as exc:
                logger.warning("API unreachable, falling back to DB: %s", exc)
                self._api_healthy = False
            except APIClientError as exc:
                logger.error("API error (no fallback): %s", exc)
                raise
        if self.db is not None:
            logger.info("Using DB fallback for fetch_pending_orders")
            return await self.db.fetch_pending_orders(agent_id)
        raise APIClientConnectionError("API unreachable and no DB fallback available")

    async def update_order_status(
        self, order_id: int, status: str,
        extra_fields: Optional[Dict[str, Any]] = None,
    ):
        """Update order status: API first, DB fallback."""
        self_check = None
        review = None
        if extra_fields:
            self_check = extra_fields.get("self_check_result")
            review = extra_fields.get("review_result")
        if self._api_healthy:
            try:
                return await self.api.update_order_status(
                    order_id, status, self_check, review,
                )
            except APIClientConnectionError as exc:
                logger.warning("API unreachable for update, falling back to DB: %s", exc)
                self._api_healthy = False
            except APIClientError as exc:
                logger.error("API error on update (no fallback): %s", exc)
                raise
        if self.db is not None:
            return await self.db.update_order_status(order_id, status, extra_fields)
        raise APIClientConnectionError("API unreachable and no DB fallback")

    async def write_execution_log(
        self, order_id: int, agent_id: str, log_data: Dict[str, Any],
    ):
        """Write execution log: API first, DB fallback."""
        if self._api_healthy:
            try:
                return await self.api.write_execution_log(order_id, agent_id, log_data)
            except APIClientConnectionError as exc:
                logger.warning("API unreachable for log, falling back to DB: %s", exc)
                self._api_healthy = False
        if self.db is not None:
            return await self.db.write_execution_log(order_id, agent_id, log_data)
        logger.warning("No backend available for execution log, dropping")

    async def recover_api(self):
        """Attempt to recover API connection."""
        if not self._api_healthy:
            healthy = await self.api.is_healthy()
            if healthy:
                self._api_healthy = True
                logger.info("API connection recovered")
            return healthy
        return True

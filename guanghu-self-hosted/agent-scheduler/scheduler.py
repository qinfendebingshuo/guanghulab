"""GH-SCHED-001 · Agent Scheduler - Main Loop
Core scheduling engine for GuangHu self-hosted Agent system.
Polls for pending work orders, dispatches to LLM for code generation,
pushes to Git, runs self-checks, and records receipts.

Part of HLDP-ARCH-001 L5 · Agent Dev Hub.
"""

import asyncio
import datetime
import json
import logging
import os
import signal
import sys
from typing import Any, Dict, List, Optional

from config import AppConfig, load_config
from boot_integration import AgentIdentity, load_boot_protocol, validate_identity
from llm_client import LLMClient, LLMResponse
from git_ops import GitOps
from self_checker import SelfChecker, SelfCheckReport

logger = logging.getLogger("agent-scheduler")

# ---------------------------------------------------------------------------
# Database layer (async PostgreSQL via asyncpg, with sync fallback stub)
# ---------------------------------------------------------------------------

try:
    import asyncpg
    HAS_ASYNCPG = True
except ImportError:
    HAS_ASYNCPG = False


class WorkOrderDB:
    """Work order database operations."""

    def __init__(self, dsn: str):
        self.dsn = dsn
        self._pool: Optional[Any] = None

    async def connect(self):
        if HAS_ASYNCPG:
            self._pool = await asyncpg.create_pool(dsn=self.dsn, min_size=1, max_size=3)
            logger.info("Connected to PostgreSQL: %s", self.dsn.split("@")[-1])
        else:
            logger.warning("asyncpg not available, database operations will be stubbed")

    async def close(self):
        if self._pool:
            await self._pool.close()

    async def fetch_pending_orders(self, agent_id: str) -> List[Dict[str, Any]]:
        """Fetch pending work orders assigned to this agent."""
        if not self._pool:
            logger.debug("DB stub: no pending orders (asyncpg not available)")
            return []
        query = (
            "SELECT id, title, dev_content, repo_path, branch_name, "
            "constraints, order_number, phase_number "
            "FROM work_orders "
            "WHERE status = 'pending' AND assigned_agent = $1 "
            "ORDER BY priority ASC, created_at ASC "
            "LIMIT 1"
        )
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query, agent_id)
        return [dict(r) for r in rows]

    async def update_order_status(
        self, order_id: int, status: str, extra_fields: Optional[Dict[str, Any]] = None
    ):
        """Update work order status and optional fields."""
        if not self._pool:
            logger.debug("DB stub: update_order_status(%s, %s)", order_id, status)
            return
        sets = ["status = $2", "updated_at = NOW()"]
        params: list = [order_id, status]
        if extra_fields:
            idx = 3
            for key, val in extra_fields.items():
                sets.append(key + " = $" + str(idx))
                params.append(val)
                idx += 1
        query = "UPDATE work_orders SET " + ", ".join(sets) + " WHERE id = $1"
        async with self._pool.acquire() as conn:
            await conn.execute(query, *params)
        logger.info("Order %s status -> %s", order_id, status)

    async def write_execution_log(
        self, order_id: int, agent_id: str, log_data: Dict[str, Any]
    ):
        """Write execution log entry."""
        if not self._pool:
            logger.debug("DB stub: write_execution_log for order %s", order_id)
            return
        query = (
            "INSERT INTO execution_logs (work_order_id, agent_id, log_data, created_at) "
            "VALUES ($1, $2, $3, NOW())"
        )
        async with self._pool.acquire() as conn:
            await conn.execute(query, order_id, agent_id, json.dumps(log_data))


# ---------------------------------------------------------------------------
# Tool Receipt integration stub
# ---------------------------------------------------------------------------

def record_receipt(
    tool_name: str,
    input_data: Any,
    output_data: Any,
    status: str,
    duration_ms: float,
):
    """Record a tool receipt (L2 integration stub).

    Phase 0: log to stdout.
    Phase 1+: call tool-receipt API.
    """
    receipt = {
        "tool_name": tool_name,
        "input": str(input_data)[:500],
        "output": str(output_data)[:500],
        "status": status,
        "duration_ms": round(duration_ms, 1),
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
    }
    logger.info("RECEIPT: %s", json.dumps(receipt, ensure_ascii=False))


# ---------------------------------------------------------------------------
# Main Scheduler
# ---------------------------------------------------------------------------

class AgentScheduler:
    """Main scheduling engine."""

    def __init__(self, config: AppConfig):
        self.config = config
        self.identity: Optional[AgentIdentity] = None
        self.db = WorkOrderDB(config.db.dsn)
        self.llm = LLMClient(config.llm)
        self.git = GitOps(config.git)
        self._running = True

    async def boot(self):
        """Initialize: load Boot Protocol, connect DB, clone repo."""
        logger.info("=== Agent Scheduler booting ===")

        # Step 1: Boot Protocol
        self.identity = load_boot_protocol(
            self.config.scheduler.boot_protocol_path,
            self.config.scheduler.agent_id,
        )
        if not validate_identity(self.identity):
            raise RuntimeError("Boot Protocol validation failed")
        logger.info(
            "Identity loaded: %s (%s) role=%s",
            self.identity.name, self.identity.agent_id, self.identity.role,
        )

        # Step 2: Database
        await self.db.connect()

        # Step 3: Git clone/pull
        result = await self.git.clone_or_pull()
        if not result.success:
            logger.error("Git clone/pull failed: %s", result.stderr)
            raise RuntimeError("Git initialization failed")
        sha = await self.git.get_current_sha()
        logger.info("Repo ready at %s (HEAD=%s)", self.config.git.clone_dir, sha[:8] if sha else "unknown")

        logger.info("=== Boot complete ===")

    async def execute_order(self, order: Dict[str, Any]):
        """Execute a single work order.

        Flow:
        1. Update status -> developing
        2. Read context (dev_content, constraints, repo_path, branch)
        3. Checkout branch
        4. Call LLM to generate code
        5. Write files to repo
        6. Git add/commit/push
        7. Self-check
        8. Update status -> self_checking -> reviewing
        9. Record receipt
        """
        order_id = order.get("id", 0)
        title = order.get("title", "unknown")
        order_number = order.get("order_number", "")
        dev_content = order.get("dev_content", "")
        repo_path = order.get("repo_path", "")
        branch_name = order.get("branch_name", "")
        constraints = order.get("constraints", "")

        logger.info("--- Executing order: %s [%s] ---", title, order_number)
        start_time = asyncio.get_event_loop().time()

        try:
            # Step 1: Accept
            await self.db.update_order_status(order_id, "developing")
            await self.db.write_execution_log(order_id, self.config.scheduler.agent_id, {
                "step": "accept",
                "message": "Order accepted, starting development",
            })

            # Step 2: Checkout branch
            checkout_result = await self.git.checkout_branch(branch_name, create=True)
            if not checkout_result.success:
                raise RuntimeError("Failed to checkout branch: " + branch_name)

            # Step 3: Generate code via LLM
            llm_response = await self.llm.generate_code(
                task_description=dev_content,
                constraints=constraints,
                file_path=repo_path,
                context="Branch: " + branch_name + " | Order: " + order_number,
            )
            record_receipt(
                "llm.generate_code", dev_content[:200], llm_response.content[:200],
                "success" if llm_response.success else "error",
                llm_response.latency_ms,
            )

            if not llm_response.success:
                raise RuntimeError("LLM generation failed: " + llm_response.error)

            # Step 4: Write files (simplified: single file output)
            # In production, LLM would return structured multi-file output
            if repo_path and llm_response.content:
                main_file = os.path.join(repo_path.strip("/"), "generated_output.py")
                self.git.write_file(main_file, llm_response.content)

            # Step 5: Git add/commit/push
            await self.git.add_files()
            commit_msg = "[" + order_number + "] " + title
            commit_result = await self.git.commit(commit_msg)
            if commit_result.success:
                push_result = await self.git.push(branch_name)
                record_receipt(
                    "git.push", branch_name, push_result.stdout[:200],
                    "success" if push_result.success else "error", 0,
                )

            # Step 6: Self-check
            await self.db.update_order_status(order_id, "self_checking")
            checker = SelfChecker(self.git.repo_dir)
            expected_files = []
            if repo_path and llm_response.content:
                expected_files.append(os.path.join(repo_path.strip("/"), "generated_output.py"))
            check_report = checker.run_all_checks(
                expected_files=expected_files,
                allowed_directory=repo_path.strip("/") if repo_path else "",
                prefix=order_number.split("-")[0] + "-" if "-" in order_number else "",
            )

            # Step 7: Submit for review
            elapsed = asyncio.get_event_loop().time() - start_time
            await self.db.update_order_status(
                order_id, "reviewing",
                extra_fields={
                    "self_check_result": check_report.summary,
                },
            )
            await self.db.write_execution_log(order_id, self.config.scheduler.agent_id, {
                "step": "complete",
                "self_check": check_report.summary,
                "elapsed_seconds": round(elapsed, 1),
                "all_checks_passed": check_report.all_passed,
            })
            logger.info(
                "Order %s complete: %s (%.1fs)",
                order_number,
                "ALL PASSED" if check_report.all_passed else "CHECKS FAILED",
                elapsed,
            )

        except asyncio.TimeoutError:
            logger.error("Order %s timed out (>%ds)", order_number, self.config.scheduler.work_order_timeout_seconds)
            await self.db.update_order_status(order_id, "error", extra_fields={
                "self_check_result": "TIMEOUT: exceeded " + str(self.config.scheduler.work_order_timeout_seconds) + "s",
            })
        except Exception as exc:
            logger.error("Order %s failed: %s", order_number, exc, exc_info=True)
            await self.db.update_order_status(order_id, "error", extra_fields={
                "self_check_result": "ERROR: " + str(exc)[:500],
            })

    async def poll_loop(self):
        """Main polling loop."""
        logger.info(
            "Starting poll loop (interval=%ds, timeout=%ds)",
            self.config.scheduler.poll_interval_seconds,
            self.config.scheduler.work_order_timeout_seconds,
        )

        while self._running:
            try:
                orders = await self.db.fetch_pending_orders(
                    self.config.scheduler.agent_id
                )
                if orders:
                    order = orders[0]
                    logger.info("Found pending order: %s", order.get("title", "?"))
                    # Execute with timeout
                    await asyncio.wait_for(
                        self.execute_order(order),
                        timeout=self.config.scheduler.work_order_timeout_seconds,
                    )
                else:
                    logger.debug("No pending orders, sleeping...")

            except asyncio.CancelledError:
                logger.info("Poll loop cancelled")
                break
            except Exception as exc:
                logger.error("Poll loop error: %s", exc, exc_info=True)

            await asyncio.sleep(self.config.scheduler.poll_interval_seconds)

    async def shutdown(self):
        """Graceful shutdown."""
        logger.info("Shutting down...")
        self._running = False
        await self.llm.close()
        await self.db.close()
        logger.info("Shutdown complete.")

    async def run(self):
        """Full lifecycle: boot -> poll -> shutdown."""
        try:
            await self.boot()
            await self.poll_loop()
        finally:
            await self.shutdown()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def setup_logging(level: str = "INFO"):
    """Configure structured logging."""
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def main():
    config = load_config()
    setup_logging(config.scheduler.log_level)
    scheduler = AgentScheduler(config)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    # Handle graceful shutdown signals
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.ensure_future(scheduler.shutdown()))

    try:
        loop.run_until_complete(scheduler.run())
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    finally:
        loop.close()


if __name__ == "__main__":
    main()

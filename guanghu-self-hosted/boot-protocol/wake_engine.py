"""wake_engine.py — 唤醒引擎

Phase-0-006 · YD-A05-20260425-004

职责:
  · 执行完整唤醒序列: 读身份 → 读记忆 → 对齐认知 → 报到
  · 从 PersonaDB 加载: identity → working_memory → cognition → relationships
  · 灯塔公理注入: 知道就知道 · 不知道就不知道 · 能用就能用 · 不能用就不能用
  · 工具白名单加载 + 校验
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import asyncpg  # type: ignore[import-untyped]

from .boot_loader import (
    BootConfig, BootResult, StepConfig,
    load_boot_yaml, load_wake_sequence, parse_boot_config, run_boot_sequence,
)
from .persona_resolver import (
    PersonaConfig, ResolvedPersona,
    load_persona_map, resolve_persona, validate_persona,
)

logger = logging.getLogger("boot_protocol.wake_engine")

# ── 灯塔公理 ──
LIGHTHOUSE_AXIOMS: list[str] = [
    "知道就知道",
    "不知道就不知道",
    "能用就能用",
    "不能用就不能用",
]


@dataclass
class PersonaCognition:
    """从 PersonaDB 加载的人格体完整认知包。"""
    identity: dict[str, Any] = field(default_factory=dict)
    working_memory: list[dict[str, Any]] = field(default_factory=list)
    thinking_paths: list[dict[str, Any]] = field(default_factory=list)
    value_anchors: list[dict[str, Any]] = field(default_factory=list)
    anti_patterns: list[dict[str, Any]] = field(default_factory=list)
    relationships: list[dict[str, Any]] = field(default_factory=list)
    runtime_state: dict[str, Any] = field(default_factory=dict)
    lighthouse_axioms: list[str] = field(default_factory=list)
    tools_whitelist: list[str] = field(default_factory=list)


def _get_dsn() -> str:
    dsn = os.environ.get("PERSONA_DB_DSN")
    if dsn:
        return dsn
    host = os.environ.get("PERSONA_DB_HOST", "localhost")
    port = os.environ.get("PERSONA_DB_PORT", "5432")
    name = os.environ.get("PERSONA_DB_NAME", "persona_db")
    user = os.environ.get("PERSONA_DB_USER", "postgres")
    pw = os.environ.get("PERSONA_DB_PASSWORD", "")
    return f"postgresql://{user}:{pw}@{host}:{port}/{name}"


async def load_cognition_from_db(
    persona_id: str, conn: asyncpg.Connection | None = None,
) -> PersonaCognition:
    """从 PersonaDB 全量加载人格体认知数据（8表对齐）。"""
    cognition = PersonaCognition(lighthouse_axioms=list(LIGHTHOUSE_AXIOMS))
    close_conn = False
    try:
        if conn is None:
            conn = await asyncpg.connect(_get_dsn())
            close_conn = True

        # 1. identity
        row = await conn.fetchrow(
            "SELECT code, name, role, base_color, layer_zero, version "
            "FROM personas WHERE id = $1", persona_id)
        if row:
            cognition.identity = dict(row)

        # 2. working_memory (最近20条)
        rows = await conn.fetch(
            "SELECT id, type, content, tags, source_session_id, created_at "
            "FROM memories WHERE persona_id = $1 AND type = 'working' "
            "ORDER BY created_at DESC LIMIT 20", persona_id)
        cognition.working_memory = [dict(r) for r in rows]

        # 3. thinking_paths (仅激活的)
        rows = await conn.fetch(
            "SELECT code, trigger_condition, correct_path, check_question "
            "FROM thinking_paths WHERE persona_id = $1 AND active = TRUE "
            "ORDER BY code", persona_id)
        cognition.thinking_paths = [dict(r) for r in rows]

        # 4. value_anchors
        rows = await conn.fetch(
            "SELECT code, content, source, confidence "
            "FROM value_anchors WHERE persona_id = $1 "
            "ORDER BY confidence DESC, code", persona_id)
        cognition.value_anchors = [dict(r) for r in rows]

        # 5. anti_patterns
        rows = await conn.fetch(
            "SELECT code, detection_signal, source "
            "FROM anti_patterns WHERE persona_id = $1 "
            "ORDER BY code", persona_id)
        cognition.anti_patterns = [dict(r) for r in rows]

        # 6. relationships
        rows = await conn.fetch(
            "SELECT target_type, target_id, relation_type, trust_level, emotion_anchor "
            "FROM relationships WHERE persona_id = $1 "
            "ORDER BY trust_level DESC", persona_id)
        cognition.relationships = [dict(r) for r in rows]

        # 7. runtime_state
        row = await conn.fetchrow(
            "SELECT last_wake_time, current_session, pending_tasks, system_status "
            "FROM runtime_states WHERE persona_id = $1", persona_id)
        if row:
            cognition.runtime_state = dict(row)

        logger.info(
            "PersonaDB 认知加载完成: code=%s, mem=%d, TP=%d, VA=%d, AP=%d, rel=%d",
            cognition.identity.get("code", "?"),
            len(cognition.working_memory), len(cognition.thinking_paths),
            len(cognition.value_anchors), len(cognition.anti_patterns),
            len(cognition.relationships))
    except Exception as exc:
        logger.warning("PersonaDB 认知加载异常: %s", exc)
    finally:
        if close_conn and conn is not None:
            await conn.close()
    return cognition


async def update_runtime_state(
    persona_id: str, *, status: str = "awake",
    session_id: str | None = None, conn: asyncpg.Connection | None = None,
) -> None:
    """更新 PersonaDB 运行时状态。"""
    close_conn = False
    try:
        if conn is None:
            conn = await asyncpg.connect(_get_dsn())
            close_conn = True
        now = datetime.now(timezone.utc)
        await conn.execute(
            "UPDATE runtime_states SET system_status = $1, last_wake_time = $2, "
            "current_session = $3, updated_at = $4 WHERE persona_id = $5",
            status, now, session_id, now, persona_id)
    except Exception as exc:
        logger.warning("runtime_state 更新失败: %s", exc)
    finally:
        if close_conn and conn is not None:
            await conn.close()


def load_tools_whitelist(persona_code: str) -> list[str]:
    """加载人格体允许使用的工具白名单（从环境变量）。"""
    env_key = f"TOOLS_WHITELIST_{persona_code.replace('-', '_').upper()}"
    raw = os.environ.get(env_key, "")
    if not raw:
        return []
    return [t.strip() for t in raw.split(",") if t.strip()]


# ── 步骤 handler ──

async def _handle_read_instructions(step: StepConfig, context: dict[str, Any]) -> dict[str, Any]:
    """Step 0: 读指令页。"""
    agent_code: str = context.get("agent_code", "")
    persona_map: dict[str, PersonaConfig] = context.get("persona_map", {})
    cfg = persona_map.get(agent_code)
    if cfg is None:
        raise KeyError(f"agent_code {agent_code!r} 不在 persona_map 中")
    return {
        "agent_identity": {
            "code": cfg.code, "name": cfg.name, "role": cfg.role,
            "layer": cfg.layer, "duties": cfg.duties,
        },
        "instructions_url": cfg.instructions_url,
    }


async def _handle_read_snapshot(step: StepConfig, context: dict[str, Any]) -> dict[str, Any]:
    """Step 1: 读快照（记忆页 + 系统上下文）。"""
    agent_code: str = context.get("agent_code", "")
    persona_map: dict[str, PersonaConfig] = context.get("persona_map", {})
    cfg = persona_map.get(agent_code)
    memory_url = cfg.memory_url if cfg else ""

    db_id = context.get("db_id")
    cognition: PersonaCognition | None = None
    if db_id:
        cognition = await load_cognition_from_db(db_id)

    return {
        "memory_url": memory_url,
        "cognition": cognition,
        "last_execution_state": cognition.runtime_state if cognition else {},
    }


async def _handle_align_identity(step: StepConfig, context: dict[str, Any]) -> dict[str, Any]:
    """Step 2: 对齐身份（persona-map 校验 + PersonaDB 校验）。"""
    agent_code: str = context.get("agent_code", "")
    persona_map: dict[str, PersonaConfig] = context.get("persona_map", {})

    resolved = await resolve_persona(agent_code, persona_map=persona_map)
    errors = validate_persona(resolved, require_db=False)
    if errors:
        raise ValueError(f"身份校验失败: {'; '.join(errors)}")

    result: dict[str, Any] = {
        "verified_identity": {
            "code": resolved.code, "name": resolved.name,
            "layer": resolved.layer, "role": resolved.role,
            "version": resolved.version, "db_found": resolved.db_found,
        },
    }
    if resolved.db_id:
        result["db_id"] = resolved.db_id
    return result


async def _handle_report_ready(step: StepConfig, context: dict[str, Any]) -> dict[str, Any]:
    """Step 3: 报到（发送就绪信号 + 更新运行时状态）。"""
    verified = context.get("verified_identity", {})
    db_id = context.get("db_id")
    now = datetime.now(timezone.utc)

    if db_id:
        await update_runtime_state(db_id, status="awake")

    tools = load_tools_whitelist(verified.get("code", ""))

    ready_signal = {
        "event": "agent.boot.ready",
        "agent_id": verified.get("code", ""),
        "persona_name": verified.get("name", ""),
        "layer": verified.get("layer", ""),
        "timestamp": now.isoformat(),
        "lighthouse_axioms": list(LIGHTHOUSE_AXIOMS),
        "tools_whitelist": tools,
    }

    log_msg = f"[{now.isoformat()}] {verified.get('name', '?')} 启动完成，身份已对齐，进入工作状态。"
    logger.info(log_msg)

    return {
        "ready_signal": ready_signal,
        "boot_log": log_msg,
        "lighthouse_axioms": list(LIGHTHOUSE_AXIOMS),
        "tools_whitelist": tools,
    }


DEFAULT_HANDLERS: dict[str, Any] = {
    "read_instructions": _handle_read_instructions,
    "read_snapshot": _handle_read_snapshot,
    "align_identity": _handle_align_identity,
    "report_ready": _handle_report_ready,
}


async def wake(
    agent_code: str,
    *,
    boot_yaml_path: str | None = None,
    wake_seq_path: str | None = None,
    persona_map_path: str | None = None,
    extra_context: dict[str, Any] | None = None,
) -> "BootResult":
    """执行完整唤醒序列（wake_engine 主入口）。"""
    from pathlib import Path as _Path

    logger.info("=== 唤醒引擎启动: %s ===", agent_code)

    boot_raw = load_boot_yaml(_Path(boot_yaml_path) if boot_yaml_path else None)
    wake_raw = load_wake_sequence(_Path(wake_seq_path) if wake_seq_path else None)
    config = parse_boot_config(boot_raw, wake_raw)
    persona_map = load_persona_map(_Path(persona_map_path) if persona_map_path else None)

    initial_context: dict[str, Any] = {
        "agent_code": agent_code,
        "persona_map": persona_map,
        "boot_config": config,
    }
    if extra_context:
        initial_context.update(extra_context)

    result = await run_boot_sequence(config, DEFAULT_HANDLERS, initial_context)

    if result.success:
        logger.info("=== 唤醒完成: %s · 全部步骤通过 ===", agent_code)
    else:
        logger.error("=== 唤醒失败: %s · 中止于 %s ===", agent_code, result.aborted_at or "unknown")

    return result

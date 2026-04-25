"""persona_resolver.py — 人格体解析器

Phase-0-006 · YD-A05-20260425-004

职责:
  · 读取 persona-map.toml · 解析 Agent 编号→名称→指令页映射
  · 从 PersonaDB.personas 表读取身份信息
  · 验证人格体存在性 + 版本校验
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib  # type: ignore[no-redef]

import asyncpg  # type: ignore[import-untyped]

logger = logging.getLogger("boot_protocol.persona_resolver")

_BASE_DIR = Path(__file__).resolve().parent
_DEFAULT_PERSONA_MAP = _BASE_DIR / "persona-map.toml"


@dataclass(frozen=True)
class PersonaConfig:
    """persona-map.toml 中的单个人格体配置。"""
    code: str
    name: str
    name_en: str
    role: str
    layer: str
    duties: str
    instructions_url: str
    memory_url: str
    agent_short_id: str = ""
    branch_prefix: str = ""
    wake_rules: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class PersonaDBRecord:
    """PersonaDB.personas 表中的一条记录。"""
    id: str
    code: str
    name: str
    role: str | None
    base_color: str | None
    layer_zero: str | None
    version: int


@dataclass
class ResolvedPersona:
    """合并 toml 配置 + DB 记录后的完整人格体。"""
    code: str
    name: str
    name_en: str
    role: str
    layer: str
    duties: str
    instructions_url: str
    memory_url: str
    agent_short_id: str
    branch_prefix: str
    wake_rules: list[str]
    db_id: str | None = None
    base_color: str | None = None
    layer_zero: str | None = None
    version: int | None = None
    db_found: bool = False


def _get_dsn() -> str:
    """从环境变量构建 PostgreSQL DSN。"""
    dsn = os.environ.get("PERSONA_DB_DSN")
    if dsn:
        return dsn
    host = os.environ.get("PERSONA_DB_HOST", "localhost")
    port = os.environ.get("PERSONA_DB_PORT", "5432")
    name = os.environ.get("PERSONA_DB_NAME", "persona_db")
    user = os.environ.get("PERSONA_DB_USER", "postgres")
    password = os.environ.get("PERSONA_DB_PASSWORD", "")
    return f"postgresql://{user}:{password}@{host}:{port}/{name}"


def load_persona_map(path: Path | None = None) -> dict[str, PersonaConfig]:
    """读取 persona-map.toml，返回 {code: PersonaConfig} 映射。"""
    file_path = path or _DEFAULT_PERSONA_MAP
    logger.info("加载 persona-map.toml: %s", file_path)
    with open(file_path, "rb") as fh:
        raw = tomllib.load(fh)

    personas_raw: dict[str, dict[str, Any]] = raw.get("personas", {})
    result: dict[str, PersonaConfig] = {}
    for code, info in personas_raw.items():
        result[code] = PersonaConfig(
            code=code,
            name=info.get("name", ""),
            name_en=info.get("name_en", ""),
            role=info.get("role", ""),
            layer=info.get("layer", ""),
            duties=info.get("duties", ""),
            instructions_url=info.get("instructions_url", ""),
            memory_url=info.get("memory_url", ""),
            agent_short_id=info.get("agent_short_id", ""),
            branch_prefix=info.get("branch_prefix", ""),
            wake_rules=info.get("wake_rules", []),
        )
    logger.info("已加载 %d 个人格体配置", len(result))
    return result


async def _fetch_persona_from_db(conn: asyncpg.Connection, code: str) -> PersonaDBRecord | None:
    """从 PersonaDB.personas 表按 code 查询一条记录。"""
    row = await conn.fetchrow(
        "SELECT id, code, name, role, base_color, layer_zero, version "
        "FROM personas WHERE code = $1", code,
    )
    if row is None:
        return None
    return PersonaDBRecord(
        id=str(row["id"]), code=row["code"], name=row["name"],
        role=row["role"], base_color=row["base_color"],
        layer_zero=row["layer_zero"], version=row["version"],
    )


async def resolve_persona(
    code: str,
    persona_map: dict[str, PersonaConfig] | None = None,
    conn: asyncpg.Connection | None = None,
) -> ResolvedPersona:
    """解析指定人格体：先查 toml 配置，再查 PersonaDB。"""
    if persona_map is None:
        persona_map = load_persona_map()

    cfg = persona_map.get(code)
    if cfg is None:
        raise KeyError(f"人格体 {code!r} 不在 persona-map.toml 中")

    resolved = ResolvedPersona(
        code=cfg.code, name=cfg.name, name_en=cfg.name_en,
        role=cfg.role, layer=cfg.layer, duties=cfg.duties,
        instructions_url=cfg.instructions_url, memory_url=cfg.memory_url,
        agent_short_id=cfg.agent_short_id, branch_prefix=cfg.branch_prefix,
        wake_rules=list(cfg.wake_rules),
    )

    close_conn = False
    try:
        if conn is None:
            conn = await asyncpg.connect(_get_dsn())
            close_conn = True
        db_record = await _fetch_persona_from_db(conn, code)
        if db_record is not None:
            resolved.db_found = True
            resolved.db_id = db_record.id
            resolved.base_color = db_record.base_color
            resolved.layer_zero = db_record.layer_zero
            resolved.version = db_record.version
            logger.info("PersonaDB 匹配成功: %s (v%d)", code, db_record.version)
        else:
            logger.warning("PersonaDB 未找到: %s（仅使用 toml 配置）", code)
    except Exception as exc:
        logger.warning("PersonaDB 连接/查询异常: %s · 仅使用 toml 配置", exc)
    finally:
        if close_conn and conn is not None:
            await conn.close()

    return resolved


async def resolve_all_personas(
    persona_map: dict[str, PersonaConfig] | None = None,
) -> dict[str, ResolvedPersona]:
    """解析 persona-map.toml 中所有人格体。"""
    if persona_map is None:
        persona_map = load_persona_map()

    results: dict[str, ResolvedPersona] = {}
    conn: asyncpg.Connection | None = None
    try:
        conn = await asyncpg.connect(_get_dsn())
    except Exception as exc:
        logger.warning("PersonaDB 连接失败: %s", exc)

    try:
        for code in persona_map:
            results[code] = await resolve_persona(code, persona_map=persona_map, conn=conn)
    finally:
        if conn is not None:
            await conn.close()
    return results


def validate_persona(
    resolved: ResolvedPersona,
    *,
    require_db: bool = False,
    expected_layer: str | None = None,
) -> list[str]:
    """校验已解析人格体的完整性。返回错误列表（空=通过）。"""
    errors: list[str] = []
    if not resolved.code:
        errors.append("缺少 code")
    if not resolved.name:
        errors.append("缺少 name")
    if require_db and not resolved.db_found:
        errors.append(f"PersonaDB 中未找到 {resolved.code!r}")
    if expected_layer and resolved.layer != expected_layer:
        errors.append(f"层级不匹配: 期望 {expected_layer!r}, 实际 {resolved.layer!r}")
    return errors

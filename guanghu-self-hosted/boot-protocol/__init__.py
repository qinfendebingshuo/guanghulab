"""boot_protocol — 光湖纪元体系 AGE OS 标准化启动协议

Phase-0-006 · YD-A05-20260425-004

公开接口:
    boot(agent_code) -> BootResult

用法::
    import asyncio
    from boot_protocol import boot

    result = asyncio.run(boot("AG-SY-01"))
    print(result.success)
    print(result.context.get("lighthouse_axioms"))
"""

from __future__ import annotations

from .boot_loader import (
    BootConfig,
    BootResult,
    StepConfig,
    StepResult,
    load_boot_yaml,
    load_wake_sequence,
    parse_boot_config,
    run_boot_sequence,
)
from .persona_resolver import (
    PersonaConfig,
    PersonaDBRecord,
    ResolvedPersona,
    load_persona_map,
    resolve_all_personas,
    resolve_persona,
    validate_persona,
)
from .wake_engine import (
    DEFAULT_HANDLERS,
    LIGHTHOUSE_AXIOMS,
    PersonaCognition,
    load_cognition_from_db,
    load_tools_whitelist,
    update_runtime_state,
    wake,
)

__version__ = "1.0.0"
__all__ = [
    "BootConfig", "BootResult", "StepConfig", "StepResult",
    "load_boot_yaml", "load_wake_sequence", "parse_boot_config", "run_boot_sequence",
    "PersonaConfig", "PersonaDBRecord", "ResolvedPersona",
    "load_persona_map", "resolve_all_personas", "resolve_persona", "validate_persona",
    "DEFAULT_HANDLERS", "LIGHTHOUSE_AXIOMS", "PersonaCognition",
    "load_cognition_from_db", "load_tools_whitelist", "update_runtime_state",
    "wake", "boot",
]


async def boot(
    agent_code: str,
    **kwargs,
) -> BootResult:
    """一键唤醒指定人格体（公开接口）。

    Args:
        agent_code: 人格体编号（如 AG-SY-01 / 5TH-LE-HK-A05）。
        **kwargs: 传递给 wake() 的额外参数。

    Returns:
        BootResult 实例。
    """
    return await wake(agent_code, **kwargs)

"""boot_loader.py — 启动加载器

Phase-0-006 · YD-A05-20260425-004

职责:
  · 读取 boot.yaml 配置
  · 解析 wake-sequence.json 唤醒序列
  · 按 step 顺序执行启动流程
  · 超时处理 + fallback 机制
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger("boot_protocol.boot_loader")

_BASE_DIR = Path(__file__).resolve().parent
_DEFAULT_BOOT_YAML = _BASE_DIR / "boot.yaml"
_DEFAULT_WAKE_SEQ = _BASE_DIR / "wake-sequence.json"


@dataclass(frozen=True)
class FallbackStrategy:
    """fallback 策略定义。"""
    name: str
    description: str
    action: str


@dataclass(frozen=True)
class StepConfig:
    """单个启动步骤的配置。"""
    order: int
    id: str
    name: str
    description: str
    required: bool
    timeout_ms: int
    retry_max: int
    retry_delay_ms: int
    fallback: str
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def timeout_seconds(self) -> float:
        return self.timeout_ms / 1000.0

    @property
    def retry_delay_seconds(self) -> float:
        return self.retry_delay_ms / 1000.0


@dataclass
class BootConfig:
    """boot.yaml + wake-sequence.json 合并后的启动配置。"""
    version: str
    protocol: str
    description: str
    global_timeout_seconds: int
    global_retry_max: int
    global_retry_delay_seconds: int
    log_level: str
    layers: list[dict[str, Any]]
    steps: list[StepConfig]
    fallback_strategies: dict[str, FallbackStrategy]
    model_backends: dict[str, Any]
    boot_sequence_raw: list[dict[str, Any]]


@dataclass
class StepResult:
    """单步执行结果。"""
    step_id: str
    step_name: str
    success: bool
    data: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    retries_used: int = 0
    skipped: bool = False


@dataclass
class BootResult:
    """完整启动序列的执行结果。"""
    success: bool
    step_results: list[StepResult] = field(default_factory=list)
    aborted_at: str | None = None
    context: dict[str, Any] = field(default_factory=dict)


def load_boot_yaml(path: Path | None = None) -> dict[str, Any]:
    """读取并解析 boot.yaml。"""
    file_path = path or _DEFAULT_BOOT_YAML
    logger.info("加载 boot.yaml: %s", file_path)
    with open(file_path, "r", encoding="utf-8") as fh:
        data: dict[str, Any] = yaml.safe_load(fh)
    if not isinstance(data, dict):
        raise ValueError(f"boot.yaml 顶层必须是映射，实际为 {type(data).__name__}")
    return data


def load_wake_sequence(path: Path | None = None) -> dict[str, Any]:
    """读取并解析 wake-sequence.json。"""
    file_path = path or _DEFAULT_WAKE_SEQ
    logger.info("加载 wake-sequence.json: %s", file_path)
    with open(file_path, "r", encoding="utf-8") as fh:
        data: dict[str, Any] = json.load(fh)
    return data


def parse_boot_config(
    boot_raw: dict[str, Any],
    wake_raw: dict[str, Any],
) -> BootConfig:
    """将 boot.yaml 和 wake-sequence.json 合并为 BootConfig。"""
    global_cfg = boot_raw.get("global", {})
    defaults = wake_raw.get("defaults", {})

    steps: list[StepConfig] = []
    for raw_step in wake_raw.get("steps", []):
        steps.append(StepConfig(
            order=raw_step["order"],
            id=raw_step["id"],
            name=raw_step["name"],
            description=raw_step.get("description", ""),
            required=raw_step.get("required", True),
            timeout_ms=raw_step.get("timeout_ms", defaults.get("timeout_ms", 30000)),
            retry_max=raw_step.get("retry_max", defaults.get("retry_max", 2)),
            retry_delay_ms=raw_step.get("retry_delay_ms", defaults.get("retry_delay_ms", 5000)),
            fallback=raw_step.get("fallback", defaults.get("fallback", "skip_and_warn")),
            raw=raw_step,
        ))
    steps.sort(key=lambda s: s.order)

    fb_strategies: dict[str, FallbackStrategy] = {}
    for name, info in wake_raw.get("fallback_strategies", {}).items():
        fb_strategies[name] = FallbackStrategy(
            name=name,
            description=info.get("description", ""),
            action=info.get("action", ""),
        )

    return BootConfig(
        version=boot_raw.get("version", wake_raw.get("version", "1.0.0")),
        protocol=boot_raw.get("protocol", "boot-protocol"),
        description=boot_raw.get("description", ""),
        global_timeout_seconds=global_cfg.get("timeout_seconds", 30),
        global_retry_max=global_cfg.get("retry_max", 2),
        global_retry_delay_seconds=global_cfg.get("retry_delay_seconds", 5),
        log_level=global_cfg.get("log_level", "info"),
        layers=boot_raw.get("layers", []),
        steps=steps,
        fallback_strategies=fb_strategies,
        model_backends=wake_raw.get("model_backends", {}),
        boot_sequence_raw=boot_raw.get("boot_sequence", []),
    )


async def execute_step(
    step: StepConfig,
    handler: Any,
    context: dict[str, Any],
) -> StepResult:
    """执行单个启动步骤（含重试与超时）。"""
    last_error: str | None = None
    retries_used = 0

    for attempt in range(step.retry_max + 1):
        try:
            result_data = await asyncio.wait_for(
                handler(step, context),
                timeout=step.timeout_seconds,
            )
            logger.info("[step %d] %s 执行成功 (attempt %d)", step.order, step.name, attempt + 1)
            return StepResult(
                step_id=step.id, step_name=step.name, success=True,
                data=result_data or {}, retries_used=attempt,
            )
        except asyncio.TimeoutError:
            last_error = f"超时 ({step.timeout_seconds}s)"
            logger.warning("[step %d] %s 超时 (attempt %d/%d)", step.order, step.name, attempt + 1, step.retry_max + 1)
        except Exception as exc:
            last_error = str(exc)
            logger.warning("[step %d] %s 异常 (attempt %d/%d): %s", step.order, step.name, attempt + 1, step.retry_max + 1, exc)
        retries_used = attempt + 1
        if attempt < step.retry_max:
            await asyncio.sleep(step.retry_delay_seconds)

    return StepResult(
        step_id=step.id, step_name=step.name, success=False,
        error=last_error, retries_used=retries_used,
    )


async def run_boot_sequence(
    config: BootConfig,
    handlers: dict[str, Any],
    initial_context: dict[str, Any] | None = None,
) -> BootResult:
    """按顺序执行整个启动序列。"""
    context: dict[str, Any] = initial_context.copy() if initial_context else {}
    results: list[StepResult] = []

    for step in config.steps:
        handler = handlers.get(step.id)
        if handler is None:
            logger.warning("[step %d] %s 无 handler，跳过", step.order, step.name)
            results.append(StepResult(
                step_id=step.id, step_name=step.name, success=False,
                error="no handler registered", skipped=True,
            ))
            if step.fallback == "abort":
                return BootResult(success=False, step_results=results, aborted_at=step.id, context=context)
            continue

        result = await execute_step(step, handler, context)
        results.append(result)

        if result.success:
            context.update(result.data)
        else:
            strategy = step.fallback
            logger.error("[step %d] %s 失败 · fallback=%s · error=%s", step.order, step.name, strategy, result.error)
            if strategy in ("abort", "retry_then_abort"):
                return BootResult(success=False, step_results=results, aborted_at=step.id, context=context)

    all_required_ok = all(
        r.success for r in results
        if not r.skipped and any(s.id == r.step_id and s.required for s in config.steps)
    )
    return BootResult(success=all_required_ok, step_results=results, context=context)

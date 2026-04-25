"""GH-SCHED-001 · Agent Scheduler Configuration
Pydantic-based configuration with environment variable support.
Part of HLDP-ARCH-001 L5 · Agent Dev Hub.
"""

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class DatabaseConfig:
    """PostgreSQL connection configuration."""
    host: str = os.getenv("PG_HOST", "127.0.0.1")
    port: int = int(os.getenv("PG_PORT", "5432"))
    user: str = os.getenv("PG_USER", "guanghu")
    password: str = os.getenv("PG_PASSWORD", "")
    database: str = os.getenv("PG_DATABASE", "guanghu_dev")

    @property
    def dsn(self) -> str:
        return (
            "postgresql://"
            + self.user
            + ":" + self.password
            + "@" + self.host
            + ":" + str(self.port)
            + "/" + self.database
        )


@dataclass
class LLMConfig:
    """LLM API configuration. Supports OpenAI-compatible endpoints."""
    api_key: str = os.getenv("LLM_API_KEY", "")
    base_url: str = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
    model: str = os.getenv("LLM_MODEL", "gpt-4o")
    max_retries: int = int(os.getenv("LLM_MAX_RETRIES", "3"))
    timeout_seconds: int = int(os.getenv("LLM_TIMEOUT", "120"))
    # Dual-model stub: Phase 2 will add routing between expression/reasoning
    expression_model: str = os.getenv("LLM_EXPRESSION_MODEL", "")  # Kimi K2.5
    reasoning_model: str = os.getenv("LLM_REASONING_MODEL", "")    # DeepSeek-R1


@dataclass
class GitConfig:
    """Git/GitHub configuration."""
    token: str = os.getenv("GITHUB_TOKEN", "")
    repo_url: str = os.getenv("REPO_URL", "https://github.com/qinfendebingshuo/guanghulab.git")
    clone_dir: str = os.getenv("GIT_CLONE_DIR", "/tmp/guanghu-scheduler-workspace")
    commit_author_name: str = os.getenv("GIT_AUTHOR_NAME", "Agent-Scheduler")
    commit_author_email: str = os.getenv("GIT_AUTHOR_EMAIL", "agent@guanghu.dev")


@dataclass
class SchedulerConfig:
    """Main scheduler configuration."""
    agent_id: str = os.getenv("AGENT_ID", "scheduler-001")
    poll_interval_seconds: int = int(os.getenv("POLL_INTERVAL", "30"))
    work_order_timeout_seconds: int = int(os.getenv("WORK_ORDER_TIMEOUT", "1800"))  # 30 min
    max_concurrent_orders: int = int(os.getenv("MAX_CONCURRENT_ORDERS", "1"))
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    # Boot Protocol path
    boot_protocol_path: str = os.getenv(
        "BOOT_PROTOCOL_PATH",
        os.path.join(os.path.dirname(__file__), "..", "boot-protocol")
    )
    # Tool Receipt module path
    tool_receipt_path: str = os.getenv(
        "TOOL_RECEIPT_PATH",
        os.path.join(os.path.dirname(__file__), "..", "tool-receipt")
    )


@dataclass
class AppConfig:
    """Top-level application configuration."""
    db: DatabaseConfig = field(default_factory=DatabaseConfig)
    llm: LLMConfig = field(default_factory=LLMConfig)
    git: GitConfig = field(default_factory=GitConfig)
    scheduler: SchedulerConfig = field(default_factory=SchedulerConfig)


def load_config() -> AppConfig:
    """Load configuration from environment variables."""
    return AppConfig()

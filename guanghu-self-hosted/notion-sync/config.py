"""Configuration for Notion Sync Service
PY-A04-20260425-001 · Notion→本地 同步器 MVP
"""
import json
from pathlib import Path

from pydantic import BaseModel, Field


class SyncConfig(BaseModel):
    """Notion Sync configuration."""

    notion_api_token: str = Field(
        default="YOUR_NOTION_API_TOKEN",
        description="Notion Integration Token",
    )
    target_page_ids: list[str] = Field(
        default_factory=list,
        description="Notion page IDs to sync",
    )
    export_dir: str = Field(
        default="./output",
        description="JSONL export directory",
    )
    last_sync_time: str | None = Field(
        default=None,
        description="ISO-8601 timestamp of last successful sync",
    )
    sync_state_file: str = Field(
        default="./.sync_state.json",
        description="Path to persistent sync-state file",
    )
    webhook_secret: str = Field(
        default="",
        description="Webhook verification secret (optional)",
    )
    port: int = Field(
        default=8400,
        description="FastAPI service port",
    )

    # ---- state helpers ----

    def save_sync_state(self, sync_time: str) -> None:
        """Persist *last_sync_time* to disk."""
        state = {"last_sync_time": sync_time}
        Path(self.sync_state_file).write_text(
            json.dumps(state, ensure_ascii=False), encoding="utf-8"
        )

    def load_sync_state(self) -> str | None:
        """Return the last recorded sync time, or *None*."""
        path = Path(self.sync_state_file)
        if path.exists():
            state = json.loads(path.read_text(encoding="utf-8"))
            return state.get("last_sync_time")
        return self.last_sync_time


def get_config() -> SyncConfig:
    """Factory – override via env vars or a config file later."""
    return SyncConfig()

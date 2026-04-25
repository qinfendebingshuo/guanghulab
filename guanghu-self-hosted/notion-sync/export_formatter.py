"""Export Formatter - Notion page to JSONL training corpus
PY-A04-20260425-001

Output schema per line:
  {"role": str, "content": str, "timestamp": str, "source_url": str}
"""
import json
from pathlib import Path

from pydantic import BaseModel, Field


class CorpusEntry(BaseModel):
    """Single JSONL record."""

    role: str = Field(description="Role: system / user / assistant / page")
    content: str = Field(description="Text content")
    timestamp: str = Field(description="ISO-8601 timestamp")
    source_url: str = Field(description="Notion page URL")


def _default_source_url(page_id: str) -> str:
    """Build a Notion URL from a page ID (hyphens stripped)."""
    return "https://www.notion.so/" + page_id.replace("-", "")


class ExportFormatter:
    """Stateless helpers that turn Notion data into CorpusEntry lists."""

    # ---- page formatting ----

    @staticmethod
    def format_page(
        page_id: str,
        title: str,
        content: str,
        last_edited: str,
        url: str | None = None,
    ) -> list[CorpusEntry]:
        source_url = url or _default_source_url(page_id)
        entries: list[CorpusEntry] = []

        # Title as metadata entry
        entries.append(
            CorpusEntry(
                role="system",
                content="[PAGE_TITLE] " + title,
                timestamp=last_edited,
                source_url=source_url,
            )
        )

        # Body - split long content into chunks
        blocks = ExportFormatter._split_content(content)
        for block in blocks:
            stripped = block.strip()
            if stripped:
                entries.append(
                    CorpusEntry(
                        role="page",
                        content=stripped,
                        timestamp=last_edited,
                        source_url=source_url,
                    )
                )

        return entries

    # ---- conversation formatting ----

    @staticmethod
    def format_conversation(
        messages: list[dict],
        page_id: str,
        last_edited: str,
        url: str | None = None,
    ) -> list[CorpusEntry]:
        source_url = url or _default_source_url(page_id)
        entries: list[CorpusEntry] = []

        for msg in messages:
            role = msg.get("role", "user")
            text = msg.get("content", "")
            ts = msg.get("timestamp", last_edited)
            stripped = text.strip()
            if stripped:
                entries.append(
                    CorpusEntry(
                        role=role,
                        content=stripped,
                        timestamp=ts,
                        source_url=source_url,
                    )
                )

        return entries

    # ---- content splitting ----

    @staticmethod
    def _split_content(content: str, max_chars: int = 4000) -> list[str]:
        """Split content on paragraph boundaries so each chunk <= max_chars."""
        if len(content) <= max_chars:
            return [content]

        blocks: list[str] = []
        paragraphs = content.split("\n\n")
        current = ""

        for para in paragraphs:
            if len(current) + len(para) + 2 > max_chars and current:
                blocks.append(current)
                current = para
            else:
                current = (current + "\n\n" + para) if current else para

        if current:
            blocks.append(current)

        return blocks

    # ---- JSONL serialisation ----

    @staticmethod
    def entries_to_jsonl(entries: list[CorpusEntry]) -> str:
        """Return a JSONL string (no trailing newline)."""
        return "\n".join(
            json.dumps(e.model_dump(), ensure_ascii=False) for e in entries
        )

    @staticmethod
    def write_jsonl(entries: list[CorpusEntry], output_path: str) -> int:
        """Overwrite output_path with JSONL. Returns entry count."""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            ExportFormatter.entries_to_jsonl(entries) + "\n", encoding="utf-8"
        )
        return len(entries)

    @staticmethod
    def append_jsonl(entries: list[CorpusEntry], output_path: str) -> int:
        """Append to output_path. Returns entry count."""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "a", encoding="utf-8") as fh:
            for entry in entries:
                fh.write(json.dumps(entry.model_dump(), ensure_ascii=False) + "\n")
        return len(entries)

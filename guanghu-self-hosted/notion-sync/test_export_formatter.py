"""Tests for ExportFormatter
PY-A04-20260425-001

Run:  python test_export_formatter.py
"""
import json
import tempfile
from pathlib import Path

from export_formatter import CorpusEntry, ExportFormatter


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_jsonl_line(line: str) -> dict:
    """Parse one JSONL line and assert required fields."""
    data = json.loads(line)
    assert "role" in data, "Missing 'role'"
    assert "content" in data, "Missing 'content'"
    assert "timestamp" in data, "Missing 'timestamp'"
    assert "source_url" in data, "Missing 'source_url'"
    return data


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_format_page_basic():
    entries = ExportFormatter.format_page(
        page_id="abc123",
        title="Test Page",
        content="Hello world\n\nSecond paragraph",
        last_edited="2026-04-25T03:00:00.000Z",
    )
    assert len(entries) >= 2
    assert entries[0].role == "system"
    assert "Test Page" in entries[0].content
    assert entries[1].role == "page"
    assert entries[1].timestamp == "2026-04-25T03:00:00.000Z"
    print("\u2705 test_format_page_basic passed")


def test_format_page_empty_content():
    entries = ExportFormatter.format_page(
        page_id="empty123",
        title="Empty Page",
        content="",
        last_edited="2026-04-25T03:00:00.000Z",
    )
    assert len(entries) >= 1
    assert entries[0].role == "system"
    print("\u2705 test_format_page_empty_content passed")


def test_format_conversation():
    messages = [
        {"role": "user", "content": "你好", "timestamp": "2026-04-25T03:00:00.000Z"},
        {"role": "assistant", "content": "你好！", "timestamp": "2026-04-25T03:01:00.000Z"},
    ]
    entries = ExportFormatter.format_conversation(
        messages=messages,
        page_id="conv123",
        last_edited="2026-04-25T03:01:00.000Z",
    )
    assert len(entries) == 2
    assert entries[0].role == "user"
    assert entries[1].role == "assistant"
    print("\u2705 test_format_conversation passed")


def test_entries_to_jsonl():
    entries = [
        CorpusEntry(
            role="page",
            content="test content",
            timestamp="2026-04-25T03:00:00.000Z",
            source_url="https://notion.so/abc",
        ),
    ]
    jsonl = ExportFormatter.entries_to_jsonl(entries)
    lines = jsonl.strip().split("\n")
    assert len(lines) == 1
    data = _validate_jsonl_line(lines[0])
    assert data["role"] == "page"
    assert data["content"] == "test content"
    print("\u2705 test_entries_to_jsonl passed")


def test_write_jsonl():
    entries = [
        CorpusEntry(
            role="system",
            content="[PAGE_TITLE] Test",
            timestamp="2026-04-25T00:00:00Z",
            source_url="https://notion.so/a",
        ),
        CorpusEntry(
            role="page",
            content="Body text here",
            timestamp="2026-04-25T00:00:00Z",
            source_url="https://notion.so/a",
        ),
    ]
    with tempfile.TemporaryDirectory() as tmpdir:
        out_path = str(Path(tmpdir) / "test_output.jsonl")
        count = ExportFormatter.write_jsonl(entries, out_path)
        assert count == 2

        content = Path(out_path).read_text(encoding="utf-8")
        lines = [line for line in content.strip().split("\n") if line.strip()]
        assert len(lines) == 2
        for line in lines:
            _validate_jsonl_line(line)

    print("\u2705 test_write_jsonl passed")


def test_append_jsonl():
    entry1 = [
        CorpusEntry(
            role="page",
            content="First",
            timestamp="2026-04-25T00:00:00Z",
            source_url="https://notion.so/a",
        )
    ]
    entry2 = [
        CorpusEntry(
            role="page",
            content="Second",
            timestamp="2026-04-25T01:00:00Z",
            source_url="https://notion.so/b",
        )
    ]
    with tempfile.TemporaryDirectory() as tmpdir:
        out_path = str(Path(tmpdir) / "append_test.jsonl")
        ExportFormatter.append_jsonl(entry1, out_path)
        ExportFormatter.append_jsonl(entry2, out_path)

        content = Path(out_path).read_text(encoding="utf-8")
        lines = [line for line in content.strip().split("\n") if line.strip()]
        assert len(lines) == 2
        d1 = json.loads(lines[0])
        d2 = json.loads(lines[1])
        assert d1["content"] == "First"
        assert d2["content"] == "Second"

    print("\u2705 test_append_jsonl passed")


def test_split_content_large():
    large = ("This is a test paragraph. " * 50 + "\n\n") * 10
    blocks = ExportFormatter._split_content(large, max_chars=4000)
    assert len(blocks) > 1
    for block in blocks:
        assert len(block) <= 4200  # slight overshoot from paragraph boundary
    print("\u2705 test_split_content_large passed")


def test_source_url_generation():
    entries = ExportFormatter.format_page(
        page_id="abcd-1234-efgh",
        title="URL Test",
        content="Content",
        last_edited="2026-04-25T00:00:00Z",
    )
    assert "abcd1234efgh" in entries[0].source_url
    print("\u2705 test_source_url_generation passed")


def test_source_url_custom():
    entries = ExportFormatter.format_page(
        page_id="abc",
        title="Custom URL",
        content="Content",
        last_edited="2026-04-25T00:00:00Z",
        url="https://custom.notion.site/my-page",
    )
    assert entries[0].source_url == "https://custom.notion.site/my-page"
    print("\u2705 test_source_url_custom passed")


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    test_format_page_basic()
    test_format_page_empty_content()
    test_format_conversation()
    test_entries_to_jsonl()
    test_write_jsonl()
    test_append_jsonl()
    test_split_content_large()
    test_source_url_generation()
    test_source_url_custom()
    print("\n\U0001f389 All tests passed!")

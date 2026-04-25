"""Notion Sync Service · FastAPI
PY-A04-20260425-001 · Notion→本地 同步器 MVP

Routes:
    POST /webhook  – Notion webhook receiver
    POST /sync     – Manual trigger: pull pages → export JSONL
    GET  /health   – Health check
    GET  /status   – Sync status

Architecture reference: message-router.js (classify → route → handle pattern)
"""
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

from config import SyncConfig, get_config
from export_formatter import CorpusEntry, ExportFormatter

app = FastAPI(
    title="Notion Sync Service",
    version="0.1.0",
    description="PY-A04 · Notion→本地同步器 MVP",
)

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class SyncRequest(BaseModel):
    page_ids: list[str] | None = Field(default=None, description="Override target pages")
    force: bool = Field(default=False, description="Ignore last_sync_time, full sync")


class SyncResult(BaseModel):
    synced_pages: int = 0
    total_entries: int = 0
    export_path: str = ""
    sync_time: str = ""
    errors: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Notion API helpers
# ---------------------------------------------------------------------------

NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


def _notion_headers(config: SyncConfig) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {config.notion_api_token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }


async def fetch_page(
    client: httpx.AsyncClient, page_id: str, config: SyncConfig
) -> dict | None:
    """GET /pages/{page_id}."""
    headers = _notion_headers(config)
    try:
        resp = await client.get(f"{NOTION_API_BASE}/pages/{page_id}", headers=headers)
        if resp.status_code == 200:
            return resp.json()
        print(f"[sync] fetch_page {page_id} failed: {resp.status_code}")
        return None
    except httpx.HTTPError as exc:
        print(f"[sync] fetch_page {page_id} error: {exc}")
        return None


async def fetch_blocks(
    client: httpx.AsyncClient, block_id: str, config: SyncConfig
) -> list[dict]:
    """Paginate GET /blocks/{block_id}/children."""
    headers = _notion_headers(config)
    blocks: list[dict] = []
    cursor: str | None = None

    while True:
        params: dict[str, str] = {}
        if cursor:
            params["start_cursor"] = cursor
        try:
            resp = await client.get(
                f"{NOTION_API_BASE}/blocks/{block_id}/children",
                headers=headers,
                params=params,
            )
            if resp.status_code != 200:
                print(f"[sync] fetch_blocks {block_id} failed: {resp.status_code}")
                break
            data = resp.json()
            blocks.extend(data.get("results", []))
            if not data.get("has_more", False):
                break
            cursor = data.get("next_cursor")
        except httpx.HTTPError as exc:
            print(f"[sync] fetch_blocks {block_id} error: {exc}")
            break

    return blocks


def extract_text_from_blocks(blocks: list[dict]) -> str:
    """Flatten Notion blocks into plain text."""
    lines: list[str] = []
    for block in blocks:
        btype = block.get("type", "")
        block_data = block.get(btype, {})

        rich_texts = block_data.get("rich_text", [])
        if rich_texts:
            text = "".join(rt.get("plain_text", "") for rt in rich_texts)
            if text.strip():
                lines.append(text)

        if btype == "child_page":
            title = block_data.get("title", "")
            if title:
                lines.append(f"[子页面] {title}")
        elif btype == "child_database":
            title = block_data.get("title", "")
            if title:
                lines.append(f"[子数据库] {title}")

    return "\n".join(lines)


def extract_title(page: dict) -> str:
    """Pull the title property from a page object."""
    props = page.get("properties", {})
    for prop in props.values():
        if prop.get("type") == "title":
            title_arr = prop.get("title", [])
            return "".join(t.get("plain_text", "") for t in title_arr)
    return "Untitled"


# ---------------------------------------------------------------------------
# Core sync logic
# ---------------------------------------------------------------------------


async def sync_pages(
    config: SyncConfig,
    page_ids: list[str] | None = None,
    force: bool = False,
) -> SyncResult:
    """Fetch pages from Notion, convert to JSONL, write to disk."""
    now = datetime.now(timezone.utc).isoformat()
    last_sync = None if force else config.load_sync_state()
    target_ids = page_ids or config.target_page_ids

    result = SyncResult(sync_time=now)
    all_entries: list[CorpusEntry] = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        for pid in target_ids:
            page = await fetch_page(client, pid, config)
            if page is None:
                result.errors.append(f"fetch_page failed: {pid}")
                continue

            # Incremental sync – skip pages not edited since last sync
            page_edited = page.get("last_edited_time", "")
            if last_sync and page_edited and page_edited <= last_sync:
                continue

            title = extract_title(page)
            url = page.get("url", "")
            blocks = await fetch_blocks(client, pid, config)
            content = extract_text_from_blocks(blocks)

            entries = ExportFormatter.format_page(
                page_id=pid,
                title=title,
                content=content,
                last_edited=page_edited or now,
                url=url,
            )
            all_entries.extend(entries)
            result.synced_pages += 1

    if all_entries:
        export_file = str(
            Path(config.export_dir) / f"notion_sync_{now[:10]}.jsonl"
        )
        count = ExportFormatter.append_jsonl(all_entries, export_file)
        result.total_entries = count
        result.export_path = export_file

    # Persist sync timestamp
    config.save_sync_state(now)
    return result


# ---------------------------------------------------------------------------
# FastAPI routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    return {"status": "ok", "service": "notion-sync", "version": "0.1.0", "agent": "PY-A04"}


@app.get("/status")
async def status():
    config = get_config()
    last_sync = config.load_sync_state()
    return {
        "last_sync_time": last_sync,
        "target_pages": len(config.target_page_ids),
        "export_dir": config.export_dir,
    }


@app.post("/sync", response_model=SyncResult)
async def manual_sync(req: SyncRequest | None = None):
    config = get_config()
    page_ids = req.page_ids if req else None
    force = req.force if req else False
    return await sync_pages(config, page_ids=page_ids, force=force)


@app.post("/webhook")
async def webhook_receiver(request: Request):
    config = get_config()
    body = await request.json()

    # Notion verification challenge
    if "challenge" in body:
        return {"challenge": body["challenge"]}

    # Extract page ID from webhook payload
    page_id = body.get("data", {}).get("id") or body.get("entity", {}).get("id")
    if not page_id:
        raise HTTPException(status_code=400, detail="No page ID in webhook payload")

    result = await sync_pages(config, page_ids=[page_id], force=True)
    return {"status": "processed", "result": result.model_dump()}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    cfg = get_config()
    uvicorn.run("sync_notion:app", host="0.0.0.0", port=cfg.port, reload=True)

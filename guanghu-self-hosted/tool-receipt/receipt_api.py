"""Receipt API - FastAPI routes for Tool Receipt System
PY-A04-20260425-002

Endpoints:
  POST   /receipts                      -> create receipt
  PATCH  /receipts/{receipt_id}          -> update result
  GET    /receipts/{receipt_id}          -> query single receipt
  GET    /sessions/{session_id}/receipts -> query session receipts
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from config import settings
from receipt_manager import (
    PgReceiptManager,
    Receipt,
    ReceiptStatus,
    SqliteReceiptManager,
)
from receipt_formatter import ReceiptFormatter


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class CreateReceiptRequest(BaseModel):
    """Body for POST /receipts."""

    tool_name: str = Field(description="Name of the tool being called")
    input_params: dict[str, Any] = Field(
        default_factory=dict, description="Tool input parameters"
    )
    session_id: str = Field(default="", description="Session / conversation ID")
    persona_id: str = Field(default="", description="Persona making the call")


class UpdateReceiptRequest(BaseModel):
    """Body for PATCH /receipts/{id}."""

    output: dict[str, Any] | None = Field(
        default=None, description="Tool output payload"
    )
    status: ReceiptStatus = Field(description="Final status of the tool call")
    duration_ms: int | None = Field(
        default=None, description="Execution duration in ms"
    )


class ReceiptResponse(BaseModel):
    """Unified receipt response with optional formatted views."""

    receipt: Receipt
    formatted_text: str = Field(
        default="", description="Human-readable text"
    )
    formatted_hldp: str = Field(
        default="", description="HLDP tree structure"
    )


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

_manager: PgReceiptManager | SqliteReceiptManager | None = None
_formatter = ReceiptFormatter()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hook."""
    global _manager
    if settings.use_sqlite:
        mgr = SqliteReceiptManager()
        mgr.connect()
        _manager = mgr
    else:
        mgr = PgReceiptManager()
        await mgr.connect()
        _manager = mgr
    yield
    if isinstance(_manager, PgReceiptManager):
        await _manager.close()
    elif isinstance(_manager, SqliteReceiptManager):
        _manager.close()


app = FastAPI(
    title="Tool Receipt System",
    description="HLDP-ARCH-001 L2 · Tool call tracing & receipt management",
    version="0.1.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _build_response(receipt: Receipt) -> ReceiptResponse:
    """Wrap a Receipt with formatted outputs."""
    return ReceiptResponse(
        receipt=receipt,
        formatted_text=_formatter.to_text(receipt),
        formatted_hldp=_formatter.to_hldp(receipt),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post("/receipts", response_model=ReceiptResponse, status_code=201)
async def create_receipt(body: CreateReceiptRequest):
    """Create a new pending receipt for a tool call."""
    if isinstance(_manager, PgReceiptManager):
        rid = await _manager.record_call(
            tool_name=body.tool_name,
            input_params=body.input_params,
            session_id=body.session_id,
            persona_id=body.persona_id,
        )
        receipt = await _manager.get_receipt(rid)
    else:
        rid = _manager.record_call(
            tool_name=body.tool_name,
            input_params=body.input_params,
            session_id=body.session_id,
            persona_id=body.persona_id,
        )
        receipt = _manager.get_receipt(rid)

    if receipt is None:
        raise HTTPException(status_code=500, detail="Failed to create receipt")
    return _build_response(receipt)


@app.patch("/receipts/{receipt_id}", response_model=ReceiptResponse)
async def update_receipt(receipt_id: str, body: UpdateReceiptRequest):
    """Update a receipt with tool output and final status."""
    if isinstance(_manager, PgReceiptManager):
        receipt = await _manager.update_result(
            receipt_id=receipt_id,
            output=body.output,
            status=body.status,
            duration_ms=body.duration_ms,
        )
    else:
        receipt = _manager.update_result(
            receipt_id=receipt_id,
            output=body.output,
            status=body.status,
            duration_ms=body.duration_ms,
        )

    if receipt is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return _build_response(receipt)


@app.get("/receipts/{receipt_id}", response_model=ReceiptResponse)
async def get_receipt(receipt_id: str):
    """Retrieve a single receipt by ID."""
    if isinstance(_manager, PgReceiptManager):
        receipt = await _manager.get_receipt(receipt_id)
    else:
        receipt = _manager.get_receipt(receipt_id)

    if receipt is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return _build_response(receipt)


@app.get("/sessions/{session_id}/receipts")
async def get_session_receipts(session_id: str):
    """Retrieve all receipts for a given session."""
    if isinstance(_manager, PgReceiptManager):
        receipts = await _manager.get_session_receipts(session_id)
    else:
        receipts = _manager.get_session_receipts(session_id)

    return {
        "session_id": session_id,
        "count": len(receipts),
        "receipts": [_build_response(r).model_dump() for r in receipts],
    }


# ---------------------------------------------------------------------------
# Standalone runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "receipt_api:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )

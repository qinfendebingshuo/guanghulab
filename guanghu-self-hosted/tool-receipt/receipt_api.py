"""Receipt API - FastAPI routes for Tool Receipt System
PY-A04-20260425-002

Endpoints:
  POST   /receipts                        -> create receipt
  PATCH  /receipts/{receipt_id}            -> update result
  GET    /receipts/{receipt_id}            -> get receipt
  GET    /sessions/{session_id}/receipts   -> get session receipts

Reference: HLDP-ARCH-001 L2 Tool Receipt System
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from config import settings
from receipt_formatter import ReceiptFormatter
from receipt_manager import (
    PgReceiptManager,
    Receipt,
    ReceiptStatus,
    SqliteReceiptManager,
)


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


class CreateReceiptResponse(BaseModel):
    """Response for POST /receipts."""

    receipt_id: str
    status: str


class UpdateReceiptRequest(BaseModel):
    """Body for PATCH /receipts/{id}."""

    output: dict[str, Any] | None = Field(
        default=None, description="Tool output"
    )
    status: str = Field(
        description="New status: success | error | timeout"
    )
    duration_ms: int | None = Field(
        default=None, description="Execution duration in ms"
    )


class ReceiptResponse(BaseModel):
    """Single receipt with formatted text."""

    receipt: Receipt
    formatted_text: str = Field(
        description="Human-readable formatted receipt"
    )
    hldp_text: str = Field(
        default="", description="HLDP mother-tongue formatted receipt"
    )


class SessionReceiptsResponse(BaseModel):
    """All receipts for a session."""

    session_id: str
    receipts: list[Receipt]
    summary_text: str = Field(
        description="Human-readable session summary"
    )


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

_manager: PgReceiptManager | SqliteReceiptManager | None = None
formatter = ReceiptFormatter()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown: connect and close the DB backend."""
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
    version="1.0.0",
    description="HLDP-ARCH-001 L2 - Tool call traceability for persona agents",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post("/receipts", response_model=CreateReceiptResponse, status_code=201)
async def create_receipt(req: CreateReceiptRequest):
    """Record a new tool call and return a receipt ID."""
    if isinstance(_manager, SqliteReceiptManager):
        rid = _manager.record_call(
            tool_name=req.tool_name,
            input_params=req.input_params,
            session_id=req.session_id,
            persona_id=req.persona_id,
        )
    else:
        rid = await _manager.record_call(
            tool_name=req.tool_name,
            input_params=req.input_params,
            session_id=req.session_id,
            persona_id=req.persona_id,
        )
    return CreateReceiptResponse(
        receipt_id=rid, status=ReceiptStatus.PENDING.value
    )


@app.patch("/receipts/{receipt_id}", response_model=ReceiptResponse)
async def update_receipt(receipt_id: str, req: UpdateReceiptRequest):
    """Update a receipt with tool output and final status."""
    try:
        status = ReceiptStatus(req.status)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid status. Must be one of: success, error, timeout",
        )

    if isinstance(_manager, SqliteReceiptManager):
        receipt = _manager.update_result(
            receipt_id=receipt_id,
            output=req.output,
            status=status,
            duration_ms=req.duration_ms,
        )
    else:
        receipt = await _manager.update_result(
            receipt_id=receipt_id,
            output=req.output,
            status=status,
            duration_ms=req.duration_ms,
        )
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return ReceiptResponse(
        receipt=receipt,
        formatted_text=formatter.to_text(receipt),
        hldp_text=formatter.to_hldp(receipt),
    )


@app.get("/receipts/{receipt_id}", response_model=ReceiptResponse)
async def get_receipt(receipt_id: str):
    """Retrieve a single receipt by ID."""
    if isinstance(_manager, SqliteReceiptManager):
        receipt = _manager.get_receipt(receipt_id)
    else:
        receipt = await _manager.get_receipt(receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return ReceiptResponse(
        receipt=receipt,
        formatted_text=formatter.to_text(receipt),
        hldp_text=formatter.to_hldp(receipt),
    )


@app.get(
    "/sessions/{session_id}/receipts",
    response_model=SessionReceiptsResponse,
)
async def get_session_receipts(session_id: str):
    """Retrieve all receipts for a session."""
    if isinstance(_manager, SqliteReceiptManager):
        receipts = _manager.get_session_receipts(session_id)
    else:
        receipts = await _manager.get_session_receipts(session_id)
    return SessionReceiptsResponse(
        session_id=session_id,
        receipts=receipts,
        summary_text=formatter.session_summary(session_id, receipts),
    )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "receipt_api:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )

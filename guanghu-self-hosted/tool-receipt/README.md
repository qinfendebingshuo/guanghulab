# Tool Receipt System MVP

**Work Order**: PY-A04-20260425-002  
**Phase**: Phase-0-005  
**Reference**: HLDP-ARCH-001 L2 Tool Receipt System  

## Overview

Every tool call made by a persona agent produces a receipt: what was called,
what was passed, what came back, how long it took, and whether it succeeded.

AI and humans see the **same** receipt. If the AI fabricates an action, the
receipt chain exposes the contradiction.

## Architecture

```
Persona Agent
    |
    v
receipt_manager.py   -- record_call / update_result / get_receipt / get_session_receipts
    |
    v
receipt_api.py       -- FastAPI REST interface (POST / PATCH / GET)
    |
    v
receipt_formatter.py -- JSON (system) + human-readable text (frontend) + HLDP mother tongue
    |
    v
PostgreSQL 15+       -- tool_receipts table (see receipt_schema.sql)
```

## Files

| File | Purpose |
|---|---|
| `config.py` | Settings: DB connection, SQLite fallback, retention, API host/port |
| `receipt_schema.sql` | PostgreSQL DDL: table + indexes + auto-update trigger |
| `receipt_manager.py` | Core logic: PgReceiptManager (async) + SqliteReceiptManager (sync) |
| `receipt_api.py` | FastAPI routes: 4 endpoints |
| `receipt_formatter.py` | Dual-format output: JSON + text + HLDP |
| `test_receipt.py` | 15 test cases using SQLite fallback |
| `requirements.txt` | fastapi + asyncpg + pydantic + uvicorn |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/receipts` | Create a new pending receipt |
| PATCH | `/receipts/{id}` | Update with output + status + duration |
| GET | `/receipts/{id}` | Retrieve single receipt |
| GET | `/sessions/{sid}/receipts` | Retrieve all receipts for a session |

## Status Enum

- `pending` -- tool call initiated
- `success` -- completed normally
- `error` -- failed
- `timeout` -- exceeded time limit

## Quick Start (local testing with SQLite)

```bash
export RECEIPT_USE_SQLITE=true
pip install -r requirements.txt
python receipt_api.py
# API available at http://localhost:8100
# Docs at http://localhost:8100/docs
```

## Run Tests

```bash
python -m pytest test_receipt.py -v
# or
python test_receipt.py
```

## Production (PostgreSQL)

```bash
# 1. Create table
psql -d personadb -f receipt_schema.sql

# 2. Configure
export RECEIPT_DB_HOST=localhost
export RECEIPT_DB_PORT=5432
export RECEIPT_DB_NAME=personadb
export RECEIPT_DB_USER=guanghu
export RECEIPT_DB_PASSWORD=your_password

# 3. Run
python receipt_api.py
```

## Constraints

- Python 3.10+
- Dependencies: fastapi + asyncpg + pydantic + uvicorn only
- PostgreSQL 15+ (same instance as PersonaDB)
- UTF-8 encoding throughout
- Does NOT modify any files outside this directory

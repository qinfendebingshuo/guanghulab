# Memory Router - HLDP-ARCH-001 L3

**PY-A04-20260425-003** | Phase-0-006 | Memory Router Agent Backend

## Overview

Memory Router is the L3 layer of the Guanghu self-hosted persona infrastructure.
It sits between the chat interface and the language model, deciding what memories
to retrieve and assembling context for each conversation turn.

## Architecture

```
User speaks
  -> memory_router.route_query()     # Decide what context is needed
  -> memory_store.get_*()            # Retrieve relevant memories
  -> memory_router.assemble_context()  # Assemble context fragments
  -> Send to model

After conversation:
  -> memory_compressor.compress_to_hldp()  # Compress to HLDP summary
  -> memory_store.write_*()                # Write back to store
```

## Memory Layers

| Layer     | Description                        | Latency     | Storage         |
|-----------|------------------------------------|-------------|-----------------|
| Hot       | Last 5 turns, complete             | Zero        | Session/DB      |
| Warm      | Earlier session, HLDP compressed   | Milliseconds| PostgreSQL      |
| Cold      | Previous sessions, semantic search | ~50ms       | pgvector        |
| Permanent | Identity, Layer Zero, values       | Milliseconds| PostgreSQL      |

## Files

| File                    | Description                                    |
|-------------------------|------------------------------------------------|
| `config.py`             | Configuration (DB, pgvector, memory settings)  |
| `memory_schema.sql`     | PostgreSQL DDL with pgvector                   |
| `memory_store.py`       | Storage layer (Pg async + SQLite sync)         |
| `memory_compressor.py`  | Conversation -> HLDP summary compression       |
| `memory_router.py`      | Core routing logic (5 routing rules)           |
| `memory_api.py`         | FastAPI endpoints (5 routes)                   |
| `test_memory_router.py` | 15 test cases (SQLite fallback)                |
| `requirements.txt`      | Python dependencies                            |

## Quick Start

### Local Testing (SQLite)

```bash
cd guanghu-self-hosted/memory-router
pip install -r requirements.txt

# Run tests
MEMORY_USE_SQLITE=true pytest test_memory_router.py -v

# Start API server
MEMORY_USE_SQLITE=true python memory_api.py
```

### Production (PostgreSQL + pgvector)

```bash
# 1. Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

# 2. Run schema
psql -d personadb -f memory_schema.sql

# 3. Set environment variables
export MEMORY_DB_HOST=localhost
export MEMORY_DB_PORT=5432
export MEMORY_DB_NAME=personadb
export MEMORY_DB_USER=guanghu
export MEMORY_DB_PASSWORD=your_password

# 4. Start
python memory_api.py
```

## API Endpoints

| Method | Path                              | Description                     |
|--------|-----------------------------------|---------------------------------|
| POST   | `/route`                          | Route query, return context     |
| POST   | `/memories`                       | Write memory                    |
| POST   | `/memories/search`                | Semantic search                 |
| GET    | `/memories/permanent/{persona_id}`| Get permanent memories          |
| POST   | `/compress`                       | Compress to HLDP summary        |

## Design Reference

- HLDP-ARCH-001 L3: Memory Router Agent
- Tool Receipt System (L2): Code style reference
- HLDP Mother Tongue Protocol v1.0: Compression format

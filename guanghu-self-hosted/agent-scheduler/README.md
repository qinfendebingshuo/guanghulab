# Agent Scheduler · GH-SCHED-001

**HLDP-ARCH-001 L5 · Agent Dev Hub · Agent Scheduling Engine**

Agent Scheduler is the core scheduling engine that enables GuangHu agents (半体) to autonomously accept work orders, generate code via LLM, push to Git, and self-check deliverables.

## Architecture Position

```
HLDP-ARCH-001 Layer Map:
  L-1  Boot Protocol     <- scheduler reads identity from here
  L0   PersonaDB         <- scheduler reads/writes memory here
  L1   Dual Model        <- scheduler calls LLM through llm_client
  L2   Tool Receipt      <- scheduler records operation receipts
  L3   Memory Router     <- future integration
  L4   Synesthesia       <- future integration
  L5   Agent Dev Hub     <- ★ THIS MODULE
```

## Module Structure

```
agent-scheduler/
├── config.py              # Pydantic configuration · env vars
├── scheduler.py           # Main async polling loop · core engine
├── boot_integration.py    # Boot Protocol loader (L-1)
├── llm_client.py          # LLM client · retry · dual-model stub
├── git_ops.py             # Git clone/checkout/add/commit/push
├── self_checker.py        # Self-check engine · 7 checks
├── test_scheduler.py      # 10 test cases
├── requirements.txt       # Dependencies
└── README.md              # This file
```

## Core Flow

```
1. Boot:   Load Boot Protocol → restore identity
2. Poll:   Query work_orders WHERE status=pending AND assigned_agent=self
3. Accept: status → developing · write execution_log
4. Execute:
   a. Read dev_content + constraints
   b. Call LLM API (with 3x retry)
   c. Write files to repo path
   d. Git: checkout branch → add → commit → push
5. Check:  Run 7 self-checks → status → self_checking → reviewing
6. Receipt: Record tool receipt for every operation
```

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set environment variables
export PG_HOST=127.0.0.1
export PG_DATABASE=guanghu_dev
export LLM_API_KEY=sk-...
export LLM_BASE_URL=https://api.openai.com/v1
export LLM_MODEL=gpt-4o
export GITHUB_TOKEN=ghp_...
export REPO_URL=https://github.com/qinfendebingshuo/guanghulab.git

# 3. Run scheduler
python scheduler.py
```

## Configuration (Environment Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `PG_HOST` | 127.0.0.1 | PostgreSQL host |
| `PG_PORT` | 5432 | PostgreSQL port |
| `PG_DATABASE` | guanghu_dev | Database name |
| `LLM_API_KEY` | (empty) | LLM API key |
| `LLM_BASE_URL` | openai | API endpoint |
| `LLM_MODEL` | gpt-4o | Default model |
| `LLM_MAX_RETRIES` | 3 | Retry count |
| `GITHUB_TOKEN` | (empty) | Git auth token |
| `REPO_URL` | guanghulab | Repository URL |
| `POLL_INTERVAL` | 30 | Poll interval (seconds) |
| `WORK_ORDER_TIMEOUT` | 1800 | Max 30min per order |
| `AGENT_ID` | scheduler-001 | Agent identifier |
| `BOOT_PROTOCOL_PATH` | ../boot-protocol | Boot Protocol dir |
| `LOG_LEVEL` | INFO | Logging level |

## Self-Check Engine (7 Checks)

1. **files_exist** - All expected deliverable files present
2. **python_syntax** - All .py files parse without syntax errors
3. **directory_isolation** - No files outside allowed directory
4. **prefix_enforcement** - Correct work order prefix
5. **forbidden_paths** - No modifications to forbidden files
6. **no_empty_files** - All deliverables are non-empty
7. **import_consistency** - Local imports reference existing modules

## Dependencies

- `httpx` - Async HTTP client for LLM API
- `asyncpg` - Async PostgreSQL driver
- `pydantic` - Configuration validation
- Git CLI (system dependency)

## Integration Points

- **Boot Protocol** (L-1): `boot_integration.py` reads `../boot-protocol/`
- **Tool Receipt** (L2): `record_receipt()` stub in `scheduler.py`
- **Memory Router** (L3): Future integration for agent memory
- **GH-API-001**: Future integration for work order API

---

*PY-A04 · Phase-NOW-004 · HLDP-ARCH-001 L5*

#!/usr/bin/env bash
# ============================================================
# migrate.sh — PersonaDB v2 一键建库+建表+导入
# Work order: YD-A05-20260425-002 | Phase-0-002
# ============================================================
# Usage:
#   chmod +x migrate.sh
#   ./migrate.sh [DB_NAME] [DB_USER] [DB_HOST] [DB_PORT]
#
# Defaults:
#   DB_NAME = persona_db
#   DB_USER = postgres
#   DB_HOST = 127.0.0.1
#   DB_PORT = 5432
# ============================================================

set -euo pipefail

DB_NAME="${1:-persona_db}"
DB_USER="${2:-postgres}"
DB_HOST="${3:-127.0.0.1}"
DB_PORT="${4:-5432}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCHEMA_FILE="$SCRIPT_DIR/schema.sql"
SEED_FILE="$SCRIPT_DIR/seed.sql"

# ---- Pre-flight checks ----
if ! command -v psql &> /dev/null; then
    echo "ERROR: psql not found. Please install PostgreSQL client."
    exit 1
fi

if [ ! -f "$SCHEMA_FILE" ]; then
    echo "ERROR: schema.sql not found at $SCHEMA_FILE"
    exit 1
fi

if [ ! -f "$SEED_FILE" ]; then
    echo "ERROR: seed.sql not found at $SEED_FILE"
    exit 1
fi

echo "============================================"
echo " PersonaDB v2 Migration"
echo " Database: $DB_NAME"
echo " User:     $DB_USER"
echo " Host:     $DB_HOST:$DB_PORT"
echo "============================================"
echo ""

# ---- Step 1: Create database (if not exists) ----
echo "[1/3] Creating database '$DB_NAME' (if not exists)..."
DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" 2>/dev/null || true)

if [ "$DB_EXISTS" != "1" ]; then
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE \"$DB_NAME\";"
    echo "  ✅ Database '$DB_NAME' created."
else
    echo "  ✅ Database '$DB_NAME' already exists."
fi

# ---- Step 2: Apply schema ----
echo "[2/3] Applying schema..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
    -f "$SCHEMA_FILE"
echo "  ✅ Schema applied (3 tables + triggers)."

# ---- Step 3: Import seed data ----
echo "[3/3] Importing seed data..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -v ON_ERROR_STOP=1 \
    -f "$SEED_FILE"
echo "  ✅ Seed data imported (5 personas + 9 config entries)."

echo ""
echo "============================================"
echo " ✅ Migration complete!"
echo "============================================"
echo " Verify:"
echo "   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
echo "   > SELECT code, name, role, layer, status FROM personas;"
echo "   > SELECT persona_code, config_key FROM persona_config;"
echo "   > SELECT COUNT(*) FROM persona_memory;"
echo "============================================"

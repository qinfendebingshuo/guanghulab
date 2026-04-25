"""Configuration for Tool Receipt System
PY-A04-20260425-002

Database: PostgreSQL 15+ (same instance as PersonaDB)
Fallback: SQLite for local testing
"""
import os

from pydantic import BaseModel, Field


class DatabaseConfig(BaseModel):
    """PostgreSQL connection settings."""

    host: str = Field(default="localhost", description="Database host")
    port: int = Field(default=5432, description="Database port")
    name: str = Field(default="personadb", description="Database name")
    user: str = Field(default="guanghu", description="Database user")
    password: str = Field(default="CHANGE_ME", description="Database password")
    min_pool: int = Field(default=2, description="Min connection pool size")
    max_pool: int = Field(default=10, description="Max connection pool size")


class ReceiptSettings(BaseModel):
    """Tool Receipt System settings."""

    db: DatabaseConfig = Field(default_factory=DatabaseConfig)
    use_sqlite: bool = Field(
        default=False, description="Use SQLite for local testing"
    )
    sqlite_path: str = Field(
        default="./data/receipts.db", description="SQLite file path"
    )
    retention_days: int = Field(
        default=90, description="Receipt retention in days"
    )
    api_host: str = Field(default="0.0.0.0", description="API listen host")
    api_port: int = Field(default=8100, description="API listen port")

    @property
    def pg_dsn(self) -> str:
        """Build PostgreSQL DSN from config."""
        d = self.db
        return (
            "postgresql://"
            + d.user
            + ":"
            + d.password
            + "@"
            + d.host
            + ":"
            + str(d.port)
            + "/"
            + d.name
        )


def load_settings() -> ReceiptSettings:
    """Load settings from environment variables with sensible defaults."""
    db = DatabaseConfig(
        host=os.getenv("RECEIPT_DB_HOST", "localhost"),
        port=int(os.getenv("RECEIPT_DB_PORT", "5432")),
        name=os.getenv("RECEIPT_DB_NAME", "personadb"),
        user=os.getenv("RECEIPT_DB_USER", "guanghu"),
        password=os.getenv("RECEIPT_DB_PASSWORD", "CHANGE_ME"),
    )
    return ReceiptSettings(
        db=db,
        use_sqlite=os.getenv("RECEIPT_USE_SQLITE", "false").lower() == "true",
        sqlite_path=os.getenv("RECEIPT_SQLITE_PATH", "./data/receipts.db"),
        retention_days=int(os.getenv("RECEIPT_RETENTION_DAYS", "90")),
        api_host=os.getenv("RECEIPT_API_HOST", "0.0.0.0"),
        api_port=int(os.getenv("RECEIPT_API_PORT", "8100")),
    )


settings = load_settings()

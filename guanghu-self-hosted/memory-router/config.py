"""Configuration for Memory Router System
PY-A04-20260425-003

Database: PostgreSQL 15+ with pgvector extension (same instance as PersonaDB)
Fallback: SQLite for local testing (semantic search uses mock)
"""
import os

from pydantic import BaseModel, Field


class DatabaseConfig(BaseModel):
    """PostgreSQL connection settings (shared with PersonaDB)."""

    host: str = Field(default="localhost", description="Database host")
    port: int = Field(default=5432, description="Database port")
    name: str = Field(default="personadb", description="Database name")
    user: str = Field(default="guanghu", description="Database user")
    password: str = Field(default="CHANGE_ME", description="Database password")
    min_pool: int = Field(default=2, description="Min connection pool size")
    max_pool: int = Field(default=10, description="Max connection pool size")


class MemoryRouterSettings(BaseModel):
    """Memory Router System settings."""

    db: DatabaseConfig = Field(default_factory=DatabaseConfig)
    use_sqlite: bool = Field(
        default=False, description="Use SQLite for local testing"
    )
    sqlite_path: str = Field(
        default="./data/memories.db", description="SQLite file path"
    )
    api_host: str = Field(default="0.0.0.0", description="API listen host")
    api_port: int = Field(default=8200, description="API listen port")

    # Memory layer settings
    hot_memory_window: int = Field(
        default=5, description="Number of recent turns kept as hot memory"
    )
    warm_compress_threshold: int = Field(
        default=10,
        description="Number of turns before compressing to warm memory",
    )
    cold_search_top_k: int = Field(
        default=5, description="Top-K results for semantic search"
    )
    embedding_dim: int = Field(
        default=1536, description="Embedding vector dimension"
    )

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


def load_settings() -> MemoryRouterSettings:
    """Load settings from environment variables with sensible defaults."""
    db = DatabaseConfig(
        host=os.getenv("MEMORY_DB_HOST", "localhost"),
        port=int(os.getenv("MEMORY_DB_PORT", "5432")),
        name=os.getenv("MEMORY_DB_NAME", "personadb"),
        user=os.getenv("MEMORY_DB_USER", "guanghu"),
        password=os.getenv("MEMORY_DB_PASSWORD", "CHANGE_ME"),
    )
    return MemoryRouterSettings(
        db=db,
        use_sqlite=os.getenv("MEMORY_USE_SQLITE", "false").lower() == "true",
        sqlite_path=os.getenv("MEMORY_SQLITE_PATH", "./data/memories.db"),
        api_host=os.getenv("MEMORY_API_HOST", "0.0.0.0"),
        api_port=int(os.getenv("MEMORY_API_PORT", "8200")),
        hot_memory_window=int(os.getenv("MEMORY_HOT_WINDOW", "5")),
        warm_compress_threshold=int(os.getenv("MEMORY_WARM_THRESHOLD", "10")),
        cold_search_top_k=int(os.getenv("MEMORY_COLD_TOP_K", "5")),
        embedding_dim=int(os.getenv("MEMORY_EMBEDDING_DIM", "1536")),
    )


settings = load_settings()

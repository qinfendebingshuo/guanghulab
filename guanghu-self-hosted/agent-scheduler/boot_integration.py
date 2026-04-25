"""GH-SCHED-001 · Boot Protocol Integration
Loads Agent persona identity from Boot Protocol (HLDP-ARCH-001 L-1).
In Phase 0 this reads local YAML/JSON config files.
Phase 2+ will read from PersonaDB (L0).
"""

import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger("agent-scheduler.boot")


@dataclass
class AgentIdentity:
    """Agent identity loaded from Boot Protocol."""
    agent_id: str = ""
    name: str = ""
    role: str = ""
    capabilities: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)
    tool_whitelist: List[str] = field(default_factory=list)
    persona_config: Dict[str, Any] = field(default_factory=dict)


def _default_identity(agent_id: str) -> AgentIdentity:
    """Return a minimal default identity when Boot Protocol files are absent."""
    return AgentIdentity(
        agent_id=agent_id,
        name="GuangHu Agent",
        role="developer",
        capabilities=["code_generation", "git_operations", "self_check"],
        constraints=["directory_isolation", "prefix_enforcement"],
        tool_whitelist=["llm", "git", "file_write", "file_read"],
    )


def load_boot_protocol(boot_path: str, agent_id: str) -> AgentIdentity:
    """Load Boot Protocol configuration.

    Reads persona identity from the boot-protocol directory.
    Falls back to defaults if files are missing (Phase 0 graceful degradation).

    Args:
        boot_path: Path to the boot-protocol module directory.
        agent_id: Unique agent identifier.

    Returns:
        AgentIdentity with loaded or default values.
    """
    identity_file = os.path.join(boot_path, "identities", agent_id + ".json")
    boot_config_file = os.path.join(boot_path, "boot.json")

    identity = _default_identity(agent_id)

    # Try loading agent-specific identity
    if os.path.isfile(identity_file):
        try:
            with open(identity_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            identity.name = data.get("name", identity.name)
            identity.role = data.get("role", identity.role)
            identity.capabilities = data.get("capabilities", identity.capabilities)
            identity.constraints = data.get("constraints", identity.constraints)
            identity.tool_whitelist = data.get("tool_whitelist", identity.tool_whitelist)
            identity.persona_config = data.get("persona", {})
            logger.info("Boot Protocol: loaded identity for %s from %s", agent_id, identity_file)
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Boot Protocol: failed to load %s: %s, using defaults", identity_file, exc)
    else:
        logger.info("Boot Protocol: identity file not found at %s, using defaults", identity_file)

    # Try loading global boot config for system-level rules
    if os.path.isfile(boot_config_file):
        try:
            with open(boot_config_file, "r", encoding="utf-8") as f:
                boot_data = json.load(f)
            # Merge global constraints into agent constraints
            global_constraints = boot_data.get("global_constraints", [])
            for c in global_constraints:
                if c not in identity.constraints:
                    identity.constraints.append(c)
            logger.info("Boot Protocol: loaded global boot config from %s", boot_config_file)
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Boot Protocol: failed to load %s: %s", boot_config_file, exc)

    return identity


def validate_identity(identity: AgentIdentity) -> bool:
    """Validate that an identity has minimum required fields."""
    if not identity.agent_id:
        logger.error("Boot Protocol validation failed: agent_id is empty")
        return False
    if not identity.name:
        logger.error("Boot Protocol validation failed: name is empty")
        return False
    if not identity.capabilities:
        logger.warning("Boot Protocol validation: no capabilities defined")
    return True

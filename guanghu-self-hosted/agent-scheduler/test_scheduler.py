"""GH-SCHED-001 · Agent Scheduler Tests
10 test cases covering core functionality.
Runs with pytest. Uses no external services (SQLite/mocks).
"""

import asyncio
import json
import os
import sys
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch

# Ensure local imports work
sys.path.insert(0, os.path.dirname(__file__))

from config import AppConfig, load_config, DatabaseConfig, LLMConfig, GitConfig, SchedulerConfig
from boot_integration import AgentIdentity, load_boot_protocol, validate_identity, _default_identity
from llm_client import LLMClient, LLMResponse
from git_ops import GitOps, GitResult
from self_checker import SelfChecker, SelfCheckReport, CheckResult


# ---- Helpers ----

def run_async(coro):
    """Helper to run async functions in tests."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ---- Test 1: Config loading ----

def test_config_loading():
    """Test that AppConfig loads with defaults."""
    config = load_config()
    assert isinstance(config, AppConfig)
    assert config.db.host == "127.0.0.1"
    assert config.db.port == 5432
    assert config.llm.max_retries == 3
    assert config.scheduler.work_order_timeout_seconds == 1800
    assert config.scheduler.poll_interval_seconds == 30
    print("[PASS] test_config_loading")


# ---- Test 2: Config DSN construction ----

def test_config_dsn():
    """Test PostgreSQL DSN is correctly constructed."""
    db = DatabaseConfig(host="localhost", port=5432, user="test", password="pw", database="testdb")
    assert "postgresql://" in db.dsn
    assert "test:pw@localhost:5432/testdb" in db.dsn
    print("[PASS] test_config_dsn")


# ---- Test 3: Boot Protocol default identity ----

def test_boot_default_identity():
    """Test default identity generation."""
    identity = _default_identity("test-agent")
    assert identity.agent_id == "test-agent"
    assert identity.name == "GuangHu Agent"
    assert "code_generation" in identity.capabilities
    assert "directory_isolation" in identity.constraints
    print("[PASS] test_boot_default_identity")


# ---- Test 4: Boot Protocol file loading ----

def test_boot_load_from_file():
    """Test loading identity from a JSON file."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create identity file
        identities_dir = os.path.join(tmpdir, "identities")
        os.makedirs(identities_dir)
        identity_data = {
            "name": "Test Agent",
            "role": "tester",
            "capabilities": ["testing"],
            "constraints": ["no_production"],
            "tool_whitelist": ["test_tool"],
        }
        with open(os.path.join(identities_dir, "test-001.json"), "w") as f:
            json.dump(identity_data, f)

        identity = load_boot_protocol(tmpdir, "test-001")
        assert identity.name == "Test Agent"
        assert identity.role == "tester"
        assert "testing" in identity.capabilities
    print("[PASS] test_boot_load_from_file")


# ---- Test 5: Boot Protocol validation ----

def test_boot_validation():
    """Test identity validation."""
    good = AgentIdentity(agent_id="a1", name="Test")
    assert validate_identity(good) is True

    bad_id = AgentIdentity(agent_id="", name="Test")
    assert validate_identity(bad_id) is False

    bad_name = AgentIdentity(agent_id="a1", name="")
    assert validate_identity(bad_name) is False
    print("[PASS] test_boot_validation")


# ---- Test 6: LLM Response dataclass ----

def test_llm_response():
    """Test LLMResponse structure."""
    resp = LLMResponse(
        content="print('hello')",
        model="test-model",
        usage_prompt_tokens=10,
        usage_completion_tokens=5,
        latency_ms=100.5,
    )
    assert resp.success is True
    assert resp.content == "print('hello')"
    assert resp.model == "test-model"
    assert resp.latency_ms == 100.5

    err_resp = LLMResponse(content="", model="m", success=False, error="timeout")
    assert err_resp.success is False
    assert err_resp.error == "timeout"
    print("[PASS] test_llm_response")


# ---- Test 7: Self-checker file existence ----

def test_selfcheck_files_exist():
    """Test file existence check."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create one file
        test_file = os.path.join(tmpdir, "module", "main.py")
        os.makedirs(os.path.dirname(test_file))
        with open(test_file, "w") as f:
            f.write("x = 1")

        checker = SelfChecker(tmpdir)
        result = checker._check_files_exist(["module/main.py"])
        assert result.passed is True

        result2 = checker._check_files_exist(["module/main.py", "module/missing.py"])
        assert result2.passed is False
        assert "missing.py" in result2.message
    print("[PASS] test_selfcheck_files_exist")


# ---- Test 8: Self-checker Python syntax ----

def test_selfcheck_python_syntax():
    """Test Python syntax checking."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Good file
        good_file = os.path.join(tmpdir, "good.py")
        with open(good_file, "w") as f:
            f.write("def hello():\n    return 'world'\n")

        # Bad file
        bad_file = os.path.join(tmpdir, "bad.py")
        with open(bad_file, "w") as f:
            f.write("def broken(:\n")

        checker = SelfChecker(tmpdir)

        result_good = checker._check_python_syntax(["good.py"])
        assert result_good.passed is True

        result_bad = checker._check_python_syntax(["bad.py"])
        assert result_bad.passed is False
    print("[PASS] test_selfcheck_python_syntax")


# ---- Test 9: Self-checker directory isolation ----

def test_selfcheck_directory_isolation():
    """Test directory isolation check."""
    checker = SelfChecker("/tmp")

    result_ok = checker._check_directory_isolation(
        ["guanghu-self-hosted/agent-scheduler/main.py"],
        "guanghu-self-hosted/agent-scheduler",
    )
    assert result_ok.passed is True

    result_fail = checker._check_directory_isolation(
        ["guanghu-self-hosted/agent-scheduler/main.py", "other/hack.py"],
        "guanghu-self-hosted/agent-scheduler",
    )
    assert result_fail.passed is False
    assert "hack.py" in result_fail.message
    print("[PASS] test_selfcheck_directory_isolation")


# ---- Test 10: Self-checker full report ----

def test_selfcheck_full_report():
    """Test full self-check report generation."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create a valid Python file in the right directory
        target_dir = os.path.join(tmpdir, "guanghu-self-hosted", "test-module")
        os.makedirs(target_dir)
        test_file = os.path.join(target_dir, "app.py")
        with open(test_file, "w") as f:
            f.write("import os\ndef main():\n    print('hello')\n")

        checker = SelfChecker(tmpdir)
        report = checker.run_all_checks(
            expected_files=["guanghu-self-hosted/test-module/app.py"],
            allowed_directory="guanghu-self-hosted/test-module",
            prefix="TEST",
        )
        assert isinstance(report, SelfCheckReport)
        assert report.all_passed is True
        assert len(report.checks) >= 6
        summary = report.summary
        assert "PASS" in summary
        assert "files_exist" in summary
    print("[PASS] test_selfcheck_full_report")


# ---- Run all tests ----

if __name__ == "__main__":
    tests = [
        test_config_loading,
        test_config_dsn,
        test_boot_default_identity,
        test_boot_load_from_file,
        test_boot_validation,
        test_llm_response,
        test_selfcheck_files_exist,
        test_selfcheck_python_syntax,
        test_selfcheck_directory_isolation,
        test_selfcheck_full_report,
    ]
    passed = 0
    failed = 0
    for test_fn in tests:
        try:
            test_fn()
            passed += 1
        except Exception as exc:
            print("[FAIL] " + test_fn.__name__ + ": " + str(exc))
            failed += 1

    total = passed + failed
    print("\n" + "=" * 40)
    print(str(passed) + "/" + str(total) + " tests passed")
    if failed > 0:
        print(str(failed) + " tests FAILED")
        sys.exit(1)
    else:
        print("All tests passed!")

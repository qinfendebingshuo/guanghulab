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

sys.path.insert(0, os.path.dirname(__file__))

from config import AppConfig, load_config, DatabaseConfig, LLMConfig, GitConfig, SchedulerConfig
from boot_integration import AgentIdentity, load_boot_protocol, validate_identity, _default_identity
from llm_client import LLMClient, LLMResponse
from git_ops import GitOps, GitResult
from self_checker import SelfChecker, SelfCheckReport, CheckResult


def run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def test_config_loading():
    config = load_config()
    assert isinstance(config, AppConfig)
    assert config.db.host == "127.0.0.1"
    assert config.db.port == 5432
    assert config.llm.max_retries == 3
    assert config.scheduler.work_order_timeout_seconds == 1800


def test_config_dsn():
    db = DatabaseConfig(host="localhost", port=5432, user="test", password="pw", database="testdb")
    assert "postgresql://" in db.dsn
    assert "test:pw@localhost:5432/testdb" in db.dsn


def test_boot_default_identity():
    identity = _default_identity("test-agent")
    assert identity.agent_id == "test-agent"
    assert identity.name == "GuangHu Agent"
    assert "code_generation" in identity.capabilities


def test_boot_load_from_file():
    with tempfile.TemporaryDirectory() as tmpdir:
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


def test_boot_validation():
    good = AgentIdentity(agent_id="a1", name="Test")
    assert validate_identity(good) is True
    bad_id = AgentIdentity(agent_id="", name="Test")
    assert validate_identity(bad_id) is False
    bad_name = AgentIdentity(agent_id="a1", name="")
    assert validate_identity(bad_name) is False


def test_llm_response():
    resp = LLMResponse(content="print('hello')", model="test-model", latency_ms=100.5)
    assert resp.success is True
    assert resp.content == "print('hello')"
    err_resp = LLMResponse(content="", model="m", success=False, error="timeout")
    assert err_resp.success is False


def test_selfcheck_files_exist():
    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = os.path.join(tmpdir, "module", "main.py")
        os.makedirs(os.path.dirname(test_file))
        with open(test_file, "w") as f:
            f.write("x = 1")
        checker = SelfChecker(tmpdir)
        result = checker._check_files_exist(["module/main.py"])
        assert result.passed is True
        result2 = checker._check_files_exist(["module/main.py", "module/missing.py"])
        assert result2.passed is False


def test_selfcheck_python_syntax():
    with tempfile.TemporaryDirectory() as tmpdir:
        with open(os.path.join(tmpdir, "good.py"), "w") as f:
            f.write("def hello():\n    return 'world'\n")
        with open(os.path.join(tmpdir, "bad.py"), "w") as f:
            f.write("def broken(:\n")
        checker = SelfChecker(tmpdir)
        assert checker._check_python_syntax(["good.py"]).passed is True
        assert checker._check_python_syntax(["bad.py"]).passed is False


def test_selfcheck_directory_isolation():
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


def test_selfcheck_full_report():
    with tempfile.TemporaryDirectory() as tmpdir:
        target_dir = os.path.join(tmpdir, "guanghu-self-hosted", "test-module")
        os.makedirs(target_dir)
        with open(os.path.join(target_dir, "app.py"), "w") as f:
            f.write("import os\ndef main():\n    print('hello')\n")
        checker = SelfChecker(tmpdir)
        report = checker.run_all_checks(
            expected_files=["guanghu-self-hosted/test-module/app.py"],
            allowed_directory="guanghu-self-hosted/test-module",
            prefix="TEST",
        )
        assert report.all_passed is True
        assert len(report.checks) >= 6


if __name__ == "__main__":
    tests = [
        test_config_loading, test_config_dsn, test_boot_default_identity,
        test_boot_load_from_file, test_boot_validation, test_llm_response,
        test_selfcheck_files_exist, test_selfcheck_python_syntax,
        test_selfcheck_directory_isolation, test_selfcheck_full_report,
    ]
    passed = failed = 0
    for t in tests:
        try:
            t()
            passed += 1
            print("[PASS] " + t.__name__)
        except Exception as exc:
            print("[FAIL] " + t.__name__ + ": " + str(exc))
            failed += 1
    print(str(passed) + "/" + str(passed + failed) + " tests passed")
    if failed:
        sys.exit(1)

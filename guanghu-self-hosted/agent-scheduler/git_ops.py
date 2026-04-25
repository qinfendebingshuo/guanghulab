"""GH-SCHED-001 · Git Operations
Git clone/checkout/add/commit/push for Agent work order execution.
Uses subprocess for git commands (no external git library dependency).
"""

import asyncio
import logging
import os
import shutil
from dataclasses import dataclass
from typing import List, Optional, Tuple

from config import GitConfig

logger = logging.getLogger("agent-scheduler.git")


@dataclass
class GitResult:
    """Result of a git operation."""
    success: bool
    stdout: str = ""
    stderr: str = ""
    return_code: int = 0


async def _run_git(
    args: List[str],
    cwd: Optional[str] = None,
    env: Optional[dict] = None,
    timeout: int = 300,
) -> GitResult:
    cmd = ["git"] + args
    cmd_str = " ".join(cmd)
    logger.debug("Running: %s (cwd=%s)", cmd_str, cwd or "(default)")

    merged_env = dict(os.environ)
    if env:
        merged_env.update(env)

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
            env=merged_env,
        )
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            proc.communicate(), timeout=timeout
        )
        stdout = stdout_bytes.decode("utf-8", errors="replace").strip()
        stderr = stderr_bytes.decode("utf-8", errors="replace").strip()
        rc = proc.returncode or 0

        if rc != 0:
            logger.warning("Git command failed (rc=%d): %s\nstderr: %s", rc, cmd_str, stderr)
        else:
            logger.debug("Git command success: %s", cmd_str)

        return GitResult(success=(rc == 0), stdout=stdout, stderr=stderr, return_code=rc)

    except asyncio.TimeoutError:
        logger.error("Git command timed out after %ds: %s", timeout, cmd_str)
        return GitResult(success=False, stderr="timeout after " + str(timeout) + "s", return_code=-1)
    except Exception as exc:
        logger.error("Git command exception: %s -> %s", cmd_str, exc)
        return GitResult(success=False, stderr=str(exc), return_code=-1)


class GitOps:
    def __init__(self, config: GitConfig):
        self.config = config
        self.repo_dir = config.clone_dir
        self._auth_url = self._build_auth_url()

    def _build_auth_url(self) -> str:
        url = self.config.repo_url
        if self.config.token and url.startswith("https://"):
            url = url.replace("https://", "https://" + self.config.token + "@", 1)
        return url

    async def clone_or_pull(self) -> GitResult:
        if os.path.isdir(os.path.join(self.repo_dir, ".git")):
            logger.info("Repo exists at %s, pulling latest...", self.repo_dir)
            return await _run_git(["pull", "--rebase"], cwd=self.repo_dir)
        else:
            logger.info("Cloning repo to %s ...", self.repo_dir)
            if os.path.exists(self.repo_dir):
                shutil.rmtree(self.repo_dir)
            result = await _run_git(["clone", self._auth_url, self.repo_dir])
            if result.success:
                await _run_git(["config", "user.name", self.config.commit_author_name], cwd=self.repo_dir)
                await _run_git(["config", "user.email", self.config.commit_author_email], cwd=self.repo_dir)
            return result

    async def checkout_branch(self, branch: str, create: bool = True) -> GitResult:
        result = await _run_git(["checkout", branch], cwd=self.repo_dir)
        if result.success:
            logger.info("Checked out existing branch: %s", branch)
            return result
        if create:
            logger.info("Creating new branch: %s", branch)
            result = await _run_git(["checkout", "-b", branch], cwd=self.repo_dir)
        return result

    async def add_files(self, paths: Optional[List[str]] = None) -> GitResult:
        if paths:
            return await _run_git(["add"] + paths, cwd=self.repo_dir)
        return await _run_git(["add", "-A"], cwd=self.repo_dir)

    async def commit(self, message: str) -> GitResult:
        return await _run_git(["commit", "-m", message], cwd=self.repo_dir)

    async def push(self, branch: str, force: bool = False) -> GitResult:
        args = ["push", "origin", branch]
        if force:
            args.append("--force")
        return await _run_git(args, cwd=self.repo_dir)

    async def get_current_sha(self) -> str:
        result = await _run_git(["rev-parse", "HEAD"], cwd=self.repo_dir)
        return result.stdout if result.success else ""

    async def get_status(self) -> str:
        result = await _run_git(["status", "--short"], cwd=self.repo_dir)
        return result.stdout if result.success else result.stderr

    def write_file(self, relative_path: str, content: str) -> str:
        full_path = os.path.join(self.repo_dir, relative_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        logger.info("Wrote file: %s (%d bytes)", relative_path, len(content))
        return full_path

    def read_file(self, relative_path: str) -> Optional[str]:
        full_path = os.path.join(self.repo_dir, relative_path)
        if not os.path.isfile(full_path):
            return None
        with open(full_path, "r", encoding="utf-8") as f:
            return f.read()

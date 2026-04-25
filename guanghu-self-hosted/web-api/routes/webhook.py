"""GH-API-001 · GitHub Webhook路由

/api/webhook/github — 接收push/PR事件
"""
import hashlib
import hmac
import logging
from fastapi import APIRouter, Request, HTTPException
from config import settings
from models import MessageResponse

logger = logging.getLogger("guanghu.webhook")

router = APIRouter(prefix="/api/webhook", tags=["webhook"])


def _verify_github_signature(payload: bytes, signature: str | None) -> bool:
    """验证GitHub Webhook签名"""
    if settings.github_webhook_secret is None:
        # 未配置secret时跳过验证（开发模式）
        return True
    if signature is None:
        return False

    expected = "sha256=" + hmac.new(
        settings.github_webhook_secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/github", response_model=MessageResponse)
async def github_webhook(request: Request):
    """接收GitHub Webhook事件"""
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")

    if not _verify_github_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    event_type = request.headers.get("X-GitHub-Event", "unknown")
    payload = await request.json()

    # 记录事件
    repo_name = payload.get("repository", {}).get("full_name", "unknown")
    sender = payload.get("sender", {}).get("login", "unknown")
    action = payload.get("action", "")

    logger.info(
        "GitHub webhook received: event=%s repo=%s sender=%s action=%s",
        event_type, repo_name, sender, action,
    )

    # 处理push事件
    if event_type == "push":
        ref = payload.get("ref", "")
        commits = payload.get("commits", [])
        commit_count = len(commits)
        logger.info("Push event: ref=%s commits=%d", ref, commit_count)
        # TODO: 触发相关工单状态更新 / Boot Protocol集成

    # 处理PR事件
    elif event_type == "pull_request":
        pr = payload.get("pull_request", {})
        pr_number = pr.get("number")
        pr_title = pr.get("title", "")
        logger.info("PR event: action=%s number=%s title=%s", action, pr_number, pr_title)
        # TODO: 自动触发审核流程

    return MessageResponse(
        message=f"Webhook received: {event_type} from {repo_name}",
        success=True,
    )

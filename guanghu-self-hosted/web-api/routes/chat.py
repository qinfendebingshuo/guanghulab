"""GH-API-002 · 聊天消息路由 · 对齐GH-DB-001 chat_messages表

/api/chat/messages — CRUD (chat_messages · UUID PK · sender/receiver/content/msg_type)
/api/chat/conversation — 获取两方对话
"""
from fastapi import APIRouter, HTTPException, Query
from db import get_pool
from models import (
    ChatMessageCreate, ChatMessageResponse, ChatMessageListResponse,
    MessageType,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _row_to_message(row) -> ChatMessageResponse:
    """将数据库行转换为ChatMessageResponse"""
    d = dict(row)
    return ChatMessageResponse(
        id=str(d["id"]),
        sender=d["sender"],
        receiver=d["receiver"],
        content=d["content"],
        msg_type=d["msg_type"],
        created_at=d["created_at"],
    )


@router.get("/messages", response_model=ChatMessageListResponse)
async def list_messages(
    sender: str | None = None,
    receiver: str | None = None,
    msg_type: MessageType | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    """获取聊天消息列表 · 支持按sender/receiver/msg_type过滤"""
    pool = await get_pool()
    conditions = []
    params = []
    idx = 1

    if sender is not None:
        conditions.append("sender = $" + str(idx))
        params.append(sender)
        idx += 1

    if receiver is not None:
        conditions.append("receiver = $" + str(idx))
        params.append(receiver)
        idx += 1

    if msg_type is not None:
        conditions.append("msg_type = $" + str(idx))
        params.append(msg_type.value)
        idx += 1

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    count_sql = "SELECT COUNT(*) FROM chat_messages " + where_clause
    total = await pool.fetchval(count_sql, *params)

    offset = (page - 1) * page_size
    list_sql = (
        "SELECT * FROM chat_messages " + where_clause
        + " ORDER BY created_at DESC"
        + " LIMIT $" + str(idx) + " OFFSET $" + str(idx + 1)
    )
    params.extend([page_size, offset])
    rows = await pool.fetch(list_sql, *params)

    messages = [_row_to_message(r) for r in rows]
    return ChatMessageListResponse(
        messages=messages, total=total, page=page, page_size=page_size
    )


@router.post("/messages", response_model=ChatMessageResponse, status_code=201)
async def create_message(body: ChatMessageCreate):
    """发送聊天消息"""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO chat_messages (sender, receiver, content, msg_type)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        """,
        body.sender, body.receiver, body.content, body.msg_type.value,
    )
    return _row_to_message(row)


@router.get("/messages/{message_id}", response_model=ChatMessageResponse)
async def get_message(message_id: str):
    """获取单条聊天消息"""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM chat_messages WHERE id = $1::uuid", message_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Message not found")
    return _row_to_message(row)


@router.delete("/messages/{message_id}", response_model=dict)
async def delete_message(message_id: str):
    """删除聊天消息"""
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM chat_messages WHERE id = $1::uuid", message_id
    )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Message not found")
    return {"deleted": True, "id": message_id}


@router.get("/conversation", response_model=ChatMessageListResponse)
async def get_conversation(
    party_a: str,
    party_b: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    """获取两方之间的对话消息 · 按时间正序"""
    pool = await get_pool()

    where_clause = (
        "WHERE (sender = $1 AND receiver = $2) OR (sender = $2 AND receiver = $1)"
    )

    count_sql = "SELECT COUNT(*) FROM chat_messages " + where_clause
    total = await pool.fetchval(count_sql, party_a, party_b)

    offset = (page - 1) * page_size
    list_sql = (
        "SELECT * FROM chat_messages " + where_clause
        + " ORDER BY created_at ASC"
        + " LIMIT $3 OFFSET $4"
    )
    rows = await pool.fetch(list_sql, party_a, party_b, page_size, offset)

    messages = [_row_to_message(r) for r in rows]
    return ChatMessageListResponse(
        messages=messages, total=total, page=page, page_size=page_size
    )

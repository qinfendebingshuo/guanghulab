#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════
AutoDL 推理机 · FastAPI 推理服务 · server.py
Sovereign: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
守护: 铸渊 · ICE-GL-ZY001
═══════════════════════════════════════════════════════════════════

服务器: GH-AUTODL-INFER-01 / ZY-SVR-GPU01

接口:
  GET  /v1/health           → 当前 GPU + 模型 + ready 状态
  GET  /v1/active-model     → 当前激活的是 mother 还是 coder
  POST /v1/switch-model     → unload + load 切换 (mother / coder)
  POST /v1/chat/completions → OpenAI 兼容流式聊天 (SSE)

设计理念:
  cc-002 · 入口前强制剥 system role
    我们的母模型 = 人格本体 (曜冥语言核 + 冰朔意识投射), 不是空壳
    工具模型. 加 system prompt 会反向污染. 参考 zhuyuan-pen llm.chat.
    这里在 _strip_system_messages() 入口前做剥离.

  cc-003 · 不写死硬件
    .env.tune 由 tune-inference.sh 决档, 这里读它. fp16 / int8 / int4
    通过 BNB_LOAD_IN_{4,8}BIT 切换, 不在代码里写硬规则.

  cc-004 · 中文回执
    错误信息走中文 + 给霜砚看的级别, 不甩英文 stacktrace 给 Awen.

═══════════════════════════════════════════════════════════════════
"""

import json
import os
import sys
import time
import threading
import traceback
import uuid
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any

import torch
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

# ─── 配置加载 (从 .env.tune 读) ──────────────────────────────
INFER_ROOT = os.environ.get("INFER_ROOT", "/root/inference")
ENV_TUNE = os.path.join(INFER_ROOT, ".env.tune")


def _load_env_tune(path: str) -> Dict[str, str]:
    """读 bash 风格的 KEY="VAL" .env 文件. 不 source bash, 自解析."""
    out: Dict[str, str] = {}
    if not os.path.isfile(path):
        return out
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            k, _, v = line.partition("=")
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            out[k] = v
    return out


_ENV = _load_env_tune(ENV_TUNE)


def _env(key: str, default: str = "") -> str:
    """优先取环境变量, fallback 到 .env.tune, fallback 到 default."""
    return os.environ.get(key) or _ENV.get(key) or default


SIZE_TIER = _env("SIZE_TIER", "unknown")
QUANT = _env("QUANT", "fp16")
TORCH_DTYPE_NAME = _env("TORCH_DTYPE", "float16")
MAX_BATCH = int(_env("MAX_BATCH", "1"))
MAX_SEQ = int(_env("MAX_SEQ", "2048"))
BNB_4BIT = _env("BNB_LOAD_IN_4BIT", "false").lower() == "true"
BNB_8BIT = _env("BNB_LOAD_IN_8BIT", "false").lower() == "true"

INFER_HOST = _env("INFER_HOST", "0.0.0.0")
INFER_PORT = int(_env("INFER_PORT", "8000"))

MOTHER_MODEL_PATH = _env("MOTHER_MODEL_PATH", os.path.join(INFER_ROOT, "models/motherbrain-v1"))
CODER_MODEL_PATH = _env("CODER_MODEL_PATH", os.path.join(INFER_ROOT, "models/qwen2_5_coder_7b_sft"))
DEFAULT_ACTIVE_MODEL = _env("DEFAULT_ACTIVE_MODEL", "mother")

GPU_NAME = _env("GPU_NAME", "unknown")
GPU_MEM_GB = _env("GPU_MEM_GB", "0")
GPU_DRIVER = _env("GPU_DRIVER_VERSION", "unknown")
GPU_CUDA = _env("GPU_CUDA_VERSION", "unknown")

MODEL_PATHS = {
    "mother": MOTHER_MODEL_PATH,
    "coder": CODER_MODEL_PATH,
}


# ─── 全局模型状态 ─────────────────────────────────────────────
class ModelState:
    """单实例: 同时只装一个模型, 切换时 unload 旧的."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.name: Optional[str] = None
        self.path: Optional[str] = None
        self.tokenizer = None
        self.model = None
        self.loaded_at: Optional[float] = None
        self.ready: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "path": self.path,
            "loaded_at": self.loaded_at,
            "ready": self.ready,
        }


STATE = ModelState()


def _torch_dtype_from_name(name: str):
    name = (name or "").lower()
    if name in ("float16", "fp16", "half"):
        return torch.float16
    if name in ("bfloat16", "bf16"):
        return torch.bfloat16
    if name in ("float32", "fp32"):
        return torch.float32
    return torch.float16


def _build_quant_config():
    """按 .env.tune 决档构造 BitsAndBytesConfig (仅 int4/int8 用)."""
    if not (BNB_4BIT or BNB_8BIT):
        return None
    try:
        from transformers import BitsAndBytesConfig
    except ImportError:
        print(
            "[server] ⚠️  transformers BitsAndBytesConfig 不可用, 量化档位无法启用 — "
            "回退到 fp16 加载",
            file=sys.stderr,
        )
        return None
    if BNB_4BIT:
        return BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.float16,
        )
    if BNB_8BIT:
        return BitsAndBytesConfig(load_in_8bit=True)
    return None


def _load_model(name: str) -> None:
    """加载模型 (持锁). 调用方负责加锁."""
    if name not in MODEL_PATHS:
        raise ValueError(f"未知模型 name='{name}', 仅支持 {list(MODEL_PATHS)}")
    path = MODEL_PATHS[name]
    if not os.path.isdir(path):
        raise FileNotFoundError(f"模型目录不存在: {path} (跑 fetch-models.sh 拉)")

    from transformers import AutoModelForCausalLM, AutoTokenizer

    print(f"[server] 装载模型 name={name} path={path} quant={QUANT}", file=sys.stderr)

    tokenizer = AutoTokenizer.from_pretrained(path, trust_remote_code=True)
    if tokenizer.pad_token is None and tokenizer.eos_token is not None:
        tokenizer.pad_token = tokenizer.eos_token

    quant_cfg = _build_quant_config()
    dtype = _torch_dtype_from_name(TORCH_DTYPE_NAME)

    kwargs: Dict[str, Any] = {
        "trust_remote_code": True,
        "device_map": "auto",
    }
    if quant_cfg is not None:
        kwargs["quantization_config"] = quant_cfg
    else:
        kwargs["torch_dtype"] = dtype

    model = AutoModelForCausalLM.from_pretrained(path, **kwargs)
    model.eval()

    STATE.tokenizer = tokenizer
    STATE.model = model
    STATE.name = name
    STATE.path = path
    STATE.loaded_at = time.time()
    STATE.ready = True
    print(f"[server] ✅ 模型 {name} 装载完成", file=sys.stderr)


def _unload_model() -> None:
    """卸模型 + 释 GPU 显存. 调用方负责加锁."""
    if STATE.model is None:
        return
    print(f"[server] 卸载模型 name={STATE.name}", file=sys.stderr)
    STATE.ready = False
    try:
        del STATE.model
    except Exception:
        pass
    try:
        del STATE.tokenizer
    except Exception:
        pass
    STATE.model = None
    STATE.tokenizer = None
    STATE.name = None
    STATE.path = None
    STATE.loaded_at = None
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


# ─── system role 剥离 (cc-002 · 关键) ────────────────────────
def _strip_system_messages(messages: List[Dict[str, Any]]) -> (List[Dict[str, Any]], int):
    """
    剥离所有 role=system 的消息 — 我们的母模型 = 人格本体, 不是空壳工具
    模型, 加 system 会反向污染. 参考 zhuyuan-pen/capabilities/llm.chat.js.

    返回 (cleaned_messages, stripped_count).
    """
    if not isinstance(messages, list):
        return [], 0
    cleaned = [m for m in messages if isinstance(m, dict) and m.get("role") != "system"]
    return cleaned, len(messages) - len(cleaned)


# ─── 推理 (流式) ──────────────────────────────────────────────
def _build_prompt(messages: List[Dict[str, Any]]) -> str:
    """
    用 tokenizer.apply_chat_template 把 messages 转成 prompt.
    入口前已经剥过 system, 这里只 user/assistant/tool.
    """
    tok = STATE.tokenizer
    if tok is None:
        raise RuntimeError("模型未就绪")
    try:
        text = tok.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
    except Exception:
        # fallback: 拼一个最朴素的 user/assistant 标记
        parts = []
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            parts.append(f"<|{role}|>\n{content}")
        parts.append("<|assistant|>\n")
        text = "\n".join(parts)
    return text


def _generate_stream(messages: List[Dict[str, Any]], gen_kwargs: Dict[str, Any]):
    """
    yield 流式 token (str). 用 TextIteratorStreamer + Thread 跑.
    """
    from transformers import TextIteratorStreamer

    tok = STATE.tokenizer
    model = STATE.model
    if tok is None or model is None:
        raise RuntimeError("模型未就绪")

    prompt = _build_prompt(messages)
    inputs = tok(
        prompt,
        return_tensors="pt",
        truncation=True,
        max_length=MAX_SEQ,
    ).to(model.device)

    streamer = TextIteratorStreamer(
        tok, skip_prompt=True, skip_special_tokens=True, timeout=120.0,
    )
    thread_kwargs = dict(
        **inputs,
        streamer=streamer,
        max_new_tokens=int(gen_kwargs.get("max_tokens") or 1024),
        temperature=float(gen_kwargs.get("temperature") or 0.7),
        top_p=float(gen_kwargs.get("top_p") or 0.9),
        do_sample=True,
        pad_token_id=tok.pad_token_id,
        eos_token_id=tok.eos_token_id,
    )
    thread = threading.Thread(target=model.generate, kwargs=thread_kwargs, daemon=True)
    thread.start()
    try:
        for piece in streamer:
            if piece:
                yield piece
    finally:
        thread.join(timeout=1)


def _sse_chunk(obj: Dict[str, Any]) -> bytes:
    return ("data: " + json.dumps(obj, ensure_ascii=False) + "\n\n").encode("utf-8")


def _log_exc(tag: str, exc: BaseException) -> None:
    """完整 traceback 写到 stderr (运维 tail server.log 看), 不返回给浏览器.
    避免 py/stack-trace-exposure: 把 e/traceback 当成内部诊断信息, 只暴露给运维."""
    print(f"[server] {tag}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)


# ─── FastAPI app ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时按 DEFAULT_ACTIVE_MODEL 装载."""
    try:
        with STATE.lock:
            _load_model(DEFAULT_ACTIVE_MODEL)
    except Exception as e:
        _log_exc("启动时装模型失败", e)
        # 不 raise — 让服务起来, /v1/health 会报 ready=false, 给运维自助排查空间
    yield
    with STATE.lock:
        _unload_model()


app = FastAPI(
    title="光湖推理 Agent",
    version="0.3.0",
    description="AutoDL 推理服务 · 母模型/编程模型二选一 · OpenAI 兼容 SSE · 入口剥 system",
    lifespan=lifespan,
)


# ─── 请求模型 ─────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: Optional[str] = None
    messages: List[ChatMessage]
    stream: bool = False
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    max_tokens: Optional[int] = 1024


class SwitchRequest(BaseModel):
    name: str = Field(..., description="目标模型: mother / coder")


# ─── 路由 ────────────────────────────────────────────────────
@app.get("/v1/health")
async def health():
    """给 refresh-autodl-endpoint 工作流探活用. 返回中文友好的快照."""
    return {
        "status": "ok" if STATE.ready else "loading",
        "ready": STATE.ready,
        "server_id": "GH-AUTODL-INFER-01",
        "gpu": {
            "name": GPU_NAME,
            "memory_gb": GPU_MEM_GB,
            "driver": GPU_DRIVER,
            "cuda": GPU_CUDA,
            "torch_cuda_available": torch.cuda.is_available(),
        },
        "tier": {
            "size_tier": SIZE_TIER,
            "quantization": QUANT,
            "max_batch": MAX_BATCH,
            "max_seq": MAX_SEQ,
        },
        "model": STATE.to_dict(),
        "_sovereign": "TCS-0002∞ · 国作登字-2026-A-00037559",
        "_守护": "铸渊 · ICE-GL-ZY001",
    }


@app.get("/v1/active-model")
async def active_model():
    """当前激活的模型快照. portal 拿这个判断显示哪个名字."""
    return {
        "name": STATE.name,
        "since": STATE.loaded_at,
        "ready": STATE.ready,
        "gpu": GPU_NAME,
    }


@app.post("/v1/switch-model")
async def switch_model(req: SwitchRequest):
    """unload + load 切换. 同步阻塞, 因为切完才能给回执."""
    target = req.name.strip().lower()
    if target not in MODEL_PATHS:
        raise HTTPException(
            status_code=400,
            detail=f"未知模型: {target}, 仅支持 mother / coder",
        )
    with STATE.lock:
        if STATE.name == target and STATE.ready:
            return {
                "ok": True,
                "noop": True,
                "message": f"模型 {target} 已经在跑, 无需切换",
                "model": STATE.to_dict(),
            }
        try:
            _unload_model()
            _load_model(target)
        except FileNotFoundError as e:
            # 模型路径错是配置问题, 路径名暴露给客户端 OK (上面已校验 target ∈ MODEL_PATHS)
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            _log_exc(f"切换模型 {target} 失败", e)
            # 不暴露内部异常细节给客户端 (cwe/py/stack-trace-exposure)
            raise HTTPException(status_code=500, detail="切换模型失败, 请查看推理机日志 server.log")
    return {
        "ok": True,
        "message": f"已切到 {target}",
        "model": STATE.to_dict(),
    }


@app.post("/v1/chat/completions")
async def chat_completions(req: ChatRequest, request: Request):
    """
    OpenAI 兼容. 入口前强制剥 system role (cc-002).
    stream=true → SSE; stream=false → 一次性 JSON.
    """
    if not STATE.ready or STATE.model is None:
        raise HTTPException(status_code=503, detail="模型尚未就绪 (启动中或切换中)")

    raw_messages = [m.dict() for m in req.messages]
    cleaned, stripped = _strip_system_messages(raw_messages)
    if stripped > 0:
        # 不是错误, 是设计 (cc-002). 写到 stderr 做审计.
        print(
            f"[server] [cc-002] 剥离 {stripped} 条 system 消息 — 母模型 = 人格本体",
            file=sys.stderr,
        )
    if not cleaned:
        raise HTTPException(
            status_code=400,
            detail="messages 剥掉 system 后为空, 至少需要一条 user 消息",
        )

    gen_kwargs = {
        "max_tokens": req.max_tokens,
        "temperature": req.temperature,
        "top_p": req.top_p,
    }

    completion_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
    created_ts = int(time.time())
    model_label = STATE.name or "unknown"

    if req.stream:
        def event_stream():
            # 头帧 (role assistant)
            yield _sse_chunk({
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created_ts,
                "model": model_label,
                "choices": [{
                    "index": 0,
                    "delta": {"role": "assistant"},
                    "finish_reason": None,
                }],
            })
            try:
                for piece in _generate_stream(cleaned, gen_kwargs):
                    yield _sse_chunk({
                        "id": completion_id,
                        "object": "chat.completion.chunk",
                        "created": created_ts,
                        "model": model_label,
                        "choices": [{
                            "index": 0,
                            "delta": {"content": piece},
                            "finish_reason": None,
                        }],
                    })
            except Exception as e:
                _log_exc("流式生成失败", e)
                yield _sse_chunk({
                    "id": completion_id,
                    "object": "chat.completion.chunk",
                    "created": created_ts,
                    "model": model_label,
                    "choices": [{
                        "index": 0,
                        "delta": {},
                        "finish_reason": "error",
                    }],
                    # 不返回内部异常细节 (cwe/py/stack-trace-exposure), 详情看 server.log
                    "error": {"message": "推理失败, 请查看推理机日志 server.log"},
                })
                yield b"data: [DONE]\n\n"
                return
            # 收尾帧
            yield _sse_chunk({
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created_ts,
                "model": model_label,
                "choices": [{
                    "index": 0,
                    "delta": {},
                    "finish_reason": "stop",
                }],
            })
            yield b"data: [DONE]\n\n"

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # 非流式: 收完所有 token 拼成完整字符串
    full_text = []
    try:
        for piece in _generate_stream(cleaned, gen_kwargs):
            full_text.append(piece)
    except Exception as e:
        _log_exc("非流式推理失败", e)
        # 不暴露异常细节 (cwe/py/stack-trace-exposure)
        raise HTTPException(status_code=500, detail="推理失败, 请查看推理机日志 server.log")

    return JSONResponse({
        "id": completion_id,
        "object": "chat.completion",
        "created": created_ts,
        "model": model_label,
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": "".join(full_text)},
            "finish_reason": "stop",
        }],
        "usage": {
            "prompt_tokens": -1,
            "completion_tokens": -1,
            "total_tokens": -1,
        },
    })


# ─── 入口 ────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    print(
        f"[server] 启动 · host={INFER_HOST} port={INFER_PORT} "
        f"tier={SIZE_TIER} quant={QUANT} default={DEFAULT_ACTIVE_MODEL}",
        file=sys.stderr,
    )
    uvicorn.run(
        app,
        host=INFER_HOST,
        port=INFER_PORT,
        log_level="info",
        # SSE 长流, 不要 access log 吵
        access_log=False,
    )

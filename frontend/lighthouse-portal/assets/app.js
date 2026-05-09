/*
 * 光湖 Portal · 前端逻辑
 * 守护: 铸渊 · ICE-GL-ZY001
 * 主权: TCS-0002∞ · 国作登字-2026-A-00037559
 *
 * 因果链:
 *   cc-002 · 永远不在 messages 里塞 system role.
 *           前端只发 [{role:"user", content:...}], 后端不补, 推理端剥. 三道关.
 *   cc-004 · 中文交互, 错误信息也走中文, 不甩英文给团队.
 *
 * 不依赖任何前端框架, 不走 CDN. 走原生 fetch + ReadableStream 解析 SSE
 * (因为 EventSource 不能发 POST, 我们要发 messages 体).
 */
(function () {
  "use strict";

  // ─── 状态 ───
  const state = {
    activeModel: "mother", // mother | coder
    convId: null,
    convs: [],
    sending: false,
    abort: null
  };

  // ─── DOM ───
  const $ = (id) => document.getElementById(id);
  const elHealth = $("health-pill");
  const elConvList = $("conv-list");
  const elChatScroll = $("chat-scroll");
  const elChatEmpty = $("chat-empty");
  const elComposer = $("composer");
  const elInput = $("composer-input");
  const elBtnSend = $("btn-send");
  const elBtnNew = $("btn-new-conv");
  const elTabMother = $("tab-mother");
  const elTabCoder = $("tab-coder");
  const elRightTitle = $("right-title");
  const elCtxCards = $("ctx-cards");

  // ─── 工具 ───
  const escapeHtml = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  function fmtTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function setHealth(text, cls) {
    elHealth.textContent = text;
    elHealth.classList.remove("ok", "bad");
    if (cls) elHealth.classList.add(cls);
  }

  // ─── API ───
  async function api(path, opts) {
    const res = await fetch(path, opts);
    if (!res.ok) {
      let msg = `请求失败 (${res.status})`;
      try {
        const j = await res.json();
        if (j && j.message) msg = j.message;
      } catch (_) {}
      throw new Error(msg);
    }
    return res.json();
  }

  async function loadHealth() {
    try {
      const j = await api("/api/health");
      if (j.inference && j.inference.ready) {
        setHealth(`推理端就绪 · ${j.inference.model || "?"}`, "ok");
      } else {
        setHealth("推理端未就绪", "bad");
      }
    } catch (e) {
      setHealth("Portal 离线", "bad");
    }
  }

  async function loadActiveModel() {
    try {
      const j = await api("/api/active-model");
      state.activeModel = j.name || "mother";
    } catch (_) {
      state.activeModel = "mother";
    }
    syncTabUI();
    loadRightContext();
  }

  async function setActiveModel(name) {
    if (state.activeModel === name) return;
    state.activeModel = name;
    syncTabUI();
    loadRightContext();
    try {
      await api("/api/active-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
    } catch (e) {
      // 切换失败时不影响前端使用 (推理端可能没起), 提示给用户但保持 UI 状态
      setHealth(`切模型失败: ${e.message}`, "bad");
    }
  }

  function syncTabUI() {
    const isMother = state.activeModel === "mother";
    elTabMother.classList.toggle("tab-active", isMother);
    elTabCoder.classList.toggle("tab-active", !isMother);
    elTabMother.setAttribute("aria-selected", String(isMother));
    elTabCoder.setAttribute("aria-selected", String(!isMother));
    elRightTitle.textContent = isMother ? "人格层 · 数据库" : "开发层 · 模块注册表";
  }

  async function loadConversations() {
    try {
      const j = await api("/api/conversations");
      state.convs = j.items || [];
    } catch (_) {
      state.convs = [];
    }
    renderConvList();
  }

  function renderConvList() {
    if (!state.convs.length) {
      elConvList.innerHTML = '<div class="empty">暂无对话</div>';
      return;
    }
    elConvList.innerHTML = "";
    for (const c of state.convs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "conv-item" + (c.id === state.convId ? " active" : "");
      btn.innerHTML =
        `<span class="conv-title">${escapeHtml(c.title || "(未命名)")}</span>` +
        `<span class="conv-meta">${escapeHtml(c.active_model === "coder" ? "开发" : "人格")} · ${escapeHtml(fmtTime(c.updated_at))}</span>`;
      btn.addEventListener("click", () => openConversation(c.id));
      elConvList.appendChild(btn);
    }
  }

  async function openConversation(id) {
    state.convId = id;
    renderConvList();
    elChatScroll.innerHTML = "";
    elChatEmpty.style.display = "none";
    try {
      const j = await api(`/api/conversations/${encodeURIComponent(id)}/messages`);
      const conv = (j && j.conversation) || {};
      if (conv.active_model && conv.active_model !== state.activeModel) {
        await setActiveModel(conv.active_model);
      }
      const items = j.items || [];
      for (const m of items) renderMessage(m.role, m.content);
      scrollChatToBottom();
    } catch (e) {
      renderError(e.message || "加载失败");
    }
  }

  async function newConversation() {
    try {
      const j = await api("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active_model: state.activeModel })
      });
      state.convId = j.id;
      await loadConversations();
      elChatScroll.innerHTML = "";
      elChatEmpty.style.display = "";
    } catch (e) {
      renderError(e.message || "新建失败");
    }
  }

  function renderMessage(role, content) {
    elChatEmpty.style.display = "none";
    const div = document.createElement("div");
    div.className = "msg msg-" + (role === "user" ? "user" : "asst");
    div.textContent = content || "";
    elChatScroll.appendChild(div);
    return div;
  }

  function renderError(msg) {
    elChatEmpty.style.display = "none";
    const div = document.createElement("div");
    div.className = "msg msg-error";
    div.textContent = "⚠️ " + msg;
    elChatScroll.appendChild(div);
    scrollChatToBottom();
  }

  function scrollChatToBottom() {
    elChatScroll.scrollTop = elChatScroll.scrollHeight;
  }

  // ─── 发送消息 (SSE byte-pipe) ───
  async function sendMessage(text) {
    if (!text || !text.trim() || state.sending) return;
    if (!state.convId) {
      await newConversation();
      if (!state.convId) return;
    }
    state.sending = true;
    elBtnSend.disabled = true;
    elInput.disabled = true;

    renderMessage("user", text);
    const asstEl = renderMessage("assistant", "");
    asstEl.classList.add("streaming");
    scrollChatToBottom();

    // cc-002 落地: 前端 messages 永远只有 user/assistant, 永不传 system
    const payload = {
      conversation_id: state.convId,
      messages: [{ role: "user", content: text }]
    };

    const ctrl = new AbortController();
    state.abort = ctrl;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      if (!res.ok || !res.body) {
        let msg = `推理端口未通 (${res.status})`;
        try { const j = await res.json(); if (j && j.message) msg = j.message; } catch (_) {}
        throw new Error(msg);
      }

      // 解析 OpenAI 兼容 SSE: data: {...}\n\n
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buf = "";
      let acc = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) buf += decoder.decode(value, { stream: !done });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of block.split("\n")) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const data = t.slice(5).trim();
          if (data === "[DONE]") { done = true; break; }
          try {
            const j = JSON.parse(data);
            const delta = j && j.choices && j.choices[0] && j.choices[0].delta;
            const piece = delta && delta.content;
            if (piece) {
              acc += piece;
              asstEl.textContent = acc;
              scrollChatToBottom();
            }
          } catch (_) {
            // 不是 JSON 也忽略, byte-pipe 兼容空 keepalive
          }
        }
        if (done) break; // 收到 [DONE] 后立刻跳出, 不再消化剩余 buf
      }
      }
      asstEl.classList.remove("streaming");
      // 历史在浏览器一刷就会从后端拉, 不需要这里写
    } catch (e) {
      asstEl.remove();
      renderError(e.message || "发送失败");
    } finally {
      state.sending = false;
      state.abort = null;
      elBtnSend.disabled = false;
      elInput.disabled = false;
      elInput.focus();
      // 刷新左栏 (新会话/标题更新)
      loadConversations();
    }
  }

  // ─── 右栏: 看模式分 ───
  async function loadRightContext() {
    elCtxCards.innerHTML = '<div class="empty">加载中…</div>';
    const path = state.activeModel === "coder" ? "/api/manifest" : "/api/persona-db";
    try {
      const j = await api(path);
      const items = j.items || [];
      if (!items.length) {
        elCtxCards.innerHTML = '<div class="empty">暂无数据</div>';
        return;
      }
      elCtxCards.innerHTML = "";
      for (const it of items) {
        const card = document.createElement("div");
        card.className = "ctx-card";
        const tags = (it.tags || []).map((t) => `<span class="ctx-tag">${escapeHtml(t)}</span>`).join("");
        card.innerHTML =
          `<h4>${escapeHtml(it.title || "(未命名)")}</h4>` +
          (tags ? `<p>${tags}</p>` : "") +
          (it.summary ? `<p>${escapeHtml(it.summary)}</p>` : "");
        elCtxCards.appendChild(card);
      }
    } catch (e) {
      elCtxCards.innerHTML = `<div class="empty">右栏加载失败: ${escapeHtml(e.message || "")}</div>`;
    }
  }

  // ─── 事件绑定 ───
  elTabMother.addEventListener("click", () => setActiveModel("mother"));
  elTabCoder.addEventListener("click", () => setActiveModel("coder"));
  elBtnNew.addEventListener("click", newConversation);

  elComposer.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = elInput.value;
    if (!text.trim()) return;
    elInput.value = "";
    sendMessage(text.trim());
  });

  elInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      elComposer.requestSubmit();
    }
  });

  // ─── 启动 ───
  (async function init() {
    await Promise.all([loadHealth(), loadActiveModel(), loadConversations()]);
    setInterval(loadHealth, 30000);
  })();
})();

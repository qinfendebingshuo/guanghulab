/*
 * 光湖密钥管理页 · 前端逻辑 (vanilla JS)
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * 不引入框架. 2C2G 不需要打包构建.
 *
 * 流程:
 *   1. 拉 manifest (按 workflow 分组的元数据)
 *   2. 拉 list (已配置的 key + 遮罩值)
 *   3. 渲染分组 + 输入框
 *   4. 单条保存 → POST /admin/secrets/:key
 *   5. AutoDL 一键 → POST /admin/secrets/autodl/save_and_refresh
 */
"use strict";

const API_BASE = "/admin/secrets";

const $ = (q, r = document) => r.querySelector(q);
const $$ = (q, r = document) => Array.from(r.querySelectorAll(q));

function toast(msg, kind = "") {
  const t = $("#toast");
  if (!t) return;
  t.className = "toast show " + kind;
  t.textContent = msg;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    t.className = "toast";
  }, 4500);
}

async function api(method, path, body) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const r = await fetch(path, init);
  let json = null;
  try {
    json = await r.json();
  } catch (_) {
    /* ignore */
  }
  return { status: r.status, ok: r.ok, body: json };
}

function statusBadge(group, configuredKeys) {
  const required = group.secrets.filter((s) => s.level === "required");
  const missing = required.filter((s) => !configuredKeys.includes(s.name));
  if (missing.length) return { cls: "err", text: "缺 " + missing.length + " 项必填" };
  const stages = group.secrets.filter((s) => s.level !== "required");
  const someOptional = stages.some((s) => configuredKeys.includes(s.name));
  if (required.length === 0 && !someOptional) {
    return { cls: "warn", text: "未填" };
  }
  return { cls: "ok", text: "已就位" };
}

function renderRow(s, current) {
  const row = document.createElement("div");
  row.className = "secret-row";

  const meta = document.createElement("div");
  meta.className = "secret-meta";
  meta.innerHTML = `
    <div class="name">${s.name}</div>
    <div class="label">${escapeHtml(s.用途 || s.name)}<span class="level ${s.level}">${levelLabel(s.level)}</span></div>
    ${s.如何配置 ? `<div class="hint">${escapeHtml(s.如何配置)}</div>` : ""}
    ${s.default_hint ? `<div class="hint">默认值: <code>${escapeHtml(s.default_hint)}</code></div>` : ""}
    ${s.强校验 ? `<div class="hint">强校验: <code>${escapeHtml(s.强校验)}</code></div>` : ""}
    ${s.stages && s.stages.length ? `<div class="hint">仅 stage 用: ${s.stages.join(", ")}</div>` : ""}
  `;

  const inputBox = document.createElement("div");
  inputBox.className = "secret-input";

  const isLong = /KEY|TOKEN|SECRET/.test(s.name) && !/PASS$/.test(s.name);
  const useTextarea = s.name === "ZY_LIGHTHOUSE_KEY" || s.name === "ZY_CN_SERVER_KEY" || s.name === "ZY_GPU_KEY" || s.name === "ZY_LIGHTHOUSE_BACKUP_KEY";

  let inputEl;
  if (useTextarea) {
    inputEl = document.createElement("textarea");
    inputEl.rows = 4;
    inputEl.placeholder = "整段贴, 包括 -----BEGIN/END----- 行";
  } else {
    inputEl = document.createElement("input");
    inputEl.type = isLong ? "password" : "text";
    inputEl.placeholder = s.default_hint || (s.level === "required" ? "(必填)" : "(选填)");
  }
  inputEl.dataset.key = s.name;
  inputBox.appendChild(inputEl);

  const status = document.createElement("div");
  if (current && current.configured) {
    status.className = "masked";
    status.textContent = "当前: " + current.masked + " (长度 " + current.length + ")";
  } else {
    status.className = "placeholder";
    status.textContent = "尚未配置";
  }
  inputBox.appendChild(status);

  const actions = document.createElement("div");
  actions.className = "secret-actions";

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "保存";
  saveBtn.onclick = () => saveOne(s.name, inputEl);
  actions.appendChild(saveBtn);

  if (current && current.configured) {
    const delBtn = document.createElement("button");
    delBtn.className = "danger";
    delBtn.textContent = "删除";
    delBtn.onclick = () => deleteOne(s.name);
    actions.appendChild(delBtn);
  }

  row.appendChild(meta);
  row.appendChild(inputBox);
  row.appendChild(actions);
  return row;
}

function renderGroup(group, configuredKeys, listValues) {
  const wrap = document.createElement("section");
  wrap.className = "group";
  const status = statusBadge(group, configuredKeys);
  wrap.innerHTML = `
    <h2>
      <span>${escapeHtml(group.describe)}</span>
      <span class="badge ${status.cls}">${status.text}</span>
      <span class="group-tag">${group.workflow}</span>
    </h2>
    ${group.subject ? `<p class="group-subject">${escapeHtml(group.subject)}</p>` : ""}
  `;

  for (const s of group.secrets) {
    wrap.appendChild(renderRow(s, listValues[s.name]));
  }

  if (group.group_action === "save_and_refresh") {
    const ga = document.createElement("div");
    ga.className = "group-action";
    ga.innerHTML = `
      <h3>🔄 一键: 保存并刷新推理端点</h3>
      <p>把上面的 host / port (必填) 和 user / pass (选填) 一起存进 vault, 然后立即:
         (1) 探活 https://host:port/v1/health (2) 写 portal 的 inference-endpoint.json (3) pm2 reload 让 portal 立刻读到新端点。</p>
    `;
    const btn = document.createElement("button");
    btn.textContent = "保存并刷新推理端点";
    btn.onclick = () => autodlSaveAndRefresh(wrap);
    ga.appendChild(btn);
    wrap.appendChild(ga);
  }

  return wrap;
}

async function saveOne(key, inputEl) {
  const v = inputEl.value;
  if (v === "") {
    toast("还没填值, 没保存", "err");
    return;
  }
  inputEl.disabled = true;
  const r = await api("POST", `${API_BASE}/${encodeURIComponent(key)}`, { value: v });
  inputEl.disabled = false;
  if (r.ok && r.body && r.body.ok) {
    toast("✅ 已保存 · " + (r.body.message || key), "ok");
    inputEl.value = "";
    await reload();
  } else {
    toast("❌ 保存失败: " + (r.body && r.body.message ? r.body.message : "HTTP " + r.status), "err");
  }
}

async function deleteOne(key) {
  if (!confirm(`删除 ${key} ? 删除后只能重填.`)) return;
  const r = await api("DELETE", `${API_BASE}/${encodeURIComponent(key)}`);
  if (r.ok) {
    toast("已删除 · " + key, "ok");
    await reload();
  } else {
    toast("删除失败: " + (r.body && r.body.message ? r.body.message : "HTTP " + r.status), "err");
  }
}

async function autodlSaveAndRefresh(groupEl) {
  const inputs = $$('input,textarea', groupEl);
  const map = {};
  for (const i of inputs) map[i.dataset.key] = i.value;
  const host = map.ZY_AUTODL_HOST;
  const port = map.ZY_AUTODL_PORT;
  if (!host || !port) {
    toast("ZY_AUTODL_HOST 和 ZY_AUTODL_PORT 必填才能刷新端点", "err");
    return;
  }
  const btn = $('button', groupEl.querySelector('.group-action'));
  btn.disabled = true;
  btn.textContent = "刷新中… (探活最多 30 秒)";
  const r = await api("POST", `${API_BASE}/autodl/save_and_refresh`, {
    host,
    port,
    user: map.ZY_AUTODL_USER || undefined,
    pass: map.ZY_AUTODL_PASS || undefined,
    scheme: "https"
  });
  btn.disabled = false;
  btn.textContent = "保存并刷新推理端点";
  if (r.ok && r.body && r.body.ok) {
    toast("✅ " + r.body.message, "ok");
    for (const i of inputs) i.value = "";
    await reload();
  } else if (r.body && r.body.vault_saved) {
    toast(
      "⚠️ vault 已落, 但端点没刷成: " + (r.body.message || "推理端不通"),
      "err"
    );
    await reload();
  } else {
    toast("❌ 刷新失败: " + (r.body && r.body.message ? r.body.message : "HTTP " + r.status), "err");
  }
}

async function reload() {
  const [mfRes, listRes] = await Promise.all([
    api("GET", `${API_BASE}/manifest`),
    api("GET", `${API_BASE}/`)
  ]);
  if (!mfRes.ok || !listRes.ok) {
    $("#vault-status").className = "badge err";
    $("#vault-status").textContent = "加载失败 (HTTP " + mfRes.status + " / " + listRes.status + ")";
    $("#groups").innerHTML = '<p class="loading-hint">加载失败. 检查 nginx + pm2 状态后刷新页面.</p>';
    return;
  }
  const groups = mfRes.body.groups || [];
  const configuredKeys = listRes.body.configured_keys || [];
  const values = listRes.body.values || {};

  $("#vault-status").className = "badge ok";
  $("#vault-status").textContent = "vault 在线 · " + configuredKeys.length + " 项已配置";

  const wrap = $("#groups");
  wrap.innerHTML = "";
  for (const g of groups) {
    wrap.appendChild(renderGroup(g, configuredKeys, values));
  }
}

function levelLabel(lv) {
  if (lv === "required") return "必填";
  if (lv === "required_on_stage") return "阶段必填";
  if (lv === "required_on_target") return "目标必填";
  return "选填";
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

reload().catch((e) => {
  toast("初始化失败: " + e.message, "err");
});

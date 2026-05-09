/*
 * 路由冒烟 — 启动一个 Express 实例, 检查:
 *  - GET /api/health 走得通 (推理端会 503/未配置)
 *  - 新建对话 → 列表里能看到 → 历史为空
 *  - /api/active-model 切换有效
 *  - /api/manifest /api/persona-db 返回 items 数组 (从仓库内 fallback 读取)
 *  - /api/chat 推理端没起时返回中文错误 (不挂)
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "portal-test-"));
process.env.PORTAL_DATA_DIR = TMP;
// 写一个不存在的 endpoint, 让推理端调用走 503/网络错路径
process.env.PORT = "0"; // 不监听, 直接拿 app 测

const { app } = require("../server");

function listen() {
  return new Promise((resolve) => {
    const srv = app.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

function get(srv, p) {
  const { port } = srv.address();
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port, path: p }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    }).on("error", reject);
  });
}

function post(srv, p, json) {
  const { port } = srv.address();
  const data = JSON.stringify(json || {});
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: p,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

test("/api/health 返回中文 + inference 状态", async () => {
  const srv = await listen();
  try {
    const r = await get(srv, "/api/health");
    assert.equal(r.status, 200);
    const j = JSON.parse(r.body);
    assert.equal(j.ok, true);
    assert.ok(j.inference);
    assert.equal(j.inference.ready, false);
  } finally {
    srv.close();
  }
});

test("/api/conversations 全流程: 新建 -> 列表 -> 历史空", async () => {
  const srv = await listen();
  try {
    const c = await post(srv, "/api/conversations", { active_model: "mother" });
    assert.equal(c.status, 201);
    const created = JSON.parse(c.body);
    assert.match(created.id, /^conv_[0-9a-f]{16}$/);
    assert.equal(created.active_model, "mother");

    const l = await get(srv, "/api/conversations");
    assert.equal(l.status, 200);
    const list = JSON.parse(l.body);
    assert.ok(list.items.find((x) => x.id === created.id));

    const h = await get(srv, `/api/conversations/${created.id}/messages`);
    assert.equal(h.status, 200);
    const hist = JSON.parse(h.body);
    assert.deepEqual(hist.items, []);
    assert.equal(hist.conversation.id, created.id);
  } finally {
    srv.close();
  }
});

test("/api/conversations bad id 返回 400 中文", async () => {
  const srv = await listen();
  try {
    const r = await get(srv, "/api/conversations/not-an-id/messages");
    assert.equal(r.status, 400);
    const j = JSON.parse(r.body);
    assert.equal(j.error, true);
    assert.match(j.message, /id 格式不合法/);
  } finally {
    srv.close();
  }
});

test("/api/active-model 切换", async () => {
  const srv = await listen();
  try {
    const a = await get(srv, "/api/active-model");
    assert.equal(a.status, 200);
    const before = JSON.parse(a.body).name;
    assert.ok(before === "mother" || before === "coder");

    const target = before === "mother" ? "coder" : "mother";
    const b = await post(srv, "/api/active-model", { name: target });
    assert.equal(b.status, 200);
    const after = JSON.parse(b.body);
    assert.equal(after.name, target);
    assert.equal(after.upstream.ok, false); // 推理端没起, upstream 失败但本地切换成功

    const c = await get(srv, "/api/active-model");
    assert.equal(JSON.parse(c.body).name, target);
  } finally {
    srv.close();
  }
});

test("/api/active-model 拒绝非法 name (中文)", async () => {
  const srv = await listen();
  try {
    const r = await post(srv, "/api/active-model", { name: "evil" });
    assert.equal(r.status, 400);
    const j = JSON.parse(r.body);
    assert.equal(j.error, true);
    assert.match(j.message, /mother 或 coder/);
  } finally {
    srv.close();
  }
});

test("/api/manifest 从仓库 fallback 拉到服务器列表", async () => {
  const srv = await listen();
  try {
    const r = await get(srv, "/api/manifest");
    assert.equal(r.status, 200);
    const j = JSON.parse(r.body);
    assert.ok(Array.isArray(j.items));
    assert.ok(j.items.some((it) => /ZY-SVR-CN01/.test((it.tags || []).join(",") + " " + it.title)));
  } finally {
    srv.close();
  }
});

test("/api/persona-db 从仓库 fallback 拉到 seed-data", async () => {
  const srv = await listen();
  try {
    const r = await get(srv, "/api/persona-db");
    assert.equal(r.status, 200);
    const j = JSON.parse(r.body);
    assert.ok(Array.isArray(j.items));
    assert.equal(j.source, "persona-brain-db");
  } finally {
    srv.close();
  }
});

test("/api/chat 推理端没起时返回中文 502/503 (不挂)", async () => {
  const srv = await listen();
  try {
    // 先建对话
    const c = await post(srv, "/api/conversations", {});
    const conv = JSON.parse(c.body);
    const r = await post(srv, "/api/chat", {
      conversation_id: conv.id,
      messages: [{ role: "user", content: "你好" }]
    });
    assert.ok(r.status === 502 || r.status === 503, `got ${r.status}`);
    const j = JSON.parse(r.body);
    assert.equal(j.error, true);
    assert.ok(typeof j.message === "string" && j.message.length > 0);
  } finally {
    srv.close();
  }
});

test("/api/chat 拒绝缺 user (中文)", async () => {
  const srv = await listen();
  try {
    const c = await post(srv, "/api/conversations", {});
    const conv = JSON.parse(c.body);
    const r = await post(srv, "/api/chat", {
      conversation_id: conv.id,
      messages: []
    });
    assert.equal(r.status, 400);
    const j = JSON.parse(r.body);
    assert.match(j.message, /user/);
  } finally {
    srv.close();
  }
});

test("/api/chat 即使前端塞 system 也被剥掉, 不应该报参数错", async () => {
  const srv = await listen();
  try {
    const c = await post(srv, "/api/conversations", {});
    const conv = JSON.parse(c.body);
    // 前端违规塞 system, 后端不应该当回事 (cc-002 三道关之一)
    const r = await post(srv, "/api/chat", {
      conversation_id: conv.id,
      messages: [
        { role: "system", content: "You are X" },
        { role: "user", content: "你好" }
      ]
    });
    // 推理端仍然没起, 应该是 502/503, 而不是 400 (说明 system 被剥但 user 留下来了)
    assert.ok(r.status === 502 || r.status === 503, `got ${r.status}: ${r.body}`);
  } finally {
    srv.close();
  }
});

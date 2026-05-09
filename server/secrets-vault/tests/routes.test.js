/*
 * routes/secrets.js + routes/internal.js · 路由烟测
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * 跑 Express app 实例 + supertest-like 风格 (用 http.request 直连本机端口).
 * 不依赖 supertest, 只用 Node 内置.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

// 测试用 manifest (不污染主清单)
function makeTempManifest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vault-mft-"));
  const p = path.join(dir, "secrets-manifest.json");
  fs.writeFileSync(
    p,
    JSON.stringify({
      version: "test",
      workflows: {
        "test-flow": {
          _describe: "测试流",
          secrets: [
            { name: "ZY_TEST_SIMPLE", level: "required", 用途: "测试用" },
            {
              name: "ZY_TEST_STRONG",
              level: "required",
              用途: "强校验测试",
              强校验: "length>=12"
            }
          ]
        }
      }
    })
  );
  return { dir, manifestPath: p };
}

function startApp() {
  const tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), "vault-routes-"));
  const tmpEndpoint = path.join(tmpVault, "inference-endpoint.json");
  const { manifestPath } = makeTempManifest();

  process.env.VAULT_DIR = tmpVault;
  process.env.INFERENCE_ENDPOINT_PATH = tmpEndpoint;
  process.env.VAULT_MANIFEST_PATH = manifestPath;
  process.env.VAULT_SKIP_PM_RELOAD = "1";

  // require lazily 让 env 先生效
  delete require.cache[require.resolve("../server")];
  const { app } = require("../server");
  return { app, tmpVault, tmpEndpoint, manifestPath };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

function req(port, method, path_, body) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : JSON.stringify(body);
    const r = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path: path_,
        headers: data
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
          : {}
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          let json = null;
          try {
            json = JSON.parse(buf);
          } catch (_) {
            /* ignore */
          }
          resolve({ status: res.statusCode, body: json, raw: buf });
        });
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

test("GET /admin/__healthz 返回 vault 状态", async () => {
  const ctx = startApp();
  const { server, port } = await listen(ctx.app);
  try {
    const r = await req(port, "GET", "/admin/__healthz");
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.ok, true);
    assert.strictEqual(r.body.role, "secrets-vault");
    assert.strictEqual(r.body.has_master, true);
  } finally {
    server.close();
  }
});

test("GET /admin/secrets/manifest 按 workflow 分组", async () => {
  const ctx = startApp();
  const { server, port } = await listen(ctx.app);
  try {
    const r = await req(port, "GET", "/admin/secrets/manifest");
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.body.groups));
    const tf = r.body.groups.find((g) => g.workflow === "test-flow");
    assert.ok(tf, "应包含 test-flow 组");
    assert.strictEqual(tf.secrets.length, 2);
    assert.strictEqual(tf.secrets[0].用途, "测试用");
  } finally {
    server.close();
  }
});

test("POST /admin/secrets/:key — 白名单外拒绝", async () => {
  const ctx = startApp();
  const { server, port } = await listen(ctx.app);
  try {
    const r = await req(port, "POST", "/admin/secrets/RANDOM_KEY_NAME", { value: "v" });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, "unknown_key");
    assert.ok(/中文|不在.*白名单/.test(r.body.message), "应有中文回执");
  } finally {
    server.close();
  }
});

test("POST /admin/secrets/:key — key 名格式错拒绝", async () => {
  const ctx = startApp();
  const { server, port } = await listen(ctx.app);
  try {
    const r = await req(port, "POST", "/admin/secrets/lowercase_bad", { value: "v" });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, "invalid_key");
  } finally {
    server.close();
  }
});

test("POST /admin/secrets/:key — 强校验长度不够拒绝", async () => {
  const ctx = startApp();
  const { server, port } = await listen(ctx.app);
  try {
    const r = await req(port, "POST", "/admin/secrets/ZY_TEST_STRONG", { value: "short" });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, "weak_value");
  } finally {
    server.close();
  }
});

test("POST + GET + DELETE 完整往返 (值不返回明文, 只遮罩)", async () => {
  const ctx = startApp();
  const { server, port } = await listen(ctx.app);
  try {
    const w = await req(port, "POST", "/admin/secrets/ZY_TEST_SIMPLE", {
      value: "abcdef-this-is-secret"
    });
    assert.strictEqual(w.status, 200);
    assert.strictEqual(w.body.ok, true);
    assert.ok(w.body.masked.includes("•"), "应遮罩");

    const list = await req(port, "GET", "/admin/secrets/");
    assert.strictEqual(list.status, 200);
    assert.deepStrictEqual(list.body.configured_keys, ["ZY_TEST_SIMPLE"]);
    assert.ok(list.body.values.ZY_TEST_SIMPLE.masked.includes("•"));
    assert.ok(
      !JSON.stringify(list.body).includes("abcdef-this-is-secret"),
      "明文绝对不能出现在列表响应里"
    );

    const del = await req(port, "DELETE", "/admin/secrets/ZY_TEST_SIMPLE");
    assert.strictEqual(del.status, 200);

    const list2 = await req(port, "GET", "/admin/secrets/");
    assert.deepStrictEqual(list2.body.configured_keys, []);
  } finally {
    server.close();
  }
});

test("/internal/fetch/:key 只允许本机 (loopback 通)", async () => {
  const ctx = startApp();
  const { server, port } = await listen(ctx.app);
  try {
    // 先存
    await req(port, "POST", "/admin/secrets/ZY_TEST_SIMPLE", { value: "internal-val" });

    // 本机 loopback 应该通
    const r = await req(port, "GET", "/internal/fetch/ZY_TEST_SIMPLE");
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.value, "internal-val");
  } finally {
    server.close();
  }
});

test("/internal/fetch/:key — 未配置 key 返回 404", async () => {
  const ctx = startApp();
  const { server, port } = await listen(ctx.app);
  try {
    const r = await req(port, "GET", "/internal/fetch/ZY_TEST_SIMPLE");
    assert.strictEqual(r.status, 404);
    assert.strictEqual(r.body.code, "not_configured");
  } finally {
    server.close();
  }
});

test("autodl/save_and_refresh — host/port 缺失 → 400", async () => {
  const ctx = startApp();
  const { server, port } = await listen(ctx.app);
  try {
    const r = await req(port, "POST", "/admin/secrets/autodl/save_and_refresh", { host: "" });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.code, "host_required");
  } finally {
    server.close();
  }
});

test("autodl/save_and_refresh — 探活失败仍然把 vault 落了 (vault_saved=true)", async () => {
  const ctx = startApp();
  const { server, port } = await listen(ctx.app);
  try {
    // 用一个保证不可达的端口
    const r = await req(port, "POST", "/admin/secrets/autodl/save_and_refresh", {
      host: "127.0.0.1",
      port: "1",
      scheme: "http"
    });
    assert.strictEqual(r.status, 502);
    assert.strictEqual(r.body.error, true);
    assert.strictEqual(r.body.vault_saved, true);
    assert.strictEqual(r.body.endpoint_refreshed, false);
    assert.strictEqual(r.body.code, "health_failed");

    // 确认 vault 真的写了 host/port
    const list = await req(port, "GET", "/admin/secrets/");
    assert.ok(list.body.configured_keys.includes("ZY_AUTODL_HOST"));
    assert.ok(list.body.configured_keys.includes("ZY_AUTODL_PORT"));
  } finally {
    server.close();
  }
});

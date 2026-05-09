/*
 * ════════════════════════════════════════════════════════════════
 * Vault · AES-256-GCM 文件落盘加密
 * Sovereign: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
 * 守护: 铸渊 · ICE-GL-ZY001
 * ════════════════════════════════════════════════════════════════
 *
 * 设计 (cc-004 系统自管 + cc-003 不让冰朔记):
 *   主密钥 .master:
 *     - 首次启动随机生成 32 字节 (256 位)
 *     - 落到 VAULT_DIR/.master, chmod 600, 仅 portal 用户可读
 *     - **不上 git, 不上 COS, 不传冰朔**
 *     - 真要换机器: 先 rsync 这个文件再起 vault, 否则 vault.enc 解不开
 *
 *   vault.enc 文件格式 (单文件全量重写 · 2C2G 上 secrets 量级 < 1KB):
 *     {
 *       "_sovereign": "...",
 *       "version": 1,
 *       "algo": "aes-256-gcm",
 *       "iv": "<24 hex chars (12 bytes)>",
 *       "tag": "<32 hex chars (16 bytes)>",
 *       "ciphertext": "<base64 plaintext JSON>"
 *     }
 *
 *   plaintext JSON:
 *     { "secrets": { "ZY_AUTODL_HOST": "...", ... }, "updated_at": "..." }
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const VAULT_VERSION = 1;
const ALGO = "aes-256-gcm";
const KEY_LEN = 32; // 256 位
const IV_LEN = 12; // 96 位 (GCM 推荐)
const TAG_LEN = 16;

class Vault {
  constructor(vaultDir) {
    if (!vaultDir) throw new Error("vault: vaultDir 必填");
    this.vaultDir = vaultDir;
    this.masterPath = path.join(vaultDir, ".master");
    this.encPath = path.join(vaultDir, "vault.enc");
    this._key = null;
  }

  // ─── 主密钥 ─────────────────────────────────────────────────
  loadOrCreateMaster() {
    fs.mkdirSync(this.vaultDir, { recursive: true, mode: 0o700 });
    if (fs.existsSync(this.masterPath)) {
      const buf = fs.readFileSync(this.masterPath);
      if (buf.length !== KEY_LEN) {
        throw new Error(
          `vault: .master 长度异常 ${buf.length} (期望 ${KEY_LEN}). 请人工介入.`
        );
      }
      try {
        const st = fs.statSync(this.masterPath);
        if ((st.mode & 0o077) !== 0) fs.chmodSync(this.masterPath, 0o600);
      } catch (_) {
        /* ignore */
      }
      this._key = buf;
      return { created: false };
    }
    const key = crypto.randomBytes(KEY_LEN);
    const tmp = this.masterPath + ".tmp." + process.pid;
    fs.writeFileSync(tmp, key, { mode: 0o600 });
    try {
      const fd = fs.openSync(tmp, "r+");
      fs.fsyncSync(fd);
      fs.closeSync(fd);
    } catch (_) {
      /* ignore */
    }
    fs.renameSync(tmp, this.masterPath);
    fs.chmodSync(this.masterPath, 0o600);
    this._key = key;
    return { created: true };
  }

  // ─── 加密 / 解密 ────────────────────────────────────────────
  _encrypt(plaintextStr) {
    if (!this._key) throw new Error("vault: 主密钥未加载");
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGO, this._key, iv);
    const ct = Buffer.concat([
      cipher.update(plaintextStr, "utf8"),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    return {
      _sovereign: "TCS-0002∞ · 国作登字-2026-A-00037559",
      version: VAULT_VERSION,
      algo: ALGO,
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
      ciphertext: ct.toString("base64")
    };
  }

  _decrypt(payload) {
    if (!this._key) throw new Error("vault: 主密钥未加载");
    if (!payload || payload.algo !== ALGO) {
      throw new Error("vault: 加密载荷格式不识别 (可能版本不匹配或主密钥换过了)");
    }
    if (typeof payload.iv !== "string" || typeof payload.tag !== "string") {
      throw new Error("vault: 加密载荷缺 iv/tag");
    }
    const iv = Buffer.from(payload.iv, "hex");
    const tag = Buffer.from(payload.tag, "hex");
    if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
      throw new Error("vault: iv/tag 长度异常");
    }
    const ct = Buffer.from(payload.ciphertext, "base64");
    const decipher = crypto.createDecipheriv(ALGO, this._key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  }

  // ─── 读 / 写整库 ────────────────────────────────────────────
  loadAll() {
    if (!fs.existsSync(this.encPath)) {
      return { secrets: {}, updated_at: null };
    }
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(this.encPath, "utf8"));
    } catch (e) {
      throw new Error("vault: vault.enc 不是合法 JSON: " + e.message);
    }
    const ptStr = this._decrypt(raw);
    let pt;
    try {
      pt = JSON.parse(ptStr);
    } catch (e) {
      throw new Error("vault: 解密后明文不是合法 JSON: " + e.message);
    }
    if (!pt || typeof pt !== "object" || typeof pt.secrets !== "object") {
      return { secrets: {}, updated_at: pt && pt.updated_at };
    }
    return { secrets: pt.secrets || {}, updated_at: pt.updated_at || null };
  }

  saveAll(state) {
    const safe = {
      secrets: (state && state.secrets) || {},
      updated_at: new Date().toISOString()
    };
    const payload = this._encrypt(JSON.stringify(safe));
    const text = JSON.stringify(payload, null, 2);
    const tmp = this.encPath + ".tmp." + process.pid;
    fs.writeFileSync(tmp, text, { mode: 0o600 });
    try {
      const fd = fs.openSync(tmp, "r+");
      fs.fsyncSync(fd);
      fs.closeSync(fd);
    } catch (_) {
      /* ignore */
    }
    fs.renameSync(tmp, this.encPath);
    fs.chmodSync(this.encPath, 0o600);
    return safe.updated_at;
  }

  // ─── 单条操作 ───────────────────────────────────────────────
  get(key) {
    const all = this.loadAll();
    return Object.prototype.hasOwnProperty.call(all.secrets, key)
      ? all.secrets[key]
      : null;
  }

  set(key, value) {
    if (typeof key !== "string" || !key) throw new Error("vault: key 必须是非空字符串");
    if (typeof value !== "string") throw new Error("vault: value 必须是字符串");
    const all = this.loadAll();
    all.secrets[key] = value;
    return this.saveAll(all);
  }

  delete(key) {
    const all = this.loadAll();
    if (!(key in all.secrets)) return false;
    delete all.secrets[key];
    this.saveAll(all);
    return true;
  }

  list() {
    return Object.keys(this.loadAll().secrets);
  }
}

// ─── 遮罩 (返回前端用 · 永不返回明文) ──────────────────────────
function maskValue(v) {
  if (v == null) return null;
  const s = String(v);
  if (s.length === 0) return "";
  if (s.length <= 4) return "••••";
  if (s.length <= 12) return s.slice(0, 2) + "••••" + s.slice(-2);
  return s.slice(0, 4) + "••••••" + s.slice(-4);
}

module.exports = { Vault, maskValue };

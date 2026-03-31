#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/subscription-server.js
// 🌐 铸渊专线 · 订阅服务
//
// 提供HTTP端点，客户端通过订阅URL获取代理配置
// 自动识别客户端类型，返回对应格式:
//   - Clash YAML (Clash Verge / ClashMi)
//   - Base64 URI (Shadowrocket)
//
// 端口: 3802 (绑定0.0.0.0，支持外部直连 + Nginx反代)
// 认证: URL中的token参数
//
// 环境变量 (从 /opt/zhuyuan/proxy/.env.keys 加载):
//   ZY_PROXY_UUID, ZY_PROXY_REALITY_PUBLIC_KEY,
//   ZY_PROXY_REALITY_SHORT_ID, ZY_PROXY_SUB_TOKEN
// ═══════════════════════════════════════════════

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.ZY_PROXY_SUB_PORT || 3802;
const DATA_DIR = process.env.ZY_PROXY_DATA_DIR || '/opt/zhuyuan/proxy/data';
const KEYS_FILE = process.env.ZY_PROXY_KEYS_FILE || '/opt/zhuyuan/proxy/.env.keys';

// ── 加载密钥 ────────────────────────────────
function loadKeys() {
  const keys = {};
  try {
    const content = fs.readFileSync(KEYS_FILE, 'utf8');
    for (const line of content.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...vals] = line.split('=');
      keys[key.trim()] = vals.join('=').trim();
    }
  } catch (err) {
    // 尝试从环境变量读取
    keys.ZY_PROXY_UUID = process.env.ZY_PROXY_UUID || '';
    keys.ZY_PROXY_REALITY_PUBLIC_KEY = process.env.ZY_PROXY_REALITY_PUBLIC_KEY || '';
    keys.ZY_PROXY_REALITY_SHORT_ID = process.env.ZY_PROXY_REALITY_SHORT_ID || '';
    keys.ZY_PROXY_SUB_TOKEN = process.env.ZY_PROXY_SUB_TOKEN || '';
  }
  return keys;
}

// ── 获取服务器IP ────────────────────────────
// ⚠️ 仓库公开，不在代码中硬编码IP
// 优先级: 环境变量 > .env.keys文件 > 回退
function getServerHost() {
  // 1. 优先从环境变量读取
  if (process.env.ZY_SERVER_HOST) {
    return process.env.ZY_SERVER_HOST;
  }

  // 2. 从.env.keys文件读取
  try {
    const content = fs.readFileSync(KEYS_FILE, 'utf8');
    for (const line of content.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...vals] = line.split('=');
      if (key.trim() === 'ZY_SERVER_HOST') {
        const val = vals.join('=').trim();
        if (val) return val;
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`⚠️ 读取 ${KEYS_FILE} 失败: ${err.code || err.message}`);
    }
  }

  console.error('⚠️ ZY_SERVER_HOST 未设置 (环境变量和.env.keys均未找到)');
  return '0.0.0.0';
}

// ── 获取CN中转服务器信息 ─────────────────────
// 优先级: 环境变量 > .env.keys文件
function getCnRelayHost() {
  // 1. 从环境变量读取
  if (process.env.ZY_CN_RELAY_HOST) {
    return process.env.ZY_CN_RELAY_HOST;
  }

  // 2. 从.env.keys文件读取
  try {
    const content = fs.readFileSync(KEYS_FILE, 'utf8');
    for (const line of content.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...vals] = line.split('=');
      if (key.trim() === 'ZY_CN_RELAY_HOST') {
        const val = vals.join('=').trim();
        if (val) return val;
      }
    }
  } catch (err) { /* ignore */ }

  return null; // CN中转未配置
}

function getCnRelayPort() {
  return parseInt(process.env.ZY_CN_RELAY_PORT || '2053', 10);
}

// ── 读取流量配额信息 ────────────────────────
function getQuotaInfo() {
  const quotaFile = path.join(DATA_DIR, 'quota-status.json');
  try {
    return JSON.parse(fs.readFileSync(quotaFile, 'utf8'));
  } catch {
    return {
      total_bytes: 500 * 1024 * 1024 * 1024, // 500GB
      used_bytes: 0,
      upload_bytes: 0,
      download_bytes: 0,
      reset_day: 1,
      period: new Date().toISOString().slice(0, 7)
    };
  }
}

// ── 生成VLESS URI (Shadowrocket) ─────────────
function generateVlessUri(keys, serverHost) {
  const params = new URLSearchParams({
    encryption: 'none',
    flow: 'xtls-rprx-vision',
    security: 'reality',
    sni: 'www.microsoft.com',
    fp: 'chrome',
    pbk: keys.ZY_PROXY_REALITY_PUBLIC_KEY,
    sid: keys.ZY_PROXY_REALITY_SHORT_ID,
    type: 'tcp',
    headerType: 'none'
  });

  return `vless://${keys.ZY_PROXY_UUID}@${serverHost}:443?${params.toString()}#ZY-SG-Reality`;
}

// ── 生成Clash YAML配置 ───────────────────────
// 兼容 Mihomo (Clash Meta) / Clash Verge / ClashMi
// 包含完整DNS配置·全局优化设置·代理节点·路由规则
function generateClashYaml(keys, serverHost) {
  const cnRelayHost = getCnRelayHost();
  const cnRelayPort = getCnRelayPort();

  // ── 代理节点定义 ──────────────────────────────
  // SG直连节点 (必选)
  let proxiesBlock = `  - name: "🏛️ 铸渊专线-SG直连"
    type: vless
    server: ${serverHost}
    port: 443
    uuid: ${keys.ZY_PROXY_UUID}
    network: tcp
    tls: true
    udp: true
    flow: xtls-rprx-vision
    servername: www.microsoft.com
    skip-cert-verify: false
    reality-opts:
      public-key: ${keys.ZY_PROXY_REALITY_PUBLIC_KEY}
      short-id: ${keys.ZY_PROXY_REALITY_SHORT_ID}
    client-fingerprint: chrome`;

  // CN中转节点 (如果已配置)
  // 注: CN中转是透明TCP转发(CN:2053 → SG:443)，所以Reality设置仍指向SG的配置
  // servername/public-key/short-id 与SG直连节点完全相同，因为TLS握手实际发生在SG端
  if (cnRelayHost) {
    proxiesBlock += `
  - name: "🇨🇳 铸渊专线-CN中转"
    type: vless
    server: ${cnRelayHost}
    port: ${cnRelayPort}
    uuid: ${keys.ZY_PROXY_UUID}
    network: tcp
    tls: true
    udp: true
    flow: xtls-rprx-vision
    servername: www.microsoft.com
    skip-cert-verify: false
    reality-opts:
      public-key: ${keys.ZY_PROXY_REALITY_PUBLIC_KEY}
      short-id: ${keys.ZY_PROXY_REALITY_SHORT_ID}
    client-fingerprint: chrome`;
  }

  // ── 代理组定义 ─────────────────────────────────
  let proxyGroupsBlock = '';

  if (cnRelayHost) {
    // 有CN中转时: 主组含自动选择 + 自动选择组
    proxyGroupsBlock = `  - name: "🌐 铸渊专线"
    type: select
    proxies:
      - "♻️ 自动选择"
      - "🏛️ 铸渊专线-SG直连"
      - "🇨🇳 铸渊专线-CN中转"
      - DIRECT
  - name: "♻️ 自动选择"
    type: url-test
    proxies:
      - "🏛️ 铸渊专线-SG直连"
      - "🇨🇳 铸渊专线-CN中转"
    url: "https://www.gstatic.com/generate_204"
    interval: 300
    tolerance: 50
  - name: "🤖 AI服务"
    type: select
    proxies:
      - "🏛️ 铸渊专线-SG直连"
      - "🇨🇳 铸渊专线-CN中转"
  - name: "💻 开发工具"
    type: select
    proxies:
      - "🏛️ 铸渊专线-SG直连"
      - "🇨🇳 铸渊专线-CN中转"`;
  } else {
    // 仅SG直连时
    proxyGroupsBlock = `  - name: "🌐 铸渊专线"
    type: select
    proxies:
      - "🏛️ 铸渊专线-SG直连"
      - DIRECT
  - name: "🤖 AI服务"
    type: select
    proxies:
      - "🏛️ 铸渊专线-SG直连"
  - name: "💻 开发工具"
    type: select
    proxies:
      - "🏛️ 铸渊专线-SG直连"`;
  }

  return `# 铸渊专线 · ZY-Proxy Subscription
# 自动生成 · ${new Date().toISOString()}
# ⚠️ 请勿分享此配置
${cnRelayHost ? '# 🇨🇳 包含CN中转节点 (国内直连广州→转发新加坡)' : ''}

# ── 全局设置 ──────────────────────────────────
port: 7890
socks-port: 7891
mixed-port: 7893
allow-lan: false
mode: rule
log-level: info
ipv6: false
unified-delay: true
tcp-concurrent: true
find-process-mode: strict
geodata-mode: true
global-client-fingerprint: chrome

# ── DNS配置 ───────────────────────────────────
dns:
  enable: true
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    - "*.lan"
    - "*.local"
    - "*.localhost"
    - "*.direct"
    - "time.*.com"
    - "ntp.*.com"
    - "+.msftconnecttest.com"
    - "+.msftncsi.com"
    - "localhost.ptlogin2.qq.com"
    - "dns.msftncsi.com"
    - "www.msftncsi.com"
    - "www.msftconnecttest.com"
  default-nameserver:
    - 223.5.5.5
    - 114.114.114.114
  nameserver:
    - https://doh.pub/dns-query
    - https://dns.alidns.com/dns-query
  fallback:
    - https://1.1.1.1/dns-query
    - https://dns.google/dns-query
    - https://cloudflare-dns.com/dns-query
  fallback-filter:
    geoip: true
    geoip-code: CN
    ipcidr:
      - 240.0.0.0/4

# ── 代理节点 ──────────────────────────────────
proxies:
${proxiesBlock}

# ── 代理组 ────────────────────────────────────
proxy-groups:
${proxyGroupsBlock}

# ── 路由规则 ──────────────────────────────────
rules:
  # AI服务
  - DOMAIN-SUFFIX,openai.com,🤖 AI服务
  - DOMAIN-SUFFIX,anthropic.com,🤖 AI服务
  - DOMAIN-SUFFIX,claude.ai,🤖 AI服务
  - DOMAIN-SUFFIX,chatgpt.com,🤖 AI服务
  - DOMAIN-SUFFIX,chat.openai.com,🤖 AI服务
  - DOMAIN-SUFFIX,ai.com,🤖 AI服务
  - DOMAIN-SUFFIX,bard.google.com,🤖 AI服务
  - DOMAIN-SUFFIX,gemini.google.com,🤖 AI服务
  - DOMAIN-SUFFIX,perplexity.ai,🤖 AI服务

  # 开发工具
  - DOMAIN-SUFFIX,github.com,💻 开发工具
  - DOMAIN-SUFFIX,githubusercontent.com,💻 开发工具
  - DOMAIN-SUFFIX,github.io,💻 开发工具
  - DOMAIN-SUFFIX,githubassets.com,💻 开发工具
  - DOMAIN-SUFFIX,copilot.microsoft.com,💻 开发工具
  - DOMAIN-SUFFIX,copilot-proxy.githubusercontent.com,💻 开发工具
  - DOMAIN-SUFFIX,npmjs.com,💻 开发工具
  - DOMAIN-SUFFIX,npmjs.org,💻 开发工具
  - DOMAIN-SUFFIX,docker.com,💻 开发工具
  - DOMAIN-SUFFIX,docker.io,💻 开发工具
  - DOMAIN-SUFFIX,stackoverflow.com,💻 开发工具
  - DOMAIN-SUFFIX,stackexchange.com,💻 开发工具

  # 社交媒体 & 常用
  - DOMAIN-SUFFIX,tiktok.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,twitter.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,x.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,youtube.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,youtu.be,🌐 铸渊专线
  - DOMAIN-SUFFIX,ytimg.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,googlevideo.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,google.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,googleapis.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,gstatic.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,ggpht.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,telegram.org,🌐 铸渊专线
  - DOMAIN-SUFFIX,t.me,🌐 铸渊专线
  - DOMAIN-SUFFIX,instagram.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,facebook.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,whatsapp.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,whatsapp.net,🌐 铸渊专线
  - DOMAIN-SUFFIX,wikipedia.org,🌐 铸渊专线
  - DOMAIN-SUFFIX,wikimedia.org,🌐 铸渊专线

  # GeoIP中国直连
  - GEOIP,CN,DIRECT

  # 默认走代理
  - MATCH,🌐 铸渊专线
`;
}

// ── 生成subscription-userinfo头 ──────────────
function generateUserInfoHeader(quota) {
  // 标准格式: upload=BYTES; download=BYTES; total=BYTES; expire=TIMESTAMP
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(quota.reset_day || 1);
  nextMonth.setHours(0, 0, 0, 0);

  return `upload=${quota.upload_bytes}; download=${quota.download_bytes}; total=${quota.total_bytes}; expire=${Math.floor(nextMonth.getTime() / 1000)}`;
}

// ── 检测客户端类型 ───────────────────────────
function detectClientType(userAgent) {
  const ua = (userAgent || '').toLowerCase();
  if (ua.includes('clash') || ua.includes('mihomo') || ua.includes('stash')) {
    return 'clash';
  }
  if (ua.includes('shadowrocket') || ua.includes('quantumult') || ua.includes('surge')) {
    return 'base64';
  }
  // 默认返回Clash格式 (最通用)
  return 'clash';
}

// ── HTTP服务器 ───────────────────────────────
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 健康检查
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'zy-proxy-subscription' }));
    return;
  }

  // 订阅端点: /sub/{token}
  const subMatch = pathname.match(/^\/sub\/([a-f0-9]+)$/);
  if (subMatch) {
    const token = subMatch[1];
    const keys = loadKeys();

    // 验证Token
    if (token !== keys.ZY_PROXY_SUB_TOKEN) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    const serverHost = getServerHost();
    const quota = getQuotaInfo();
    const clientType = detectClientType(req.headers['user-agent']);
    const userInfoHeader = generateUserInfoHeader(quota);

    if (clientType === 'clash') {
      // Clash YAML格式
      const yaml = generateClashYaml(keys, serverHost);
      res.writeHead(200, {
        'Content-Type': 'text/yaml; charset=utf-8',
        'Content-Disposition': 'attachment; filename="zy-proxy.yaml"',
        'subscription-userinfo': userInfoHeader,
        'profile-update-interval': '6',
        'profile-title': 'base64:6ZO45ria5LiT57q/',  // "铸渊专线" in base64
      });
      res.end(yaml);
    } else {
      // Base64 URI格式 (Shadowrocket)
      const vlessUri = generateVlessUri(keys, serverHost);
      const encoded = Buffer.from(vlessUri).toString('base64');
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'subscription-userinfo': userInfoHeader,
        'profile-update-interval': '6',
      });
      res.end(encoded);
    }
    return;
  }

  // 配额查询端点: /quota (公开安全 - 仅数字)
  if (pathname === '/quota') {
    const quota = getQuotaInfo();
    const totalGB = (quota.total_bytes / (1024 ** 3)).toFixed(1);
    const usedGB = ((quota.upload_bytes + quota.download_bytes) / (1024 ** 3)).toFixed(1);
    const remainGB = (totalGB - usedGB).toFixed(1);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      total_gb: parseFloat(totalGB),
      used_gb: parseFloat(usedGB),
      remaining_gb: parseFloat(remainGB),
      percentage_used: parseFloat(((usedGB / totalGB) * 100).toFixed(1)),
      period: quota.period,
      reset_day: quota.reset_day,
      updated_at: quota.updated_at || new Date().toISOString()
    }));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 铸渊专线订阅服务已启动: http://0.0.0.0:${PORT}`);
  console.log(`  订阅端点: /sub/{token}`);
  console.log(`  配额查询: /quota`);
  console.log(`  健康检查: /health`);
});

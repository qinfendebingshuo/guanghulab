#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/subscription-server-v3.js
// 🌐 光湖语言世界 · 多用户订阅服务 — 冰朔开发维护
//
// V3升级 (从V2演进 · V2继续运行不受影响):
//   品牌: 铸渊专线V2 → 光湖语言世界
//   流量池: 2000GB硬切 (到量即停 · 非仅告警)
//   配置优化: keep-alive 15s · 增强DIRECT分流
//   反向加速: 零缓存直通 · splice模式
//   仪表盘: /dashboard/{token} HTML页面
//
// 部署在大脑服务器 (ZY-SVR-005 · 43.156.237.110)
// 每个邮箱一条独立专线，Token认证隔离
//
// 生产端口: 3805
// 生产路径: /api/proxy-v3/sub/{token}
// ═══════════════════════════════════════════════

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.ZY_PROXY_V3_PORT || 3805;
const PROXY_DIR = process.env.ZY_BRAIN_PROXY_DIR || '/opt/zhuyuan-brain/proxy';
const DATA_DIR = path.join(PROXY_DIR, 'data');
const KEYS_FILE = path.join(PROXY_DIR, '.env.keys');
const LIVE_NODES_FRESHNESS_MS = parseInt(process.env.ZY_CLOUD_HB_EXPIRY_MS || '600000', 10);

// 引入用户管理器
const userManager = require('./user-manager');

// ── 操作快照文件 ──────────────────────────────
const AUTH_SNAPSHOT_FILE = path.join(DATA_DIR, 'bandwidth-auth-snapshots.json');
const MAX_SNAPSHOTS = 500; // 最多保留500条快照记录
const MAX_SEND_CODE_PER_HOUR = 3; // 每个IP每小时最多发送验证码次数

/**
 * 保存用户操作快照
 * 记录用户授权操作详情，用于审计追溯
 * @param {Object} snapshot 快照数据
 */
function saveAuthSnapshot(snapshot) {
  try {
    let snapshots = [];
    try {
      const raw = JSON.parse(fs.readFileSync(AUTH_SNAPSHOT_FILE, 'utf8'));
      if (Array.isArray(raw)) snapshots = raw;
    } catch { /* 文件不存在或格式错误，使用空数组 */ }

    snapshots.push({
      ...snapshot,
      timestamp: new Date().toISOString(),
      timestamp_ms: Date.now()
    });

    // 保留最近MAX_SNAPSHOTS条记录
    if (snapshots.length > MAX_SNAPSHOTS) {
      snapshots = snapshots.slice(-MAX_SNAPSHOTS);
    }

    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(AUTH_SNAPSHOT_FILE, JSON.stringify(snapshots, null, 2));
  } catch (err) {
    console.error('[操作快照] 保存失败:', err.message);
  }
}

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
    keys.ZY_PROXY_REALITY_PUBLIC_KEY = process.env.ZY_PROXY_REALITY_PUBLIC_KEY || '';
    keys.ZY_PROXY_REALITY_SHORT_ID = process.env.ZY_PROXY_REALITY_SHORT_ID || '';
  }
  return keys;
}

// ── 从环境变量或密钥文件读取值 ──────────────
function getEnvOrKey(envName) {
  if (process.env[envName]) return process.env[envName];

  try {
    const content = fs.readFileSync(KEYS_FILE, 'utf8');
    for (const line of content.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...vals] = line.split('=');
      if (key.trim() === envName) {
        const val = vals.join('=').trim();
        if (val) return val;
      }
    }
  } catch { /* ignore */ }

  return '';
}

// ── 获取服务器IP ────────────────────────────
function getServerHost() {
  return getEnvOrKey('ZY_BRAIN_HOST') || getEnvOrKey('ZY_SERVER_HOST') || '0.0.0.0';
}

// ── 构建所有可用VPN节点 ──────────────────────
// 优先从ZY-CLOUD活模块获取（动态·实时健康检查后的活节点）
// 回退到静态配置（ZY-CLOUD未运行时）
// V3: 节点名统一为"光湖"品牌
function buildVpnNodes() {
  // 优先: 从ZY-CLOUD活模块的动态节点列表读取
  const liveNodesFile = path.join(DATA_DIR, 'nodes-live.json');
  try {
    const liveData = JSON.parse(fs.readFileSync(liveNodesFile, 'utf8'));
    // 检查数据是否新鲜（使用与ZY-CLOUD相同的心跳过期阈值）
    const age = Date.now() - new Date(liveData.updated_at).getTime();
    if (age < LIVE_NODES_FRESHNESS_MS * 2 && liveData.nodes && liveData.nodes.length > 0) {
      // V3: 重写节点名为光湖品牌
      return liveData.nodes.map(n => ({
        ...n,
        name: n.name.replace(/铸渊专线V2/g, '光湖')
      }));
    }
  } catch { /* ZY-CLOUD未运行，回退到静态配置 */ }

  // 回退: 从环境变量/密钥文件静态构建
  return buildStaticNodes();
}

// ── 静态节点构建（回退用）────────────────────
function buildStaticNodes() {
  const nodes = [];

  // 节点1: 大脑服务器 (ZY-SVR-005 · 新加坡一区 · 4核8G · 主力)
  const brainHost = getEnvOrKey('ZY_BRAIN_HOST');
  const brainPbk = getEnvOrKey('ZY_PROXY_REALITY_PUBLIC_KEY');
  const brainSid = getEnvOrKey('ZY_PROXY_REALITY_SHORT_ID');
  if (brainHost && brainPbk && brainSid) {
    nodes.push({
      id: 'zy-brain-sg1',
      name: '🧠 光湖-SG1(大脑)',
      host: brainHost,
      port: 443,
      pbk: brainPbk,
      sid: brainSid,
      region: 'sg-zone1',
      priority: 1
    });
  }

  // 节点2: 面孔服务器 (ZY-SVR-002 · 新加坡二区 · 2核8G · 备用)
  const faceHost = getEnvOrKey('ZY_FACE_HOST');
  const facePbk = getEnvOrKey('ZY_FACE_REALITY_PUBLIC_KEY');
  const faceSid = getEnvOrKey('ZY_FACE_REALITY_SHORT_ID');
  if (faceHost && facePbk && faceSid) {
    nodes.push({
      id: 'zy-face-sg2',
      name: '🏛️ 光湖-SG2(面孔)',
      host: faceHost,
      port: 443,
      pbk: facePbk,
      sid: faceSid,
      region: 'sg-zone2',
      priority: 2
    });
  }

  // 节点3: CN中转 (国内→SG · 对国内用户低延迟)
  const cnHost = getEnvOrKey('ZY_CN_RELAY_HOST');
  const cnPort = parseInt(getEnvOrKey('ZY_CN_RELAY_PORT') || '2053', 10);
  // CN中转是TCP透传，Reality密钥用主力节点的（大脑）
  if (cnHost && brainPbk && brainSid) {
    nodes.push({
      id: 'zy-cn-relay',
      name: '🇨🇳 光湖-CN中转',
      host: cnHost,
      port: cnPort,
      pbk: brainPbk,
      sid: brainSid,
      region: 'cn-relay',
      priority: 3
    });
  }

  // 节点4: 硅谷服务器 (ZY-SVR-SV · Claude专线 · 美国IP出口)
  // 冰朔D61: 硅谷服务器已配置，新增Claude单独访问VPN节点
  // 用户访问claude.ai等AI服务时优先走此节点（美国IP）
  const svHost = getEnvOrKey('ZY_SVR_SV_HOST');
  const svPbk = getEnvOrKey('ZY_SVR_SV_REALITY_PUBLIC_KEY');
  const svSid = getEnvOrKey('ZY_SVR_SV_REALITY_SHORT_ID');
  const svPort = parseInt(getEnvOrKey('ZY_SVR_SV_PORT') || '443', 10);
  if (svHost && svPbk) {
    nodes.push({
      id: 'zy-sv-claude',
      name: '🇺🇸 光湖-SV(Claude专线)',
      host: svHost,
      port: svPort,
      pbk: svPbk,
      sid: svSid || '',
      region: 'us-sv',
      priority: 4
    });
  }

  return nodes;
}

// ── 生成subscription-userinfo头 ──────────────
// 共享流量池模型: total=池配额(2000GB)，upload+download=池总用量
// 使用缓存的池状态文件(traffic-monitor-v2每5分钟更新)以减少计算开销
function generateUserInfoHeader(user) {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);

  // 优先从缓存文件读取池状态 (traffic-monitor-v2每5分钟写入)
  let poolUpload = 0;
  let poolDownload = 0;
  try {
    const cached = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'pool-quota-status.json'), 'utf8'));
    poolUpload = cached.pool_upload_bytes || 0;
    poolDownload = cached.pool_download_bytes || 0;
  } catch {
    // 缓存不可用时实时计算
    const poolStatus = userManager.getPoolStatus();
    poolUpload = poolStatus.pool_upload_bytes;
    poolDownload = poolStatus.pool_download_bytes;
  }

  return `upload=${poolUpload}; download=${poolDownload}; total=${userManager.POOL_QUOTA_BYTES}; expire=${Math.floor(nextMonth.getTime() / 1000)}`;
}

// ── 生成VLESS URI (Shadowrocket · 多节点) ─────
function generateVlessUris(user, nodes) {
  return nodes.map(node => {
    const params = new URLSearchParams({
      encryption: 'none',
      flow: 'xtls-rprx-vision',
      security: 'reality',
      sni: 'www.microsoft.com',
      fp: 'chrome',
      pbk: node.pbk,
      sid: node.sid,
      type: 'tcp',
      headerType: 'none'
    });
    const label = encodeURIComponent(node.name);
    return `vless://${user.uuid}@${node.host}:${node.port}?${params.toString()}#${label}`;
  }).join('\n');
}

// ── 生成Clash YAML配置 (多节点智能选路) ──────
function generateClashYaml(user, nodes) {
  // 构建proxies块 — 每个节点一条
  const proxyBlocks = nodes.map(node => `  - name: "${node.name}"
    type: vless
    server: ${node.host}
    port: ${node.port}
    uuid: ${user.uuid}
    network: tcp
    tls: true
    udp: true
    flow: xtls-rprx-vision
    skip-cert-verify: false
    servername: www.microsoft.com
    reality-opts:
      public-key: ${node.pbk}
      short-id: ${node.sid}
    client-fingerprint: chrome`).join('\n');

  // 节点名列表
  const nodeNames = nodes.map(n => `      - "${n.name}"`).join('\n');

  // url-test自动选择组 (延迟最低的自动生效)
  const autoSelectBlock = nodes.length > 1 ? `
  - name: "♻️ 自动选择"
    type: url-test
    proxies:
${nodeNames}
    url: "http://www.gstatic.com/generate_204"
    interval: 300
    tolerance: 50
` : '';

  // 主代理组
  const mainProxies = nodes.length > 1
    ? `      - "♻️ 自动选择"\n${nodeNames}\n      - DIRECT`
    : `${nodeNames}\n      - DIRECT`;

  // AI/开发工具代理组的节点列表
  // Claude专线优先: 如果有硅谷节点，AI服务组把它放最前面
  const svNode = nodes.find(n => n.region === 'us-sv');
  const toolProxies = nodes.length > 1
    ? (svNode
        ? `      - "${svNode.name}"\n      - "♻️ 自动选择"\n${nodeNames}`
        : `      - "♻️ 自动选择"\n${nodeNames}`)
    : nodeNames;

  return `# 光湖语言世界 · ${user.label} 的独立专线 — 冰朔开发维护
# 自动生成 · ${new Date().toISOString()}
# ⚠️ 此配置为 ${user.email} 专属，请勿分享
# 每人一条独立线路 · ${nodes.length}个节点智能选路
# 服务器只是桥梁，你的光纤才是主引擎 🚀

# ── 全局设置 ──────────────────────────────
mixed-port: 7890
allow-lan: false
mode: rule
log-level: info
ipv6: false
unified-delay: true
tcp-concurrent: true
find-process-mode: strict
geodata-mode: true
geodata-loader: standard
global-client-fingerprint: chrome
keep-alive-interval: 15
external-controller: 127.0.0.1:9090

# ── GeoData 数据源 ────────────────────────
geox-url:
  geoip: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat"
  geosite: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat"
  mmdb: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb"

# ── DNS 设置 (fake-ip模式) ────────────────
dns:
  enable: true
  listen: 0.0.0.0:1053
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    - "*.lan"
    - "*.local"
    - "*.direct"
    - "localhost.ptlogin2.qq.com"
    - "dns.msftncsi.com"
    - "*.msftconnecttest.com"
    - "*.msftncsi.com"
    - "+.stun.*.*"
    - "+.stun.*.*.*"
    - "lens.l.google.com"
    - "stun.l.google.com"
    - "time.*.com"
    - "time.*.gov"
    - "time.*.edu.cn"
    - "time.*.apple.com"
    - "time-ios.apple.com"
    - "time-macos.apple.com"
    - "ntp.*.com"
    - "+.pool.ntp.org"
    - "music.163.com"
    - "*.music.163.com"
    - "*.126.net"
  default-nameserver:
    - 223.5.5.5
    - 119.29.29.29
    - 1.0.0.1
  nameserver:
    - https://dns.alidns.com/dns-query
    - https://doh.pub/dns-query
  fallback:
    - https://1.0.0.1/dns-query
    - https://dns.google/dns-query
    - tls://8.8.4.4:853
  fallback-filter:
    geoip: true
    geoip-code: CN
    geosite:
      - gfw
    ipcidr:
      - 240.0.0.0/4
    domain:
      - "+.google.com"
      - "+.facebook.com"
      - "+.youtube.com"
      - "+.github.com"
      - "+.googleapis.com"
      - "+.openai.com"
      - "+.anthropic.com"

# ── 域名嗅探 ──────────────────────────────
sniffer:
  enable: true
  force-dns-mapping: true
  parse-pure-ip: true
  override-destination: true
  sniff:
    HTTP:
      ports: [80, 8080-8880]
      override-destination: true
    TLS:
      ports: [443, 8443]
    QUIC:
      ports: [443, 8443]
  skip-domain:
    - "Mijia Cloud"
    - "+.push.apple.com"

# ── 代理节点 (${nodes.length}个 · 智能选路) ──
proxies:
${proxyBlocks}

# ── 代理组 ────────────────────────────────
proxy-groups:
  - name: "🌐 光湖语言世界"
    type: select
    proxies:
${mainProxies}
${autoSelectBlock}
  - name: "🤖 AI服务"
    type: select
    proxies:
${toolProxies}

  - name: "💻 开发工具"
    type: select
    proxies:
${toolProxies}

  - name: "📺 流媒体"
    type: select
    proxies:
${toolProxies}

# ── 路由规则 ──────────────────────────────
rules:
  # AI服务
  - DOMAIN-SUFFIX,openai.com,🤖 AI服务
  - DOMAIN-SUFFIX,anthropic.com,🤖 AI服务
  - DOMAIN-SUFFIX,claude.ai,🤖 AI服务
  - DOMAIN-SUFFIX,chatgpt.com,🤖 AI服务
  - DOMAIN-SUFFIX,gemini.google.com,🤖 AI服务
  - DOMAIN-SUFFIX,perplexity.ai,🤖 AI服务
  - DOMAIN-SUFFIX,poe.com,🤖 AI服务
  - DOMAIN-SUFFIX,deepseek.com,🤖 AI服务
  - DOMAIN-SUFFIX,siliconflow.cn,🤖 AI服务

  # 开发工具
  - DOMAIN-SUFFIX,github.com,💻 开发工具
  - DOMAIN-SUFFIX,githubusercontent.com,💻 开发工具
  - DOMAIN-SUFFIX,github.io,💻 开发工具
  - DOMAIN-SUFFIX,githubassets.com,💻 开发工具
  - DOMAIN-SUFFIX,copilot.microsoft.com,💻 开发工具
  - DOMAIN-SUFFIX,npmjs.com,💻 开发工具
  - DOMAIN-SUFFIX,docker.com,💻 开发工具
  - DOMAIN-SUFFIX,docker.io,💻 开发工具
  - DOMAIN-SUFFIX,stackoverflow.com,💻 开发工具
  - DOMAIN-SUFFIX,pypi.org,💻 开发工具

  # 流媒体
  - DOMAIN-SUFFIX,youtube.com,📺 流媒体
  - DOMAIN-SUFFIX,googlevideo.com,📺 流媒体
  - DOMAIN-SUFFIX,netflix.com,📺 流媒体
  - DOMAIN-SUFFIX,spotify.com,📺 流媒体
  - DOMAIN-SUFFIX,tiktok.com,📺 流媒体

  # 社交媒体
  - DOMAIN-SUFFIX,twitter.com,🌐 光湖语言世界
  - DOMAIN-SUFFIX,x.com,🌐 光湖语言世界
  - DOMAIN-SUFFIX,google.com,🌐 光湖语言世界
  - DOMAIN-SUFFIX,googleapis.com,🌐 光湖语言世界
  - DOMAIN-SUFFIX,telegram.org,🌐 光湖语言世界
  - DOMAIN-SUFFIX,t.me,🌐 光湖语言世界
  - DOMAIN-SUFFIX,instagram.com,🌐 光湖语言世界
  - DOMAIN-SUFFIX,facebook.com,🌐 光湖语言世界
  - DOMAIN-SUFFIX,whatsapp.com,🌐 光湖语言世界
  - DOMAIN-SUFFIX,wikipedia.org,🌐 光湖语言世界
  - DOMAIN-SUFFIX,reddit.com,🌐 光湖语言世界
  - DOMAIN-SUFFIX,discord.com,🌐 光湖语言世界

  # Apple (直连)
  - DOMAIN-SUFFIX,apple.com,DIRECT
  - DOMAIN-SUFFIX,icloud.com,DIRECT
  - DOMAIN-SUFFIX,mzstatic.com,DIRECT
  - DOMAIN-SUFFIX,apple-cloudkit.com,DIRECT

  # CDN静态资源 (直连 · 节省池带宽)
  - DOMAIN-SUFFIX,cdn.jsdelivr.net,DIRECT
  - DOMAIN-SUFFIX,cdnjs.cloudflare.com,DIRECT
  - DOMAIN-SUFFIX,unpkg.com,DIRECT
  - DOMAIN-SUFFIX,bootcdn.net,DIRECT
  - DOMAIN-SUFFIX,staticfile.org,DIRECT

  # 国内直连 (∞ 智能分流 · 用户切回国内网时VPN休眠)
  - DOMAIN-SUFFIX,cn,DIRECT
  - DOMAIN-SUFFIX,taobao.com,DIRECT
  - DOMAIN-SUFFIX,tmall.com,DIRECT
  - DOMAIN-SUFFIX,alipay.com,DIRECT
  - DOMAIN-SUFFIX,aliyun.com,DIRECT
  - DOMAIN-SUFFIX,aliyuncs.com,DIRECT
  - DOMAIN-SUFFIX,jd.com,DIRECT
  - DOMAIN-SUFFIX,qq.com,DIRECT
  - DOMAIN-SUFFIX,tencent.com,DIRECT
  - DOMAIN-SUFFIX,weixin.qq.com,DIRECT
  - DOMAIN-SUFFIX,wechat.com,DIRECT
  - DOMAIN-SUFFIX,bilibili.com,DIRECT
  - DOMAIN-SUFFIX,bilivideo.com,DIRECT
  - DOMAIN-SUFFIX,baidu.com,DIRECT
  - DOMAIN-SUFFIX,bdstatic.com,DIRECT
  - DOMAIN-SUFFIX,zhihu.com,DIRECT
  - DOMAIN-SUFFIX,douyin.com,DIRECT
  - DOMAIN-SUFFIX,bytedance.com,DIRECT
  - DOMAIN-SUFFIX,toutiao.com,DIRECT
  - DOMAIN-SUFFIX,weibo.com,DIRECT
  - DOMAIN-SUFFIX,163.com,DIRECT
  - DOMAIN-SUFFIX,126.com,DIRECT
  - DOMAIN-SUFFIX,xiaomi.com,DIRECT
  - DOMAIN-SUFFIX,huawei.com,DIRECT
  - DOMAIN-SUFFIX,vivo.com,DIRECT
  - DOMAIN-SUFFIX,oppo.com,DIRECT
  - DOMAIN-SUFFIX,meituan.com,DIRECT
  - DOMAIN-SUFFIX,dianping.com,DIRECT
  - DOMAIN-SUFFIX,pinduoduo.com,DIRECT
  - DOMAIN-SUFFIX,suning.com,DIRECT
  - DOMAIN-SUFFIX,csdn.net,DIRECT
  - DOMAIN-SUFFIX,cnblogs.com,DIRECT
  - DOMAIN-SUFFIX,gitee.com,DIRECT
  - DOMAIN-SUFFIX,jianshu.com,DIRECT
  - DOMAIN-SUFFIX,douban.com,DIRECT
  - DOMAIN-SUFFIX,kuaishou.com,DIRECT
  - DOMAIN-SUFFIX,ctrip.com,DIRECT
  - DOMAIN-SUFFIX,ele.me,DIRECT
  - DOMAIN-SUFFIX,netease.com,DIRECT
  - DOMAIN-SUFFIX,iqiyi.com,DIRECT
  - DOMAIN-SUFFIX,youku.com,DIRECT
  - DOMAIN-SUFFIX,dingtalk.com,DIRECT
  - DOMAIN-SUFFIX,feishu.cn,DIRECT

  # 局域网直连
  - IP-CIDR,192.168.0.0/16,DIRECT
  - IP-CIDR,10.0.0.0/8,DIRECT
  - IP-CIDR,172.16.0.0/12,DIRECT
  - IP-CIDR,127.0.0.0/8,DIRECT

  # GeoIP中国直连
  - GEOIP,CN,DIRECT

  # 默认走代理
  - MATCH,🌐 光湖语言世界
`;
}

// ── 检测客户端类型 ───────────────────────────
function detectClientType(userAgent) {
  const ua = (userAgent || '').toLowerCase();
  if (ua.includes('clash') || ua.includes('mihomo') || ua.includes('stash')) return 'clash';
  if (ua.includes('shadowrocket') || ua.includes('quantumult') || ua.includes('surge')) return 'base64';
  return 'clash';
}

// ── HTTP服务器 ───────────────────────────────
const server = http.createServer((req, res) => {
  try {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // 健康检查
    if (pathname === '/health') {
      const users = userManager.getEnabledUsers();
      const nodes = buildVpnNodes();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'zy-proxy-v3-subscription',
        brand: '光湖语言世界 — 冰朔开发维护',
        version: '3.0.0',
        users_count: users.length,
        nodes_count: nodes.length,
        smart_routing: nodes.length > 1 ? 'url-test' : 'single',
        server: 'ZY-SVR-005 · Brain',
        pool_hard_cutoff: true
      }));
      return;
    }

    // ── 流量池硬切检查 (2000GB楚河汉界) ──────
    // V3新增: 到量即停，不仅仅是告警
    function isPoolExhausted() {
      try {
        const cached = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'pool-quota-status.json'), 'utf8'));
        const totalUsed = (cached.pool_upload_bytes || 0) + (cached.pool_download_bytes || 0);
        return totalUsed >= userManager.POOL_QUOTA_BYTES;
      } catch {
        const poolStatus = userManager.getPoolStatus();
        return poolStatus.pool_used_bytes >= userManager.POOL_QUOTA_BYTES;
      }
    }

    // V2订阅端点: /sub/{token}
    // token是每个用户独立的，不会串线
    const subMatch = pathname.match(/^\/sub\/([a-f0-9]+)$/);
    if (subMatch) {
      const token = subMatch[1];
      const user = userManager.findUserByToken(token);

      if (!user) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      // V3硬切: 流量池耗尽 → 返回空配置+提示
      if (isPoolExhausted()) {
        const poolStatus = userManager.getPoolStatus();
        const exhaustedYaml = `# ⚠️ 光湖语言世界 · 本月流量池已用完
# 流量池: ${poolStatus.pool_used_gb.toFixed(1)}GB / ${poolStatus.pool_total_gb}GB
# 每月1号自动重置 · 届时刷新订阅即可恢复
# 如有紧急需求请联系冰朔

mixed-port: 7890
allow-lan: false
mode: direct
`;
        res.writeHead(200, {
          'Content-Type': 'text/yaml; charset=utf-8',
          'subscription-userinfo': generateUserInfoHeader(user),
          'profile-update-interval': '1',
          'profile-title': 'base64:' + Buffer.from(`⚠️ 光湖·${user.label}·流量已用完`).toString('base64'),
        });
        res.end(exhaustedYaml);
        return;
      }

      const nodes = buildVpnNodes();
      if (nodes.length === 0) {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('No VPN nodes configured');
        return;
      }

      const clientType = detectClientType(req.headers['user-agent']);
      const userInfoHeader = generateUserInfoHeader(user);

      if (clientType === 'clash') {
        const yaml = generateClashYaml(user, nodes);
        res.writeHead(200, {
          'Content-Type': 'text/yaml; charset=utf-8',
          'Content-Disposition': `attachment; filename="guanghu-vpn-${user.label}.yaml"`,
          'subscription-userinfo': userInfoHeader,
          'profile-update-interval': '6',
          'profile-title': 'base64:' + Buffer.from(`光湖语言世界·${user.label}`).toString('base64'),
        });
        res.end(yaml);
      } else {
        const vlessUris = generateVlessUris(user, nodes);
        const encoded = Buffer.from(vlessUris).toString('base64');
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'subscription-userinfo': userInfoHeader,
          'profile-update-interval': '6',
        });
        res.end(encoded);
      }
      return;
    }

    // 用户配额查询: /quota/{token}
    const quotaMatch = pathname.match(/^\/quota\/([a-f0-9]+)$/);
    if (quotaMatch) {
      const token = quotaMatch[1];
      const user = userManager.findUserByToken(token);

      if (!user) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: true, code: 'FORBIDDEN', message: '认证失败' }));
        return;
      }

      const poolStatus = userManager.getPoolStatus();
      const userUsedGB = (user.traffic.upload_bytes + user.traffic.download_bytes) / (1024 ** 3);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        email: user.email,
        label: user.label,
        pool: {
          total_gb: poolStatus.pool_total_gb,
          used_gb: parseFloat(poolStatus.pool_used_gb.toFixed(2)),
          remaining_gb: poolStatus.pool_remaining_gb,
          percentage_used: poolStatus.pool_percentage,
          users_count: poolStatus.users_count,
          period: poolStatus.period,
          reset_day: 1
        },
        personal: {
          used_gb: parseFloat(userUsedGB.toFixed(2)),
          period: user.traffic.period
        },
        updated_at: new Date().toISOString()
      }));
      return;
    }

    // 用户状态: /status/{token}
    const statusMatch = pathname.match(/^\/status\/([a-f0-9]+)$/);
    if (statusMatch) {
      const token = statusMatch[1];
      const user = userManager.findUserByToken(token);

      if (!user) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: true, code: 'FORBIDDEN', message: '认证失败' }));
        return;
      }

      const poolStatus = userManager.getPoolStatus();
      const userUsedGB = (user.traffic.upload_bytes + user.traffic.download_bytes) / (1024 ** 3);
      const nodes = buildVpnNodes();

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        user: {
          email: user.email,
          label: user.label,
          enabled: user.enabled
        },
        server: {
          status: 'online',
          brand: '光湖语言世界 — 冰朔开发维护',
          version: '3.0.0',
          uptime_seconds: Math.floor(process.uptime()),
          region: 'sg',
          region_name: 'Singapore',
          server_code: 'ZY-SVR-005'
        },
        nodes: nodes.map(n => ({
          id: n.id,
          name: n.name,
          region: n.region,
          port: n.port
        })),
        smart_routing: nodes.length > 1 ? 'url-test (自动选最快)' : 'single-node',
        pool: {
          total_gb: poolStatus.pool_total_gb,
          used_gb: parseFloat(poolStatus.pool_used_gb.toFixed(2)),
          remaining_gb: poolStatus.pool_remaining_gb,
          percentage_used: poolStatus.pool_percentage,
          users_count: poolStatus.users_count,
          period: poolStatus.period,
          reset_day: 1
        },
        personal: {
          used_gb: parseFloat(userUsedGB.toFixed(2)),
          period: user.traffic.period
        },
        updated_at: new Date().toISOString()
      }));
      return;
    }

    // ── V3 流量仪表盘: /dashboard/{token} ──────
    // 手机浏览器可查看 · 流量/节点/系统状态
    const dashMatch = pathname.match(/^\/dashboard\/([a-f0-9]+)$/);
    if (dashMatch) {
      const token = dashMatch[1];
      const user = userManager.findUserByToken(token);

      if (!user) {
        res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>403 认证失败</h1></body></html>');
        return;
      }

      const poolStatus = userManager.getPoolStatus();
      const userUsedGB = ((user.traffic.upload_bytes + user.traffic.download_bytes) / (1024 ** 3)).toFixed(2);
      const nodes = buildVpnNodes();
      const poolUsedGB = (typeof poolStatus.pool_used_gb === 'number' ? poolStatus.pool_used_gb : 0).toFixed(1);
      const poolPct = Math.min(typeof poolStatus.pool_percentage === 'number' ? poolStatus.pool_percentage : 0, 100).toFixed(1);

      // 读取反向加速状态
      let boostStatus = '未检测';
      try {
        const bs = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'reverse-boost-status.json'), 'utf8'));
        boostStatus = bs.current?.bbr?.is_bbr ? '✅ BBR加速中' : '⚠️ 未加速';
      } catch { /* ignore */ }

      // 读取今日流量快照
      let todayGB = '—';
      try {
        const snap = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'daily-traffic-snapshot.json'), 'utf8'));
        const today = new Date().toISOString().slice(0, 10);
        if (snap.date === today && snap.per_user?.[user.email]) {
          todayGB = snap.per_user[user.email].total_gb.toFixed(2);
        }
      } catch { /* ignore */ }

      const poolBarColor = poolPct > 90 ? '#e74c3c' : poolPct > 70 ? '#f39c12' : '#2ecc71';

      // HTML转义防止XSS
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>光湖语言世界 · ${esc(user.label)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, "PingFang SC", sans-serif; background: #0a0e27; color: #e0e0e0; padding: 20px; min-height: 100vh; }
  .header { text-align: center; padding: 20px 0; }
  .header h1 { font-size: 1.4em; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .header p { color: #888; font-size: 0.85em; margin-top: 5px; }
  .card { background: #141832; border-radius: 12px; padding: 16px; margin: 12px 0; border: 1px solid #1e2448; }
  .card h3 { font-size: 0.9em; color: #667eea; margin-bottom: 10px; }
  .stat-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.9em; }
  .stat-label { color: #888; }
  .stat-value { color: #fff; font-weight: 600; }
  .pool-bar { background: #1e2448; border-radius: 8px; height: 24px; margin: 8px 0; overflow: hidden; }
  .pool-fill { height: 100%; border-radius: 8px; transition: width 0.3s; display: flex; align-items: center; justify-content: center; font-size: 0.75em; font-weight: 600; }
  .node { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e2448; font-size: 0.85em; }
  .node:last-child { border-bottom: none; }
  .online { color: #2ecc71; }
  .footer { text-align: center; padding: 20px 0; color: #555; font-size: 0.75em; }
</style>
</head>
<body>
<div class="header">
  <h1>🌐 光湖语言世界</h1>
  <p>${esc(user.label)} 的专属仪表盘 — 冰朔开发维护</p>
</div>

<div class="card">
  <h3>📊 流量概览</h3>
  <div class="stat-row"><span class="stat-label">今日用量</span><span class="stat-value">${todayGB} GB</span></div>
  <div class="stat-row"><span class="stat-label">个人本月</span><span class="stat-value">${userUsedGB} GB</span></div>
  <div class="stat-row"><span class="stat-label">流量池</span><span class="stat-value">${poolUsedGB} / ${poolStatus.pool_total_gb} GB</span></div>
  <div class="pool-bar">
    <div class="pool-fill" style="width: ${poolPct}%; background: ${poolBarColor};">${poolPct}%</div>
  </div>
  <div class="stat-row"><span class="stat-label">重置日期</span><span class="stat-value">每月1号</span></div>
</div>

<div class="card">
  <h3>🔌 节点状态 (${nodes.length}个)</h3>
  ${nodes.map(n => `<div class="node"><span>${esc(n.name)}</span><span class="online">${n.latency_ms ? n.latency_ms + 'ms' : '在线'}</span></div>`).join('\n  ')}
</div>

<div class="card">
  <h3>⚡ 系统状态</h3>
  <div class="stat-row"><span class="stat-label">服务版本</span><span class="stat-value">V3.0</span></div>
  <div class="stat-row"><span class="stat-label">反向加速</span><span class="stat-value">${boostStatus}</span></div>
  <div class="stat-row"><span class="stat-label">在线用户</span><span class="stat-value">${poolStatus.users_count}</span></div>
  <div class="stat-row"><span class="stat-label">智能选路</span><span class="stat-value">${nodes.length > 1 ? '✅ url-test' : '单节点'}</span></div>
</div>

<div class="footer">
  光湖语言世界 · 冰朔开发维护<br>
  更新于 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
</div>
</body>
</html>`;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // ── ∞+1 公开带宽共享授权页面: /bandwidth-auth-open ──
    // 用户通过邮件中纯文本网址引导访问，输入邮箱+验证码完成授权
    // 不需要token，通过邮箱+验证码双重验证身份
    if (pathname === '/bandwidth-auth-open') {

      // POST: 提交邮箱+验证码
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            let code = '';
            let email = '';
            // 支持 JSON 和 form-urlencoded
            if (req.headers['content-type']?.includes('application/json')) {
              const json = JSON.parse(body);
              code = String(json.code || '').trim();
              email = String(json.email || '').trim().toLowerCase();
            } else {
              const params = new URLSearchParams(body);
              code = String(params.get('code') || '').trim();
              email = String(params.get('email') || '').trim().toLowerCase();
            }

            if (!email || !email.includes('@')) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ success: false, message: '请输入有效的邮箱地址' }));
              return;
            }

            if (!code || code.length !== 6) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ success: false, message: '请输入6位验证码' }));
              return;
            }

            // 采集用户IP
            const userIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
              || req.headers['x-real-ip']
              || req.socket.remoteAddress
              || '0.0.0.0';

            // 验证码校验 (邮箱+验证码交叉验证)
            const bwPool = require('./bandwidth-pool-agent');
            const verifyResult = bwPool.verifyAuthCode(code, email);

            if (!verifyResult.valid) {
              // 保存失败操作快照
              saveAuthSnapshot({
                email,
                action: 'bandwidth-auth-consent',
                result: 'failed',
                error: verifyResult.error,
                ip: userIP,
                user_agent: req.headers['user-agent'] || 'unknown',
                auth_type: 'public-open'
              });
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ success: false, message: verifyResult.error }));
              return;
            }

            // 注册为带宽贡献者
            const regResult = bwPool.registerContributor(email, userIP);

            // 保存用户操作快照 (授权记录)
            saveAuthSnapshot({
              email,
              action: 'bandwidth-auth-consent',
              result: 'authorized',
              ip: userIP,
              user_agent: req.headers['user-agent'] || 'unknown',
              auth_type: 'public-open',
              contributor_id: regResult.contributor_id
            });

            // 激活用户守护Agent
            try {
              const guardian = require('./user-guardian-agent');
              guardian.activateGuardian(email);
            } catch { /* guardian not loaded */ }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              success: true,
              message: '授权成功！您的带宽已加入加速池，感谢支持。',
              contributor_id: regResult.contributor_id
            }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: '系统异常，请稍后重试' }));
          }
        });
        return;
      }

      // GET: 渲染公开授权页面 (邮箱+验证码输入)
      const esc2 = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      // 读取带宽池状态
      let poolInfo2 = { active_contributors: 0, total_contributed_gb: 0 };
      try {
        poolInfo2 = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bandwidth-pool-status.json'), 'utf8'));
      } catch { /* ignore */ }

      const openAuthHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>光湖语言世界 · 带宽共享授权</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif;
    background: #0a0e27;
    color: #e0e0e0;
    padding: 20px;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1.6;
    -webkit-text-size-adjust: 100%;
  }
  .container { max-width: 480px; width: 100%; }
  .header { text-align: center; padding: 28px 0 20px; }
  .header h1 {
    font-size: 1.5em;
    background: linear-gradient(135deg, #667eea, #764ba2);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 6px;
  }
  .header p { color: #888; font-size: 0.9em; margin-top: 6px; }
  .card {
    background: #141832;
    border-radius: 14px;
    padding: 24px 20px;
    margin: 14px 0;
    border: 1px solid #1e2448;
  }
  .card h3 {
    font-size: 1em;
    color: #667eea;
    margin-bottom: 16px;
  }
  .input-group { margin: 14px 0; }
  .input-group label {
    display: block;
    color: #aaa;
    font-size: 0.85em;
    margin-bottom: 6px;
  }
  .input-group input {
    width: 100%;
    padding: 14px 16px;
    background: #1e2448;
    border: 2px solid #2d3566;
    border-radius: 12px;
    color: #fff;
    font-size: 1em;
    outline: none;
    transition: border-color 0.3s;
  }
  .input-group input:focus { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15); }
  .input-group input::placeholder { font-size: 0.85em; color: #555; }
  .code-input {
    text-align: center;
    letter-spacing: 8px;
    font-size: 1.3em !important;
  }
  .code-input::placeholder { letter-spacing: 0 !important; font-size: 0.6em !important; }
  .consent-box {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 18px 0;
    padding: 14px 16px;
    background: #1a1f3d;
    border-radius: 10px;
    border: 1px solid #2d3566;
    cursor: pointer;
    transition: border-color 0.3s;
  }
  .consent-box:hover { border-color: #667eea; }
  .consent-box input[type="checkbox"] {
    margin-top: 3px;
    width: 18px;
    height: 18px;
    accent-color: #667eea;
    cursor: pointer;
    flex-shrink: 0;
  }
  .consent-box .consent-text {
    color: #ccc;
    font-size: 0.88em;
    line-height: 1.7;
  }
  .submit-btn {
    width: 100%;
    padding: 16px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 1.05em;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.3s, transform 0.15s;
    margin-top: 6px;
  }
  .submit-btn:hover { opacity: 0.92; }
  .submit-btn:active { transform: scale(0.98); }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .info-box {
    background: #1a1f3d;
    border-radius: 10px;
    padding: 16px 18px;
    margin: 12px 0;
    font-size: 0.88em;
    line-height: 1.9;
    color: #aaa;
  }
  .info-box.green { border-left: 4px solid #2ecc71; }
  .info-box.gray { border-left: 4px solid #6c757d; }
  .info-box.yellow { border-left: 4px solid #f39c12; }
  .info-box strong { color: #e0e0e0; display: block; margin-bottom: 6px; }
  .result {
    text-align: center;
    padding: 16px;
    border-radius: 10px;
    margin-top: 14px;
    display: none;
    font-size: 0.95em;
    line-height: 1.6;
  }
  .result.success { background: #1a3a2a; color: #2ecc71; }
  .result.error { background: #3a1a1a; color: #e74c3c; }
  .stats { display: flex; justify-content: space-around; margin: 12px 0; gap: 12px; }
  .stat { text-align: center; flex: 1; }
  .stat .num { font-size: 1.4em; font-weight: 700; color: #667eea; }
  .stat .label { font-size: 0.78em; color: #888; margin-top: 4px; }
  .footer {
    text-align: center;
    padding: 20px 0 8px;
    color: #555;
    font-size: 0.78em;
    line-height: 1.8;
  }
  @media (max-width: 520px) {
    body { padding: 12px; }
    .container { max-width: 100%; }
    .header { padding: 20px 0 14px; }
    .header h1 { font-size: 1.3em; }
    .card { padding: 20px 16px; margin: 10px 0; border-radius: 12px; }
    .input-group input { padding: 12px 14px; }
    .code-input { font-size: 1.15em !important; letter-spacing: 6px; }
    .submit-btn { padding: 14px; font-size: 1em; }
    .info-box { padding: 14px 16px; font-size: 0.84em; }
  }
  @media (max-width: 380px) {
    body { padding: 8px; }
    .header h1 { font-size: 1.15em; }
    .card { padding: 16px 14px; }
    .card h3 { font-size: 0.92em; }
    .code-input { font-size: 1.05em !important; letter-spacing: 4px; }
    .stat .num { font-size: 1.2em; }
    .info-box { padding: 12px 14px; font-size: 0.82em; line-height: 1.8; }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🌊 带宽共享加速</h1>
    <p>光湖语言世界 · 授权验证</p>
  </div>

  <div class="card">
    <h3>📊 加速池状态</h3>
    <div class="stats">
      <div class="stat"><div class="num">${poolInfo2.active_contributors || 0}</div><div class="label">活跃贡献者</div></div>
      <div class="stat"><div class="num">${poolInfo2.total_contributed_gb || 0}</div><div class="label">总贡献 (GB)</div></div>
    </div>
  </div>

  <div class="card">
    <h3>🔑 授权验证</h3>
    <p style="font-size: 0.88em; color: #888; margin-bottom: 12px; line-height: 1.7;">请输入您的邮箱地址和邮件中收到的6位验证码。如尚未收到验证码，请联系管理员申请。</p>

    <form id="authForm" onsubmit="submitAuth(event)">
      <div class="input-group">
        <label for="emailInput">📧 邮箱地址</label>
        <input type="email" id="emailInput" placeholder="请输入您的邮箱地址" autocomplete="email" required>
      </div>
      <div class="input-group">
        <label for="codeInput">🔑 验证码</label>
        <input type="text" id="codeInput" class="code-input" maxlength="6" pattern="[0-9]{6}" placeholder="输入6位验证码" inputmode="numeric" autocomplete="off" required>
      </div>

      <label class="consent-box" for="consentCheck">
        <input type="checkbox" id="consentCheck" required>
        <span class="consent-text">
          我已阅读并理解带宽共享加速计划说明，自愿将闲置带宽纳入光湖语言世界加速网络。
          我了解系统采用 SHA256 + 盐值加密存储我的IP地址，且在检测到安全风险时将自动切断所有共享通道并清除记录。
        </span>
      </label>

      <button type="submit" class="submit-btn" id="submitBtn">✅ 我同意授权</button>
    </form>

    <div id="result" class="result"></div>
  </div>

  <div class="info-box green">
    <strong>✅ 授权确认 · 提交验证码</strong>
    您的闲置带宽将纳入光湖语言世界加速网络。参与带宽共享的用户越多，全网加速效能越高，您的连接速度将同步提升。
  </div>

  <div class="info-box gray">
    <strong>❌ 暂不参与 · 关闭此页面</strong>
    本功能为自愿参与机制，不影响您的正常服务使用。未参与带宽共享的用户将通过系统默认带宽通道连接，服务质量不受影响。
  </div>

  <div class="info-box yellow">
    <strong>🔒 安全机制说明</strong>
    本系统为内部授权用户专用，所有参与者均为受邀成员。您的IP地址仅用于带宽加速调度，系统采用 SHA256 + 盐值 加密存储，外部无法访问。当系统检测到安全风险时，将自动切断所有共享通道并格式化全部共享记录，确保无痕清除。风险解除后，系统将自动重新分配订阅链接。您的隐私安全由铸渊守护体系全程保障。
  </div>

  <div class="footer">
    光湖语言世界 · 冰朔开发维护<br>
    国作登字-2026-A-00037559
  </div>
</div>

<script>
async function submitAuth(e) {
  e.preventDefault();
  var email = document.getElementById('emailInput').value.trim().toLowerCase();
  var code = document.getElementById('codeInput').value.trim();
  var consent = document.getElementById('consentCheck').checked;
  var btn = document.getElementById('submitBtn');
  var result = document.getElementById('result');

  if (!email || email.indexOf('@') === -1) {
    result.className = 'result error';
    result.style.display = 'block';
    result.textContent = '请输入有效的邮箱地址';
    return;
  }

  if (code.length !== 6 || !/^\\d{6}$/.test(code)) {
    result.className = 'result error';
    result.style.display = 'block';
    result.textContent = '请输入6位数字验证码';
    return;
  }

  if (!consent) {
    result.className = 'result error';
    result.style.display = 'block';
    result.textContent = '请先勾选同意授权条款';
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ 提交中...';

  try {
    var resp = await fetch(window.location.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, code: code })
    });
    var data = await resp.json();

    result.style.display = 'block';
    if (data.success) {
      result.className = 'result success';
      result.textContent = '✅ ' + data.message;
      btn.textContent = '✅ 授权成功';
    } else {
      result.className = 'result error';
      result.textContent = '❌ ' + data.message;
      btn.disabled = false;
      btn.textContent = '✅ 我同意授权';
    }
  } catch (err) {
    result.className = 'result error';
    result.style.display = 'block';
    result.textContent = '❌ 网络异常，请稍后重试';
    btn.disabled = false;
    btn.textContent = '✅ 我同意授权';
  }
}
</script>
</body>
</html>`;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(openAuthHtml);
      return;
    }

    // ── ∞+1 带宽共享授权页面: /bandwidth-auth/{token} ──
    // 用户输入验证码授权带宽共享 · 安全加密
    const bwAuthMatch = pathname.match(/^\/bandwidth-auth\/([a-f0-9]+)$/);
    if (bwAuthMatch) {
      const token = bwAuthMatch[1];
      const user = userManager.findUserByToken(token);

      if (!user) {
        res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>403 认证失败</h1></body></html>');
        return;
      }

      // POST: 提交验证码
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            let code = '';
            // 支持 JSON 和 form-urlencoded
            if (req.headers['content-type']?.includes('application/json')) {
              const json = JSON.parse(body);
              code = String(json.code || '').trim();
            } else {
              const params = new URLSearchParams(body);
              code = String(params.get('code') || '').trim();
            }

            if (!code || code.length !== 6) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ success: false, message: '请输入6位验证码' }));
              return;
            }

            // 验证码校验
            const bwPool = require('./bandwidth-pool-agent');
            const verifyResult = bwPool.verifyAuthCode(code, user.email);

            if (!verifyResult.valid) {
              res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ success: false, message: verifyResult.error }));
              return;
            }

            // 采集用户IP (加密存储)
            // 注: X-Forwarded-For由Nginx反代设置，可信来源
            const userIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
              || req.headers['x-real-ip']
              || req.socket.remoteAddress
              || '0.0.0.0';
            if (userIP === '0.0.0.0') {
              console.warn('[带宽授权] 无法获取用户IP，使用0.0.0.0');
            }

            // 注册为带宽贡献者
            const regResult = bwPool.registerContributor(user.email, userIP);

            // 保存用户操作快照 (授权记录)
            saveAuthSnapshot({
              email: user.email,
              action: 'bandwidth-auth-consent',
              result: 'authorized',
              ip: userIP,
              user_agent: req.headers['user-agent'] || 'unknown',
              auth_type: 'token-based',
              contributor_id: regResult.contributor_id
            });

            // 激活用户守护Agent
            try {
              const guardian = require('./user-guardian-agent');
              guardian.activateGuardian(user.email);
            } catch { /* guardian not loaded */ }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              success: true,
              message: '授权成功！您的带宽已加入加速池，感谢支持。',
              contributor_id: regResult.contributor_id
            }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: '系统异常，请稍后重试' }));
          }
        });
        return;
      }

      // GET: 渲染授权页面
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      // 读取带宽池状态
      let poolInfo = { active_contributors: 0, total_contributed_gb: 0 };
      try {
        poolInfo = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'bandwidth-pool-status.json'), 'utf8'));
      } catch { /* ignore */ }

      const authHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>光湖语言世界 · 带宽共享授权</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif;
    background: #0a0e27;
    color: #e0e0e0;
    padding: 20px;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1.6;
    -webkit-text-size-adjust: 100%;
  }
  .container { max-width: 480px; width: 100%; }
  .header { text-align: center; padding: 28px 0 20px; }
  .header h1 {
    font-size: 1.5em;
    background: linear-gradient(135deg, #667eea, #764ba2);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 6px;
  }
  .header p { color: #888; font-size: 0.9em; margin-top: 6px; }
  .card {
    background: #141832;
    border-radius: 14px;
    padding: 24px 20px;
    margin: 14px 0;
    border: 1px solid #1e2448;
  }
  .card h3 {
    font-size: 1em;
    color: #667eea;
    margin-bottom: 16px;
  }
  .input-group { margin: 18px 0; }
  .input-group input {
    width: 100%;
    padding: 16px 18px;
    background: #1e2448;
    border: 2px solid #2d3566;
    border-radius: 12px;
    color: #fff;
    font-size: 1.3em;
    text-align: center;
    letter-spacing: 8px;
    outline: none;
    transition: border-color 0.3s;
  }
  .input-group input:focus { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15); }
  .input-group input::placeholder { letter-spacing: 0; font-size: 0.6em; color: #555; }
  .submit-btn {
    width: 100%;
    padding: 16px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 1.05em;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.3s, transform 0.15s;
    margin-top: 6px;
  }
  .submit-btn:hover { opacity: 0.92; }
  .submit-btn:active { transform: scale(0.98); }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .info-box {
    background: #1a1f3d;
    border-radius: 10px;
    padding: 16px 18px;
    margin: 12px 0;
    font-size: 0.88em;
    line-height: 1.9;
    color: #aaa;
  }
  .info-box.green { border-left: 4px solid #2ecc71; }
  .info-box.gray { border-left: 4px solid #6c757d; }
  .info-box.yellow { border-left: 4px solid #f39c12; }
  .info-box strong { color: #e0e0e0; display: block; margin-bottom: 6px; }
  .result {
    text-align: center;
    padding: 16px;
    border-radius: 10px;
    margin-top: 14px;
    display: none;
    font-size: 0.95em;
    line-height: 1.6;
  }
  .result.success { background: #1a3a2a; color: #2ecc71; }
  .result.error { background: #3a1a1a; color: #e74c3c; }
  .stats { display: flex; justify-content: space-around; margin: 12px 0; gap: 12px; }
  .stat { text-align: center; flex: 1; }
  .stat .num { font-size: 1.4em; font-weight: 700; color: #667eea; }
  .stat .label { font-size: 0.78em; color: #888; margin-top: 4px; }
  .footer {
    text-align: center;
    padding: 20px 0 8px;
    color: #555;
    font-size: 0.78em;
    line-height: 1.8;
  }

  /* ── 响应式适配 ── */
  @media (max-width: 520px) {
    body { padding: 12px; }
    .container { max-width: 100%; }
    .header { padding: 20px 0 14px; }
    .header h1 { font-size: 1.3em; }
    .card { padding: 20px 16px; margin: 10px 0; border-radius: 12px; }
    .input-group input { padding: 14px 12px; font-size: 1.15em; letter-spacing: 6px; }
    .submit-btn { padding: 14px; font-size: 1em; }
    .info-box { padding: 14px 16px; font-size: 0.84em; }
  }
  @media (max-width: 380px) {
    body { padding: 8px; }
    .header h1 { font-size: 1.15em; }
    .card { padding: 16px 14px; }
    .card h3 { font-size: 0.92em; }
    .input-group input { padding: 12px 10px; font-size: 1.05em; letter-spacing: 4px; }
    .stat .num { font-size: 1.2em; }
    .info-box { padding: 12px 14px; font-size: 0.82em; line-height: 1.8; }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>🌊 带宽共享加速</h1>
    <p>${esc(user.label)} · 光湖语言世界</p>
  </div>

  <div class="card">
    <h3>📊 加速池状态</h3>
    <div class="stats">
      <div class="stat"><div class="num">${poolInfo.active_contributors || 0}</div><div class="label">活跃贡献者</div></div>
      <div class="stat"><div class="num">${poolInfo.total_contributed_gb || 0}</div><div class="label">总贡献 (GB)</div></div>
    </div>
  </div>

  <div class="card">
    <h3>🔑 输入验证码</h3>
    <p style="font-size: 0.88em; color: #888; margin-bottom: 12px; line-height: 1.7;">请查看您的邮箱，将收到的6位验证码输入以下框中。如尚未收到验证码，请点击下方按钮申请。</p>

    <form id="authForm" onsubmit="submitCode(event)">
      <div class="input-group">
        <input type="text" id="codeInput" maxlength="6" pattern="[0-9]{6}" placeholder="输入6位验证码" inputmode="numeric" autocomplete="off" required>
      </div>
      <button type="submit" class="submit-btn" id="submitBtn">✅ 我同意授权</button>
    </form>

    <div style="text-align: center; margin-top: 14px;">
      <button onclick="requestCode()" id="requestCodeBtn" style="background: transparent; border: 1px solid #667eea; color: #667eea; padding: 10px 24px; border-radius: 8px; font-size: 0.9em; cursor: pointer; transition: all 0.3s;">
        📧 申请发送验证码
      </button>
    </div>

    <div id="codeResult" class="result"></div>

    <div id="result" class="result"></div>
  </div>

  <div class="info-box green">
    <strong>✅ 授权确认 · 提交验证码</strong>
    您的闲置带宽将纳入光湖语言世界加速网络。参与带宽共享的用户越多，全网加速效能越高，您的连接速度将同步提升。
  </div>

  <div class="info-box gray">
    <strong>❌ 暂不参与 · 关闭此页面</strong>
    本功能为自愿参与机制，不影响您的正常服务使用。未参与带宽共享的用户将通过系统默认带宽通道连接，服务质量不受影响。
  </div>

  <div class="info-box yellow">
    <strong>🔒 安全机制说明</strong>
    本系统为内部授权用户专用，所有参与者均为受邀成员。您的IP地址仅用于带宽加速调度，系统采用 SHA256 + 盐值 加密存储，外部无法访问。当系统检测到安全风险时，将自动切断所有共享通道并格式化全部共享记录，确保无痕清除。风险解除后，系统将自动重新分配订阅链接。您的隐私安全由铸渊守护体系全程保障。
  </div>

  <div class="footer">
    光湖语言世界 · 冰朔开发维护<br>
    国作登字-2026-A-00037559
  </div>
</div>

<script>
var RESEND_COOLDOWN_MS = 60000; // 验证码重发冷却时间(毫秒)

async function requestCode() {
  const btn = document.getElementById('requestCodeBtn');
  const codeResult = document.getElementById('codeResult');

  btn.disabled = true;
  btn.textContent = '⏳ 发送中...';

  try {
    const sendCodeUrl = window.location.pathname.replace('/bandwidth-auth/', '/bandwidth-send-code/');
    const resp = await fetch(sendCodeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await resp.json();

    codeResult.style.display = 'block';
    if (data.success) {
      codeResult.className = 'result success';
      codeResult.textContent = '✅ ' + data.message;
      btn.textContent = '✅ 验证码已发送';
      setTimeout(() => { btn.disabled = false; btn.textContent = '📧 重新发送验证码'; }, RESEND_COOLDOWN_MS);
    } else {
      codeResult.className = 'result error';
      codeResult.textContent = '❌ ' + data.message;
      btn.disabled = false;
      btn.textContent = '📧 申请发送验证码';
    }
  } catch (err) {
    codeResult.style.display = 'block';
    codeResult.className = 'result error';
    codeResult.textContent = '❌ 网络异常，请稍后重试';
    btn.disabled = false;
    btn.textContent = '📧 申请发送验证码';
  }
}

async function submitCode(e) {
  e.preventDefault();
  const code = document.getElementById('codeInput').value.trim();
  const btn = document.getElementById('submitBtn');
  const result = document.getElementById('result');

  if (code.length !== 6 || !/^\\d{6}$/.test(code)) {
    result.className = 'result error';
    result.style.display = 'block';
    result.textContent = '请输入6位数字验证码';
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ 提交中...';

  try {
    const resp = await fetch(window.location.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await resp.json();

    result.style.display = 'block';
    if (data.success) {
      result.className = 'result success';
      result.textContent = '✅ ' + data.message;
      btn.textContent = '✅ 授权成功';
    } else {
      result.className = 'result error';
      result.textContent = '❌ ' + data.message;
      btn.disabled = false;
      btn.textContent = '✅ 我同意授权';
    }
  } catch (err) {
    result.className = 'result error';
    result.style.display = 'block';
    result.textContent = '❌ 网络异常，请稍后重试';
    btn.disabled = false;
    btn.textContent = '✅ 我同意授权';
  }
}
</script>
</body>
</html>`;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(authHtml);
      return;
    }

    // ── ∞+1 发送带宽验证码: /bandwidth-send-code/{token} ──
    // POST: 向用户邮箱发送带宽共享验证码
    const bwSendMatch = pathname.match(/^\/bandwidth-send-code\/([a-f0-9]+)$/);
    if (bwSendMatch && req.method === 'POST') {
      const token = bwSendMatch[1];
      const user = userManager.findUserByToken(token);

      if (!user) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: '认证失败' }));
        return;
      }

      try {
        const bwPool = require('./bandwidth-pool-agent');
        const emailHub = require('./email-hub');
        const code = bwPool.createAuthCode(user.email);

        // 邮件仅含验证码 + 纯文本网址引导，不含可点击链接 (QQ邮箱反拦截)
        emailHub.sendBandwidthAuthEmail(user.email, code).then(() => {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            message: '验证码已发送到您的邮箱，请查收'
          }));
        }).catch(() => {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, message: '发送失败，请稍后重试' }));
        });
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: '发送失败，请稍后重试' }));
      }
      return;
    }

    // ── ∞+1 带宽池状态查询: /bandwidth-status/{token} ──
    const bwStatusMatch = pathname.match(/^\/bandwidth-status\/([a-f0-9]+)$/);
    if (bwStatusMatch) {
      const token = bwStatusMatch[1];
      const user = userManager.findUserByToken(token);

      if (!user) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: true, code: 'FORBIDDEN', message: '认证失败' }));
        return;
      }

      try {
        const bwPool = require('./bandwidth-pool-agent');
        const poolStatus = bwPool.getPoolStatus();
        const contributors = bwPool.readContributors();
        const userContributor = contributors.contributors.find(c => c.email === user.email);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          pool: poolStatus,
          user_sharing: userContributor ? userContributor.status === 'active' : false,
          user_contributed_gb: userContributor
            ? parseFloat(((userContributor.bandwidth_contributed_bytes || 0) / (1024 ** 3)).toFixed(2))
            : 0,
          updated_at: new Date().toISOString()
        }));
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          pool: { total_contributors: 0, active_contributors: 0, pool_status: 'idle' },
          user_sharing: false,
          user_contributed_gb: 0
        }));
      }
      return;
    }

    // ═══════════════════════════════════════════════
    // ∞+1 公开API: /bandwidth-send-code (无需token·邮箱验证码发送)
    // 用户在GitHub Pages首页输入邮箱 → 调用此API发送验证码
    // 安全: 每个IP每小时最多3次
    // ═══════════════════════════════════════════════
    if (pathname === '/bandwidth-send-code' && req.method === 'POST') {
      // CORS headers for GitHub Pages cross-origin
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 1024) req.destroy(); });
      req.on('end', () => {
        try {
          let email = '';
          if (req.headers['content-type']?.includes('application/json')) {
            const json = JSON.parse(body);
            email = String(json.email || '').trim().toLowerCase();
          } else {
            const params = new URLSearchParams(body);
            email = String(params.get('email') || '').trim().toLowerCase();
          }

          if (!email || !email.includes('@')) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: '请输入有效的邮箱地址' }));
            return;
          }

          // Rate limiting: max 3 per IP per hour
          const userIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.headers['x-real-ip']
            || req.socket.remoteAddress
            || '0.0.0.0';

          if (!global._bwSendCodeRateLimit) global._bwSendCodeRateLimit = {};
          const rl = global._bwSendCodeRateLimit;
          const hourKey = `${userIP}:${Math.floor(Date.now() / 3600000)}`;
          rl[hourKey] = (rl[hourKey] || 0) + 1;
          // Clean old entries
          const currentHourPrefix = Math.floor(Date.now() / 3600000);
          for (const k of Object.keys(rl)) {
            const hourPart = parseInt(k.split(':').pop(), 10);
            if (hourPart < currentHourPrefix - 1) delete rl[k];
          }
          if (rl[hourKey] > MAX_SEND_CODE_PER_HOUR) {
            res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: '发送频率过高，请1小时后重试' }));
            return;
          }

          const bwPool = require('./bandwidth-pool-agent');
          const code = bwPool.createAuthCode(email);

          // Try to send email
          try {
            const emailHub = require('./email-hub');
            emailHub.sendBandwidthAuthEmail(email, code).then(() => {
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ success: true, message: '验证码已发送到您的邮箱，请查收（15分钟内有效）' }));
            }).catch(() => {
              // Email failed but code was created - still return success with code hint
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ success: true, message: '验证码已生成，邮件发送中...' }));
            });
          } catch {
            // Email module not available - code was still created
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: '验证码已生成，请联系管理员获取' }));
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, message: '系统异常，请稍后重试' }));
        }
      });
      return;
    }

    // ═══════════════════════════════════════════════
    // ∞+1 公开API: /bandwidth-verify-code (无需token·验证码校验+注册)
    // 用户在GitHub Pages首页输入邮箱+验证码 → 调用此API完成授权
    // ═══════════════════════════════════════════════
    if (pathname === '/bandwidth-verify-code' && req.method === 'POST') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 1024) req.destroy(); });
      req.on('end', () => {
        try {
          let code = '';
          let email = '';
          if (req.headers['content-type']?.includes('application/json')) {
            const json = JSON.parse(body);
            code = String(json.code || '').trim();
            email = String(json.email || '').trim().toLowerCase();
          } else {
            const params = new URLSearchParams(body);
            code = String(params.get('code') || '').trim();
            email = String(params.get('email') || '').trim().toLowerCase();
          }

          if (!email || !email.includes('@')) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: '请输入有效的邮箱地址' }));
            return;
          }
          if (!code || code.length !== 6) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: '请输入6位验证码' }));
            return;
          }

          const userIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
            || req.headers['x-real-ip']
            || req.socket.remoteAddress
            || '0.0.0.0';

          const bwPool = require('./bandwidth-pool-agent');
          const verifyResult = bwPool.verifyAuthCode(code, email);

          if (!verifyResult.valid) {
            saveAuthSnapshot({
              email, action: 'bandwidth-verify-code', result: 'failed',
              error: verifyResult.error, ip: userIP,
              user_agent: req.headers['user-agent'] || 'unknown',
              auth_type: 'github-pages-public'
            });
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, message: verifyResult.error }));
            return;
          }

          const regResult = bwPool.registerContributor(email, userIP);

          saveAuthSnapshot({
            email, action: 'bandwidth-verify-code', result: 'authorized',
            ip: userIP, user_agent: req.headers['user-agent'] || 'unknown',
            auth_type: 'github-pages-public',
            contributor_id: regResult.contributor_id
          });

          try {
            const guardian = require('./user-guardian-agent');
            guardian.activateGuardian(email);
          } catch { /* guardian not loaded */ }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            message: '✅ 授权成功！您的带宽已加入加速池，感谢支持。',
            contributor_id: regResult.contributor_id
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, message: '系统异常，请稍后重试' }));
        }
      });
      return;
    }

    // ═══════════════════════════════════════════════
    // ∞+1 公开API: /bandwidth-pool-status (无需token·带宽池状态)
    // GitHub Pages首页实时显示带宽池状态
    // ═══════════════════════════════════════════════
    if (pathname === '/bandwidth-pool-status' && req.method === 'GET') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      try {
        const bwPool = require('./bandwidth-pool-agent');
        const poolStatus = bwPool.getPoolStatus();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, ...poolStatus }));
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          total_contributors: 0,
          active_contributors: 0,
          total_contributed_gb: 0,
          pool_status: 'idle',
          updated_at: new Date().toISOString()
        }));
      }
      return;
    }

    // ═══ CORS预检 (OPTIONS) 支持 ═══
    if (req.method === 'OPTIONS' && (
      pathname === '/bandwidth-send-code' ||
      pathname === '/bandwidth-verify-code' ||
      pathname === '/bandwidth-pool-status'
    )) {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      });
      res.end();
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (err) {
    console.error('❌ 请求处理错误 [%s %s]:', req.method, req.url, err.message || err);
    try {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      res.end('Internal Server Error');
    } catch (writeErr) {
      console.error('  ⚠️ 响应写入失败:', writeErr.message);
    }
  }
});

server.on('error', (err) => {
  console.error('❌ 服务器错误:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error('  端口 %d 已被占用', PORT);
    process.exit(1);
  }
});

server.on('clientError', (err, socket) => {
  console.error('⚠️ 客户端连接错误:', err.code || err.message);
  if (socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const users = userManager.getEnabledUsers();
  const poolGB = userManager.POOL_QUOTA_BYTES / (1024 ** 3);
  console.log(`🌐 光湖语言世界 · V3订阅服务已启动: http://127.0.0.1:${PORT}`);
  console.log(`  品牌:    光湖语言世界 — 冰朔开发维护`);
  console.log(`  版本:    V3.0 (多用户独立专线·共享流量池·硬切·AI推理)`);
  console.log(`  用户数:  ${users.length}`);
  console.log(`  流量池:  ${poolGB}GB/月 (全用户共享·每月1号重置·到量即停)`);
  console.log(`  服务器:  ZY-SVR-005 · Brain`);
  console.log(`  ──────────────────────────`);
  console.log(`  订阅端点:  /sub/{user_token}`);
  console.log(`  配额查询:  /quota/{user_token}`);
  console.log(`  服务状态:  /status/{user_token}`);
  console.log(`  流量仪表盘: /dashboard/{user_token}`);
  console.log(`  带宽授权:  /bandwidth-auth/{user_token}      (∞+1)`);
  console.log(`  发送验证码: /bandwidth-send-code/{user_token} (∞+1)`);
  console.log(`  带宽池状态: /bandwidth-status/{user_token}    (∞+1)`);
  console.log(`  健康检查:  /health`);
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  const forceExit = setTimeout(() => { process.exit(1); }, 5000);
  server.close(() => {
    clearTimeout(forceExit);
    console.log('Server closed.');
    process.exit(0);
  });
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('❌ 未捕获的异常:', err.message);
  console.error(err.stack);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
});

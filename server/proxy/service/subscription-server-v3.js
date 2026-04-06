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
  const toolProxies = nodes.length > 1
    ? `      - "♻️ 自动选择"\n${nodeNames}`
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

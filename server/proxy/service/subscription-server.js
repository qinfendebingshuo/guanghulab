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
// 端口: 3802 (绑定127.0.0.1，仅通过Nginx反代访问)
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
const os = require('os');

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
// v3.0 · 完整Mihomo/Clash Meta兼容配置
// 必须包含: DNS fake-ip + 全局设置 + sniffer + GeoData
// 缺少DNS配置会导致Clash流量为0 (DNS查询绕过代理)
function generateClashYaml(keys, serverHost) {
  const cnRelayHost = getCnRelayHost();
  const cnRelayPort = getCnRelayPort();

  // CN中转节点 (如果已配置)
  // 注: CN中转是透明TCP转发(CN:2053 → SG:443)，所以Reality设置仍指向SG的配置
  // servername/public-key/short-id 与SG直连节点完全相同，因为TLS握手实际发生在SG端
  const cnProxyBlock = cnRelayHost ? `
  - name: "🇨🇳 铸渊专线-CN中转"
    type: vless
    server: ${cnRelayHost}
    port: ${cnRelayPort}
    uuid: ${keys.ZY_PROXY_UUID}
    network: tcp
    tls: true
    udp: true
    flow: xtls-rprx-vision
    skip-cert-verify: false
    servername: www.microsoft.com
    reality-opts:
      public-key: ${keys.ZY_PROXY_REALITY_PUBLIC_KEY}
      short-id: ${keys.ZY_PROXY_REALITY_SHORT_ID}
    client-fingerprint: chrome` : '';

  // 代理组中的节点列表
  // SG直连优先 (更可靠的直连节点排在前面作为默认)
  const proxyList = cnRelayHost
    ? `      - "🏛️ 铸渊专线-SG直连"
      - "🇨🇳 铸渊专线-CN中转"`
    : '      - "🏛️ 铸渊专线-SG直连"';

  // 自动选择组 (url-test: 自动测试延迟，选择最快可用节点)
  // CN中转如果不可用(connection refused)会自动被排除
  const autoGroupBlock = cnRelayHost ? `
  - name: "♻️ 自动选择"
    type: url-test
    proxies:
      - "🏛️ 铸渊专线-SG直连"
      - "🇨🇳 铸渊专线-CN中转"
    url: "http://www.gstatic.com/generate_204"
    interval: 300
    tolerance: 50
` : '';

  // 主代理组: 有CN时默认使用自动选择，无CN时直接使用SG
  const mainGroupProxies = cnRelayHost
    ? `      - "♻️ 自动选择"
      - "🏛️ 铸渊专线-SG直连"
      - "🇨🇳 铸渊专线-CN中转"
      - DIRECT`
    : `      - "🏛️ 铸渊专线-SG直连"
      - DIRECT`;

  return `# 铸渊专线 · ZY-Proxy Subscription
# 自动生成 · ${new Date().toISOString()}
# ⚠️ 请勿分享此配置
# 配置版本: v3.0 (Mihomo/Clash Meta 完整兼容)
${cnRelayHost ? `# 🇨🇳 包含CN中转节点 (国内直连广州→转发新加坡)` : ''}

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
keep-alive-interval: 30
external-controller: 127.0.0.1:9090

# ── GeoData 数据源 ────────────────────────
geox-url:
  geoip: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat"
  geosite: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat"
  mmdb: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb"

# ── DNS 设置 (fake-ip模式·必须) ───────────
# 缺少此配置会导致DNS查询绕过代理，流量显示0
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
    - "+.stun.*.*.*.*"
    - "+.stun.*.*.*.*.*"
    - "lens.l.google.com"
    - "stun.l.google.com"
    - "time.*.com"
    - "time.*.gov"
    - "time.*.edu.cn"
    - "time.*.apple.com"
    - "time-ios.apple.com"
    - "time-macos.apple.com"
    - "time1.*.com"
    - "ntp.*.com"
    - "+.pool.ntp.org"
    - "music.163.com"
    - "*.music.163.com"
    - "*.126.net"
    - "*.ntp.org.cn"
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
      - "+.google.com.hk"
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

# ── 代理节点 ──────────────────────────────
proxies:
  - name: "🏛️ 铸渊专线-SG直连"
    type: vless
    server: ${serverHost}
    port: 443
    uuid: ${keys.ZY_PROXY_UUID}
    network: tcp
    tls: true
    udp: true
    flow: xtls-rprx-vision
    skip-cert-verify: false
    servername: www.microsoft.com
    reality-opts:
      public-key: ${keys.ZY_PROXY_REALITY_PUBLIC_KEY}
      short-id: ${keys.ZY_PROXY_REALITY_SHORT_ID}
    client-fingerprint: chrome
${cnProxyBlock}

# ── 代理组 ────────────────────────────────
proxy-groups:
  - name: "🌐 铸渊专线"
    type: select
    proxies:
${mainGroupProxies}
${autoGroupBlock}
  - name: "🤖 AI服务"
    type: select
    proxies:
${proxyList}

  - name: "💻 开发工具"
    type: select
    proxies:
${proxyList}

# ── 路由规则 ──────────────────────────────
rules:
  # AI服务
  - DOMAIN-SUFFIX,openai.com,🤖 AI服务
  - DOMAIN-SUFFIX,anthropic.com,🤖 AI服务
  - DOMAIN-SUFFIX,claude.ai,🤖 AI服务
  - DOMAIN-SUFFIX,chatgpt.com,🤖 AI服务
  - DOMAIN-SUFFIX,bard.google.com,🤖 AI服务
  - DOMAIN-SUFFIX,gemini.google.com,🤖 AI服务
  - DOMAIN-SUFFIX,ai.google.dev,🤖 AI服务
  - DOMAIN-SUFFIX,perplexity.ai,🤖 AI服务
  - DOMAIN-SUFFIX,poe.com,🤖 AI服务

  # 开发工具
  - DOMAIN-SUFFIX,github.com,💻 开发工具
  - DOMAIN-SUFFIX,githubusercontent.com,💻 开发工具
  - DOMAIN-SUFFIX,github.io,💻 开发工具
  - DOMAIN-SUFFIX,githubassets.com,💻 开发工具
  - DOMAIN-SUFFIX,copilot.microsoft.com,💻 开发工具
  - DOMAIN-SUFFIX,npmjs.com,💻 开发工具
  - DOMAIN-SUFFIX,npmjs.org,💻 开发工具
  - DOMAIN-SUFFIX,docker.com,💻 开发工具
  - DOMAIN-SUFFIX,docker.io,💻 开发工具
  - DOMAIN-SUFFIX,stackoverflow.com,💻 开发工具
  - DOMAIN-SUFFIX,stackexchange.com,💻 开发工具
  - DOMAIN-SUFFIX,vercel.app,💻 开发工具
  - DOMAIN-SUFFIX,netlify.app,💻 开发工具
  - DOMAIN-SUFFIX,pypi.org,💻 开发工具

  # 社交媒体 & 流媒体
  - DOMAIN-SUFFIX,tiktok.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,twitter.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,x.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,twimg.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,youtube.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,ytimg.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,yt.be,🌐 铸渊专线
  - DOMAIN-SUFFIX,googlevideo.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,google.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,googleapis.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,gstatic.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,ggpht.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,telegram.org,🌐 铸渊专线
  - DOMAIN-SUFFIX,t.me,🌐 铸渊专线
  - DOMAIN-SUFFIX,telesco.pe,🌐 铸渊专线
  - DOMAIN-SUFFIX,instagram.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,cdninstagram.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,facebook.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,fbcdn.net,🌐 铸渊专线
  - DOMAIN-SUFFIX,whatsapp.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,whatsapp.net,🌐 铸渊专线
  - DOMAIN-SUFFIX,wikipedia.org,🌐 铸渊专线
  - DOMAIN-SUFFIX,wikimedia.org,🌐 铸渊专线
  - DOMAIN-SUFFIX,reddit.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,redd.it,🌐 铸渊专线
  - DOMAIN-SUFFIX,redditstatic.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,netflix.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,nflxvideo.net,🌐 铸渊专线
  - DOMAIN-SUFFIX,spotify.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,discord.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,discord.gg,🌐 铸渊专线
  - DOMAIN-SUFFIX,discordapp.com,🌐 铸渊专线

  # Apple 服务
  - DOMAIN-SUFFIX,apple.com,DIRECT
  - DOMAIN-SUFFIX,icloud.com,DIRECT
  - DOMAIN-SUFFIX,mzstatic.com,DIRECT
  - DOMAIN-KEYWORD,apple,DIRECT
  - DOMAIN-KEYWORD,icloud,DIRECT

  # 国内常用直连
  - DOMAIN-SUFFIX,cn,DIRECT
  - DOMAIN-SUFFIX,npmmirror.com,DIRECT
  - DOMAIN-SUFFIX,taobao.com,DIRECT
  - DOMAIN-SUFFIX,tmall.com,DIRECT
  - DOMAIN-SUFFIX,alipay.com,DIRECT
  - DOMAIN-SUFFIX,alibaba.com,DIRECT
  - DOMAIN-SUFFIX,aliyun.com,DIRECT
  - DOMAIN-SUFFIX,aliyuncs.com,DIRECT
  - DOMAIN-SUFFIX,jd.com,DIRECT
  - DOMAIN-SUFFIX,qq.com,DIRECT
  - DOMAIN-SUFFIX,tencent.com,DIRECT
  - DOMAIN-SUFFIX,weixin.qq.com,DIRECT
  - DOMAIN-SUFFIX,bilibili.com,DIRECT
  - DOMAIN-SUFFIX,163.com,DIRECT
  - DOMAIN-SUFFIX,126.net,DIRECT
  - DOMAIN-SUFFIX,baidu.com,DIRECT
  - DOMAIN-SUFFIX,bdstatic.com,DIRECT
  - DOMAIN-SUFFIX,zhihu.com,DIRECT
  - DOMAIN-SUFFIX,douyin.com,DIRECT
  - DOMAIN-SUFFIX,doubanio.com,DIRECT
  - DOMAIN-SUFFIX,weibo.com,DIRECT
  - DOMAIN-SUFFIX,xiaomi.com,DIRECT
  - DOMAIN-SUFFIX,meituan.com,DIRECT
  - DOMAIN-SUFFIX,dianping.com,DIRECT
  - DOMAIN-KEYWORD,baidu,DIRECT
  - DOMAIN-KEYWORD,alibaba,DIRECT

  # 局域网直连
  - IP-CIDR,192.168.0.0/16,DIRECT
  - IP-CIDR,10.0.0.0/8,DIRECT
  - IP-CIDR,172.16.0.0/12,DIRECT
  - IP-CIDR,127.0.0.0/8,DIRECT
  - IP-CIDR,100.64.0.0/10,DIRECT

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

// ── 生成sing-box客户端配置 (JSON) ────────────
// 铸渊专线客户端专用格式，供Flutter/sing-box引擎使用
function generateSingboxConfig(keys, serverHost) {
  const cnRelayHost = getCnRelayHost();
  const cnRelayPort = getCnRelayPort();

  // 出站节点列表
  const outbounds = [
    {
      tag: 'zy-sg-direct',
      type: 'vless',
      server: serverHost,
      server_port: 443,
      uuid: keys.ZY_PROXY_UUID,
      flow: 'xtls-rprx-vision',
      tls: {
        enabled: true,
        server_name: 'www.microsoft.com',
        utls: { enabled: true, fingerprint: 'chrome' },
        reality: {
          enabled: true,
          public_key: keys.ZY_PROXY_REALITY_PUBLIC_KEY,
          short_id: keys.ZY_PROXY_REALITY_SHORT_ID
        }
      },
      packet_encoding: 'xudp'
    }
  ];

  // CN中转节点 (如果已配置)
  if (cnRelayHost) {
    outbounds.push({
      tag: 'zy-cn-relay',
      type: 'vless',
      server: cnRelayHost,
      server_port: cnRelayPort,
      uuid: keys.ZY_PROXY_UUID,
      flow: 'xtls-rprx-vision',
      tls: {
        enabled: true,
        server_name: 'www.microsoft.com',
        utls: { enabled: true, fingerprint: 'chrome' },
        reality: {
          enabled: true,
          public_key: keys.ZY_PROXY_REALITY_PUBLIC_KEY,
          short_id: keys.ZY_PROXY_REALITY_SHORT_ID
        }
      },
      packet_encoding: 'xudp'
    });
  }

  // 自动选择出站
  const autoOutboundTags = ['zy-sg-direct'];
  if (cnRelayHost) autoOutboundTags.push('zy-cn-relay');

  outbounds.push(
    {
      tag: 'auto',
      type: 'urltest',
      outbounds: [...autoOutboundTags],
      url: 'http://www.gstatic.com/generate_204',
      interval: '5m',
      tolerance: 50
    },
    {
      tag: 'proxy',
      type: 'selector',
      outbounds: ['auto', ...autoOutboundTags, 'direct'],
      default: 'auto'
    },
    {
      tag: 'ai-services',
      type: 'selector',
      outbounds: [...autoOutboundTags],
      default: autoOutboundTags[0]
    },
    {
      tag: 'dev-tools',
      type: 'selector',
      outbounds: [...autoOutboundTags],
      default: autoOutboundTags[0]
    },
    { tag: 'direct', type: 'direct' },
    { tag: 'block', type: 'block' },
    { tag: 'dns-out', type: 'dns' }
  );

  // DNS配置 (fake-ip模式)
  const dns = {
    servers: [
      {
        tag: 'remote-dns',
        address: 'https://dns.google/dns-query',
        address_resolver: 'local-dns',
        detour: 'proxy'
      },
      {
        tag: 'local-dns',
        address: 'https://dns.alidns.com/dns-query',
        detour: 'direct'
      },
      {
        tag: 'fakeip-dns',
        address: 'fakeip'
      },
      {
        tag: 'block-dns',
        address: 'rcode://success'
      }
    ],
    rules: [
      { outbound: 'any', server: 'local-dns' },
      {
        rule_set: 'geosite-cn',
        server: 'local-dns'
      },
      {
        query_type: ['A', 'AAAA'],
        server: 'fakeip-dns'
      }
    ],
    fakeip: {
      enabled: true,
      inet4_range: '198.18.0.0/15',
      inet6_range: 'fc00::/18'
    },
    independent_cache: true
  };

  // 路由规则
  const route = {
    rule_set: [
      {
        tag: 'geosite-cn',
        type: 'remote',
        format: 'binary',
        url: 'https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-cn.srs',
        download_detour: 'proxy'
      },
      {
        tag: 'geoip-cn',
        type: 'remote',
        format: 'binary',
        url: 'https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-cn.srs',
        download_detour: 'proxy'
      }
    ],
    rules: [
      { protocol: 'dns', outbound: 'dns-out' },
      // AI服务走专用出站
      {
        domain_suffix: [
          'openai.com', 'anthropic.com', 'claude.ai', 'chatgpt.com',
          'bard.google.com', 'gemini.google.com', 'ai.google.dev',
          'perplexity.ai', 'poe.com'
        ],
        outbound: 'ai-services'
      },
      // 开发工具走专用出站
      {
        domain_suffix: [
          'github.com', 'githubusercontent.com', 'github.io', 'githubassets.com',
          'copilot.microsoft.com', 'npmjs.com', 'npmjs.org',
          'docker.com', 'docker.io', 'stackoverflow.com', 'stackexchange.com',
          'vercel.app', 'netlify.app', 'pypi.org'
        ],
        outbound: 'dev-tools'
      },
      // 国内直连
      { rule_set: 'geosite-cn', outbound: 'direct' },
      { rule_set: 'geoip-cn', outbound: 'direct' },
      { ip_is_private: true, outbound: 'direct' }
    ],
    auto_detect_interface: true,
    final: 'proxy'
  };

  // 入站配置
  const inbounds = [
    {
      tag: 'tun-in',
      type: 'tun',
      inet4_address: '172.19.0.1/30',
      inet6_address: 'fdfe:dcba:9876::1/126',
      auto_route: true,
      strict_route: true,
      stack: 'system',
      sniff: true,
      sniff_override_destination: true
    },
    {
      tag: 'mixed-in',
      type: 'mixed',
      listen: '127.0.0.1',
      listen_port: 7890,
      sniff: true,
      sniff_override_destination: true
    }
  ];

  return {
    log: { level: 'info', timestamp: true },
    dns,
    inbounds,
    outbounds,
    route,
    experimental: {
      cache_file: { enabled: true },
      clash_api: {
        external_controller: '127.0.0.1:9090',
        secret: ''
      }
    },
    _metadata: {
      generator: 'zy-proxy-subscription',
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      copyright: '国作登字-2026-A-00037559'
    }
  };
}

// ── 构建节点信息列表 ─────────────────────────
function buildNodeList(keys, serverHost) {
  const cnRelayHost = getCnRelayHost();
  const cnRelayPort = getCnRelayPort();

  const nodes = [
    {
      id: 'zy-sg-direct',
      name: '🏛️ 铸渊专线-SG直连',
      region: 'sg',
      region_name: 'Singapore',
      server: serverHost,
      port: 443,
      protocol: 'vless',
      security: 'reality',
      flow: 'xtls-rprx-vision',
      sni: 'www.microsoft.com',
      fingerprint: 'chrome',
      available: true,
      priority: 1
    }
  ];

  if (cnRelayHost) {
    nodes.push({
      id: 'zy-cn-relay',
      name: '🇨🇳 铸渊专线-CN中转',
      region: 'cn',
      region_name: 'China (Relay)',
      server: cnRelayHost,
      port: cnRelayPort,
      protocol: 'vless',
      security: 'reality',
      flow: 'xtls-rprx-vision',
      sni: 'www.microsoft.com',
      fingerprint: 'chrome',
      available: true,
      priority: 2
    });
  }

  return nodes;
}

// ── 读取守护状态 ─────────────────────────────
function readGuardianStatus() {
  const guardianFile = path.join(DATA_DIR, 'guardian-status.json');
  try {
    return JSON.parse(fs.readFileSync(guardianFile, 'utf8'));
  } catch {
    return null;
  }
}

// ── 常见错误码中文翻译表 ─────────────────────
const ERROR_TRANSLATIONS = {
  'i/o timeout': {
    zh: '服务器暂时无法连接',
    suggestion: '请切换到CN中转节点，或检查本地网络'
  },
  'connection refused': {
    zh: '服务器拒绝连接',
    suggestion: '请检查服务器是否在运行，或稍后重试'
  },
  'TLS handshake': {
    zh: '加密握手失败',
    suggestion: '网络环境可能受限，请切换节点或尝试CN中转'
  },
  'context deadline exceeded': {
    zh: '连接超时',
    suggestion: '网络延迟过高，建议切换节点或检查本地网络'
  },
  'no route to host': {
    zh: '无法到达服务器',
    suggestion: '可能是网络中断或IP被封锁，请切换节点'
  },
  'connection reset': {
    zh: '连接被重置',
    suggestion: '可能被防火墙干扰，建议切换到CN中转节点'
  },
  'EOF': {
    zh: '连接意外断开',
    suggestion: '请检查网络稳定性或切换节点重试'
  },
  'certificate': {
    zh: 'TLS证书验证失败',
    suggestion: '请检查系统时间是否正确，或更新客户端'
  }
};

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
  try {
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

    // ── 铸渊客户端API端点 ─────────────────────
    // 以下端点需要token认证，供铸渊专线专属客户端使用

    // 客户端配置端点: /client-config/{token}
    // 返回sing-box JSON格式配置
    const clientConfigMatch = pathname.match(/^\/client-config\/([a-f0-9]+)$/);
    if (clientConfigMatch) {
      const token = clientConfigMatch[1];
      const keys = loadKeys();

      if (token !== keys.ZY_PROXY_SUB_TOKEN) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: true, code: 'FORBIDDEN', message: '认证失败' }));
        return;
      }

      const serverHost = getServerHost();
      const config = generateSingboxConfig(keys, serverHost);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(config, null, 2));
      return;
    }

    // 节点列表端点: /nodes/{token}
    // 返回所有可用节点的结构化信息
    const nodesMatch = pathname.match(/^\/nodes\/([a-f0-9]+)$/);
    if (nodesMatch) {
      const token = nodesMatch[1];
      const keys = loadKeys();

      if (token !== keys.ZY_PROXY_SUB_TOKEN) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: true, code: 'FORBIDDEN', message: '认证失败' }));
        return;
      }

      const serverHost = getServerHost();
      const nodes = buildNodeList(keys, serverHost);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        nodes,
        total: nodes.length,
        updated_at: new Date().toISOString()
      }));
      return;
    }

    // 服务状态端点: /status/{token}
    // 返回服务器健康状态、节点列表、配额、守护状态
    const statusMatch = pathname.match(/^\/status\/([a-f0-9]+)$/);
    if (statusMatch) {
      const token = statusMatch[1];
      const keys = loadKeys();

      if (token !== keys.ZY_PROXY_SUB_TOKEN) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: true, code: 'FORBIDDEN', message: '认证失败' }));
        return;
      }

      const serverHost = getServerHost();
      const quota = getQuotaInfo();
      const guardian = readGuardianStatus();
      const nodes = buildNodeList(keys, serverHost);

      const totalGB = quota.total_bytes / (1024 ** 3);
      const usedGB = (quota.upload_bytes + quota.download_bytes) / (1024 ** 3);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        server: {
          status: 'online',
          version: '1.0.0',
          uptime_seconds: Math.floor(process.uptime()),
          region: 'sg',
          region_name: 'Singapore'
        },
        nodes,
        quota: {
          total_gb: parseFloat(totalGB.toFixed(1)),
          used_gb: parseFloat(usedGB.toFixed(1)),
          remaining_gb: parseFloat((totalGB - usedGB).toFixed(1)),
          percentage_used: parseFloat(((usedGB / totalGB) * 100).toFixed(1)),
          period: quota.period,
          reset_day: quota.reset_day,
          upload_bytes: quota.upload_bytes,
          download_bytes: quota.download_bytes
        },
        guardian: guardian ? {
          status: guardian.status || 'unknown',
          last_check: guardian.last_check,
          consecutive_failures: guardian.consecutive_failures || 0,
          auto_fixes: guardian.auto_fixes || 0,
          last_issue: guardian.last_issue
        } : { status: 'not_available' },
        updated_at: new Date().toISOString()
      }));
      return;
    }

    // 测速端点信息: /speedtest/{token}
    // 返回测速配置和端点
    const speedtestMatch = pathname.match(/^\/speedtest\/([a-f0-9]+)$/);
    if (speedtestMatch) {
      const token = speedtestMatch[1];
      const keys = loadKeys();

      if (token !== keys.ZY_PROXY_SUB_TOKEN) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: true, code: 'FORBIDDEN', message: '认证失败' }));
        return;
      }

      const serverHost = getServerHost();
      const cnRelayHost = getCnRelayHost();
      const cnRelayPort = getCnRelayPort();

      const endpoints = [
        {
          id: 'zy-sg-direct',
          name: '🏛️ SG直连',
          test_url: `http://${serverHost}/api/proxy-sub/health`,
          ping_host: serverHost,
          ping_port: 443
        }
      ];

      if (cnRelayHost) {
        endpoints.push({
          id: 'zy-cn-relay',
          name: '🇨🇳 CN中转',
          test_url: `http://${cnRelayHost}:${cnRelayPort}`,
          ping_host: cnRelayHost,
          ping_port: cnRelayPort
        });
      }

      // 第三方测速URL (用于测试代理后的下载速度)
      const download_test_urls = [
        { url: 'http://www.gstatic.com/generate_204', purpose: 'latency', size: 'tiny' },
        { url: 'https://speed.cloudflare.com/__down?bytes=1000000', purpose: 'download', size: '1MB' },
        { url: 'https://speed.cloudflare.com/__down?bytes=10000000', purpose: 'download', size: '10MB' }
      ];

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        endpoints,
        download_test_urls,
        recommended_interval_seconds: 300,
        updated_at: new Date().toISOString()
      }));
      return;
    }

    // 诊断端点: /diagnostics/{token}
    // 返回诊断辅助信息、错误翻译表、检查项
    const diagMatch = pathname.match(/^\/diagnostics\/([a-f0-9]+)$/);
    if (diagMatch) {
      const token = diagMatch[1];
      const keys = loadKeys();

      if (token !== keys.ZY_PROXY_SUB_TOKEN) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: true, code: 'FORBIDDEN', message: '认证失败' }));
        return;
      }

      const serverHost = getServerHost();
      const guardian = readGuardianStatus();

      // 客户端应执行的诊断检查列表
      const client_checks = [
        {
          id: 'dns_resolution',
          name: 'DNS解析检查',
          description: '检查是否能解析服务器域名',
          test_type: 'dns',
          target: serverHost
        },
        {
          id: 'tcp_connectivity',
          name: 'TCP连接检查',
          description: '检查443端口是否可达',
          test_type: 'tcp',
          target: serverHost,
          port: 443,
          timeout_ms: 5000
        },
        {
          id: 'tls_handshake',
          name: 'TLS握手检查',
          description: '检查Reality TLS握手是否成功',
          test_type: 'tls',
          target: serverHost,
          port: 443,
          sni: 'www.microsoft.com',
          timeout_ms: 10000
        },
        {
          id: 'subscription_api',
          name: '订阅服务检查',
          description: '检查订阅API是否正常响应',
          test_type: 'http',
          url: `http://${serverHost}/api/proxy-sub/health`,
          timeout_ms: 10000,
          expected_status: 200
        },
        {
          id: 'proxy_throughput',
          name: '代理吞吐量检查',
          description: '通过代理下载测试文件检测速度',
          test_type: 'download',
          url: 'https://speed.cloudflare.com/__down?bytes=1000000',
          via_proxy: true,
          timeout_ms: 30000
        }
      ];

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        error_translations: ERROR_TRANSLATIONS,
        client_checks,
        server_guardian: guardian ? {
          status: guardian.status || 'unknown',
          last_check: guardian.last_check,
          last_issue: guardian.last_issue
        } : { status: 'not_available' },
        support: {
          report_method: 'email',
          admin_contact: 'zy-admin',
          log_retention_hours: 24
        },
        client_version: {
          minimum: '1.0.0',
          recommended: '1.0.0',
          config_format: 'sing-box-1.8+'
        },
        updated_at: new Date().toISOString()
      }));
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

// 处理连接级别错误 (防止未捕获的socket错误导致进程崩溃)
server.on('error', (err) => {
  console.error('❌ 服务器错误:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error('  端口 %d 已被占用，进程退出等待PM2重启...', PORT);
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
  console.log(`🌐 铸渊专线订阅服务已启动: http://127.0.0.1:${PORT}`);
  console.log(`  订阅端点: /sub/{token}`);
  console.log(`  配额查询: /quota`);
  console.log(`  健康检查: /health`);
  console.log(`  ── 铸渊客户端API ──`);
  console.log(`  客户端配置: /client-config/{token} (sing-box JSON)`);
  console.log(`  节点列表:   /nodes/{token}`);
  console.log(`  服务状态:   /status/{token}`);
  console.log(`  测速信息:   /speedtest/{token}`);
  console.log(`  诊断信息:   /diagnostics/{token}`);
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

// 进程级错误保护 (记录后优雅退出，由PM2负责重启)
process.on('uncaughtException', (err) => {
  console.error('❌ 未捕获的异常:', err.message);
  console.error(err.stack);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
});

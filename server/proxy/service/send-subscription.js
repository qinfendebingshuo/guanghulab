#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/send-subscription.js
// 📧 铸渊专线 · 订阅链接邮件发送
//
// 通过SMTP发送订阅链接到指定邮箱
// 确保敏感信息不经过公开仓库
//
// 用法:
//   node send-subscription.js send <email>           — 发送V2订阅链接
//   node send-subscription.js send-v3 <email> <url> <dashboard>  — 发送V3订阅链接
//   node send-subscription.js alert <msg>            — 发送告警邮件
//
// 环境变量:
//   ZY_SMTP_USER, ZY_SMTP_PASS — SMTP认证
//   ZY_PROXY_SUB_TOKEN — 订阅Token
//   ZY_SERVER_HOST — 服务器地址
// ═══════════════════════════════════════════════

'use strict';

const net = require('net');
const tls = require('tls');
const fs = require('fs');
const path = require('path');

const KEYS_FILE = process.env.ZY_PROXY_KEYS_FILE || '/opt/zhuyuan/proxy/.env.keys';

// ── 加载配置 ─────────────────────────────────
// 优先级: 环境变量 > .env.keys文件
// 通用读取所有键值对，确保guardian/monitor等服务也能获取完整配置
function loadConfig() {
  const config = {
    smtp_user: process.env.ZY_SMTP_USER || '',
    smtp_pass: process.env.ZY_SMTP_PASS || '',
    server_host: process.env.ZY_SERVER_HOST || '',
    sub_token: process.env.ZY_PROXY_SUB_TOKEN || ''
  };

  // 从.env.keys文件读取所有键值对（环境变量未设置时回退）
  try {
    const content = fs.readFileSync(KEYS_FILE, 'utf8');
    for (const line of content.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...vals] = line.split('=');
      const k = key.trim();
      const v = vals.join('=').trim();
      if (!v) continue;

      // 仅在环境变量未设置时使用文件中的值
      if (k === 'ZY_PROXY_SUB_TOKEN' && !config.sub_token) config.sub_token = v;
      if (k === 'ZY_SERVER_HOST' && !config.server_host) config.server_host = v;
      if (k === 'ZY_SMTP_USER' && !config.smtp_user) config.smtp_user = v;
      if (k === 'ZY_SMTP_PASS' && !config.smtp_pass) config.smtp_pass = v;
    }
  } catch { /* ignore */ }

  return config;
}

// ── SMTP发送邮件 ─────────────────────────────
async function sendEmail(to, subject, htmlBody) {
  const config = loadConfig();

  if (!config.smtp_user || !config.smtp_pass) {
    console.error('❌ SMTP未配置 (需要ZY_SMTP_USER和ZY_SMTP_PASS)');
    process.exit(1);
  }

  // 检测SMTP服务商
  const smtpHost = detectSmtpHost(config.smtp_user);
  const smtpPort = 465; // SSL

  return new Promise((resolve, reject) => {
    const socket = tls.connect(smtpPort, smtpHost, {}, () => {
      let step = 0;
      const from = config.smtp_user;

      const commands = [
        `EHLO zy-proxy\r\n`,
        `AUTH LOGIN\r\n`,
        `${Buffer.from(from).toString('base64')}\r\n`,
        `${Buffer.from(config.smtp_pass).toString('base64')}\r\n`,
        `MAIL FROM:<${from}>\r\n`,
        `RCPT TO:<${to}>\r\n`,
        `DATA\r\n`,
        `From: "铸渊专线" <${from}>\r\nTo: <${to}>\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\nContent-Type: text/html; charset=utf-8\r\nMIME-Version: 1.0\r\n\r\n${htmlBody}\r\n.\r\n`,
        `QUIT\r\n`
      ];

      socket.on('data', (data) => {
        const response = data.toString();
        if (step < commands.length) {
          socket.write(commands[step]);
          step++;
        }
        if (response.startsWith('250 ') && step >= commands.length) {
          resolve(true);
        }
      });

      socket.on('error', (err) => {
        reject(err);
      });
    });

    socket.on('error', (err) => {
      reject(err);
    });
  });
}

// ── 检测SMTP主机 ─────────────────────────────
function detectSmtpHost(email) {
  if (email.includes('@qq.com')) return 'smtp.qq.com';
  if (email.includes('@163.com')) return 'smtp.163.com';
  if (email.includes('@126.com')) return 'smtp.126.com';
  if (email.includes('@gmail.com')) return 'smtp.gmail.com';
  if (email.includes('@outlook.com') || email.includes('@hotmail.com')) return 'smtp.office365.com';
  if (email.includes('@yeah.net')) return 'smtp.yeah.net';
  // 默认
  return 'smtp.qq.com';
}

// ── 生成订阅邮件HTML ─────────────────────────
function generateSubscriptionEmail(config, urlOverride) {
  const subUrl = urlOverride || `http://${config.server_host}/api/proxy-sub/sub/${config.sub_token}`;
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a2e; margin-bottom: 5px;">🏛️ 铸渊专线</h1>
    <p style="color: #666; margin-top: 0;">ZY-Proxy · 私有订阅链接</p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

    <h3 style="color: #333;">📱 订阅链接</h3>
    <div style="background: #f0f4ff; border: 1px solid #d0d8ff; border-radius: 8px; padding: 15px; word-break: break-all; font-family: monospace; font-size: 13px;">
      ${subUrl}
    </div>

    <p style="color: #999; font-size: 12px; margin-top: 8px;">
      ⚠️ 请勿分享此链接 · 所有订阅共享500GB月配额
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

    <h3 style="color: #333;">📋 使用方法</h3>

    <h4 style="color: #555;">🍎 iPhone (Shadowrocket)</h4>
    <ol style="color: #666; line-height: 1.8;">
      <li>打开 Shadowrocket</li>
      <li>点击右上角 <strong>+</strong></li>
      <li>选择 <strong>Subscribe</strong> (订阅)</li>
      <li>粘贴上方订阅链接</li>
      <li>点击完成 → 选择节点 → 开启连接</li>
    </ol>

    <h4 style="color: #555;">💻 Mac / Windows (Clash Verge)</h4>
    <ol style="color: #666; line-height: 1.8;">
      <li>打开 Clash Verge</li>
      <li>点击 <strong>Profiles</strong> (配置)</li>
      <li>粘贴上方订阅链接到输入框</li>
      <li>点击 <strong>Import</strong> (导入)</li>
      <li>选中新配置 → 开启系统代理</li>
    </ol>

    <h4 style="color: #555;">🤖 Android (ClashMi / Clash Meta)</h4>
    <ol style="color: #666; line-height: 1.8;">
      <li>打开 ClashMi</li>
      <li>点击 <strong>Profile</strong> → <strong>New Profile</strong></li>
      <li>选择 <strong>URL</strong></li>
      <li>粘贴上方订阅链接</li>
      <li>保存 → 选中配置 → 启动</li>
    </ol>

    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

    <h3 style="color: #333;">📊 配额信息</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px; color: #666;">月配额</td><td style="padding: 8px; font-weight: bold;">500 GB</td></tr>
      <tr><td style="padding: 8px; color: #666;">重置日期</td><td style="padding: 8px;">每月1日</td></tr>
      <tr><td style="padding: 8px; color: #666;">协议</td><td style="padding: 8px;">VLESS + Reality (最高安全级别)</td></tr>
      <tr><td style="padding: 8px; color: #666;">节点位置</td><td style="padding: 8px;">🇸🇬 新加坡</td></tr>
    </table>

    <p style="color: #999; font-size: 12px; margin-top: 15px;">
      在客户端中刷新订阅可查看剩余配额。<br>
      配额达到80%/90%/100%时会自动发送邮件提醒。
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

    <p style="color: #aaa; font-size: 11px; text-align: center;">
      铸渊专线 · 冰朔私有网络 · ${now}<br>
      国作登字-2026-A-00037559
    </p>
  </div>
</body>
</html>`;
}

// ── 生成V3订阅邮件HTML (光湖语言世界) ─────────
function generateV3SubscriptionEmail(subUrl, dashboardUrl) {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
  <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a2e; margin-bottom: 5px;">🌐 光湖语言世界</h1>
    <p style="color: #666; margin-top: 0;">光湖语言世界 V3 · 私有订阅链接</p>

    <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 12px; margin: 15px 0;">
      <strong style="color: #155724;">✅ V3 正式版</strong>
      <span style="color: #555;"> — 稳定版本，全面优化升级</span>
    </div>

    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

    <h3 style="color: #333;">📱 V3 订阅链接</h3>
    <div style="background: #f0f4ff; border: 1px solid #d0d8ff; border-radius: 8px; padding: 15px; word-break: break-all; font-family: monospace; font-size: 13px;">
      ${subUrl}
    </div>

    <p style="color: #999; font-size: 12px; margin-top: 8px;">
      ⚠️ 请勿分享此链接 · 所有订阅共享 2000GB 月流量池
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

    <h3 style="color: #333;">📊 V3 流量仪表盘</h3>
    <div style="background: #fff8e1; border: 1px solid #ffe082; border-radius: 8px; padding: 15px; word-break: break-all; font-family: monospace; font-size: 13px;">
      ${dashboardUrl}
    </div>
    <p style="color: #999; font-size: 12px; margin-top: 8px;">
      💡 V3新功能：在浏览器中查看实时流量统计和节点状态
    </p>

    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

    <h3 style="color: #333;">📋 使用方法</h3>

    <h4 style="color: #555;">🍎 iPhone (Shadowrocket)</h4>
    <ol style="color: #666; line-height: 1.8;">
      <li>打开 Shadowrocket</li>
      <li>点击右上角 <strong>+</strong></li>
      <li>选择 <strong>Subscribe</strong> (订阅)</li>
      <li>粘贴上方 V3 订阅链接</li>
      <li>点击完成 → 选择节点 → 开启连接</li>
    </ol>

    <h4 style="color: #555;">💻 Mac / Windows (Clash Verge)</h4>
    <ol style="color: #666; line-height: 1.8;">
      <li>打开 Clash Verge</li>
      <li>点击 <strong>Profiles</strong> (配置)</li>
      <li>粘贴上方 V3 订阅链接到输入框</li>
      <li>点击 <strong>Import</strong> (导入)</li>
      <li>选中新配置 → 开启系统代理</li>
    </ol>

    <h4 style="color: #555;">🤖 Android (ClashMi / Clash Meta)</h4>
    <ol style="color: #666; line-height: 1.8;">
      <li>打开 ClashMi</li>
      <li>点击 <strong>Profile</strong> → <strong>New Profile</strong></li>
      <li>选择 <strong>URL</strong></li>
      <li>粘贴上方 V3 订阅链接</li>
      <li>保存 → 选中配置 → 启动</li>
    </ol>

    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

    <h3 style="color: #333;">🆕 V3 升级亮点</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 8px; color: #666;">品牌</td><td style="padding: 8px; font-weight: bold;">光湖语言世界</td></tr>
      <tr><td style="padding: 8px; color: #666;">流量池</td><td style="padding: 8px; font-weight: bold;">2000 GB / 月 (硬切 · 到量即停)</td></tr>
      <tr><td style="padding: 8px; color: #666;">重置日期</td><td style="padding: 8px;">每月1日</td></tr>
      <tr><td style="padding: 8px; color: #666;">协议</td><td style="padding: 8px;">VLESS + Reality (最高安全级别)</td></tr>
      <tr><td style="padding: 8px; color: #666;">节点位置</td><td style="padding: 8px;">🇸🇬 新加坡 (多节点)</td></tr>
      <tr><td style="padding: 8px; color: #666;">新增</td><td style="padding: 8px;">📊 流量仪表盘 · 增强分流 · 反向加速</td></tr>
    </table>

    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

    <p style="color: #aaa; font-size: 11px; text-align: center;">
      光湖语言世界 · V3 正式版 · ${now}<br>
      国作登字-2026-A-00037559
    </p>
  </div>
</body>
</html>`;
}

// ── 生成告警邮件HTML ─────────────────────────
function generateAlertEmail(message) {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px;">
    <h2 style="color: #856404; margin-top: 0;">🛡️ 铸渊专线 · 系统告警</h2>
    <pre style="white-space: pre-wrap; color: #333; font-size: 14px; line-height: 1.6;">${message}</pre>
    <p style="color: #999; font-size: 12px; margin-bottom: 0;">${now}</p>
  </div>
</body>
</html>`;
}

// ── 主入口 ───────────────────────────────────
async function main() {
  const [,, action, target, urlOverride, dashboardUrl] = process.argv;

  if (!action) {
    console.log('用法:');
    console.log('  node send-subscription.js send <email>           — 发送V2订阅链接');
    console.log('  node send-subscription.js send-v3 <email> <url> <dashboard>  — 发送V3订阅链接');
    console.log('  node send-subscription.js alert <msg>            — 发送告警邮件');
    process.exit(0);
  }

  const config = loadConfig();

  if (action === 'send') {
    const email = target || config.smtp_user;
    if (!email) {
      console.error('❌ 请指定目标邮箱');
      process.exit(1);
    }

    console.log(`📧 发送订阅链接到: ${email}`);
    const html = generateSubscriptionEmail(config, urlOverride);

    try {
      await sendEmail(email, '🏛️ 铸渊专线 · 订阅链接', html);
      console.log('✅ 订阅链接已发送');
    } catch (err) {
      console.error('❌ 发送失败:', err.message);
      process.exit(1);
    }

  } else if (action === 'send-v3') {
    const email = target;
    if (!email) {
      console.error('❌ 请指定目标邮箱');
      process.exit(1);
    }
    if (!urlOverride) {
      console.error('❌ 请提供V3订阅URL');
      process.exit(1);
    }

    let dashboard = dashboardUrl;
    if (!dashboard) {
      if (urlOverride.includes('/sub/')) {
        dashboard = urlOverride.replace('/sub/', '/dashboard/');
      } else {
        console.error('❌ 订阅URL中未包含/sub/路径，请手动提供仪表盘URL');
        process.exit(1);
      }
    }
    console.log(`📧 发送V3订阅链接到: ${email}`);
    const html = generateV3SubscriptionEmail(urlOverride, dashboard);

    try {
      await sendEmail(email, '🌐 光湖语言世界 · V3订阅链接', html);
      console.log('✅ V3订阅链接已发送');
    } catch (err) {
      console.error('❌ 发送失败:', err.message);
      process.exit(1);
    }

  } else if (action === 'alert') {
    const message = target || '未知告警';
    const email = config.smtp_user; // 告警发到管理员邮箱

    if (!email) {
      console.error('❌ SMTP用户未配置，无法发送告警');
      process.exit(1);
    }

    console.log(`📧 发送告警到: ${email}`);
    const html = generateAlertEmail(message);

    try {
      await sendEmail(email, '🛡️ 铸渊专线告警', html);
      console.log('✅ 告警已发送');
    } catch (err) {
      console.error('❌ 发送失败:', err.message);
      process.exit(1);
    }

  } else {
    console.error(`❌ 未知操作: ${action}`);
    process.exit(1);
  }
}

main().catch(console.error);

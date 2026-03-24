/**
 * scripts/grid-db/drive-auth.js
 *
 * OAuth2 认证模块 · 替代原 Service Account 模式
 *
 * 环境变量：
 *   GDRIVE_CLIENT_ID      — OAuth 客户端 ID
 *   GDRIVE_CLIENT_SECRET   — OAuth 客户端密钥
 *   GDRIVE_REFRESH_TOKEN   — 长效刷新令牌
 *
 * 返回已认证的 google.drive 客户端实例
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 * 主控: TCS-0002∞ 冰朔
 */

const { google } = require('googleapis');

function getOAuth2Client() {
  const clientId = process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GDRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    const missing = [];
    if (!clientId) missing.push('GDRIVE_CLIENT_ID');
    if (!clientSecret) missing.push('GDRIVE_CLIENT_SECRET');
    if (!refreshToken) missing.push('GDRIVE_REFRESH_TOKEN');
    throw new Error(`Missing OAuth2 environment variables: ${missing.join(', ')}`);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);

  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  return oauth2Client;
}

function getDriveClient() {
  const auth = getOAuth2Client();
  return google.drive({ version: 'v3', auth });
}

module.exports = { getDriveClient, getOAuth2Client };

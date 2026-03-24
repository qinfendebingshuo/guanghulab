/**
 * renew-tokens.js
 * 
 * OAuth2 Token 自动续期引擎
 * 
 * 功能：
 *   1. 读取 config/gdrive-tokens.json 注册表
 *   2. 遍历所有 active 的 Token
 *   3. 检查每个 Token 的剩余有效期
 *   4. 剩余 < 48小时 → 立即刷新
 *   5. 刷新成功 → 用 GitHub API 更新 Secret + 更新注册表
 *   6. 刷新失败 → 写告警日志
 * 
 * 环境变量：
 *   GDRIVE_CLIENT_ID       — OAuth 客户端 ID
 *   GDRIVE_CLIENT_SECRET    — OAuth 客户端密钥
 *   GITHUB_TOKEN            — 有 repo 权限的 GitHub Token（用于更新 Secrets）
 *   GDRIVE_REFRESH_TOKEN    — 主控的当前 Refresh Token
 *   GDRIVE_REFRESH_TOKEN_*  — 各开发者的 Refresh Token
 * 
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 * 主控: TCS-0002∞ 冰朔
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '../../config/gdrive-tokens.json');

async function main() {
  console.log('\n🔄 Token 自动续期引擎启动');
  console.log(`当前时间: ${new Date().toISOString()}`);
  
  // 1. 读取注册表
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const results = { renewed: [], skipped: [], failed: [] };
  
  for (const token of registry.tokens) {
    if (token.status === 'expired') {
      console.log(`❌ ${token.user_name} (${token.user_id}): 已过期，需人类重新授权`);
      results.failed.push(token.user_id);
      continue;
    }
    
    // 2. 检查剩余有效期
    const expiresAt = new Date(token.expires_at);
    const now = new Date();
    const hoursLeft = (expiresAt - now) / (1000 * 60 * 60);
    
    console.log(`\n👤 ${token.user_name} (${token.user_id}): 剩余 ${hoursLeft.toFixed(1)} 小时`);
    
    if (hoursLeft > 72 && process.env.FORCE_RENEW !== 'true') {
      console.log(`  ✅ 跳过（剩余充足）`);
      results.skipped.push(token.user_id);
      continue;
    }
    
    if (hoursLeft <= 0) {
      console.log(`  ❌ 已过期！`);
      token.status = 'expired';
      results.failed.push(token.user_id);
      continue;
    }
    
    // 3. 执行刷新
    console.log(`  ⚡ 执行刷新...`);
    const currentToken = process.env[token.github_secret_name];
    
    if (!currentToken) {
      console.log(`  ❌ 环境变量 ${token.github_secret_name} 不存在`);
      results.failed.push(token.user_id);
      continue;
    }
    
    try {
      const newTokenData = await refreshOAuth2Token(currentToken);
      
      if (newTokenData.refresh_token) {
        // 4. 更新 GitHub Secret
        await updateGitHubSecret(
          token.github_secret_name,
          newTokenData.refresh_token
        );
        
        // 5. 更新注册表
        const renewTime = new Date().toISOString();
        token.last_renewed = renewTime;
        token.expires_at = new Date(
          Date.now() + registry.oauth_app.token_ttl_days * 24 * 60 * 60 * 1000
        ).toISOString();
        token.status = 'active';
        token.renew_count += 1;
        
        // 6. 写刷新日志
        registry.renew_log.push({
          user_id: token.user_id,
          time: renewTime,
          result: 'success',
          hours_remaining: hoursLeft.toFixed(1)
        });
        
        console.log(`  ✅ 刷新成功！新过期时间: ${token.expires_at}`);
        results.renewed.push(token.user_id);
      } else {
        // Google 有时不返回新的 refresh_token（access_type 非 offline 或非首次授权时常见）
        console.log(`  ⚠️ Google 未返回新 refresh_token，需人类重新授权（access_type=offline + prompt=consent）`);
        token.status = 'expiring';
        registry.renew_log.push({
          user_id: token.user_id,
          time: new Date().toISOString(),
          result: 'no_new_token',
          hours_remaining: hoursLeft.toFixed(1)
        });
        results.failed.push(token.user_id);
      }
    } catch (err) {
      console.log(`  ❌ 刷新失败: ${err.message}`);
      token.status = hoursLeft < 24 ? 'expired' : 'expiring';
      registry.renew_log.push({
        user_id: token.user_id,
        time: new Date().toISOString(),
        result: 'error',
        error: err.message,
        hours_remaining: hoursLeft.toFixed(1)
      });
      results.failed.push(token.user_id);
    }
  }
  
  // 保留最近 100 条日志
  if (registry.renew_log.length > 100) {
    registry.renew_log = registry.renew_log.slice(-100);
  }
  
  // 写回注册表
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
  
  // 输出摘要
  console.log('\n═══ 刷新摘要 ═══');
  console.log(`✅ 已刷新: ${results.renewed.length} 个`);
  console.log(`⏭️ 已跳过: ${results.skipped.length} 个`);
  console.log(`❌ 失败/过期: ${results.failed.length} 个`);
  
  // 如果有失败，输出告警标记（供天眼读取）
  if (results.failed.length > 0) {
    const logsDir = path.join(__dirname, '../../grid-db/logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    
    const alertFile = path.join(logsDir, 'token-alert.json');
    fs.writeFileSync(alertFile, JSON.stringify({
      alert_type: 'TOKEN_RENEWAL_FAILURE',
      severity: results.failed.some(id =>
        registry.tokens.find(t => t.user_id === id && t.status === 'expired')
      ) ? 'CRITICAL' : 'ALERT',
      time: new Date().toISOString(),
      failed_users: results.failed,
      message: `${results.failed.length} 个 Token 刷新失败，需要人类介入`,
      action_required: 'HUMAN_REAUTH',
      instructions: [
        '1. 登录 Google Cloud Console',
        '2. 访问授权链接获取新 code',
        '3. 运行换 token 脚本获取新 refresh_token',
        '4. 更新 GitHub Secret: GDRIVE_REFRESH_TOKEN',
        '5. 手动触发 renew-gdrive-tokens workflow 验证'
      ]
    }, null, 2));
    
    // 设置非零退出码，让 workflow 知道有问题
    process.exitCode = 1;
  }
}

/**
 * 用旧的 refresh_token 向 Google 换新的 token
 * 
 * 重要：Google OAuth2 刷新时可能会返回新的 refresh_token（也可能不返回）
 * 如果返回了新的，旧的就失效了。必须更新 Secret。
 */
async function refreshOAuth2Token(refreshToken) {
  const params = new URLSearchParams({
    client_id: process.env.GDRIVE_CLIENT_ID,
    client_secret: process.env.GDRIVE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  
  return new Promise((resolve, reject) => {
    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(`${json.error}: ${json.error_description}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error('Invalid JSON response from Google OAuth2 endpoint'));
        }
      });
    });
    req.on('error', reject);
    req.write(params.toString());
    req.end();
  });
}

/**
 * 通过 GitHub API 更新 Repository Secret
 * 
 * 流程：
 *   1. 获取仓库的 public key（用于加密 secret）
 *   2. 用 tweetsodium 加密新值
 *   3. PUT 更新 secret
 */
async function updateGitHubSecret(secretName, secretValue) {
  const repo = process.env.GITHUB_REPOSITORY || 'qinfendebingshuo/guanghulab';
  const token = process.env.GITHUB_TOKEN;
  
  // 获取 public key
  const pubKey = await githubAPI(`/repos/${repo}/actions/secrets/public-key`, 'GET', token);
  
  // 加密
  const sodium = require('tweetsodium');
  const messageBytes = Buffer.from(secretValue);
  const keyBytes = Buffer.from(pubKey.key, 'base64');
  const encryptedBytes = sodium.seal(messageBytes, keyBytes);
  const encrypted = Buffer.from(encryptedBytes).toString('base64');
  
  // 更新 secret
  await githubAPI(`/repos/${repo}/actions/secrets/${secretName}`, 'PUT', token, {
    encrypted_value: encrypted,
    key_id: pubKey.key_id
  });
  
  console.log(`  🔑 GitHub Secret ${secretName} 已更新`);
}

function githubAPI(apiPath, method, token, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'zhuyuan-token-renewer',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };
    if (body) options.headers['Content-Type'] = 'application/json';
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`GitHub API ${res.statusCode}: ${data}`));
        } else {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (e) {
            resolve({});
          }
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

main().catch(err => {
  console.error('☠️ Token 续期引擎崩溃:', err);
  process.exitCode = 1;
});

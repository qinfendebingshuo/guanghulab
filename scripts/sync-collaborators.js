/**
 * sync-collaborators.js
 * 同步 GitHub 仓库合作者列表到 .github/brain/collaborators.json
 * 由 GitHub Actions 调用：node scripts/sync-collaborators.js
 *
 * 逻辑：
 * 1. 读取 collaborators.json 中的 members（含 github_username、role 等）
 * 2. 调用 GitHub API 获取当前仓库合作者列表
 * 3. 更新每个 member 的 active 状态（是否仍在合作者列表中）
 * 4. 将新加入但尚未配置 role 的合作者记录到 _pending_role_assignment
 * 5. 写回 collaborators.json
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');

const REPO        = process.env.GITHUB_REPOSITORY || 'qinfendebingshuo/guanghulab';
const CONFIG_PATH = path.join(__dirname, '../.github/brain/collaborators.json');

/** Make an authenticated GET request to the GitHub API */
function githubGet(apiPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      headers: {
        Authorization:          `Bearer ${process.env.GH_TOKEN}`,
        'User-Agent':           'guanghulab-sync-bot/1.0',
        Accept:                 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };
    const req = https.get(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}\nBody: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
  });
}

/** Fetch all collaborators (handles pagination) */
async function fetchAllCollaborators() {
  const all = [];
  let page = 1;
  while (true) {
    const { status, body } = await githubGet(`/repos/${REPO}/collaborators?per_page=100&page=${page}`);
    if (status !== 200) throw new Error(`GitHub API error ${status}: ${JSON.stringify(body)}`);
    if (!Array.isArray(body) || body.length === 0) break;
    all.push(...body);
    if (body.length < 100) break;
    page++;
  }
  return all;
}

async function main() {
  if (!process.env.GH_TOKEN) {
    console.error('GH_TOKEN environment variable is required');
    process.exit(1);
  }

  // Load existing config
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const members  = config.members  || [];

  // Fetch current GitHub collaborators
  console.log(`Fetching collaborators for ${REPO}…`);
  const githubCollabs = await fetchAllCollaborators();
  const githubLogins  = new Set(githubCollabs.map(c => c.login.toLowerCase()));
  console.log(`Found ${githubLogins.size} collaborator(s) on GitHub.`);

  // Update active status for existing members
  const updatedMembers = members.map(m => ({
    ...m,
    active: m.github_username
      ? githubLogins.has(m.github_username.toLowerCase())
      : false,
  }));

  const knownLogins = new Set(
    members
      .filter(m => m.github_username)
      .map(m => m.github_username.toLowerCase())
  );

  // Find collaborators on GitHub but not yet assigned a role
  const pending = githubCollabs
    .filter(c => !knownLogins.has(c.login.toLowerCase()))
    .map(c => c.login);

  if (pending.length) {
    console.log(`⚠️  Collaborators pending role assignment: ${pending.join(', ')}`);
    console.log('   → Add them to .github/brain/collaborators.json with name/role/emoji/title fields.');
  }

  const active = updatedMembers.filter(m => m.active);
  const inactive = updatedMembers.filter(m => !m.active);
  if (inactive.length) {
    console.log(`ℹ️  Inactive (removed from GitHub): ${inactive.map(m => m.name || m.github_username).join(', ')}`);
  }
  console.log(`✅ Active members: ${active.length}`);

  // Write back
  const updated = {
    ...config,
    updated: new Date().toISOString().slice(0, 10),
    members: updatedMembers,
    _pending_role_assignment: pending,
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2) + '\n');
  console.log('collaborators.json updated.');
}

main().catch(e => {
  console.error('sync-collaborators failed:', e.message);
  process.exit(1);
});

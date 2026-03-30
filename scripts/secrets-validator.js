#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 * 📜 Copyright: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════
 * 
 * 铸渊 · 密钥配置验证器
 * scripts/secrets-validator.js
 * 
 * 功能：验证所有必需的 GitHub Secrets 是否已配置
 * 用法：node scripts/secrets-validator.js [--check] [--report]
 * 
 * 指令：SY-CMD-KEY-012 · 密钥全量清理与统一替换
 */

const fs = require('fs');
const path = require('path');

// ━━━ 加载密钥清单 ━━━
const manifestPath = path.join(__dirname, '..', 'brain', 'secrets-manifest.json');
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error('❌ 无法加载密钥清单: brain/secrets-manifest.json');
  process.exit(1);
}

// ━━━ 从环境变量检查密钥状态 ━━━
function checkSecrets() {
  const results = {
    configured: [],
    missing: [],
    optional_configured: [],
    optional_missing: []
  };

  // 检查必需密钥
  for (const secret of manifest.secrets.required) {
    const envName = secret.name;
    if (process.env[envName] && process.env[envName].length > 0) {
      results.configured.push(secret);
    } else {
      results.missing.push(secret);
    }
  }

  // 检查可选密钥
  for (const secret of manifest.secrets.optional) {
    const envName = secret.name;
    if (process.env[envName] && process.env[envName].length > 0) {
      results.optional_configured.push(secret);
    } else {
      results.optional_missing.push(secret);
    }
  }

  return results;
}

// ━━━ 扫描工作流文件验证密钥引用一致性 ━━━
function scanWorkflows() {
  const workflowDir = path.join(__dirname, '..', '.github', 'workflows');
  const issues = [];
  
  if (!fs.existsSync(workflowDir)) {
    return { issues: ['工作流目录不存在'], stats: {} };
  }

  const files = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml'));
  const secretRefs = new Map();
  let oldSecretRefs = [];

  // 旧密钥名称列表（不应再出现）
  const oldSecretNames = Object.keys(manifest.migration_mapping.mappings);

  for (const file of files) {
    const content = fs.readFileSync(path.join(workflowDir, file), 'utf8');
    const matches = content.match(/secrets\.([A-Z_0-9]+)/g) || [];
    
    for (const match of matches) {
      const secretName = match.replace('secrets.', '');
      
      // 跳过 GITHUB_TOKEN（自动提供）
      if (secretName === 'GITHUB_TOKEN') continue;
      
      if (!secretRefs.has(secretName)) {
        secretRefs.set(secretName, []);
      }
      secretRefs.get(secretName).push(file);

      // 检查是否使用了旧密钥名称
      if (oldSecretNames.includes(secretName)) {
        oldSecretRefs.push({ secret: secretName, file, newName: manifest.migration_mapping.mappings[secretName] });
      }
    }
  }

  if (oldSecretRefs.length > 0) {
    issues.push(`⚠️ 发现 ${oldSecretRefs.length} 处旧密钥名称引用未迁移`);
  }

  return {
    issues,
    oldSecretRefs,
    stats: {
      total_workflows: files.length,
      unique_secrets: secretRefs.size,
      secret_refs: Object.fromEntries(secretRefs)
    }
  };
}

// ━━━ 生成报告 ━━━
function generateReport(mode) {
  const envCheck = checkSecrets();
  const workflowScan = scanWorkflows();

  if (mode === 'check') {
    // CI模式：仅检查工作流引用是否已迁移到ZY_*
    console.log('🔍 铸渊密钥迁移验证');
    console.log('═'.repeat(50));
    
    if (workflowScan.oldSecretRefs && workflowScan.oldSecretRefs.length > 0) {
      console.log(`\n❌ 发现 ${workflowScan.oldSecretRefs.length} 处旧密钥引用：`);
      for (const ref of workflowScan.oldSecretRefs) {
        console.log(`  ${ref.file}: ${ref.secret} → 应改为 ${ref.newName}`);
      }
      process.exit(1);
    } else {
      console.log('\n✅ 所有工作流密钥引用已迁移到 ZY_* 命名体系');
      console.log(`  工作流总数: ${workflowScan.stats.total_workflows}`);
      console.log(`  唯一密钥数: ${workflowScan.stats.unique_secrets}`);
    }
    return;
  }

  // 完整报告
  console.log('');
  console.log('🔺 铸渊密钥配置验证报告');
  console.log('═'.repeat(60));
  console.log(`📋 密钥清单版本: ${manifest._meta.manifest_id}`);
  console.log(`📅 清单创建时间: ${manifest._meta.created}`);
  console.log('');
  
  // 必需密钥状态
  console.log('━━━ 必需密钥 (Required) ━━━');
  console.log(`  ✅ 已配置: ${envCheck.configured.length}/${manifest.secrets.required.length}`);
  console.log(`  ❌ 未配置: ${envCheck.missing.length}/${manifest.secrets.required.length}`);
  console.log('');

  if (envCheck.missing.length > 0) {
    console.log('  未配置的必需密钥：');
    for (const s of envCheck.missing) {
      console.log(`    ❌ ${s.name} — ${s.description}`);
    }
    console.log('');
  }

  if (envCheck.configured.length > 0) {
    console.log('  已配置的必需密钥：');
    for (const s of envCheck.configured) {
      console.log(`    ✅ ${s.name}`);
    }
    console.log('');
  }

  // 可选密钥状态
  console.log('━━━ 可选密钥 (Optional) ━━━');
  console.log(`  ✅ 已配置: ${envCheck.optional_configured.length}/${manifest.secrets.optional.length}`);
  console.log(`  ⬜ 未配置: ${envCheck.optional_missing.length}/${manifest.secrets.optional.length}`);
  console.log('');

  // 工作流扫描
  console.log('━━━ 工作流密钥引用扫描 ━━━');
  console.log(`  工作流总数: ${workflowScan.stats.total_workflows}`);
  console.log(`  唯一密钥数: ${workflowScan.stats.unique_secrets}`);
  
  if (workflowScan.issues.length > 0) {
    for (const issue of workflowScan.issues) {
      console.log(`  ${issue}`);
    }
  } else {
    console.log('  ✅ 所有引用已使用 ZY_* 命名');
  }
  console.log('');

  // 总结
  const allRequired = envCheck.missing.length === 0;
  console.log('━━━ 总结 ━━━');
  if (allRequired) {
    console.log('  🟢 所有必需密钥已配置 · 系统可以正常运行');
  } else {
    console.log(`  🔴 还有 ${envCheck.missing.length} 个必需密钥未配置`);
    console.log('  请参考 brain/secrets-manifest.json 逐一配置');
  }
  console.log('');
}

// ━━━ 主程序 ━━━
const args = process.argv.slice(2);
const mode = args.includes('--check') ? 'check' : 'report';

generateReport(mode);

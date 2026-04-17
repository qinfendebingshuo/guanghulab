/**
 * UI 皮肤部署引擎 · apply-skin.js
 * 
 * 铸渊 · 壳-核分离架构
 * 读取皮肤 JSON → 安全校验 → 生成覆盖 CSS → 部署到目标页面
 * 
 * 用法: node apply-skin.js <skin-file.json>
 * 
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── 配置 ───
const SKINS_DIR = path.join(__dirname, 'skins');
const INBOX_DIR = path.join(SKINS_DIR, 'inbox');
const APPLIED_DIR = path.join(SKINS_DIR, 'applied');
const REJECTED_DIR = path.join(SKINS_DIR, 'rejected');

// 站点根目录（服务器部署路径）
const SITE_ROOT = process.env.SITE_ROOT || path.join(__dirname, '..');

// 目标页面映射
const TARGET_MAP = {
  homepage:  path.join(SITE_ROOT, 'homepage'),
  chat:      path.join(SITE_ROOT, 'persona-studio', 'frontend'),
  dashboard: path.join(SITE_ROOT, 'dashboard'),
  login:     path.join(SITE_ROOT, 'persona-studio', 'frontend')
};

// ─── 安全校验 ───
const FORBIDDEN_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on(click|load|error|mouseover|mouseout|focus|blur|submit|change|input)\s*=/i,
  /expression\s*\(/i,
  /url\s*\(\s*['"]?(https?:|data:|javascript:)/i,
  /@import\s/i,
  /behavior\s*:/i,
  /-moz-binding/i
];

const FORBIDDEN_HIDE_SELECTORS = [
  '#sendBtn',
  '#loginBtn', 
  '.btn-primary',
  '#msgInput',
  '#emailModal'
];

function validateSkin(skin) {
  const errors = [];

  // Required fields
  if (!skin.skin_id) errors.push('缺少 skin_id');
  if (!skin.author) errors.push('缺少 author');
  if (!skin.target) errors.push('缺少 target');
  if (!TARGET_MAP[skin.target]) errors.push('无效的 target: ' + skin.target);

  // Check custom_css for forbidden patterns
  if (skin.custom_css) {
    FORBIDDEN_PATTERNS.forEach(function(pattern) {
      if (pattern.test(skin.custom_css)) {
        errors.push('custom_css 包含禁止内容: ' + pattern.toString());
      }
    });

    // Check for hiding functional elements
    FORBIDDEN_HIDE_SELECTORS.forEach(function(sel) {
      if (skin.custom_css.includes(sel) && /display\s*:\s*none/i.test(skin.custom_css)) {
        errors.push('不允许隐藏功能性元素: ' + sel);
      }
    });
  }

  // Check css_overrides for forbidden patterns
  if (skin.css_overrides) {
    var cssStr = JSON.stringify(skin.css_overrides);
    FORBIDDEN_PATTERNS.forEach(function(pattern) {
      if (pattern.test(cssStr)) {
        errors.push('css_overrides 包含禁止内容: ' + pattern.toString());
      }
    });
  }

  // Check text_overrides for HTML
  if (skin.text_overrides) {
    Object.keys(skin.text_overrides).forEach(function(sel) {
      var text = skin.text_overrides[sel];
      if (/<[^>]+>/.test(text)) {
        errors.push('text_overrides 不允许包含 HTML 标签: ' + sel);
      }
    });
  }

  return errors;
}

// ─── 生成 CSS ───
function generateCSS(skin) {
  var lines = [];
  lines.push('/* UI Skin: ' + skin.skin_id + ' by ' + skin.author + ' */');
  lines.push('/* Target: ' + skin.target + ' · ' + skin.description + ' */');
  lines.push('/* Generated: ' + new Date().toISOString() + ' */');
  lines.push('');

  // CSS variable overrides
  if (skin.css_overrides) {
    Object.keys(skin.css_overrides).forEach(function(selector) {
      var props = skin.css_overrides[selector];
      lines.push(selector + ' {');
      Object.keys(props).forEach(function(prop) {
        lines.push('  ' + prop + ': ' + props[prop] + ';');
      });
      lines.push('}');
      lines.push('');
    });
  }

  // Custom CSS
  if (skin.custom_css) {
    lines.push('/* Custom CSS */');
    lines.push(skin.custom_css);
    lines.push('');
  }

  return lines.join('\n');
}

// ─── 生成 text override JS ───
function generateTextScript(skin) {
  if (!skin.text_overrides || Object.keys(skin.text_overrides).length === 0) {
    return null;
  }

  var lines = [];
  lines.push('/* Text Overrides: ' + skin.skin_id + ' */');
  lines.push('(function() {');
  lines.push('  document.addEventListener("DOMContentLoaded", function() {');
  
  Object.keys(skin.text_overrides).forEach(function(sel) {
    var text = skin.text_overrides[sel].replace(/'/g, "\\'").replace(/\n/g, '\\n');
    lines.push('    var el = document.querySelector(\'' + sel + '\');');
    lines.push('    if (el) el.textContent = \'' + text + '\';');
  });

  lines.push('  });');
  lines.push('})();');

  return lines.join('\n');
}

// ─── 主流程 ───
function applySkin(skinFileName) {
  var skinPath = path.join(INBOX_DIR, skinFileName);

  if (!fs.existsSync(skinPath)) {
    console.error('❌ 皮肤文件不存在: ' + skinPath);
    process.exit(1);
  }

  var skin;
  try {
    skin = JSON.parse(fs.readFileSync(skinPath, 'utf-8'));
  } catch (e) {
    console.error('❌ JSON 解析失败: ' + e.message);
    process.exit(1);
  }

  console.log('📋 皮肤包信息:');
  console.log('   ID: ' + skin.skin_id);
  console.log('   作者: ' + skin.author);
  console.log('   目标: ' + skin.target);
  console.log('   描述: ' + skin.description);
  console.log('');

  // Validate
  var errors = validateSkin(skin);
  if (errors.length > 0) {
    console.error('❌ 安全校验未通过:');
    errors.forEach(function(err) {
      console.error('   - ' + err);
    });

    // Move to rejected
    var rejectPath = path.join(REJECTED_DIR, skinFileName);
    fs.renameSync(skinPath, rejectPath);
    console.error('📁 已移至 rejected/');
    process.exit(1);
  }

  console.log('✅ 安全校验通过');

  // Generate CSS
  var css = generateCSS(skin);
  var targetDir = TARGET_MAP[skin.target];

  // Backup existing skin override if any
  var overridePath = path.join(targetDir, 'skin-override.css');
  if (fs.existsSync(overridePath)) {
    var backupName = 'skin-override.backup.' + Date.now() + '.css';
    fs.copyFileSync(overridePath, path.join(targetDir, backupName));
    console.log('📦 已备份旧皮肤: ' + backupName);
  }

  // Write CSS override
  fs.writeFileSync(overridePath, css, 'utf-8');
  console.log('🎨 CSS 覆盖已写入: ' + overridePath);

  // Write text override script if needed
  var textScript = generateTextScript(skin);
  if (textScript) {
    var scriptPath = path.join(targetDir, 'skin-text-override.js');
    fs.writeFileSync(scriptPath, textScript, 'utf-8');
    console.log('📝 文字覆盖已写入: ' + scriptPath);
  }

  // Move to applied
  var appliedPath = path.join(APPLIED_DIR, skinFileName);
  fs.copyFileSync(skinPath, appliedPath);
  fs.unlinkSync(skinPath);
  console.log('📁 皮肤已归档至 applied/');

  console.log('');
  console.log('✨ 皮肤部署完成！');
  console.log('⚠️  请确认目标 HTML 文件中已引入 skin-override.css:');
  console.log('   <link rel="stylesheet" href="skin-override.css">');
  if (textScript) {
    console.log('   <script src="skin-text-override.js"><\/script>');
  }
}

// ─── CLI ───
var args = process.argv.slice(2);
if (args.length === 0) {
  console.log('用法: node apply-skin.js <skin-file.json>');
  console.log('');
  console.log('示例: node apply-skin.js SKIN-20260417-001.json');
  console.log('');
  console.log('皮肤文件放在: style-system/skins/inbox/ 目录下');
  process.exit(0);
}

applySkin(args[0]);

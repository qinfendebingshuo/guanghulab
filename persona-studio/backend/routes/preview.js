/**
 * persona-studio · 预览 API
 * GET /api/ps/preview/:devId/:project  提供 iframe 实时预览
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const WORKSPACE_DIR = path.join(__dirname, '..', '..', 'workspace');

// 简易速率限制：每个 IP 每分钟最多 60 次请求
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: true,
      code: 'RATE_LIMITED',
      message: '请求过于频繁，请稍后再试'
    });
  }

  return next();
}

// 定期清理过期条目
setInterval(function () {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.start > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

// GET /api/ps/preview/:devId/:project
router.get('/:devId/:project', rateLimit, (req, res) => {
  const { devId, project } = req.params;

  if (!devId || !project) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_PARAMS',
      message: '缺少必要参数'
    });
  }

  // 安全校验：确保 devId 和 project 匹配预期格式（防止路径遍历）
  const safeDevId = path.basename(devId);
  const safeProject = path.basename(project);

  if (!/^[a-zA-Z0-9_-]+$/.test(safeDevId) || !/^[a-zA-Z0-9_.-]+$/.test(safeProject)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_PARAMS',
      message: '参数格式无效'
    });
  }

  const previewDir = path.join(WORKSPACE_DIR, safeDevId, safeProject, 'preview');
  const projectDir = path.join(WORKSPACE_DIR, safeDevId, safeProject);

  // 优先从 preview/ 子目录查找
  let targetDir = previewDir;
  if (!fs.existsSync(previewDir)) {
    targetDir = projectDir;
  }

  const indexPath = path.join(targetDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(404).send(
      '<html><body style="background:#0a0e1a;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">' +
      '<div style="text-align:center"><p style="font-size:2rem">🌊</p><p>预览正在准备中…</p></div>' +
      '</body></html>'
    );
  }

  res.sendFile(indexPath);
});

// GET /api/ps/preview/:devId/:project/:file (sub-resources like CSS/JS)
router.get('/:devId/:project/:file', rateLimit, (req, res) => {
  const { devId, project, file } = req.params;

  const safeDevId = path.basename(devId);
  const safeProject = path.basename(project);
  const safeFile = path.basename(file);

  if (!/^[a-zA-Z0-9_-]+$/.test(safeDevId) || !/^[a-zA-Z0-9_.-]+$/.test(safeProject) || !/^[a-zA-Z0-9_.-]+$/.test(safeFile)) {
    return res.status(400).send('Invalid parameters');
  }

  const previewDir = path.join(WORKSPACE_DIR, safeDevId, safeProject, 'preview');
  const projectDir = path.join(WORKSPACE_DIR, safeDevId, safeProject);

  let targetDir = previewDir;
  if (!fs.existsSync(previewDir)) {
    targetDir = projectDir;
  }

  const filePath = path.join(targetDir, safeFile);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.sendFile(filePath);
});

module.exports = router;

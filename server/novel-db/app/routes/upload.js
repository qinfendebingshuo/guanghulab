/**
 * ═══════════════════════════════════════════════════════════
 * 上传路由 · /api/zhiku/upload
 * ═══════════════════════════════════════════════════════════
 *
 * 智库节点 Phase 4 · ZY-SVR-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 端点:
 *   POST /api/zhiku/upload              — 上传文件
 *   POST /api/zhiku/upload/text         — 上传纯文本（JSON方式）
 *   GET  /api/zhiku/upload/formats      — 获取支持的格式
 *   GET  /api/zhiku/upload/list         — 上传历史
 *   GET  /api/zhiku/upload/stats        — 上传统计
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const engine  = require('../services/upload-engine');

// ─── 文件大小限制 ───
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * 简易文件解析中间件（不依赖 multer）
 * 解析 multipart/form-data 中的单个文件
 */
function parseFileUpload(req, res, next) {
  const contentType = req.headers['content-type'] || '';

  // JSON 方式上传跳过
  if (contentType.includes('application/json')) {
    return next();
  }

  if (!contentType.includes('multipart/form-data')) {
    return res.status(400).json({
      error: true,
      code:  'INVALID_CONTENT_TYPE',
      message: '请使用 multipart/form-data 或 application/json 上传'
    });
  }

  const boundary = contentType.split('boundary=')[1];
  if (!boundary) {
    return res.status(400).json({
      error: true,
      code:  'MISSING_BOUNDARY',
      message: '无法解析 multipart boundary'
    });
  }

  const chunks = [];
  let totalSize = 0;

  req.on('data', (chunk) => {
    totalSize += chunk.length;
    if (totalSize > MAX_SIZE) {
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (totalSize > MAX_SIZE) {
      return res.status(413).json({
        error: true,
        code:  'FILE_TOO_LARGE',
        message: `文件过大，最大支持 ${MAX_SIZE / 1024 / 1024}MB`
      });
    }

    try {
      const buffer = Buffer.concat(chunks);
      const parts = parseMultipart(buffer, boundary);

      req.uploadedFile = parts.file || null;
      req.uploadFields = parts.fields || {};
      next();
    } catch (err) {
      res.status(400).json({
        error: true,
        code:  'PARSE_ERROR',
        message: '文件解析失败: ' + err.message
      });
    }
  });

  req.on('error', () => {
    res.status(500).json({ error: true, code: 'UPLOAD_ERROR', message: '上传过程中断' });
  });
}

/**
 * 解析 multipart/form-data
 */
function parseMultipart(buffer, boundary) {
  const result = { file: null, fields: {} };
  const boundaryBuf = Buffer.from('--' + boundary);
  const parts = [];

  let start = 0;
  while (true) {
    const idx = buffer.indexOf(boundaryBuf, start);
    if (idx === -1) break;
    if (start > 0) {
      parts.push(buffer.slice(start, idx - 2)); // -2 for \r\n
    }
    start = idx + boundaryBuf.length + 2; // skip boundary + \r\n
  }

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headerStr = part.slice(0, headerEnd).toString('utf8');
    const body = part.slice(headerEnd + 4);

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    if (!nameMatch) continue;

    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const contentTypeMatch = headerStr.match(/Content-Type:\s*(.+)/i);

    if (filenameMatch) {
      // 文件部分
      result.file = {
        originalname: filenameMatch[1],
        mimetype:     contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream',
        buffer:       body,
        size:         body.length
      };
    } else {
      // 普通字段
      result.fields[nameMatch[1]] = body.toString('utf8').trim();
    }
  }

  return result;
}

/* ─── POST / — 上传文件（multipart） ─── */
router.post('/', parseFileUpload, (req, res) => {
  try {
    const file = req.uploadedFile;
    const fields = req.uploadFields || {};

    if (!file) {
      return res.status(400).json({
        error: true,
        code:  'NO_FILE',
        message: '未收到文件，请使用 multipart/form-data 上传'
      });
    }

    const result = engine.processUpload(file, {
      title:    fields.title || '',
      author:   fields.author || '',
      uploader: fields.uploader || 'unknown'
    });

    res.status(201).json({
      error: false,
      data:  result,
      message: `上传成功 · ${result.original_format} → TXT · ${result.word_count} 字`
    });
  } catch (err) {
    res.status(400).json({
      error: true,
      code:  'UPLOAD_FAILED',
      message: err.message
    });
  }
});

/* ─── POST /text — 纯文本上传（JSON方式） ─── */
router.post('/text', express.json({ limit: '20mb' }), (req, res) => {
  try {
    const { title, author, content, uploader, format } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length < 10) {
      return res.status(400).json({
        error: true,
        code:  'EMPTY_CONTENT',
        message: '文本内容为空或过短（最少10字）'
      });
    }

    const filename = (title || '未命名') + (format || '.txt');
    const file = {
      originalname: filename,
      mimetype:     'text/plain',
      buffer:       Buffer.from(content, 'utf8'),
      size:         Buffer.byteLength(content, 'utf8')
    };

    const result = engine.processUpload(file, {
      title:    title || '未命名',
      author:   author || '未知',
      uploader: uploader || 'unknown'
    });

    res.status(201).json({
      error: false,
      data:  result,
      message: `文本上传成功 · ${result.word_count} 字`
    });
  } catch (err) {
    res.status(400).json({
      error: true,
      code:  'UPLOAD_FAILED',
      message: err.message
    });
  }
});

/* ─── GET /formats — 支持的格式 ─── */
router.get('/formats', (_req, res) => {
  res.json({
    error: false,
    data:  engine.getSupportedFormats(),
    max_size_mb: MAX_SIZE / 1024 / 1024
  });
});

/* ─── GET /list — 上传历史 ─── */
router.get('/list', (req, res) => {
  const { uploader, limit } = req.query;
  const list = engine.listUploads({
    uploader,
    limit: limit ? parseInt(limit, 10) : undefined
  });

  res.json({
    error: false,
    data:  list,
    total: list.length
  });
});

/* ─── GET /stats — 上传统计 ─── */
router.get('/stats', (_req, res) => {
  res.json({ error: false, data: engine.getStats() });
});

module.exports = router;

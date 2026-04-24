/**
 * 视频生成路由
 * POST /api/video/generate  — 提交生成任务
 * GET  /api/video/status/:id — 查询进度
 * GET  /api/video/preview/:id — 获取预览URL
 * GET  /api/video/download/:id — 下载视频
 *
 * 支持 BYOK: 前端可传 customApiKey，用户使用自己的即梦额度
 */
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const videoDispatch = require('../services/video-dispatch');

// 任务存储 (P0: 内存Map，P1迁移到PostgreSQL)
const tasks = new Map();

// ── 提交生成任务 ────────────────────────────────────
router.post('/generate', async (req, res) => {
  try {
    const {
      prompt,
      model = 'jimeng',
      duration = '5',
      resolution = '1080p',
      style,
      customApiKey,  // BYOK: 用户自定义 API Key
    } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: '提示词不能为空' });
    }
    if (prompt.length > 3000) {
      return res.status(400).json({ error: '提示词超过1000字限制' });
    }

    // 简单校验自定义 Key 格式（非空字符串即可）
    const sanitizedKey = customApiKey && typeof customApiKey === 'string'
      ? customApiKey.trim()
      : null;

    const taskId = uuidv4();
    const task = {
      id: taskId,
      prompt: prompt.trim(),
      model,
      params: { duration, resolution, style },
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      completedAt: null,
      videoUrl: null,
      previewUrl: null,
      apiTaskId: null,
      error: null,
      customApiKey: sanitizedKey,  // 存储以便轮询时使用同一 key
      usingCustomKey: !!sanitizedKey,
    };
    tasks.set(taskId, task);

    // 异步启动生成
    processVideoTask(taskId, req.app.get('io'));

    res.json({
      taskId,
      status: 'pending',
      message: '视频生成任务已提交',
      usingCustomKey: !!sanitizedKey,
    });
  } catch (err) {
    console.error('[POST /api/video/generate]', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// ── 查询进度 ────────────────────────────────────────
router.get('/status/:taskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: '任务不存在' });

  res.json({
    taskId: task.id,
    status: task.status,
    progress: task.progress,
    videoUrl: task.previewUrl,
    error: task.error,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    usingCustomKey: task.usingCustomKey,
  });
});

// ── 预览URL ─────────────────────────────────────────
router.get('/preview/:taskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  if (task.status !== 'completed') {
    return res.status(400).json({ error: '视频尚未生成完成', status: task.status });
  }
  res.json({ previewUrl: task.previewUrl });
});

// ── 下载 ────────────────────────────────────────────
router.get('/download/:taskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  if (task.status !== 'completed') {
    return res.status(400).json({ error: '视频尚未生成完成' });
  }
  res.json({ downloadUrl: task.videoUrl || task.previewUrl });
});

// ── 异步处理 ────────────────────────────────────────
async function processVideoTask(taskId, io) {
  const task = tasks.get(taskId);
  if (!task) return;

  const emit = (data) => io.emit('video:progress', { taskId, ...data });

  try {
    // 1) 提交到即梦
    task.status = 'generating';
    task.progress = 10;
    const keyLabel = task.usingCustomKey ? '您的Key' : '平台';
    emit({ status: 'generating', progress: 10, message: `正在提交到即梦 (${keyLabel})...` });

    const submitResult = await videoDispatch.submitTask({
      prompt: task.prompt,
      duration: task.params.duration,
      resolution: task.params.resolution,
      style: task.params.style,
      customApiKey: task.customApiKey,
    });

    task.apiTaskId = submitResult.taskId;
    task.progress = 20;
    emit({ status: 'generating', progress: 20, message: '任务已提交，等待生成...' });

    // 2) 轮询 (每5秒，最多10分钟)
    const MAX_ATTEMPTS = 120;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await sleep(5000);

      const result = await videoDispatch.queryTask(submitResult.taskId, task.customApiKey);

      if (result.status === 'completed') {
        task.status = 'completed';
        task.progress = 100;
        task.videoUrl = result.videoUrl;
        task.previewUrl = result.videoUrl;
        task.completedAt = new Date().toISOString();
        emit({ status: 'completed', progress: 100, message: '✅ 视频生成完成！', videoUrl: result.videoUrl });
        console.log(`[video] ✅ 完成: ${taskId} (${task.usingCustomKey ? '用户Key' : '平台Key'})`);
        return;
      }

      if (result.status === 'failed') {
        throw new Error(result.error || '即梦返回生成失败');
      }

      // 进度: 20→90 线性
      const progress = Math.min(90, 20 + Math.floor((i / MAX_ATTEMPTS) * 70));
      task.progress = progress;
      emit({ status: 'generating', progress, message: `生成中... ${progress}%` });
    }

    throw new Error('生成超时（超过10分钟）');
  } catch (err) {
    task.status = 'failed';
    task.error = err.message;
    emit({ status: 'failed', progress: 0, message: `❌ ${err.message}` });
    console.error(`[video] ❌ 失败: ${taskId}`, err.message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = router;

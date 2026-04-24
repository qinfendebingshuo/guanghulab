/**
 * 视频生成API调度器
 * MVP P0: 仅对接即梦 Seedance (火山方舟)
 * P3: 扩展可灵 / Vidu / WAN / Veo
 *
 * 即梦 Seedance API 通过火山方舟(VolcEngine Ark)调用
 * 文档: https://www.volcengine.com/docs/6791
 */
const axios = require('axios');
const config = require('../config');

class VideoDispatch {
  constructor() {
    this.client = axios.create({
      baseURL: config.jimeng.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.jimeng.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * 提交视频生成任务到即梦
   * @param {object} opts
   * @param {string} opts.prompt - 视频描述提示词
   * @param {string} opts.duration - 时长 '5' | '10'
   * @param {string} opts.resolution - 分辨率 '720p' | '1080p'
   * @param {string} [opts.style] - 风格
   * @returns  taskId: string 
   */
  async submitTask({ prompt, duration = '5', resolution = '1080p', style }) {
    console.log(`[即梦] 提交任务: ${prompt.substring(0, 50)}...`);

    const payload = {
      model: config.jimeng.model,
      content: [
        { type: 'text', text: prompt }
      ],
      parameters: {
        video_length: String(duration),
        resolution: resolution,
      },
    };

    if (style) {
      payload.parameters.style = style;
    }

    try {
      const resp = await this.client.post('/contents/generations/tasks', payload);
      const data = resp.data;

      // 火山方舟返回格式适配
      const taskId = data.id || data.task_id || data.data?.task_id || data.data?.id;

      if (!taskId) {
        console.error('[即梦] 响应无task_id:', JSON.stringify(data));
        throw new Error('即梦API未返回任务ID');
      }

      console.log(`[即梦] 任务已提交: ${taskId}`);
      return { taskId };
    } catch (err) {
      if (err.response) {
        const msg = err.response.data?.error?.message
          || err.response.data?.message
          || JSON.stringify(err.response.data);
        throw new Error(`即梦API错误(${err.response.status}): ${msg}`);
      }
      throw err;
    }
  }

  /**
   * 查询任务状态
   * @param {string} apiTaskId
   * @returns  status: 'generating'|'completed'|'failed', videoUrl?: string, error?: string 
   */
  async queryTask(apiTaskId) {
    try {
      const resp = await this.client.get(`/contents/generations/tasks/${apiTaskId}`);
      const data = resp.data;

      const rawStatus = (data.status || data.data?.status || '').toLowerCase();

      // 完成
      if (['succeeded', 'completed', 'success', 'done'].includes(rawStatus)) {
        const videoUrl = data.output?.video_url
          || data.output?.url
          || data.data?.output?.video_url
          || data.data?.output?.url
          || data.result?.video_url
          || data.content?.[0]?.url
          || data.data?.content?.[0]?.url;

        if (!videoUrl) {
          console.warn('[即梦] 任务完成但无视频URL:', JSON.stringify(data));
          return { status: 'failed', error: '任务完成但未返回视频地址' };
        }

        return { status: 'completed', videoUrl };
      }

      // 失败
      if (['failed', 'error', 'cancelled'].includes(rawStatus)) {
        const errMsg = data.error?.message || data.data?.error?.message || data.message || '生成失败';
        return { status: 'failed', error: errMsg };
      }

      // 其他 = 生成中
      return { status: 'generating' };
    } catch (err) {
      if (err.response) {
        const msg = err.response.data?.error?.message || err.response.data?.message || '查询失败';
        throw new Error(`即梦查询错误(${err.response.status}): ${msg}`);
      }
      throw err;
    }
  }
}

module.exports = new VideoDispatch();

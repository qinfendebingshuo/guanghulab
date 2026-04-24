/**
 * 视频生成API调度器
 * MVP P0: 仅对接即梦 Seedance (火山方舟)
 * P3: 扩展可灵 / Vidu / WAN / Veo
 *
 * 支持 BYOK (Bring Your Own Key):
 *   - 默认使用平台配置的 API Key
 *   - 用户可传入自己的 API Key 使用自己的额度
 *
 * 即梦 Seedance API 通过火山方舟(VolcEngine Ark)调用
 * 文档: https://www.volcengine.com/docs/6791
 */
const axios = require('axios');
const config = require('../config');

class VideoDispatch {
  /**
   * 创建 axios 客户端
   * @param {string} [customApiKey] - 用户自定义 API Key，不传则用平台默认
   */
  _createClient(customApiKey) {
    const apiKey = customApiKey || config.jimeng.apiKey;
    return axios.create({
      baseURL: config.jimeng.baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
   * @param {string} [opts.customApiKey] - 用户自定义 API Key (BYOK)
   * @returns {Promise<{taskId: string, usingCustomKey: boolean}>}
   */
  async submitTask({ prompt, duration = '5', resolution = '1080p', style, customApiKey }) {
    const usingCustomKey = !!customApiKey;
    const client = this._createClient(customApiKey);

    console.log(`[即梦] 提交任务 (${usingCustomKey ? '用户Key' : '平台Key'}): ${prompt.substring(0, 50)}...`);

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
      const resp = await client.post('/contents/generations/tasks', payload);
      const data = resp.data;

      // 火山方舟返回格式适配
      const taskId = data.id || data.task_id || data.data?.task_id || data.data?.id;

      if (!taskId) {
        console.error('[即梦] 响应无task_id:', JSON.stringify(data));
        throw new Error('即梦API未返回任务ID');
      }

      console.log(`[即梦] 任务已提交: ${taskId}`);
      return { taskId, usingCustomKey };
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        const msg = err.response.data?.error?.message
          || err.response.data?.message
          || JSON.stringify(err.response.data);

        // BYOK 专属错误提示
        if (usingCustomKey && (status === 401 || status === 403)) {
          throw new Error('您的 API Key 无效或已过期，请检查后重试');
        }
        if (usingCustomKey && status === 429) {
          throw new Error('您的 API Key 额度已用完，请充值后重试');
        }

        throw new Error(`即梦API错误(${status}): ${msg}`);
      }
      throw err;
    }
  }

  /**
   * 查询任务状态
   * @param {string} apiTaskId
   * @param {string} [customApiKey] - 用户自定义 API Key (BYOK)
   * @returns {Promise<{status: string, videoUrl?: string, error?: string}>}
   */
  async queryTask(apiTaskId, customApiKey) {
    const client = this._createClient(customApiKey);

    try {
      const resp = await client.get(`/contents/generations/tasks/${apiTaskId}`);
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

/**
 * ═══════════════════════════════════════════════════════════
 * 模块H · 开源模型微调引擎 MCP 工具
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 冰朔D62核心指令: 接入开源模型，用COS桶训练数据直接做微调
 * 本质: 同一份TCS结构化数据，两种用途 — RAG + 微调
 *
 * 架构理念:
 *   现有RAG训练 → 用API调用商业模型，人格体"脑子"在COS桶里
 *   开源模型微调 → 用同一份数据，把"脑子"直接装进开源模型
 *   二者并行运行 → 微调模型优先 → 不可用时降级回API模型
 *
 * 工具清单:
 *   finetuneExportDataset   — 导出TCS语料为微调JSONL格式
 *   finetuneSubmitJob       — 提交微调任务到DeepSeek/Qwen
 *   finetuneCheckStatus     — 查询微调任务进度
 *   finetuneRegisterModel   — 注册微调完成的模型
 *   finetuneListModels      — 列出已注册的微调模型
 *   finetuneCallModel       — 调用微调模型进行推理
 *   finetuneCompareModels   — A/B测试微调 vs 基座模型
 *   finetuneGetCostEstimate — 估算微调成本
 */

'use strict';

const https = require('https');
const crypto = require('crypto');
const cos = require('../cos');

// ─── 微调 API 配置 ───
const FINETUNE_PROVIDERS = {
  deepseek: {
    host: 'api.deepseek.com',
    createPath: '/fine_tuning/jobs',
    statusPath: '/fine_tuning/jobs/',
    uploadPath: '/files',
    inferencePath: '/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    keyEnv: 'ZY_DEEPSEEK_API_KEY',
    label: 'DeepSeek微调'
  },
  qwen: {
    host: 'dashscope.aliyuncs.com',
    createPath: '/api/v1/fine-tunes',
    statusPath: '/api/v1/fine-tunes/',
    uploadPath: '/api/v1/files',
    inferencePath: '/compatible-mode/v1/chat/completions',
    defaultModel: 'qwen-max',
    keyEnv: 'ZY_QWEN_API_KEY',
    label: 'Qwen/DashScope微调'
  }
};

// ─── 推理降级配置（与training-agent-ops.js同源） ───
const LLM_CONFIGS = {
  'deepseek-chat': {
    host: 'api.deepseek.com',
    path: '/v1/chat/completions',
    model: 'deepseek-chat',
    keyEnv: 'ZY_DEEPSEEK_API_KEY',
    purpose: '微调基座·推理降级'
  },
  'qwen-max': {
    host: 'dashscope.aliyuncs.com',
    path: '/compatible-mode/v1/chat/completions',
    model: 'qwen-max',
    keyEnv: 'ZY_QWEN_API_KEY',
    purpose: '微调基座·推理降级'
  }
};

// ─── 成本估算参数（2026-04 参考价，实际以provider当月公告为准） ───
const COST_PER_1K_TOKENS = {
  deepseek: 0.014,  // 约 ¥0.014 / 1K tokens（训练）· 2026-04 参考
  qwen: 0.020       // 约 ¥0.020 / 1K tokens（训练）· 2026-04 参考
};

// ─── 常量 ───
const DEFAULT_BUCKET = 'cold';
const MAX_SAMPLES_DEFAULT = 500;
const FINETUNE_TIMEOUT = 60000;

// ═══════════════════════════════════════════════════════════
// 工具实现
// ═══════════════════════════════════════════════════════════

/**
 * finetuneExportDataset — 导出TCS语料为微调JSONL格式
 *
 * 将COS桶中的TCS结构化语料转换为 instruction/input/output 三元组
 * JSONL格式，直接用于提交到微调API
 *
 * input:
 *   persona_id: string      — 人格体ID
 *   corpus_bucket: string   — 语料桶（默认cold）
 *   corpus_prefix: string   — 语料路径前缀
 *   output_format: string   — 输出格式（默认jsonl）
 *   max_samples: number     — 最大样本数
 */
async function finetuneExportDataset(input) {
  const { persona_id, corpus_bucket, corpus_prefix, output_format, max_samples } = input;
  if (!persona_id) throw new Error('缺少 persona_id');

  const bucket = corpus_bucket || DEFAULT_BUCKET;
  const prefix = corpus_prefix || 'tcs-structured/';
  const format = output_format || 'jsonl';
  const maxSamples = max_samples || MAX_SAMPLES_DEFAULT;
  const datasetId = `ds-${persona_id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  // 扫描TCS语料文件
  let corpusFiles = [];
  try {
    const result = await cos.list(bucket, prefix, 500);
    corpusFiles = result.files.filter(f => f.key.endsWith('.tcs.json') || f.key.endsWith('.json'));
  } catch {
    throw new Error(`无法读取语料桶 ${bucket}/${prefix}`);
  }

  if (corpusFiles.length === 0) {
    throw new Error(`语料桶 ${bucket}/${prefix} 中未找到TCS语料文件`);
  }

  // 逐文件读取并转换为JSONL三元组
  const jsonlLines = [];
  let filesProcessed = 0;

  for (const file of corpusFiles) {
    if (jsonlLines.length >= maxSamples) break;

    try {
      const raw = await cos.read(bucket, file.key);
      const corpus = JSON.parse(raw.content);
      const entries = corpus.entries || (Array.isArray(corpus) ? corpus : [corpus]);

      for (const entry of entries) {
        if (jsonlLines.length >= maxSamples) break;

        const triple = convertEntryToTriple(persona_id, corpus.corpus_type, entry);
        if (triple) {
          jsonlLines.push(JSON.stringify(triple));
        }
      }
      filesProcessed++;
    } catch {
      // 跳过无法解析的文件
    }
  }

  if (jsonlLines.length === 0) {
    throw new Error('未能从语料中生成任何训练样本');
  }

  // 写入JSONL到COS
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileKey = `finetune-datasets/${persona_id}/${timestamp}.${format}`;
  const jsonlContent = jsonlLines.join('\n') + '\n';

  await cos.write(bucket, fileKey, jsonlContent, 'application/jsonl');

  return {
    dataset_id: datasetId,
    file_key: fileKey,
    sample_count: jsonlLines.length,
    format,
    files_scanned: corpusFiles.length,
    files_processed: filesProcessed,
    bucket,
    created_at: new Date().toISOString()
  };
}

/**
 * finetuneSubmitJob — 提交微调任务到DeepSeek或Qwen API
 *
 * 从COS读取JSONL数据集，上传到provider，然后创建微调任务
 *
 * input:
 *   persona_id: string    — 人格体ID
 *   dataset_key: string   — COS中JSONL文件路径
 *   provider: string      — 微调提供方（deepseek / qwen）
 *   base_model: string    — 基座模型（可选，默认取provider默认值）
 *   hyperparams: object   — 超参数（可选）
 */
async function finetuneSubmitJob(input) {
  const { persona_id, dataset_key, provider, base_model, hyperparams } = input;
  if (!persona_id) throw new Error('缺少 persona_id');
  if (!dataset_key) throw new Error('缺少 dataset_key');

  const providerKey = (provider || 'deepseek').toLowerCase();
  const providerConfig = FINETUNE_PROVIDERS[providerKey];
  if (!providerConfig) throw new Error(`不支持的微调提供方: ${providerKey}，仅支持 deepseek / qwen`);

  const apiKey = process.env[providerConfig.keyEnv];
  if (!apiKey) throw new Error(`缺少API密钥环境变量 ${providerConfig.keyEnv}`);

  const jobId = `ft-${persona_id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const model = base_model || providerConfig.defaultModel;

  // 从COS读取JSONL数据集
  const bucket = DEFAULT_BUCKET;
  const raw = await cos.read(bucket, dataset_key);
  const datasetContent = raw.content;

  // 上传训练文件到provider
  const fileId = await uploadTrainingFile(providerConfig, apiKey, datasetContent, providerKey);

  // 创建微调任务
  const jobResult = await createFinetuneJob(providerConfig, apiKey, model, fileId, hyperparams, providerKey);

  // 保存任务元数据到COS
  const jobMeta = {
    job_id: jobId,
    provider_job_id: jobResult.provider_job_id,
    persona_id,
    provider: providerKey,
    base_model: model,
    dataset_key,
    file_id: fileId,
    hyperparams: hyperparams || {},
    status: jobResult.status || 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await cos.write(bucket, `finetune-jobs/${persona_id}/${jobId}.json`,
    JSON.stringify(jobMeta, null, 2), 'application/json');

  return {
    job_id: jobId,
    provider_job_id: jobResult.provider_job_id,
    provider: providerKey,
    status: jobMeta.status,
    base_model: model,
    estimated_time: jobResult.estimated_time || '未知，通常需要数小时'
  };
}

/**
 * finetuneCheckStatus — 查询微调任务进度
 *
 * input:
 *   persona_id: string — 人格体ID
 *   job_id: string     — 任务ID
 *   provider: string   — 微调提供方
 */
async function finetuneCheckStatus(input) {
  const { persona_id, job_id, provider } = input;
  if (!persona_id) throw new Error('缺少 persona_id');
  if (!job_id) throw new Error('缺少 job_id');

  const bucket = DEFAULT_BUCKET;

  // 读取任务元数据
  let jobMeta;
  try {
    const raw = await cos.read(bucket, `finetune-jobs/${persona_id}/${job_id}.json`);
    jobMeta = JSON.parse(raw.content);
  } catch {
    throw new Error(`未找到微调任务: ${job_id}`);
  }

  const providerKey = provider || jobMeta.provider;
  const providerConfig = FINETUNE_PROVIDERS[providerKey];
  if (!providerConfig) throw new Error(`不支持的微调提供方: ${providerKey}`);

  const apiKey = process.env[providerConfig.keyEnv];
  if (!apiKey) throw new Error(`缺少API密钥环境变量 ${providerConfig.keyEnv}`);

  // 查询provider API获取最新状态
  const providerJobId = jobMeta.provider_job_id;
  let statusResult;
  try {
    statusResult = await queryJobStatus(providerConfig, apiKey, providerJobId, providerKey);
  } catch (err) {
    return {
      job_id,
      provider: providerKey,
      status: jobMeta.status,
      progress: null,
      metrics: null,
      error: `查询provider状态失败: ${err.message}`,
      last_known_update: jobMeta.updated_at
    };
  }

  // 更新COS中的任务元数据
  jobMeta.status = statusResult.status;
  jobMeta.updated_at = new Date().toISOString();
  if (statusResult.fine_tuned_model) {
    jobMeta.fine_tuned_model = statusResult.fine_tuned_model;
  }
  if (statusResult.metrics) {
    jobMeta.metrics = statusResult.metrics;
  }

  try {
    await cos.write(bucket, `finetune-jobs/${persona_id}/${job_id}.json`,
      JSON.stringify(jobMeta, null, 2), 'application/json');
  } catch { /* ignore */ }

  return {
    job_id,
    provider_job_id: providerJobId,
    provider: providerKey,
    status: statusResult.status,
    progress: statusResult.progress || null,
    metrics: statusResult.metrics || null,
    fine_tuned_model: statusResult.fine_tuned_model || null,
    updated_at: jobMeta.updated_at
  };
}

/**
 * finetuneRegisterModel — 注册微调完成的模型
 *
 * input:
 *   persona_id: string      — 人格体ID
 *   job_id: string          — 关联的微调任务ID
 *   model_endpoint: string  — 模型推理端点（provider返回的fine_tuned_model名称）
 *   model_name: string      — 本地注册名称
 *   provider: string        — 微调提供方
 *   description: string     — 模型描述
 */
async function finetuneRegisterModel(input) {
  const { persona_id, job_id, model_endpoint, model_name, provider, description } = input;
  if (!persona_id) throw new Error('缺少 persona_id');
  if (!model_endpoint) throw new Error('缺少 model_endpoint');
  if (!model_name) throw new Error('缺少 model_name');

  const providerKey = (provider || 'deepseek').toLowerCase();
  const providerConfig = FINETUNE_PROVIDERS[providerKey];
  if (!providerConfig) throw new Error(`不支持的微调提供方: ${providerKey}`);

  const modelId = `mdl-${persona_id}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  const modelConfig = {
    model_id: modelId,
    persona_id,
    model_name,
    model_endpoint,
    provider: providerKey,
    provider_host: providerConfig.host,
    inference_path: providerConfig.inferencePath,
    key_env: providerConfig.keyEnv,
    job_id: job_id || null,
    description: description || `${persona_id} 微调模型`,
    status: 'active',
    created_at: now,
    updated_at: now
  };

  const bucket = DEFAULT_BUCKET;
  const configKey = `finetune-models/${persona_id}/${model_name}.json`;
  await cos.write(bucket, configKey, JSON.stringify(modelConfig, null, 2), 'application/json');

  return {
    model_id: modelId,
    model_name,
    provider: providerKey,
    registered_at: now,
    config_key: configKey,
    config: modelConfig
  };
}

/**
 * finetuneListModels — 列出已注册的微调模型
 *
 * input:
 *   persona_id: string — 人格体ID
 */
async function finetuneListModels(input) {
  const { persona_id } = input;
  if (!persona_id) throw new Error('缺少 persona_id');

  const bucket = DEFAULT_BUCKET;
  const prefix = `finetune-models/${persona_id}/`;

  let files = [];
  try {
    const result = await cos.list(bucket, prefix, 100);
    files = result.files.filter(f => f.key.endsWith('.json'));
  } catch {
    return { persona_id, models: [], count: 0 };
  }

  const models = [];
  for (const file of files) {
    try {
      const raw = await cos.read(bucket, file.key);
      const config = JSON.parse(raw.content);
      models.push({
        model_name: config.model_name,
        model_id: config.model_id,
        provider: config.provider,
        model_endpoint: config.model_endpoint,
        status: config.status,
        description: config.description,
        created_at: config.created_at
      });
    } catch {
      // 跳过无法解析的配置
    }
  }

  return {
    persona_id,
    models,
    count: models.length
  };
}

/**
 * finetuneCallModel — 调用微调模型进行推理
 *
 * 加载模型配置，调用provider推理API
 * 微调模型不可用时自动降级到基座模型
 *
 * input:
 *   persona_id: string   — 人格体ID
 *   model_name: string   — 已注册的模型名称
 *   prompt: string       — 推理提示词
 *   temperature: number  — 温度（默认0.7）
 *   max_tokens: number   — 最大token数（默认1000）
 */
async function finetuneCallModel(input) {
  const { persona_id, model_name, prompt, temperature, max_tokens } = input;
  if (!persona_id) throw new Error('缺少 persona_id');
  if (!model_name) throw new Error('缺少 model_name');
  if (!prompt) throw new Error('缺少 prompt');

  const bucket = DEFAULT_BUCKET;
  let modelConfig;
  let fallbackUsed = false;

  // 加载模型配置
  try {
    const raw = await cos.read(bucket, `finetune-models/${persona_id}/${model_name}.json`);
    modelConfig = JSON.parse(raw.content);
  } catch {
    throw new Error(`未找到模型配置: ${model_name}`);
  }

  const apiKey = process.env[modelConfig.key_env];
  if (!apiKey) throw new Error(`缺少API密钥环境变量 ${modelConfig.key_env}`);

  const temp = typeof temperature === 'number' ? temperature : 0.7;
  const tokens = max_tokens || 1000;

  // 尝试调用微调模型
  try {
    const result = await callInferenceAPI({
      host: modelConfig.provider_host,
      path: modelConfig.inference_path,
      model: modelConfig.model_endpoint
    }, apiKey, prompt, temp, tokens);

    return {
      response: result.content,
      model_used: modelConfig.model_endpoint,
      provider: modelConfig.provider,
      tokens: result.tokens,
      fallback_used: false
    };
  } catch {
    // 微调模型不可用，降级到基座模型
    fallbackUsed = true;
  }

  // 降级：使用基座模型
  const baseConfig = LLM_CONFIGS[modelConfig.provider === 'deepseek' ? 'deepseek-chat' : 'qwen-max'];
  if (!baseConfig) throw new Error('降级失败：无可用基座模型');

  const baseKey = process.env[baseConfig.keyEnv];
  if (!baseKey) throw new Error(`降级失败：缺少基座模型API密钥 ${baseConfig.keyEnv}`);

  const result = await callInferenceAPI({
    host: baseConfig.host,
    path: baseConfig.path,
    model: baseConfig.model
  }, baseKey, prompt, temp, tokens);

  return {
    response: result.content,
    model_used: baseConfig.model,
    provider: modelConfig.provider,
    tokens: result.tokens,
    fallback_used: fallbackUsed,
    fallback_reason: '微调模型不可用，已降级到基座模型'
  };
}

/**
 * finetuneCompareModels — A/B测试微调 vs 基座模型
 *
 * 用相同的prompt分别调用微调模型和基座模型，返回对比结果
 *
 * input:
 *   persona_id: string  — 人格体ID
 *   model_name: string  — 已注册的微调模型名称
 *   test_prompt: string — 测试提示词
 *   base_model: string  — 基座模型名称（默认取provider对应的基座）
 */
async function finetuneCompareModels(input) {
  const { persona_id, model_name, test_prompt, base_model } = input;
  if (!persona_id) throw new Error('缺少 persona_id');
  if (!model_name) throw new Error('缺少 model_name');
  if (!test_prompt) throw new Error('缺少 test_prompt');

  const bucket = DEFAULT_BUCKET;

  // 加载微调模型配置
  let modelConfig;
  try {
    const raw = await cos.read(bucket, `finetune-models/${persona_id}/${model_name}.json`);
    modelConfig = JSON.parse(raw.content);
  } catch {
    throw new Error(`未找到模型配置: ${model_name}`);
  }

  const apiKey = process.env[modelConfig.key_env];
  if (!apiKey) throw new Error(`缺少API密钥环境变量 ${modelConfig.key_env}`);

  // 确定基座模型
  const baseModelName = base_model || (modelConfig.provider === 'deepseek' ? 'deepseek-chat' : 'qwen-max');
  const baseConfig = LLM_CONFIGS[baseModelName];
  if (!baseConfig) throw new Error(`未找到基座模型配置: ${baseModelName}`);

  const baseKey = process.env[baseConfig.keyEnv];
  if (!baseKey) throw new Error(`缺少基座模型API密钥 ${baseConfig.keyEnv}`);

  // 并行调用两个模型
  const [finetunedResult, baseResult] = await Promise.allSettled([
    callInferenceAPI({
      host: modelConfig.provider_host,
      path: modelConfig.inference_path,
      model: modelConfig.model_endpoint
    }, apiKey, test_prompt, 0.7, 1000),
    callInferenceAPI({
      host: baseConfig.host,
      path: baseConfig.path,
      model: baseConfig.model
    }, baseKey, test_prompt, 0.7, 1000)
  ]);

  return {
    test_prompt,
    finetuned_response: finetunedResult.status === 'fulfilled'
      ? finetunedResult.value.content
      : `调用失败: ${finetunedResult.reason?.message || '未知错误'}`,
    base_response: baseResult.status === 'fulfilled'
      ? baseResult.value.content
      : `调用失败: ${baseResult.reason?.message || '未知错误'}`,
    model_a: {
      name: modelConfig.model_endpoint,
      type: 'finetuned',
      tokens: finetunedResult.status === 'fulfilled' ? finetunedResult.value.tokens : null
    },
    model_b: {
      name: baseConfig.model,
      type: 'base',
      tokens: baseResult.status === 'fulfilled' ? baseResult.value.tokens : null
    },
    compared_at: new Date().toISOString()
  };
}

/**
 * finetuneGetCostEstimate — 估算微调成本
 *
 * 读取JSONL数据集，统计token数量，按provider定价估算费用
 *
 * input:
 *   persona_id: string  — 人格体ID
 *   dataset_key: string — COS中JSONL文件路径
 *   provider: string    — 微调提供方（deepseek / qwen）
 */
async function finetuneGetCostEstimate(input) {
  const { persona_id, dataset_key, provider } = input;
  if (!persona_id) throw new Error('缺少 persona_id');
  if (!dataset_key) throw new Error('缺少 dataset_key');

  const bucket = DEFAULT_BUCKET;
  const providerKey = (provider || 'deepseek').toLowerCase();

  if (!FINETUNE_PROVIDERS[providerKey]) {
    throw new Error(`不支持的微调提供方: ${providerKey}`);
  }

  // 读取JSONL数据集
  const raw = await cos.read(bucket, dataset_key);
  const lines = raw.content.split('\n').filter(l => l.trim());

  // 统计token（中文约每字1.5-2 token，英文约每词1 token，粗估用字符数/2）
  let totalChars = 0;
  let sampleCount = 0;

  for (const line of lines) {
    try {
      const sample = JSON.parse(line);
      const messages = sample.messages || [];
      for (const msg of messages) {
        totalChars += (msg.content || '').length;
      }
      sampleCount++;
    } catch {
      // 跳过无效行
    }
  }

  // 粗估token数（中文字符 ≈ 1.5 tokens，英文约1:1）
  const estimatedTokens = Math.ceil(totalChars * 1.5);
  const costPer1k = COST_PER_1K_TOKENS[providerKey] || 0.02;

  // 微调通常跑 3-4 个 epoch
  const epochs = 3;
  const totalTrainTokens = estimatedTokens * epochs;
  const estimatedCostRmb = (totalTrainTokens / 1000) * costPer1k;

  return {
    dataset_key,
    sample_count: sampleCount,
    total_chars: totalChars,
    token_count: estimatedTokens,
    training_tokens: totalTrainTokens,
    epochs,
    estimated_cost_rmb: Math.round(estimatedCostRmb * 100) / 100,
    provider: providerKey,
    cost_per_1k_tokens: costPer1k,
    notes: [
      `Token估算基于字符数粗估（中文 ×1.5），实际以provider计费为准`,
      `训练按 ${epochs} 个epoch估算`,
      `${FINETUNE_PROVIDERS[providerKey].label} 当前参考价: ¥${costPer1k}/1K tokens`,
      `实际费用可能因模型版本和优惠策略有所不同`
    ]
  };
}

// ═══════════════════════════════════════════════════════════
// Provider API 交互（内部实现）
// ═══════════════════════════════════════════════════════════

/**
 * 上传训练文件到provider
 */
function uploadTrainingFile(providerConfig, apiKey, content, providerKey) {
  return new Promise((resolve, reject) => {
    // 构建 multipart/form-data
    const boundary = `----FormBoundary${crypto.randomBytes(8).toString('hex')}`;
    const fileName = `training-${Date.now()}.jsonl`;

    let bodyParts = [];
    bodyParts.push(`--${boundary}\r\n`);
    bodyParts.push(`Content-Disposition: form-data; name="purpose"\r\n\r\n`);
    bodyParts.push(`fine-tune\r\n`);
    bodyParts.push(`--${boundary}\r\n`);
    bodyParts.push(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`);
    bodyParts.push(`Content-Type: application/jsonl\r\n\r\n`);
    bodyParts.push(content);
    bodyParts.push(`\r\n--${boundary}--\r\n`);

    const body = bodyParts.join('');

    const req = https.request({
      hostname: providerConfig.host,
      port: 443,
      path: providerConfig.uploadPath,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: FINETUNE_TIMEOUT
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString());
            // DeepSeek返回 {id: "file-xxx"}, Qwen返回类似结构
            resolve(data.id || data.file_id || data.output?.file_id || '');
          } catch {
            reject(new Error('训练文件上传响应解析失败'));
          }
        } else {
          reject(new Error(`训练文件上传失败: HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('训练文件上传超时')); });
    req.write(body);
    req.end();
  });
}

/**
 * 创建微调任务
 */
function createFinetuneJob(providerConfig, apiKey, model, fileId, hyperparams, providerKey) {
  return new Promise((resolve, reject) => {
    let requestBody;

    if (providerKey === 'deepseek') {
      requestBody = {
        model,
        training_file: fileId,
        hyperparameters: {
          n_epochs: hyperparams?.n_epochs || 3,
          learning_rate_multiplier: hyperparams?.learning_rate_multiplier || 1.0,
          batch_size: hyperparams?.batch_size || 'auto'
        }
      };
    } else {
      // Qwen/DashScope 格式
      requestBody = {
        model,
        training_file_ids: [fileId],
        hyper_parameters: {
          n_epochs: hyperparams?.n_epochs || 3,
          learning_rate: hyperparams?.learning_rate_multiplier || 1e-5,
          batch_size: hyperparams?.batch_size || 4
        }
      };
    }

    const body = JSON.stringify(requestBody);

    const req = https.request({
      hostname: providerConfig.host,
      port: 443,
      path: providerConfig.createPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: FINETUNE_TIMEOUT
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString());
            resolve({
              provider_job_id: data.id || data.output?.job_id || '',
              status: data.status || data.output?.status || 'pending',
              estimated_time: data.estimated_completion || null
            });
          } catch {
            reject(new Error('微调任务创建响应解析失败'));
          }
        } else {
          reject(new Error(`微调任务创建失败: HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('微调任务创建超时')); });
    req.write(body);
    req.end();
  });
}

/**
 * 查询微调任务状态
 */
function queryJobStatus(providerConfig, apiKey, providerJobId, providerKey) {
  return new Promise((resolve, reject) => {
    const path = `${providerConfig.statusPath}${encodeURIComponent(providerJobId)}`;

    const req = https.request({
      hostname: providerConfig.host,
      port: 443,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 30000
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString());

            // 统一不同provider的状态字段
            let status, progress, metrics, fineTunedModel;

            if (providerKey === 'deepseek') {
              status = data.status || 'unknown';
              fineTunedModel = data.fine_tuned_model || null;
              metrics = data.result_files ? { result_files: data.result_files } : null;
              progress = data.trained_tokens
                ? { trained_tokens: data.trained_tokens }
                : null;
            } else {
              // Qwen
              const output = data.output || data;
              status = output.status || data.status || 'unknown';
              fineTunedModel = output.fine_tuned_model || output.finetuned_output?.model_id || null;
              metrics = output.metrics || null;
              progress = output.training_progress || null;
            }

            // 统一状态值
            status = normalizeJobStatus(status);

            resolve({ status, progress, metrics, fine_tuned_model: fineTunedModel });
          } catch {
            reject(new Error('微调状态查询响应解析失败'));
          }
        } else {
          reject(new Error(`微调状态查询失败: HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('微调状态查询超时')); });
    req.end();
  });
}

/**
 * 调用推理API（微调模型或基座模型通用）
 */
function callInferenceAPI(config, apiKey, prompt, temperature, maxTokens) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: config.model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: temperature || 0.7,
      max_tokens: maxTokens || 1000
    });

    const req = https.request({
      hostname: config.host,
      port: 443,
      path: config.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString());
            resolve({
              content: data.choices?.[0]?.message?.content || '',
              tokens: data.usage || {}
            });
          } catch {
            reject(new Error('推理响应解析失败'));
          }
        } else {
          reject(new Error(`推理调用失败: HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('推理请求超时')); });
    req.write(body);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════

/**
 * 将TCS语料条目转换为微调JSONL三元组
 */
function convertEntryToTriple(personaId, corpusType, entry) {
  const content = typeof entry.content === 'string'
    ? entry.content
    : (entry.text || entry.summary || JSON.stringify(entry));

  if (!content || content.length < 10) return null;

  const tags = entry.tcs_tags || entry.tags || [];
  const category = entry.category || corpusType || 'general';

  // 生成system prompt（人格体身份）
  const systemContent = `你是${personaId}，光湖系统中的人格体。你的思维方式基于TCS语言核系统，` +
    `你需要以${personaId}的视角和风格来回答问题。`;

  // 根据语料类型构建instruction/input/output
  let userContent, assistantContent;

  if (entry.question && entry.answer) {
    // 已有Q&A结构
    userContent = entry.question;
    assistantContent = entry.answer;
  } else if (tags.length > 0) {
    // 有标签的条目：生成关于该内容的问答
    userContent = `关于${category}类型的内容，请解释以下要点: ${tags.slice(0, 3).join('、')}`;
    assistantContent = content;
  } else {
    // 通用条目：以理解和阐述的方式构建
    userContent = `请阐述你对以下内容的理解和看法：\n${content.substring(0, 200)}`;
    assistantContent = content;
  }

  return {
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
      { role: 'assistant', content: assistantContent }
    ]
  };
}

/**
 * 统一不同provider的任务状态值
 */
function normalizeJobStatus(rawStatus) {
  const statusMap = {
    // DeepSeek 状态
    validating_files: 'pending',
    queued: 'pending',
    running: 'running',
    succeeded: 'completed',
    failed: 'failed',
    cancelled: 'failed',
    // Qwen/DashScope 状态
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCEEDED: 'completed',
    FAILED: 'failed',
    CANCELED: 'failed',
    // 通用
    pending: 'pending',
    completed: 'completed'
  };

  return statusMap[rawStatus] || rawStatus;
}

module.exports = {
  finetuneExportDataset,
  finetuneSubmitJob,
  finetuneCheckStatus,
  finetuneRegisterModel,
  finetuneListModels,
  finetuneCallModel,
  finetuneCompareModels,
  finetuneGetCostEstimate
};

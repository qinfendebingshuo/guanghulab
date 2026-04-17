/**
 * ═══════════════════════════════════════════════════════════
 * ZY-MIRROR-AGENT · Step 3 · 自主评估 — LLM 推理引擎
 * ═══════════════════════════════════════════════════════════
 *
 * 将 diff 结果送入 LLM 模型进行评估：
 *   - 是否影响我们的搜索索引？
 *   - 是否需要更新本地数据库 schema？
 *   - 是否有新书源我们应该纳入？
 *   - 输出：升级方案（含具体变更步骤）
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const https = require('https');
const http = require('http');
const { MIRROR_CONFIG } = require('./config');

/**
 * 调用 LLM API
 */
function callLLM(provider, messages, maxTokens = 2000) {
  return new Promise((resolve, reject) => {
    const config = provider === 'deepseek' ? MIRROR_CONFIG.llm.primary : MIRROR_CONFIG.llm.fallback;

    if (!config.api_key) {
      return reject(new Error(`${provider} API key not configured`));
    }

    const url = new URL(config.api_url);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    let body;
    const headers = { 'Content-Type': 'application/json' };

    if (provider === 'claude') {
      headers['x-api-key'] = config.api_key;
      headers['anthropic-version'] = '2023-06-01';
      body = JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        messages
      });
    } else {
      // DeepSeek / OpenAI compatible
      headers['Authorization'] = `Bearer ${config.api_key}`;
      body = JSON.stringify({
        model: config.model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.3
      });
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 60000
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            // Extract response text based on provider
            let text;
            if (provider === 'claude') {
              text = parsed.content?.[0]?.text || '';
            } else {
              text = parsed.choices?.[0]?.message?.content || '';
            }
            resolve({ text, raw: parsed });
          } catch (err) {
            reject(new Error(`Failed to parse LLM response: ${err.message}`));
          }
        } else {
          reject(new Error(`LLM API ${res.statusCode}: ${data.slice(0, 300)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('LLM request timeout')); });
    req.write(body);
    req.end();
  });
}

/**
 * 构建评估 prompt
 */
function buildEvaluationPrompt(diffs) {
  const systemPrompt = `你是「镜鉴」——光湖智库系统的镜面监控 Agent。
你的职责是分析第三方书库数据源的变化，判断我方系统是否需要跟进升级。

你必须从以下维度评估：
1. 搜索索引影响：变化是否影响我方搜索结果的准确性？
2. 数据库结构：是否需要更新我方的书目索引格式？
3. 新书源纳入：是否有值得我方纳入的新书目？
4. 可用性风险：数据源离线是否影响我方服务？
5. 上游兼容性：上游版本更新是否导致 API 接口变化？

请输出 JSON 格式的评估结果：
{
  "needs_upgrade": true/false,
  "urgency": "none" | "low" | "medium" | "high" | "critical",
  "summary": "一句话摘要",
  "recommendations": [
    {
      "action": "动作描述",
      "reason": "原因",
      "scope": "影响范围",
      "steps": ["具体步骤1", "具体步骤2"]
    }
  ],
  "rollback_plan": "回滚方案（如果升级失败）",
  "risk_assessment": "风险评估"
}

只输出 JSON，不要其他文字。`;

  const userMessage = `以下是本次镜像扫描的差异报告：

${JSON.stringify(diffs, null, 2)}

请评估这些变化并给出升级建议。`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];
}

/**
 * 执行 LLM 评估
 * 先尝试 primary (DeepSeek)，失败回退到 fallback (Claude)
 */
async function evaluate(diffs) {
  if (!diffs || diffs.length === 0) {
    return {
      needs_upgrade: false,
      urgency: 'none',
      summary: '无差异，无需评估',
      recommendations: [],
      evaluated_at: new Date().toISOString(),
      model_used: 'none'
    };
  }

  // 过滤掉无变化的 diff
  const significantDiffs = diffs.filter(d =>
    d.severity !== 'none' && !d.changes.every(c => c.type === 'no_change')
  );

  if (significantDiffs.length === 0) {
    return {
      needs_upgrade: false,
      urgency: 'none',
      summary: '所有数据源无显著变化',
      recommendations: [],
      evaluated_at: new Date().toISOString(),
      model_used: 'none'
    };
  }

  const messages = buildEvaluationPrompt(significantDiffs);

  // 尝试 primary
  try {
    const result = await callLLM('deepseek', messages);
    const evaluation = parseEvaluation(result.text);
    evaluation.evaluated_at = new Date().toISOString();
    evaluation.model_used = MIRROR_CONFIG.llm.primary.model;
    return evaluation;
  } catch (primaryErr) {
    // 回退到 fallback
    try {
      const result = await callLLM('claude', messages);
      const evaluation = parseEvaluation(result.text);
      evaluation.evaluated_at = new Date().toISOString();
      evaluation.model_used = MIRROR_CONFIG.llm.fallback.model;
      evaluation._primary_error = primaryErr.message;
      return evaluation;
    } catch (fallbackErr) {
      // 两个模型都失败，返回保守评估
      return {
        needs_upgrade: significantDiffs.some(d => d.severity === 'critical' || d.severity === 'action_needed'),
        urgency: significantDiffs.some(d => d.severity === 'critical') ? 'high' : 'low',
        summary: `LLM 评估失败，基于规则判断: ${significantDiffs.length} 个数据源有变化`,
        recommendations: significantDiffs.map(d => ({
          action: `检查数据源 ${d.source_name}`,
          reason: d.changes.map(c => c.description).join('; '),
          scope: d.source_id,
          steps: ['人工检查差异报告', '决定是否跟进']
        })),
        rollback_plan: '无需回滚（未执行自动升级）',
        risk_assessment: '评估模型不可用，建议人工审核',
        evaluated_at: new Date().toISOString(),
        model_used: 'rule_based_fallback',
        _primary_error: primaryErr.message,
        _fallback_error: fallbackErr.message
      };
    }
  }
}

/**
 * 解析 LLM 输出为结构化评估结果
 */
function parseEvaluation(text) {
  // 尝试直接 JSON 解析
  try {
    return JSON.parse(text);
  } catch {
    // 尝试从 markdown code block 中提取
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // fall through
      }
    }

    // 都失败了，返回原始文本
    return {
      needs_upgrade: false,
      urgency: 'low',
      summary: '评估结果解析失败，原始输出已保存',
      recommendations: [],
      raw_output: text.slice(0, 2000)
    };
  }
}

module.exports = {
  evaluate,
  callLLM,
  buildEvaluationPrompt,
  parseEvaluation
};

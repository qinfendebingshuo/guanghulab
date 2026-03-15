// LLM自动检测引擎·llm-engine.js·v1.0
// HoloLake·M-DINGTALK Phase 7
// DEV-004 之之 × 秋秋

var axios = require('axios');

var LLM_API_KEY = process.env.LLM_API_KEY || '';
var LLM_BASE_URL = (process.env.LLM_BASE_URL || 'https://api.anthropic.com/v1').replace(/\/$/, '');

// ===== 模型优先级队列 =====
var PREFERRED_MODELS = [
    'gpt-4o',
    'claude-3-5-sonnet',
    'claude-3-5-sonnet-20241022',
    'anthropic/claude-3.5-sonnet',
    'claude-3-sonnet',
    'claude-3-haiku',
    'deepseek-chat',
    'deepseek-v3',
    'gpt-4o-mini'
];

async function discoverModels() {
    try {
        var res = await axios.get(LLM_BASE_URL + '/models', {
            headers: { 'Authorization': 'Bearer ' + LLM_API_KEY },
            timeout: 10000
        });
        var models = (res.data && res.data.data) || [];
        console.log('[LLM] 发现 ' + models.length + ' 个可用模型');
        return models;
    } catch (err) {
        console.log('[LLM] △ 模型发现失败: ' + err.message + '，使用默认模型');
        return [];
    }
}

function selectBestModel(models) {
    if (models.length === 0) return 'gpt-4o';

    var available = models.map(function(m) { return m.id.toLowerCase(); });

    for (var i = 0; i < PREFERRED_MODELS.length; i++) {
        var preferred = PREFERRED_MODELS[i].toLowerCase();
        var match = available.find(function(id) { return id.includes(preferred); });
        if (match) {
            var original = models.find(function(m) { return m.id.toLowerCase() === match; });
            return original ? original.id : match;
        }
    }

    var anyClaude = available.find(function(id) { return id.includes('claude'); });
    if (anyClaude) {
        var orig = models.find(function(m) { return m.id.toLowerCase() === anyClaude; });
        return orig ? orig.id : anyClaude;
    }

    return models[0] ? models[0].id : 'gpt-4o';
}

async function detectApiFormat() {
    try {
        var res = await axios.post(LLM_BASE_URL + '/chat/completions', {
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5
        }, {
            headers: {
                'Authorization': 'Bearer ' + LLM_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 15000,
            validateStatus: function(s) { return s < 500; }
        });
        if (res.status < 500) return 'openai-compat';
    } catch (e) {}

    try {
        var res2 = await axios.post(LLM_BASE_URL + '/messages', {
            model: 'gpt-4o',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5
        }, {
            headers: {
                'x-api-key': LLM_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            timeout: 15000,
            validateStatus: function(s) { return s < 500; }
        });
        if (res2.status < 500) return 'anthropic-native';
    } catch (e) {}

    return 'openai-compat';
}

async function callLLM(systemPrompt, userMessage, options) {
    options = options || {};
    var maxTokens = options.maxTokens || 4000;

    var models = await discoverModels();
    var model = options.model || selectBestModel(models);
    var format = await detectApiFormat();

    console.log('[LLM] 调用: model=' + model + ' format=' + format + ' platform=' + LLM_BASE_URL);

    var response;
    if (format === 'openai-compat') {
        response = await axios.post(LLM_BASE_URL + '/chat/completions', {
            model: model,
            max_tokens: maxTokens,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ]
        }, {
            headers: {
                'Authorization': 'Bearer ' + LLM_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 120000
        });

        var text = response.data.choices &&
                   response.data.choices[0] &&
                   response.data.choices[0].message &&
                   response.data.choices[0].message.content;
        return { text: text || '', model: model, format: format };
    } else {
        response = await axios.post(LLM_BASE_URL + '/messages', {
            model: model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userMessage }
            ]
        }, {
            headers: {
                'x-api-key': LLM_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            },
            timeout: 120000
        });

        var text2 = response.data.content &&
                    response.data.content[0] &&
                    response.data.content[0].text;
        return { text: text2 || '', model: model, format: format };
    }
}

async function healthCheck() {
    try {
        var models = await discoverModels();
        var best = selectBestModel(models);
        var format = await detectApiFormat();
        return {
            status: 'ok',
            model_count: models.length,
            selected_model: best,
            api_format: format,
            base_url: LLM_BASE_URL,
            has_key: !!LLM_API_KEY
        };
    } catch (err) {
        return { status: 'error', error: err.message };
    }
}

module.exports = {
    callLLM: callLLM,
    discoverModels: discoverModels,
    selectBestModel: selectBestModel,
    detectApiFormat: detectApiFormat,
    healthCheck: healthCheck
};

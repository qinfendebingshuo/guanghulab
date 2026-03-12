/**
 * persona-studio · 代码生成引擎
 *
 * 从对话历史中提取需求 → 调用 model-router → 生成代码 → 写入 workspace
 */
const fs = require('fs');
const path = require('path');
const modelRouter = require('./model-router');
const knowledgeExtractor = require('./knowledge-extractor');
const patternAnalyzer = require('./pattern-analyzer');
const evolutionLogger = require('./evolution-logger');

const WORKSPACE_DIR = path.join(__dirname, '..', '..', 'workspace');

/**
 * 从对话历史中提取项目需求摘要
 */
function extractRequirements(conversation) {
  const userMessages = conversation
    .filter(function (m) { return m.role === 'user'; })
    .map(function (m) { return m.content; });

  return userMessages.join('\n');
}

/**
 * 生成项目代码
 * @param {object} params
 * @param {string} params.dev_id - 开发编号
 * @param {Array} params.conversation - 对话历史
 * @returns {Promise<{projectName: string, files: string[], summary: string}>}
 */
async function generate({ dev_id, conversation }) {
  const requirements = extractRequirements(conversation);
  const projectName = 'project-' + Date.now();
  const projectDir = path.join(WORKSPACE_DIR, dev_id, projectName);
  const startTime = Date.now();

  // 确保工作目录存在
  fs.mkdirSync(projectDir, { recursive: true });

  const apiKey = process.env.MODEL_API_KEY || '';

  if (!apiKey) {
    // 无 API 密钥时生成模板项目
    const result = generateTemplate(projectDir, projectName, requirements);
    triggerPostBuildEvolution(dev_id, conversation, result, startTime, true);
    return result;
  }

  try {
    const { model, baseUrl } = modelRouter.selectModel('code_generation');

    const codePrompt = [
      '你是一个代码生成引擎。根据以下需求生成完整的项目代码。',
      '输出格式要求：',
      '1. 先输出项目结构概览',
      '2. 然后逐个文件输出，每个文件用 ```filename.ext 和 ``` 包裹',
      '3. 最后输出一段使用说明',
      '',
      '需求描述：',
      requirements
    ].join('\n');

    const reply = await modelRouter.callModel({
      model,
      baseUrl,
      apiKey,
      messages: [{ role: 'user', content: codePrompt }],
      maxTokens: 4000,
      temperature: 0.3
    });

    // 解析代码块并写入文件
    const files = parseAndWriteFiles(projectDir, reply);

    // 写入 README
    const readmePath = path.join(projectDir, 'README.md');
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(readmePath, [
        '# ' + projectName,
        '',
        '## 需求描述',
        requirements.substring(0, 500),
        '',
        '## 生成说明',
        '由光湖 Persona Studio 铸渊自动生成',
        '生成时间：' + new Date().toISOString()
      ].join('\n'), 'utf-8');
      files.push('README.md');
    }

    const result = {
      projectName,
      files,
      summary: `项目 ${projectName} 已生成，包含 ${files.length} 个文件。`
    };
    triggerPostBuildEvolution(dev_id, conversation, result, startTime, true);
    return result;
  } catch (err) {
    console.error('Code generation failed:', err.message);
    const result = generateTemplate(projectDir, projectName, requirements);
    triggerPostBuildEvolution(dev_id, conversation, result, startTime, false);
    return result;
  }
}

/**
 * 项目完成后触发自进化：知识提取 + 模式识别
 */
function triggerPostBuildEvolution(devId, conversation, result, startTime, success) {
  try {
    const buildTimeMs = Date.now() - startTime;

    // 知识提取
    knowledgeExtractor.autoExtractKnowledge(devId, conversation, result.projectName);

    // 模式识别
    const patterns = patternAnalyzer.analyzeAndUpdatePatterns(
      devId, conversation, result.files, buildTimeMs, success
    );

    // 进化日志
    evolutionLogger.logEvent('build_complete', '项目构建完成: ' + result.projectName, {
      dev_id: devId,
      project: result.projectName,
      files_count: (result.files || []).length,
      build_time_ms: buildTimeMs,
      success: success,
      patterns_detected: patterns
    });
  } catch (err) {
    console.error('Post-build evolution error:', err.message);
  }
}

/**
 * 解析 AI 回复中的代码块并写入文件
 */
function parseAndWriteFiles(projectDir, reply) {
  const files = [];
  const codeBlockRe = /```(\S+)\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRe.exec(reply)) !== null) {
    let filename = match[1];
    const content = match[2];

    // 跳过语言标识符（不是文件名的情况）
    if (['javascript', 'js', 'html', 'css', 'json', 'python', 'bash', 'sh', 'typescript', 'ts'].includes(filename)) {
      continue;
    }

    // 安全检查：防止路径遍历
    filename = path.basename(filename);
    if (!filename || filename.startsWith('.')) continue;

    const filePath = path.join(projectDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    files.push(filename);
  }

  return files;
}

/**
 * 生成模板项目（无 API 密钥时的降级方案）
 */
function generateTemplate(projectDir, projectName, requirements) {
  const files = [];

  // 生成 index.html
  const htmlContent = [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '  <title>' + projectName + '</title>',
    '  <link rel="stylesheet" href="style.css">',
    '</head>',
    '<body>',
    '  <h1>🌊 ' + projectName + '</h1>',
    '  <p>由光湖 Persona Studio 生成</p>',
    '  <script src="main.js"></script>',
    '</body>',
    '</html>'
  ].join('\n');
  fs.writeFileSync(path.join(projectDir, 'index.html'), htmlContent, 'utf-8');
  files.push('index.html');

  // 生成 style.css
  fs.writeFileSync(path.join(projectDir, 'style.css'), 'body { font-family: sans-serif; padding: 2rem; }\n', 'utf-8');
  files.push('style.css');

  // 生成 main.js
  fs.writeFileSync(path.join(projectDir, 'main.js'), 'console.log("Project initialized by Persona Studio");\n', 'utf-8');
  files.push('main.js');

  // 生成 README
  fs.writeFileSync(path.join(projectDir, 'README.md'), [
    '# ' + projectName,
    '',
    '## 需求描述',
    requirements.substring(0, 500),
    '',
    '> 模板项目（AI 模型尚未配置，请管理员设置 MODEL_API_KEY）',
    '',
    '生成时间：' + new Date().toISOString()
  ].join('\n'), 'utf-8');
  files.push('README.md');

  return {
    projectName,
    files,
    summary: `模板项目 ${projectName} 已生成（${files.length} 个文件）。待 API 密钥配置后可生成完整代码。`
  };
}

module.exports = {
  generate,
  extractRequirements
};

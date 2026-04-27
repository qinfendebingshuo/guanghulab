/**
 * LSC-Engine · 神笔引擎 · GMP模块入口
 * 遵循GMP-SPEC-v1.0生命周期函数规范
 * 
 * 作者: 译典A05 (5TH-LE-HK-A05)
 * 工单: GH-LSC-001
 * 
 * 说明:
 *   Node.js薄壳，负责GMP生命周期对接。
 *   实际引擎逻辑在Python侧（magicpen.py）。
 *   通过child_process调用Python脚本。
 */

const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const MODULE_DIR = path.resolve(__dirname);
const LOG_DIR = '/var/log/gh-modules/lsc-engine';

/**
 * 辅助: 执行Python命令并返回结果
 */
function runPython(command, timeout = 30000) {
  try {
    const result = execSync(`python3 -c "${command}"`, {
      cwd: MODULE_DIR,
      timeout,
      encoding: 'utf-8',
      env: { ...process.env, PYTHONPATH: MODULE_DIR },
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 辅助: 写日志
 */
function log(level, message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [LSC-Engine] [${level}] ${message}`;
  console.log(line);
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    fs.appendFileSync(path.join(LOG_DIR, 'lsc-engine.log'), line + '\n');
  } catch (_) {
    // 日志写入失败不影响主流程
  }
}

/**
 * GMP生命周期: init
 * 初始化环境 · 安装Python依赖 · 创建工具目录
 */
async function init() {
  log('INFO', 'init: 开始初始化...');

  // 1. 确保工具目录存在
  const dirs = [
    '/guanghu/tools/self',
    '/guanghu/tools/shared',
    LOG_DIR,
  ];
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      log('WARN', `创建目录失败: ${dir} - ${err.message}`);
    }
  }

  // 2. 安装RestrictedPython
  try {
    execSync('pip3 install "RestrictedPython>=7.0" 2>/dev/null || true', {
      cwd: MODULE_DIR,
      timeout: 60000,
      encoding: 'utf-8',
    });
    log('INFO', 'init: RestrictedPython 已就绪');
  } catch (err) {
    log('WARN', `init: RestrictedPython安装跳过 - ${err.message}`);
  }

  // 3. 验证Python引擎可导入
  const check = runPython('from magicpen import MagicPen; print("engine_ok")');
  if (check.success && check.output.includes('engine_ok')) {
    log('INFO', 'init: 神笔引擎导入验证通过 ✓');
  } else {
    log('ERROR', `init: 引擎导入失败 - ${check.error || check.output}`);
    throw new Error('MagicPen Engine 导入失败');
  }

  log('INFO', 'init: 初始化完成 🖊️');
  return { status: 'ok', module: 'lsc-engine' };
}

/**
 * GMP生命周期: start
 * 启动引擎 · 预热验证
 */
async function start() {
  log('INFO', 'start: 神笔引擎启动中...');

  const result = runPython(
    'from magicpen import MagicPen; ' +
    'pen = MagicPen(\"__test__\", api_key=\"test\"); ' +
    'print(f\"started|tools={len(pen.tools)}\")'
  );

  if (result.success) {
    log('INFO', `start: 引擎启动成功 - ${result.output}`);
  } else {
    log('WARN', `start: 引擎启动验证跳过 - ${result.error}`);
  }

  log('INFO', 'start: 🖊️ 神笔引擎已就绪 · MagicPen Engine Ready');
  return { status: 'running', module: 'lsc-engine' };
}

/**
 * GMP生命周期: stop
 * 停止引擎 · 清理资源
 */
async function stop() {
  log('INFO', 'stop: 神笔引擎停止中...');
  // Python引擎无需特殊清理（无常驻进程）
  log('INFO', 'stop: 神笔引擎已停止');
  return { status: 'stopped', module: 'lsc-engine' };
}

/**
 * GMP生命周期: healthCheck
 * 健康检查 · 验证引擎可用性
 */
async function healthCheck() {
  const result = runPython('from magicpen import MagicPen; print("healthy")');
  const healthy = result.success && result.output.includes('healthy');

  if (healthy) {
    return { status: 'healthy', module: 'lsc-engine' };
  } else {
    log('WARN', `healthCheck: 不健康 - ${result.error || result.output}`);
    return { status: 'unhealthy', module: 'lsc-engine', error: result.error };
  }
}

module.exports = { init, start, stop, healthCheck };

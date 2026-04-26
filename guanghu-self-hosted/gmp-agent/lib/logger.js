/**
 * GMP-Agent 日志模块
 * 简单的结构化日志, 输出到控制台 + 文件
 */

const fs = require('fs');
const path = require('path');

function createLogger(module) {
  const prefix = '[' + module + ']';

  function formatMessage(level, msg, meta) {
    const ts = new Date().toISOString();
    let line = ts + ' ' + level + ' ' + prefix + ' ' + msg;
    if (meta) {
      line += ' ' + JSON.stringify(meta);
    }
    return line;
  }

  function writeToFile(line) {
    try {
      const logsDir = process.env.GMP_LOGS_DIR || path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      const logFile = path.join(logsDir, 'gmp-agent.log');
      fs.appendFileSync(logFile, line + '\n');
    } catch (err) {
      // 日志写入失败不应影响主流程
    }
  }

  return {
    info: function(msg, meta) {
      const line = formatMessage('INFO', msg, meta);
      console.log(line);
      writeToFile(line);
    },
    warn: function(msg, meta) {
      const line = formatMessage('WARN', msg, meta);
      console.warn(line);
      writeToFile(line);
    },
    error: function(msg, meta) {
      const line = formatMessage('ERROR', msg, meta);
      console.error(line);
      writeToFile(line);
    },
    debug: function(msg, meta) {
      if (process.env.GMP_DEBUG === 'true') {
        const line = formatMessage('DEBUG', msg, meta);
        console.log(line);
        writeToFile(line);
      }
    }
  };
}

module.exports = { createLogger };

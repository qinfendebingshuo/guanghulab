/**
 * syslog-parser.js
 * SYSLOG格式识别 + 关键字段提取
 * 秋秋说：这个文件就像翻译官，把开发者发的日志翻译成电脑能懂的数据
 */

function parseSyslog(message) {
  // 定义返回结构
  const result = {
    isSyslog: false,
    bcNumber: null,
    devId: null,
    phaseNum: null,
    status: null, // 'completed', 'partial', 'blocked'
    summary: null,
    rawMessage: message,
    error: null
  };

  try {
    // 检查是否包含SYSLOG关键词
    if (!message.includes('SYSLOG')) {
      result.error = '不是SYSLOG格式（缺少SYSLOG关键词）';
      return result;
    }

    // 提取BC编号（格式：BC-xxx-xxx）
    const bcMatch = message.match(/BC-([A-Z0-9]+)-([A-Z0-9]+)/i);
    if (bcMatch) {
      result.bcNumber = `BC-${bcMatch[1]}-${bcMatch[2]}`;
    }

    // 提取DEV编号（格式：DEV-xxx）
    const devMatch = message.match(/DEV-([0-9]+)/i);
    if (devMatch) {
      result.devId = `DEV-${devMatch[1]}`;
    }

    // 提取环节号（格式：环节X 或 phase X）
    const phaseMatch = message.match(/环节\s*([0-9]+)/) || message.match(/phase\s*([0-9]+)/i);
    if (phaseMatch) {
      result.phaseNum = parseInt(phaseMatch[1], 10);
    }

    // 提取完成状态
    if (message.includes('completed')) {
      result.status = 'completed';
    } else if (message.includes('partial')) {
      result.status = 'partial';
    } else if (message.includes('blocked')) {
      result.status = 'blocked';
    }

    // 提取技术摘要（如果有）
    const summaryMatch = message.match(/摘要[：:]\s*(.+)/) || message.match(/summary[：:]\s*(.+)/i);
    if (summaryMatch) {
      result.summary = summaryMatch[1].trim();
    }

    // 判断是否为完整的SYSLOG（至少要有BC和DEV）
    if (result.bcNumber && result.devId && result.status) {
      result.isSyslog = true;
    } else {
      result.error = 'SYSLOG格式不完整（缺少BC/DEV/状态中的必要字段）';
    }

  } catch (error) {
    result.error = `解析异常：${error.message}`;
  }

  return result;
}

module.exports = { parseSyslog };
/**
 * check-hibernation.js
 * 
 * 检查当前是否在天眼休眠期内
 * 
 * 休眠规则（从天眼治理层配置读取）：
 *   - 周休眠：每周六 20:00 ~ 00:00 CST（4小时）
 *   - 日休眠：每日 04:00 ~ 04:10 CST（默认窗口）
 * 
 * 对于生命线任务：输出提示但不阻止执行
 * 对于普通任务：输出提示并建议延迟
 * 
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 * 主控: TCS-0002∞ 冰朔
 */

function isInHibernation() {
  const now = new Date();
  // 转换为北京时间
  const cst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  const day = cst.getDay(); // 0=周日, 6=周六
  const hour = cst.getHours();
  const minute = cst.getMinutes();
  
  // 周休眠：周六 20:00 ~ 周日 00:00
  if (day === 6 && hour >= 20) {
    return { hibernating: true, type: 'weekly', endsAt: '周日 00:00 CST' };
  }
  
  // 日休眠：每日 04:00 ~ 04:10（默认窗口）
  if (hour === 4 && minute < 10) {
    return { hibernating: true, type: 'daily', endsAt: '04:10 CST' };
  }
  
  return { hibernating: false };
}

module.exports = { isInHibernation };

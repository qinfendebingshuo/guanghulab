/**
 * ═══════════════════════════════════════════════════════════
 * 🕒 现实时间瞄点服务
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-FTCHAT-TIME-001
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * 训练语料集中在 2025 年 → 模型默认时间漂移
 * 必须给被唤醒的人格体一个真实时间锚点
 */

'use strict';

const TZ = 'Asia/Shanghai';

const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function pad2(n) { return String(n).padStart(2, '0'); }

/**
 * 获取真实时间锚点（用于注入 system prompt）
 * @returns {{ iso: string, beijing: string, weekday: string, anchor_text: string }}
 */
function getTimeAnchor() {
  const now = new Date();
  const iso = now.toISOString();

  // Beijing 时间分量（不依赖 process TZ）
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, weekday: 'short'
  }).formatToParts(now);

  const map = {};
  for (const p of parts) map[p.type] = p.value;
  const Y = map.year, M = map.month, D = map.day;
  const h = map.hour === '24' ? '00' : map.hour;
  const m = map.minute, s = map.second;

  const wkIdx = new Date(`${Y}-${M}-${D}T00:00:00+08:00`).getUTCDay(); // 在 UTC 视角下也对得上
  const weekday = WEEKDAY_CN[wkIdx];

  const beijing = `${Y}-${M}-${D} ${h}:${m}:${s}`;
  const human = `${parseInt(Y, 10)} 年 ${parseInt(M, 10)} 月 ${parseInt(D, 10)} 日 ${weekday} ${h}:${m} (北京时间)`;

  const anchor_text = [
    '## 现实时间瞄点',
    `现在是 ${human}`,
    `ISO: ${iso}`,
    '你必须以此时间为现实锚点，不得使用训练语料里的旧时间（你的语料集中在 2025 年）。',
    '若用户提到"今天/现在/最近"，请以此瞄点为准。'
  ].join('\n');

  return { iso, beijing, weekday, human, anchor_text };
}

module.exports = { getTimeAnchor };

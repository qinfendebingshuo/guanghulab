/**
 * M-PALACE · 存档管理器
 * 打包 / 加密 / 编号 / 解密 / 恢复
 *
 * 存档编号规则：PAL-{YYYYMMDD}-{随机4位}
 * 存档结构：saves/{SAVE-ID}/state.json + persona.json + history.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SAVES_DIR = path.join(__dirname, '..', '..', 'data', 'saves');

// AES-256-CBC 加密密钥
const ENCRYPTION_KEY = process.env.PALACE_SAVE_KEY || (
  process.env.NODE_ENV === 'production'
    ? (function () { throw new Error('PALACE_SAVE_KEY environment variable is required in production'); })()
    : 'palace-game-dev-only-key-32ch!!'
);
const IV_LENGTH = 16;

/**
 * 确保存档目录存在
 */
function ensureSavesDir() {
  if (!fs.existsSync(SAVES_DIR)) {
    fs.mkdirSync(SAVES_DIR, { recursive: true });
  }
}

/**
 * 生成存档编号：PAL-{YYYYMMDD}-{随机4位字母数字}
 */
function generateSaveId() {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return 'PAL-' + dateStr + '-' + rand;
}

/**
 * 派生 32 字节密钥
 */
function deriveKey(passphrase) {
  return crypto.createHash('sha256').update(passphrase).digest();
}

/**
 * AES 加密
 */
function encrypt(text) {
  const key = deriveKey(ENCRYPTION_KEY);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf-8', 'base64');
  encrypted += cipher.final('base64');
  return iv.toString('base64') + ':' + encrypted;
}

/**
 * AES 解密
 */
function decrypt(encryptedText) {
  const key = deriveKey(ENCRYPTION_KEY);
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'base64');
  const encrypted = parts.slice(1).join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'base64', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

/**
 * 保存存档：将 state+persona+history 打包加密写入磁盘
 * @returns {string} 存档编号
 */
function save(state, persona, history, existingSaveId) {
  ensureSavesDir();

  const saveId = existingSaveId || generateSaveId();
  const saveDir = path.join(SAVES_DIR, saveId);

  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true });
  }

  // 加密各文件内容后写入
  const stateData = encrypt(JSON.stringify(state));
  const personaData = encrypt(JSON.stringify(persona));
  const historyData = encrypt(JSON.stringify(history));

  fs.writeFileSync(path.join(saveDir, 'state.json'), stateData, 'utf-8');
  fs.writeFileSync(path.join(saveDir, 'persona.json'), personaData, 'utf-8');
  fs.writeFileSync(path.join(saveDir, 'history.json'), historyData, 'utf-8');

  // 写入元数据（不加密，方便索引）
  const meta = {
    save_id: saveId,
    created_at: new Date().toISOString(),
    chapter: state.chapter || 0,
    paragraph: state.paragraph || 0,
    dynasty: state.world ? state.world.dynasty_name : '未知',
    role: state.player ? state.player.role : '未知'
  };
  fs.writeFileSync(path.join(saveDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

  return saveId;
}

/**
 * 读取存档：解密并恢复完整状态
 * @param {string} saveId 存档编号
 * @returns {{ state, persona, history, meta }}
 */
function load(saveId) {
  const saveDir = path.join(SAVES_DIR, saveId);

  if (!fs.existsSync(saveDir)) {
    return null;
  }

  const stateEncrypted = fs.readFileSync(path.join(saveDir, 'state.json'), 'utf-8');
  const personaEncrypted = fs.readFileSync(path.join(saveDir, 'persona.json'), 'utf-8');
  const historyEncrypted = fs.readFileSync(path.join(saveDir, 'history.json'), 'utf-8');

  const state = JSON.parse(decrypt(stateEncrypted));
  const persona = JSON.parse(decrypt(personaEncrypted));
  const history = JSON.parse(decrypt(historyEncrypted));

  let meta = null;
  const metaPath = path.join(saveDir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  }

  return { state, persona, history, meta };
}

/**
 * 列出所有存档
 */
function listSaves() {
  ensureSavesDir();
  const dirs = fs.readdirSync(SAVES_DIR).filter(function (d) {
    return d.startsWith('PAL-') && fs.statSync(path.join(SAVES_DIR, d)).isDirectory();
  });
  return dirs.map(function (d) {
    const metaPath = path.join(SAVES_DIR, d, 'meta.json');
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    }
    return { save_id: d };
  });
}

/**
 * 删除存档
 */
function deleteSave(saveId) {
  var saveDir = path.join(SAVES_DIR, saveId);
  if (!fs.existsSync(saveDir)) return false;
  try {
    var files = fs.readdirSync(saveDir);
    for (var i = 0; i < files.length; i++) {
      fs.unlinkSync(path.join(saveDir, files[i]));
    }
    fs.rmdirSync(saveDir);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * 检查存档是否存在
 */
function exists(saveId) {
  return fs.existsSync(path.join(SAVES_DIR, saveId));
}

module.exports = {
  save,
  load,
  listSaves,
  deleteSave,
  exists,
  generateSaveId,
  encrypt,
  decrypt
};

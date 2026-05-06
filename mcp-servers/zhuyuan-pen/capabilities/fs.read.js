/**
 * @capability fs.read
 * @description 读文件 (utf8 / binary)
 * @signature read(path, encoding='utf8') → string|Buffer
 * @sovereign TCS-0002∞
 * @copyright 国作登字-2026-A-00037559
 */
'use strict';
const fs = require('fs');
module.exports = function read(p, encoding = 'utf8') {
  return fs.readFileSync(p, encoding);
};

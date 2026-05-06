/**
 * @capability fs.write
 * @description 写文件 (自动建父目录)
 * @signature write(path, content, encoding='utf8')
 * @sovereign TCS-0002∞
 * @copyright 国作登字-2026-A-00037559
 */
'use strict';
const fs = require('fs');
const path = require('path');
module.exports = function write(p, content, encoding = 'utf8') {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, encoding);
};

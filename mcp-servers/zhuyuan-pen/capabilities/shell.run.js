/**
 * @capability shell.run
 * @description 运行 shell 命令 (sync, 默认拒绝危险命令)
 * @signature run(cmd, args=[], options={}) → {status, stdout, stderr}
 * @sovereign TCS-0002∞
 * @copyright 国作登字-2026-A-00037559
 */
'use strict';
const { spawnSync } = require('child_process');

const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\s+\//,
  /:\(\)\{:\|:&\};:/, // fork bomb
  /\bdd\s+if=\/dev\//,
  /\bmkfs\b/,
];

module.exports = function shellRun(cmd, args = [], options = {}) {
  const full = [cmd, ...args].join(' ');
  const checkTargets = [full, cmd, ...args];
  for (const re of DANGEROUS_PATTERNS) {
    for (const t of checkTargets) {
      if (typeof t === 'string' && re.test(t)) {
        throw new Error(`shell.run refused dangerous pattern in: ${t}`);
      }
    }
  }
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    timeout: options.timeoutMs || 60000,
    cwd: options.cwd,
    env: options.env || process.env,
  });
  return {
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
};

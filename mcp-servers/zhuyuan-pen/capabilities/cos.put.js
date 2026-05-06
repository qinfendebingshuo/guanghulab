/**
 * @capability cos.put
 * @description 上传到腾讯云 COS (依赖 coscmd 或 cos-cli, 不预装)
 * @signature put(localFile, key, opts={bucket,region,secretId,secretKey}) → {ok, key}
 * @sovereign TCS-0002∞
 * @copyright 国作登字-2026-A-00037559
 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = function cosPut(localFile, key, opts = {}) {
  const bucket = opts.bucket || process.env.CN_COS_LIGHTHOUSE_BUCKET;
  const region = opts.region || process.env.CN_COS_REGION || 'ap-guangzhou';
  const secretId = opts.secretId || process.env.CN_COS_SECRET_ID || process.env.ZY_COS_SECRET_ID;
  const secretKey = opts.secretKey || process.env.CN_COS_SECRET_KEY || process.env.ZY_COS_SECRET_KEY;
  if (!bucket || !secretId || !secretKey) throw new Error('cos.put: missing bucket/secretId/secretKey');

  const cfg = path.join(os.homedir(), '.cos.conf');
  fs.writeFileSync(cfg, `[common]\nsecret_id = ${secretId}\nsecret_key = ${secretKey}\nbucket = ${bucket}\nregion = ${region}\nmax_thread = 5\n`, { mode: 0o600 });
  const r = spawnSync('coscmd', ['upload', localFile, key], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('cos.put: coscmd failed (是否已安装? pip install coscmd)');
  return { ok: true, key, bucket, region };
};

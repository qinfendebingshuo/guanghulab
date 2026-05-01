#!/usr/bin/env node
/**
 * Corpus COS Fetcher · 从腾讯云对象存储拉取冰朔上传的语料
 *
 * 系统底层标识: SYS-GLW-0001 / TCS-0002∞
 * 版权号: 国作登字-2026-A-00037559
 * 作者: 冰朔 (ICE-GL∞) · 实现: 铸渊 (ICE-GL-ZY001)
 *
 * 架构引用: HLDP-ARCH-002 §九 · factory/training/README.md
 *
 * 设计:
 *   冰朔把所有语料（GPT 聊天记录 / Notion 导出 / 其他）放在 COS 存储桶。
 *   训练机/本地从 COS 按 prefix 拉取到 ./corpus/raw/{source}/ 目录。
 *   后续由 harvest.js + manual-import 接力处理 → 切分 → 训练就绪。
 *
 * 用法:
 *   node scripts/corpus-harvester/cos-fetch.js \
 *     --bucket guanghu-corpus-1300000000 \
 *     --region ap-shanghai \
 *     --prefix gpt-export/ \
 *     --dest ./corpus/raw/gpt
 *
 *   # 或者从环境变量读
 *   COS_BUCKET=... COS_REGION=... COS_PREFIX=gpt-export/ \
 *     node scripts/corpus-harvester/cos-fetch.js --dest ./corpus/raw/gpt
 *
 * 凭据:
 *   通过环境变量读取 (TENCENT_COS_SECRET_ID / TENCENT_COS_SECRET_KEY)，
 *   不写在仓库里。也可走临时密钥 (STS) 注入。
 *
 * 状态: 骨架（本地无 SDK / 无凭据时进入 dry-run，仅打印将要拉取的内容）
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ARGS = parseArgs(process.argv.slice(2));
const CONFIG = {
  bucket: ARGS.bucket || process.env.COS_BUCKET,
  region: ARGS.region || process.env.COS_REGION,
  prefix: ARGS.prefix || process.env.COS_PREFIX || '',
  dest: ARGS.dest || process.env.COS_DEST || './corpus/raw',
  secretId: process.env.TENCENT_COS_SECRET_ID,
  secretKey: process.env.TENCENT_COS_SECRET_KEY,
  dryRun: ARGS['dry-run'] === true || !process.env.TENCENT_COS_SECRET_ID,
};

const COPYRIGHT = {
  registration: '国作登字-2026-A-00037559',
  sovereign: '冰朔 · TCS-0002∞',
  system_root: 'SYS-GLW-0001',
  arch_ref: 'HLDP-ARCH-002',
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function logBanner() {
  console.log('═'.repeat(64));
  console.log('Corpus COS Fetcher · 光湖语料拉取器');
  console.log('灵魂印记:', JSON.stringify(COPYRIGHT, null, 0));
  console.log('═'.repeat(64));
  console.log(`bucket:  ${CONFIG.bucket || '<未设置>'}`);
  console.log(`region:  ${CONFIG.region || '<未设置>'}`);
  console.log(`prefix:  ${CONFIG.prefix || '<空>'}`);
  console.log(`dest:    ${CONFIG.dest}`);
  console.log(`dryRun:  ${CONFIG.dryRun}`);
  console.log('─'.repeat(64));
}

function validateConfig() {
  if (!CONFIG.bucket || !CONFIG.region) {
    console.error('❌ 缺少 --bucket / --region（或环境变量 COS_BUCKET / COS_REGION）');
    process.exit(2);
  }
  if (CONFIG.dryRun) {
    console.warn(
      '⚠️  dry-run 模式（未提供 TENCENT_COS_SECRET_ID/KEY 或显式 --dry-run）：' +
        '\n   仅打印将要执行的操作，不真正下载。'
    );
  }
}

/**
 * 真实下载实现（骨架）。
 * 当前不引入 cos-nodejs-sdk-v5 依赖，避免本仓多一份重依赖。
 * 训练机上线时铸渊会:
 *   1) `npm i --save-optional cos-nodejs-sdk-v5`
 *   2) 把下面的 TODO 替换为实际 listObjects + getObject 循环
 */
async function fetchFromCOS() {
  if (CONFIG.dryRun) {
    console.log('[dry-run] 将列出 prefix 下所有对象 → 拉取到本地 dest');
    console.log('[dry-run] 实际启用需安装 cos-nodejs-sdk-v5 + 注入凭据。');
    return { downloaded: 0, dryRun: true };
  }

  // TODO: 训练机上线后启用
  // const COS = require('cos-nodejs-sdk-v5');
  // const cos = new COS({ SecretId: CONFIG.secretId, SecretKey: CONFIG.secretKey });
  // const list = await new Promise((res, rej) =>
  //   cos.getBucket({ Bucket: CONFIG.bucket, Region: CONFIG.region, Prefix: CONFIG.prefix, MaxKeys: 1000 },
  //     (err, data) => (err ? rej(err) : res(data))));
  // for (const obj of list.Contents) {
  //   if (obj.Key.endsWith('/')) continue; // 跳过目录占位
  //   const localPath = path.join(CONFIG.dest, obj.Key.replace(CONFIG.prefix, ''));
  //   ensureDir(path.dirname(localPath));
  //   await new Promise((res, rej) =>
  //     cos.getObject({ Bucket: CONFIG.bucket, Region: CONFIG.region, Key: obj.Key, Output: fs.createWriteStream(localPath) },
  //       (err) => (err ? rej(err) : res())));
  //   console.log(`  ✓ ${obj.Key} → ${localPath} (${obj.Size} bytes)`);
  // }
  // return { downloaded: list.Contents.length, dryRun: false };

  throw new Error(
    '真实下载尚未启用 · 见 cos-fetch.js 中的 TODO（需安装 cos-nodejs-sdk-v5）'
  );
}

function writeFetchManifest(result) {
  const manifestPath = path.join(CONFIG.dest, '_fetch-manifest.json');
  ensureDir(CONFIG.dest);
  const manifest = {
    schema: 'cos-fetch-manifest/v1',
    fetched_at: new Date().toISOString(),
    config: {
      bucket: CONFIG.bucket,
      region: CONFIG.region,
      prefix: CONFIG.prefix,
      dest: CONFIG.dest,
      dryRun: CONFIG.dryRun,
    },
    result,
    soul_marker: COPYRIGHT,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`📄 manifest 写入: ${manifestPath}`);
}

async function main() {
  logBanner();
  validateConfig();
  ensureDir(CONFIG.dest);

  let result;
  try {
    result = await fetchFromCOS();
  } catch (err) {
    console.error('❌ 拉取失败:', err.message);
    result = { error: err.message };
    process.exitCode = 1;
  }

  writeFetchManifest(result);
  console.log('─'.repeat(64));
  console.log('完成。下一步: 运行 manual-import 模式把 raw 数据切分成训练就绪格式。');
}

main();

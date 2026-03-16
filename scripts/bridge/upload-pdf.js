// scripts/bridge/upload-pdf.js
// 🌉 桥接·PDF 上传
//
// 将生成的 PDF 文件上传到可下载位置
// 支持多种上传方式：
//   方案A：阿里云 OSS（国内快）
//   方案B：GitHub Release Assets
//   方案C：服务器目录（/var/www/guanghulab/broadcasts/）
//
// 环境变量：
//   PDF_MANIFEST          pdf-manifest.json 路径
//   UPLOAD_MODE           上传模式: oss | github | server（默认 server）
//   OSS_ACCESS_KEY        阿里云 OSS AccessKey
//   OSS_SECRET_KEY        阿里云 OSS SecretKey
//   OSS_BUCKET            阿里云 OSS Bucket
//   OSS_REGION            阿里云 OSS Region
//   SERVER_BROADCAST_DIR  服务器广播目录

'use strict';

const fs   = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join('data', 'broadcasts', 'pdf');
const SITE_BASE_URL = 'https://guanghulab.com';

// ══════════════════════════════════════════════════════════
// 上传模式
// ══════════════════════════════════════════════════════════

/**
 * 服务器本地模式：复制 PDF 到指定目录
 */
async function uploadToServer(pdfFiles) {
  const serverDir = process.env.SERVER_BROADCAST_DIR ||
                    '/var/www/guanghulab/broadcasts';

  // 在 CI 环境中，只记录路径（不实际复制）
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

  console.log(`☁️  服务器模式 · 目标目录: ${serverDir}`);

  const results = [];
  for (const item of pdfFiles) {
    const pdfPath = item.pdf;
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      console.log(`  ⚠️  PDF 不存在: ${pdfPath}`);
      continue;
    }

    const filename = path.basename(pdfPath);
    const destPath = path.join(serverDir, filename);
    const downloadUrl = `${SITE_BASE_URL}/broadcasts/${filename}`;

    if (isCI) {
      // CI 环境：仅记录，由部署脚本负责实际复制
      results.push({ ...item, download_url: downloadUrl });
      console.log(`  📋 ${filename} → ${downloadUrl} (CI模式·待部署)`);
    } else {
      try {
        if (!fs.existsSync(serverDir)) {
          fs.mkdirSync(serverDir, { recursive: true });
        }
        fs.copyFileSync(pdfPath, destPath);
        results.push({ ...item, download_url: downloadUrl });
        console.log(`  ✅ ${filename} → ${destPath}`);
      } catch (e) {
        console.error(`  ❌ 复制失败: ${filename}: ${e.message}`);
      }
    }
  }
  return results;
}

/**
 * GitHub 模式：将 PDF 提交到仓库（已在 data/broadcasts/pdf/ 中）
 */
async function uploadToGitHub(pdfFiles) {
  console.log(`☁️  GitHub 模式 · PDF 已在仓库 data/broadcasts/pdf/ 中`);

  const results = [];
  for (const item of pdfFiles) {
    const pdfPath = item.pdf;
    if (!pdfPath || !fs.existsSync(pdfPath)) continue;

    const filename = path.basename(pdfPath);
    const downloadUrl = `https://github.com/qinfendebingshuo/guanghulab/raw/main/${pdfPath}`;
    results.push({ ...item, download_url: downloadUrl });
    console.log(`  ✅ ${filename} → ${downloadUrl}`);
  }
  return results;
}

/**
 * OSS 模式：上传到阿里云 OSS（需安装 ali-oss SDK）
 */
async function uploadToOSS(pdfFiles) {
  const accessKey = process.env.OSS_ACCESS_KEY;
  const secretKey = process.env.OSS_SECRET_KEY;
  const bucket    = process.env.OSS_BUCKET || 'guanghulab-broadcasts';
  const region    = process.env.OSS_REGION || 'oss-cn-shanghai';

  if (!accessKey || !secretKey) {
    console.log('⚠️  OSS 密钥未配置，回退到 GitHub 模式');
    return uploadToGitHub(pdfFiles);
  }

  console.log(`☁️  OSS 模式 · Bucket: ${bucket} · Region: ${region}`);

  let OSS;
  try {
    OSS = require('ali-oss');
  } catch (e) {
    console.log('⚠️  ali-oss 未安装，回退到 GitHub 模式');
    return uploadToGitHub(pdfFiles);
  }

  const client = new OSS({ region, accessKeyId: accessKey, accessKeySecret: secretKey, bucket });

  const results = [];
  for (const item of pdfFiles) {
    const pdfPath = item.pdf;
    if (!pdfPath || !fs.existsSync(pdfPath)) continue;

    const filename = path.basename(pdfPath);
    const ossKey   = `broadcasts/${filename}`;

    try {
      const result = await client.put(ossKey, pdfPath);
      results.push({ ...item, download_url: result.url });
      console.log(`  ✅ ${filename} → ${result.url}`);
    } catch (e) {
      console.error(`  ❌ OSS 上传失败: ${filename}: ${e.message}`);
    }
  }
  return results;
}

// ══════════════════════════════════════════════════════════
// 主逻辑
// ══════════════════════════════════════════════════════════

async function main() {
  const manifestFile = process.env.PDF_MANIFEST ||
                       path.join(OUTPUT_DIR, 'pdf-manifest.json');

  if (!fs.existsSync(manifestFile)) {
    console.log('📭 无 pdf-manifest.json，跳过上传');
    process.exit(0);
  }

  const pdfFiles = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (pdfFiles.length === 0) {
    console.log('📭 PDF 列表为空，跳过上传');
    process.exit(0);
  }

  const mode = (process.env.UPLOAD_MODE || 'server').toLowerCase();
  console.log(`🌉 PDF 上传 · 模式: ${mode} · 共 ${pdfFiles.length} 份`);

  let results;
  switch (mode) {
    case 'oss':    results = await uploadToOSS(pdfFiles); break;
    case 'github': results = await uploadToGitHub(pdfFiles); break;
    case 'server':
    default:       results = await uploadToServer(pdfFiles); break;
  }

  // 写入分发清单
  const distManifest = path.join(OUTPUT_DIR, 'dist-manifest.json');
  fs.writeFileSync(distManifest, JSON.stringify(results, null, 2));
  console.log(`\n✅ 上传完成 · ${results.length} 份 · 清单: ${distManifest}`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `uploaded_count=${results.length}\ndist_manifest=${distManifest}\n`
    );
  }
}

main().catch(e => { console.error(e); process.exit(1); });

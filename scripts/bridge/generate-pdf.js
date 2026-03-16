// scripts/bridge/generate-pdf.js
// 🌉 桥接·Markdown → PDF 生成
//
// 读取 data/broadcasts/pdf/ 下的 Markdown 文件，
// 使用 md-to-pdf 转换为 PDF，套用光湖广播模板
//
// 环境变量：
//   MANIFEST_FILE    fetch-broadcast.js 生成的清单文件路径

'use strict';

const fs   = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join('data', 'broadcasts', 'pdf');

// ══════════════════════════════════════════════════════════
// PDF 样式模板
// ══════════════════════════════════════════════════════════

const PDF_CSS = `
body {
  font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.8;
  color: #333;
  padding: 40px;
}
h1 {
  font-size: 24px;
  border-bottom: 2px solid #1a73e8;
  padding-bottom: 10px;
  margin-bottom: 20px;
}
h2 { font-size: 20px; margin-top: 30px; }
h3 { font-size: 16px; margin-top: 20px; }
blockquote {
  border-left: 4px solid #1a73e8;
  padding: 10px 20px;
  margin: 15px 0;
  background: #f8f9fa;
  color: #555;
}
code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
}
pre code {
  display: block;
  padding: 15px;
  overflow-x: auto;
}
hr {
  border: none;
  border-top: 1px solid #ddd;
  margin: 20px 0;
}
@page {
  margin: 20mm;
  @top-center { content: "光湖广播 · guanghulab.com"; font-size: 10px; color: #999; }
  @bottom-center { content: counter(page) " / " counter(pages); font-size: 10px; color: #999; }
}
`;

// ══════════════════════════════════════════════════════════
// 主逻辑
// ══════════════════════════════════════════════════════════

async function main() {
  const manifestFile = process.env.MANIFEST_FILE ||
                       path.join(OUTPUT_DIR, 'manifest.json');

  if (!fs.existsSync(manifestFile)) {
    console.log('📭 无 manifest.json，跳过 PDF 生成');
    process.exit(0);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (manifest.length === 0) {
    console.log('📭 清单为空，跳过 PDF 生成');
    process.exit(0);
  }

  // 动态加载 md-to-pdf（在 workflow 中安装）
  let mdToPdf;
  try {
    mdToPdf = require('md-to-pdf').mdToPdf;
  } catch (e) {
    console.error('❌ md-to-pdf 未安装，请先运行: npm install md-to-pdf');
    console.log('⚠️  回退到纯文本 PDF 模式（将 Markdown 原文保留）');

    // 回退：仅保留 .md 文件，标记为待处理
    for (const item of manifest) {
      if (fs.existsSync(item.file)) {
        const pdfPath = item.file.replace(/\.md$/, '.pdf.pending');
        fs.copyFileSync(item.file, pdfPath);
        console.log(`  📝 ${pdfPath} (待转换)`);
      }
    }
    return;
  }

  console.log(`📄 开始生成 ${manifest.length} 份 PDF…`);

  let ok = 0, failed = 0;
  const pdfFiles = [];

  for (const item of manifest) {
    if (!fs.existsSync(item.file)) {
      console.log(`  ⚠️  文件不存在: ${item.file}`);
      failed++;
      continue;
    }

    try {
      const pdfPath = item.file.replace(/\.md$/, '.pdf');

      const result = await mdToPdf(
        { path: path.resolve(item.file) },
        {
          stylesheet: [],
          css: PDF_CSS,
          pdf_options: {
            format: 'A4',
            margin: { top: '25mm', bottom: '25mm', left: '20mm', right: '20mm' },
            printBackground: true,
          },
          launch_options: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
        }
      );

      if (result && result.content) {
        fs.writeFileSync(pdfPath, result.content);
        pdfFiles.push({ ...item, pdf: pdfPath });
        console.log(`  ✅ ${pdfPath}`);
        ok++;
      } else {
        console.error(`  ❌ PDF 内容为空: ${item.file}`);
        failed++;
      }
    } catch (e) {
      console.error(`  ❌ PDF 生成失败: ${item.file}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n✅ PDF 生成完成 · 成功 ${ok} 份 · 失败 ${failed} 份`);

  // 更新 manifest 包含 PDF 路径
  const pdfManifest = path.join(OUTPUT_DIR, 'pdf-manifest.json');
  fs.writeFileSync(pdfManifest, JSON.stringify(pdfFiles, null, 2));
  console.log(`📁 PDF 清单: ${pdfManifest}`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `pdf_count=${ok}\npdf_manifest=${pdfManifest}\n`
    );
  }
}

main().catch(e => { console.error(e); process.exit(1); });

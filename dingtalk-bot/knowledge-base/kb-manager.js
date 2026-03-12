//知识库管理器·kb-manager.js
// HoloLake·M-DINGTALK Phase 3
// DEV-004 之之×秋秋
//

const fs = require('fs');
const path = require('path');

//知识库文档目录
const DOCS_DIR = path.join(__dirname, 'docs');
const INDEX_FILE = path.join(__dirname, 'kb-index.json');

// 知识库索引（内存缓存）
let kbIndex = [];

/**
 * 扫描文档目录，建立索引
 * 索引结构：[{ filename, title, sections: [{ heading, content, keywords }] }]
 */
function buildIndex() {
  console.log('[KB] 开始建立知识库索引...');
  kbIndex = [];

  // 读取docs目录下所有.md文件
  const docsDir = DOCS_DIR;
  if (!fs.existsSync(docsDir)) {
    console.log('[KB] 文档目录不存在，创建中...');
    fs.mkdirSync(docsDir, { recursive: true });
    return kbIndex;
  }

  const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));
  console.log(`[KB] 发现 ${files.length} 个文档文件`);

  for (const file of files) {
    const filePath = path.join(docsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // 解析文档结构
    const doc = parseDocument(file, content);
    kbIndex.push(doc);
  }

  // 保存索引到文件
  fs.writeFileSync(INDEX_FILE, JSON.stringify(kbIndex, null, 2), 'utf-8');
  console.log(`[KB] 索引建立完成，共 ${kbIndex.length} 个文档， ${kbIndex.reduce((sum, d) => sum + d.sections.length, 0)} 个章节`);

  return kbIndex;
}

/**
 * 解析单个Markdown文档
 */
function parseDocument(filename, content) {
  const lines = content.split('\n');
  const doc = {
    filename,
    title: '',
    sections: []
  };

  let currentSection = null;

  for (const line of lines) {
    // 检测标题行
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);

    if (headingMatch) {
      // 保存上一个section
      if (currentSection) {
        currentSection.keywords = extractKeywords(currentSection.content);
        doc.sections.push(currentSection);
      }

      const level = headingMatch[1].length;
      const heading = headingMatch[2].trim();

      // 第一个h1作为文档标题
      if (level === 1 && !doc.title) {
        doc.title = heading;
      }

      currentSection = {
        heading,
        level,
        content: ''
      };
    } else if (currentSection) {
      currentSection.content += line + '\n';
    }
  }

  // 保存最后一个section
  if (currentSection) {
    currentSection.keywords = extractKeywords(currentSection.content);
    doc.sections.push(currentSection);
  }

  // 如果没有找到h1标题，用文件名
  if (!doc.title) {
    doc.title = filename.replace('.md', '');
  }

  return doc;
}

/**
 * 从文本中提取关键词（简单版：提取中英文词汇）
 */
function extractKeywords(text) {
  // 移除Markdown语法
  const clean = text
    .replace(/```[\s\S]*?```/g, '') // 移除代码块
    .replace(/[`*_#\[\]()]/g, '')    // 移除Markdown符号
    .replace(/\s+/g, ' ');

  // 提取关键词（2个字以上的词）
  const words = clean.match(/[a-zA-Z]{3,}|[\u4e00-\u9fa5]{2,}/g) || [];
  
  // 去重并返回
  return [...new Set(words)].slice(0, 30);
}

/**
 * 搜索知识库
 * @param {string} query - 搜索关键词
 * @returns {Array} - 匹配结果列表
 */
function search(query) {
  if (kbIndex.length === 0) {
    buildIndex();
  }

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length >= 1);
  const results = [];

  for (const doc of kbIndex) {
    for (const section of doc.sections) {
      // 计算匹配分数
      let score = 0;
      const sectionText = (section.heading + ' ' + section.content).toLowerCase();

      for (const word of queryWords) {
        // 标题匹配权重更高
        if (section.heading.toLowerCase().includes(word)) {
          score += 10;
        }
        // 内容匹配
        if (sectionText.includes(word)) {
          score += 5;
        }
        // 关键词匹配
        if (section.keywords && section.keywords.some(k => k.toLowerCase().includes(word))) {
          score += 3;
        }
      }

      if (score > 0) {
        results.push({
          doc: doc.title,
          filename: doc.filename,
          heading: section.heading,
          content: section.content.trim().substring(0, 500),
          score
        });
      }
    }
  }

  // 按分数排序，返回前5个
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 5);
}

/**
 * 获取知识库统计信息
 */
function getStats() {
  if (kbIndex.length === 0) {
    buildIndex();
  }

  return {
    totalDocs: kbIndex.length,
    totalSections: kbIndex.reduce((sum, d) => sum + d.sections.length, 0),
    docs: kbIndex.map(d => ({
      filename: d.filename,
      title: d.title,
      sections: d.sections.length
    }))
  };
}

/**
 * 重新加载知识库（用于热更新）
 */
function reload() {
  console.log('[KB] 热更新：重新加载知识库...');
  return buildIndex();
}

module.exports = {
  buildIndex,
  search,
  getStats,
  reload
};


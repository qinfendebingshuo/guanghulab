/**
 * Unit test · Notion 页面阅读器 URL 解析
 *
 * 测试 extractPageId 函数对各种 Notion URL 格式的解析
 *
 * 运行: node tests/smoke/notion-page-reader.test.js
 */

const { extractPageId, extractBlockText, blocksToMarkdown } = require('../../scripts/notion-page-reader');

// ══════════════════════════════════════════════════════════
// extractPageId 测试
// ══════════════════════════════════════════════════════════

describe('extractPageId', () => {
  test('extracts from 32-char hex string', () => {
    expect(extractPageId('abc123def4561234567890abcdef1234'))
      .toBe('abc123de-f456-1234-5678-90abcdef1234');
  });

  test('extracts from UUID with dashes', () => {
    expect(extractPageId('abc123de-f456-1234-5678-90abcdef1234'))
      .toBe('abc123de-f456-1234-5678-90abcdef1234');
  });

  test('extracts from notion.so URL with title', () => {
    expect(extractPageId('https://www.notion.so/workspace/My-Page-Title-abc123def4561234567890abcdef1234'))
      .toBe('abc123de-f456-1234-5678-90abcdef1234');
  });

  test('extracts from notion.so URL without title', () => {
    expect(extractPageId('https://www.notion.so/abc123def4561234567890abcdef1234'))
      .toBe('abc123de-f456-1234-5678-90abcdef1234');
  });

  test('extracts from notion.site URL', () => {
    expect(extractPageId('https://myworkspace.notion.site/Page-Title-abc123def4561234567890abcdef1234'))
      .toBe('abc123de-f456-1234-5678-90abcdef1234');
  });

  test('handles URL with query parameters', () => {
    expect(extractPageId('https://www.notion.so/abc123def4561234567890abcdef1234?v=xxx&p=123'))
      .toBe('abc123de-f456-1234-5678-90abcdef1234');
  });

  test('handles URL with anchor', () => {
    expect(extractPageId('https://www.notion.so/abc123def4561234567890abcdef1234#section'))
      .toBe('abc123de-f456-1234-5678-90abcdef1234');
  });

  test('handles uppercase hex', () => {
    expect(extractPageId('ABC123DEF4561234567890ABCDEF1234'))
      .toBe('abc123de-f456-1234-5678-90abcdef1234');
  });

  test('returns null for empty input', () => {
    expect(extractPageId('')).toBeNull();
    expect(extractPageId(null)).toBeNull();
    expect(extractPageId(undefined)).toBeNull();
  });

  test('returns null for invalid input', () => {
    expect(extractPageId('not-a-valid-id')).toBeNull();
    expect(extractPageId('https://google.com')).toBeNull();
  });

  test('handles whitespace around input', () => {
    expect(extractPageId('  abc123def4561234567890abcdef1234  '))
      .toBe('abc123de-f456-1234-5678-90abcdef1234');
  });
});

// ══════════════════════════════════════════════════════════
// extractBlockText 测试
// ══════════════════════════════════════════════════════════

describe('extractBlockText', () => {
  test('extracts text from paragraph block', () => {
    const block = {
      type: 'paragraph',
      paragraph: {
        rich_text: [{ plain_text: 'Hello ' }, { plain_text: 'World' }]
      }
    };
    expect(extractBlockText(block)).toBe('Hello World');
  });

  test('returns empty string for block without content', () => {
    const block = { type: 'divider', divider: {} };
    expect(extractBlockText(block)).toBe('');
  });

  test('handles block with text property', () => {
    const block = {
      type: 'paragraph',
      paragraph: {
        text: [{ plain_text: 'Legacy text' }]
      }
    };
    expect(extractBlockText(block)).toBe('Legacy text');
  });
});

// ══════════════════════════════════════════════════════════
// blocksToMarkdown 测试
// ══════════════════════════════════════════════════════════

describe('blocksToMarkdown', () => {
  test('converts heading blocks', () => {
    const blocks = [
      { type: 'heading_1', heading_1: { rich_text: [{ plain_text: 'Title' }] } },
      { type: 'heading_2', heading_2: { rich_text: [{ plain_text: 'Subtitle' }] } },
      { type: 'heading_3', heading_3: { rich_text: [{ plain_text: 'Section' }] } },
    ];
    const md = blocksToMarkdown(blocks);
    expect(md).toContain('# Title');
    expect(md).toContain('## Subtitle');
    expect(md).toContain('### Section');
  });

  test('converts list items', () => {
    const blocks = [
      { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'Bullet' }] } },
      { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ plain_text: 'Number' }] } },
    ];
    const md = blocksToMarkdown(blocks);
    expect(md).toContain('- Bullet');
    expect(md).toContain('1. Number');
  });

  test('converts code blocks', () => {
    const blocks = [
      { type: 'code', code: { rich_text: [{ plain_text: 'console.log("hi")' }], language: 'javascript' } },
    ];
    const md = blocksToMarkdown(blocks);
    expect(md).toContain('```javascript');
    expect(md).toContain('console.log("hi")');
  });

  test('converts to_do blocks', () => {
    const blocks = [
      { type: 'to_do', to_do: { rich_text: [{ plain_text: 'Done' }], checked: true } },
      { type: 'to_do', to_do: { rich_text: [{ plain_text: 'Todo' }], checked: false } },
    ];
    const md = blocksToMarkdown(blocks);
    expect(md).toContain('☑ Done');
    expect(md).toContain('☐ Todo');
  });

  test('converts divider', () => {
    const blocks = [
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Before' }] } },
      { type: 'divider', divider: {} },
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'After' }] } },
    ];
    const md = blocksToMarkdown(blocks);
    expect(md).toContain('---');
  });

  test('converts quote and callout', () => {
    const blocks = [
      { type: 'quote', quote: { rich_text: [{ plain_text: 'A quote' }] } },
      { type: 'callout', callout: { rich_text: [{ plain_text: 'A callout' }] } },
    ];
    const md = blocksToMarkdown(blocks);
    expect(md).toContain('> A quote');
    expect(md).toContain('> A callout');
  });

  test('filters empty blocks', () => {
    const blocks = [
      { type: 'paragraph', paragraph: { rich_text: [] } },
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Content' }] } },
    ];
    const md = blocksToMarkdown(blocks);
    expect(md).toBe('Content');
  });
});

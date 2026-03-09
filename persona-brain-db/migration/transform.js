/**
 * 数据格式转换工具
 * Notion导出的数据 → persona-brain-db schema格式
 *
 * Phase 2 启用
 */

/**
 * 转换Notion页面属性为persona_identity记录
 */
function transformIdentity(notionPage) {
  return {
    persona_id: extractText(notionPage, 'persona_id'),
    name: extractText(notionPage, 'name'),
    name_en: extractText(notionPage, 'name_en') || null,
    role: extractText(notionPage, 'role'),
    parent_persona: extractText(notionPage, 'parent_persona') || null,
    binding_platform: extractText(notionPage, 'binding_platform') || null,
    binding_user: extractText(notionPage, 'binding_user') || null,
    status: extractText(notionPage, 'status') || 'active',
    capabilities: extractMultiSelect(notionPage, 'capabilities'),
    style_profile: null,
    space_config: null,
    notes: extractText(notionPage, 'notes') || null
  };
}

/**
 * 转换Notion页面属性为dev_profiles记录
 */
function transformProfile(notionPage) {
  return {
    dev_id: extractText(notionPage, 'dev_id'),
    name: extractText(notionPage, 'name'),
    device_os: extractText(notionPage, 'device_os') || 'Unknown',
    current_module: extractText(notionPage, 'current_module') || null,
    streak: extractNumber(notionPage, 'streak') || 0,
    total_completed: extractNumber(notionPage, 'total_completed') || 0,
    status: extractText(notionPage, 'status') || 'inactive'
  };
}

function extractText(page, propName) {
  const prop = page.properties[propName];
  if (!prop) return null;
  if (prop.type === 'title') return prop.title[0]?.plain_text || null;
  if (prop.type === 'rich_text') return prop.rich_text[0]?.plain_text || null;
  if (prop.type === 'select') return prop.select?.name || null;
  return null;
}

function extractNumber(page, propName) {
  const prop = page.properties[propName];
  if (!prop || prop.type !== 'number') return null;
  return prop.number;
}

function extractMultiSelect(page, propName) {
  const prop = page.properties[propName];
  if (!prop || prop.type !== 'multi_select') return [];
  return prop.multi_select.map(s => s.name);
}

module.exports = { transformIdentity, transformProfile };

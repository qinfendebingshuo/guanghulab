/**
 * Notion 属性值解析器
 * 将 Notion API 返回的 property value 转换为简洁的 JS 值
 */

'use strict';

/**
 * 解析单个 Notion property value
 * @param {object} prop - Notion property object (含 type 字段)
 * @returns {*} 解析后的值
 */
function parsePropertyValue(prop) {
  if (!prop || !prop.type) return null;

  switch (prop.type) {
    case 'title':
      return (prop.title || []).map((t) => t.plain_text).join('');

    case 'rich_text':
      return (prop.rich_text || []).map((t) => t.plain_text).join('');

    case 'number':
      return prop.number;

    case 'select':
      return prop.select ? prop.select.name : null;

    case 'multi_select':
      return (prop.multi_select || []).map((s) => s.name);

    case 'status':
      return prop.status ? prop.status.name : null;

    case 'date':
      if (!prop.date) return null;
      return {
        start: prop.date.start,
        end: prop.date.end,
        timeZone: prop.date.time_zone,
      };

    case 'checkbox':
      return prop.checkbox;

    case 'url':
      return prop.url;

    case 'email':
      return prop.email;

    case 'phone_number':
      return prop.phone_number;

    case 'created_time':
      return prop.created_time;

    case 'created_by':
      return prop.created_by ? prop.created_by.id : null;

    case 'last_edited_time':
      return prop.last_edited_time;

    case 'last_edited_by':
      return prop.last_edited_by ? prop.last_edited_by.id : null;

    case 'people':
      return (prop.people || []).map((p) => ({ id: p.id, name: p.name }));

    case 'relation':
      return (prop.relation || []).map((r) => r.id);

    case 'formula':
      if (!prop.formula) return null;
      return prop.formula[prop.formula.type];

    case 'rollup':
      if (!prop.rollup) return null;
      if (prop.rollup.type === 'array') {
        return (prop.rollup.array || []).map(parsePropertyValue);
      }
      return prop.rollup[prop.rollup.type];

    case 'files':
      return (prop.files || []).map((f) => ({
        name: f.name,
        url: f.type === 'external' ? f.external.url : f.file.url,
      }));

    default:
      return null;
  }
}

/**
 * 解析页面的全部属性
 * @param {object} properties - page.properties
 * @returns {object} key→parsedValue 的扁平对象
 */
function parseAllProperties(properties) {
  const result = {};
  for (const [key, prop] of Object.entries(properties || {})) {
    result[key] = parsePropertyValue(prop);
  }
  return result;
}

/**
 * 将简单JS值转回 Notion property value（用于 updatePage）
 * 仅支持常用的几种类型
 */
function buildPropertyValue(type, value) {
  switch (type) {
    case 'title':
      return { title: [{ text: { content: String(value || '') } }] };

    case 'rich_text':
      return { rich_text: [{ text: { content: String(value || '') } }] };

    case 'number':
      return { number: value === null ? null : Number(value) };

    case 'select':
      return value ? { select: { name: String(value) } } : { select: null };

    case 'status':
      return value ? { status: { name: String(value) } } : { status: null };

    case 'multi_select':
      return {
        multi_select: (Array.isArray(value) ? value : [value])
          .filter(Boolean)
          .map((v) => ({ name: String(v) })),
      };

    case 'checkbox':
      return { checkbox: !!value };

    case 'url':
      return { url: value || null };

    case 'date':
      if (!value) return { date: null };
      if (typeof value === 'string') return { date: { start: value } };
      return { date: { start: value.start, end: value.end || null } };

    default:
      return null;
  }
}

module.exports = {
  parsePropertyValue,
  parseAllProperties,
  buildPropertyValue,
};

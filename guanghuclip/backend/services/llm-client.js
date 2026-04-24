/**
 * llm-client.js — [已废弃 · 重定向到 connectors/model-router]
 *
 * 这个文件不再需要了。
 * 模型路由已经由仓库根目录的 connectors/model-router 统一处理。
 * persona-engine.js 直接 require connectors/model-router。
 *
 * 保留此文件只是为了兼容性，防止其他地方还在引用。
 *
 * @deprecated 请使用 connectors/model-router
 */

'use strict';

const path = require('path');
const REPO_ROOT = path.resolve(__dirname, '../../..');

// 直接转发到仓库已有的 model-router
const modelRouter = require(path.join(REPO_ROOT, 'connectors/model-router'));

module.exports = modelRouter;

#!/usr/bin/env node
/**
 * 光湖智库数据备份脚本
 * 将/opt/zhiku/data目录备份到腾讯云COS
 * 由cron定时执行
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { COS } = require('cos-nodejs-sdk-v5');
const { execSync } = require('child_process');

// 加载环境变量
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// 配置检查
if (!process.env.ZY_COS_SECRET_ID || !process.env.ZY_COS_SECRET_KEY || !process.env.ZY_COS_BUCKET) {
  console.error('[ZY-SVR-006] ⚠️ 缺少腾讯云COS配置，备份终止');
  process.exit(1);
}

// 初始化COS客户端
const cos = new COS({
  SecretId: process.env.ZY_COS_SECRET_ID,
  SecretKey: process.env.ZY_COS_SECRET_KEY,
  Region: process.env.ZY_COS_REGION || 'ap-singapore'
});

// 常量定义
const DATA_DIR = process.env.ZY_ZHIKU_DATA_DIR || '/opt/zhiku/data';
const BACKUP_DIR = '/opt/zhiku/backups';
const BACKUP_PREFIX = 'zhiku-data-backup';
const KEEP_DAYS = 7;

// 生成备份文件名(带日期)
function getBackupName() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `${BACKUP_PREFIX}-${dateStr}.tar.gz`;
}

// 创建本地备份目录
function ensureBackupDir() {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } catch (err) {
    console.error(`[ZY-SVR-006] ⚠️ 无法创建备份目录: ${err.message}`);
    process.exit(1);
  }
}

// 执行tar压缩
function createBackup() {
  const backupFile = path.join(BACKUP_DIR, getBackupName());
  try {
    execSync(`tar -czf ${backupFile} -C ${DATA_DIR} .`, { stdio: 'inherit' });
    return backupFile;
  } catch (err) {
    console.error(`[ZY-SVR-006] ⚠️ 备份创建失败: ${err.message}`);
    process.exit(1);
  }
}

// 上传到COS
async function uploadToCos(filePath) {
  const key = `backups/${path.basename(filePath)}`;
  try {
    await cos.putObject({
      Bucket: process.env.ZY_COS_BUCKET,
      Region: process.env.ZY_COS_REGION || 'ap-singapore',
      Key: key,
      Body: fs.createReadStream(filePath),
      onProgress: (progressData) => {
        console.log(`[ZY-SVR-006] 上传进度: ${Math.round(progressData.percent * 100)}%`);
      }
    });
    console.log(`[ZY-SVR-006] ✅ 备份成功上传到COS: ${key}`);
  } catch (err) {
    console.error(`[ZY-SVR-006] ⚠️ COS上传失败: ${err.message}`);
    process.exit(1);
  }
}

// 清理旧备份
function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    
    files.forEach(file => {
      if (file.startsWith(BACKUP_PREFIX)) {
        const filePath = path.join(BACKUP_DIR, file);
        const stat = fs.statSync(filePath);
        const ageDays = (now - stat.mtimeMs) / (1000 * 60 * 60 * 24);
        
        if (ageDays > KEEP_DAYS) {
          fs.unlinkSync(filePath);
          console.log(`[ZY-SVR-006] 清理旧备份: ${file}`);
        }
      }
    });
  } catch (err) {
    console.error(`[ZY-SVR-006] ⚠️ 清理旧备份失败: ${err.message}`);
  }
}

// 主流程
async function main() {
  console.log(`[ZY-SVR-006] 🚀 开始数据备份: ${new Date().toISOString()}`);
  
  ensureBackupDir();
  const backupFile = createBackup();
  await uploadToCos(backupFile);
  cleanupOldBackups();
  
  console.log(`[ZY-SVR-006] ✅ 备份完成: ${backupFile}`);
}

main().catch(err => {
  console.error(`[ZY-SVR-006] ⚠️ 备份流程失败: ${err.message}`);
  process.exit(1);
});
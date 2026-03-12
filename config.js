require('dotenv').config();

const config = {
  DINGTALK_APP_KEY: process.env.DINGTALK_APP_KEY,
  DINGTALK_APP_SECRET: process.env.DINGTALK_APP_SECRET,
  DINGTALK_ROBOT_CODE: process.env.DINGTALK_ROBOT_CODE,
  PORT: process.env.PORT || 3000
};

// 检查必要配置是否齐全
if (!config.DINGTALK_APP_KEY || !config.DINGTALK_APP_SECRET) {
  throw new Error('缺少钉钉配置，请检查 .env 文件');
}

module.exports = config;
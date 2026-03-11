/**
 * persona-studio · GitHub API 封装
 * 用于仓库操作（读写文件、触发 workflow 等）
 */
const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const REPO_OWNER = 'qinfendebingshuo';
const REPO_NAME = 'guanghulab';

/**
 * GitHub API 请求
 */
function githubRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      method,
      headers: {
        'User-Agent': 'persona-studio/1.0',
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      }
    };

    if (GITHUB_TOKEN) {
      options.headers['Authorization'] = 'Bearer ' + GITHUB_TOKEN;
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * 触发 GitHub Actions workflow
 */
async function triggerWorkflow(workflowFile, inputs) {
  return githubRequest('POST',
    `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${workflowFile}/dispatches`,
    { ref: 'main', inputs: inputs || {} }
  );
}

/**
 * 获取仓库文件内容
 */
async function getFileContent(filePath) {
  return githubRequest('GET',
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`
  );
}

module.exports = {
  githubRequest,
  triggerWorkflow,
  getFileContent
};

/**
 * Smoke test · API Key 模型检测接口
 *
 * 测试 POST /api/ps/apikey/detect-models 和 POST /api/ps/apikey/chat
 * 的输入验证与错误处理逻辑
 */
const http = require('http');

const BASE = process.env.TEST_BASE || 'http://localhost:3002';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(chunks) });
        } catch {
          resolve({ status: res.statusCode, body: chunks });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

describe('POST /api/ps/apikey/detect-models', () => {
  test('returns MISSING_API_BASE when api_base is missing', async () => {
    const res = await post('/api/ps/apikey/detect-models', {});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe('MISSING_API_BASE');
  });

  test('returns MISSING_API_KEY when api_key is missing', async () => {
    const res = await post('/api/ps/apikey/detect-models', { api_base: 'https://example.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe('MISSING_API_KEY');
  });

  test('returns error for unreachable API base', async () => {
    const res = await post('/api/ps/apikey/detect-models', {
      api_base: 'http://invalid.test.local',
      api_key: 'sk-test-invalid'
    });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe(true);
    // DNS resolution failure returns DNS_ERROR; other network issues may return NETWORK_ERROR
    expect(res.body.code).toMatch(/^(DNS_ERROR|NETWORK_ERROR|TIMEOUT)$/);
  });

  test('returns INVALID_API_BASE for malformed URL', async () => {
    const res = await post('/api/ps/apikey/detect-models', {
      api_base: 'not-a-url',
      api_key: 'sk-test'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe('INVALID_API_BASE');
  });
});

describe('POST /api/ps/apikey/chat', () => {
  test('returns MISSING_PARAMS when required fields are missing', async () => {
    const res = await post('/api/ps/apikey/chat', {});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe('MISSING_PARAMS');
  });

  test('returns MISSING_MESSAGES when messages array is missing', async () => {
    const res = await post('/api/ps/apikey/chat', {
      api_base: 'https://example.com',
      api_key: 'sk-test',
      model: 'gpt-4'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe('MISSING_MESSAGES');
  });
});

describe('GET /api/health (proxy health check)', () => {
  test('returns ok status', async () => {
    return new Promise((resolve, reject) => {
      const url = new URL(BASE + '/api/health');
      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET',
        timeout: 10000
      }, (res) => {
        let chunks = '';
        res.on('data', (c) => { chunks += c; });
        res.on('end', () => {
          try {
            const body = JSON.parse(chunks);
            expect(res.statusCode).toBe(200);
            expect(body.status).toBe('ok');
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  });
});

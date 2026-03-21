// tests/contract/guanghu-shell.test.js
// 🌊 光湖语言壳 · 契约测试

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SHELL_PATH = path.join(ROOT, '.github/scripts/guanghu-shell.js');
const STATUS_PATH = path.join(ROOT, '.github/brain/shell-status.json');
const ERROR_LOG_PATH = path.join(ROOT, '.github/brain/shell-errors.json');

function runShell(agentId, action, detail) {
  const args = [SHELL_PATH, agentId, action];
  if (detail) args.push(detail);
  try {
    const output = execFileSync('node', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout: output, stderr: '' };
  } catch (e) {
    return { exitCode: e.status, stdout: e.stdout || '', stderr: e.stderr || '' };
  }
}

function readStatus() {
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

function readErrors() {
  return JSON.parse(fs.readFileSync(ERROR_LOG_PATH, 'utf8'));
}

function resetState() {
  fs.writeFileSync(STATUS_PATH, '{}');
  fs.writeFileSync(ERROR_LOG_PATH, '[]');
}

describe('🌊 光湖语言壳 · Guanghu Shell v1.0', () => {

  beforeEach(() => {
    resetState();
  });

  afterAll(() => {
    resetState();
  });

  describe('① 身份校验层', () => {
    test('已注册Agent(定时型)允许通行', () => {
      const r = runShell('AG-ZY-013', 'enter');
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toContain('定时型Agent');
      expect(r.stdout).toContain('允许通行');
    });

    test('已注册Agent(事件触发型)允许通行', () => {
      const r = runShell('AG-ZY-002', 'enter');
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toContain('事件触发型Agent');
      expect(r.stdout).toContain('允许通行');
    });

    test('未注册Agent被拒绝', () => {
      const r = runShell('AG-FAKE-999', 'enter');
      expect(r.exitCode).toBe(1);
      expect(r.stderr).toContain('身份不明');
    });

    test('缺少参数时退出码为1', () => {
      const r = runShell('AG-ZY-001', '');
      expect(r.exitCode).toBe(1);
    });
  });

  describe('② 状态注册层', () => {
    test('enter 记录启动状态', () => {
      runShell('AG-ZY-001', 'enter');
      const status = readStatus();
      expect(status['AG-ZY-001']).toBeDefined();
      expect(status['AG-ZY-001'].currentState).toBe('running');
      expect(status['AG-ZY-001'].lastEnter).toBeDefined();
      expect(status['AG-ZY-001'].runs).toHaveLength(1);
      expect(status['AG-ZY-001'].runs[0].result).toBeNull();
    });

    test('exit 记录完成状态', () => {
      runShell('AG-ZY-001', 'enter');
      runShell('AG-ZY-001', 'exit', 'completed successfully');
      const status = readStatus();
      expect(status['AG-ZY-001'].currentState).toBe('completed');
      expect(status['AG-ZY-001'].lastExit).toBeDefined();
      expect(status['AG-ZY-001'].runs[0].result).toBe('success');
      expect(status['AG-ZY-001'].runs[0].detail).toBe('completed successfully');
    });

    test('error 记录异常状态', () => {
      runShell('AG-ZY-058', 'enter');
      runShell('AG-ZY-058', 'error', 'test failure');
      const status = readStatus();
      expect(status['AG-ZY-058'].currentState).toBe('error');
      expect(status['AG-ZY-058'].lastError).toBeDefined();
      expect(status['AG-ZY-058'].runs[0].result).toBe('error');
    });

    test('多次运行保留最近10条', () => {
      for (let i = 0; i < 12; i++) {
        runShell('AG-ZY-001', 'enter');
        runShell('AG-ZY-001', 'exit');
      }
      const status = readStatus();
      expect(status['AG-ZY-001'].runs.length).toBeLessThanOrEqual(10);
    });
  });

  describe('③ 异常兑底层', () => {
    test('未注册Agent异常写入错误日志', () => {
      runShell('AG-FAKE-999', 'enter');
      const errors = readErrors();
      expect(errors.length).toBeGreaterThanOrEqual(1);
      const last = errors[errors.length - 1];
      expect(last.agentId).toBe('AG-FAKE-999');
      expect(last.error).toContain('UNREGISTERED');
      expect(last.timestamp).toBeDefined();
    });

    test('error action 写入错误日志', () => {
      runShell('AG-ZY-013', 'error', 'something broke');
      const errors = readErrors();
      const last = errors[errors.length - 1];
      expect(last.agentId).toBe('AG-ZY-013');
      expect(last.error).toBe('something broke');
    });

    test('错误日志最多保留100条', () => {
      for (let i = 0; i < 105; i++) {
        runShell('AG-FAKE-999', 'enter');
      }
      const errors = readErrors();
      expect(errors.length).toBeLessThanOrEqual(100);
    });
  });
});

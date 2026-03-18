// tests/contract/sfp-core.test.js
// SFP v1.0 · 系统指纹安全协议 · 契约测试

'use strict';

const path = require('path');

// ━━━ 加载 SFP 核心模块 ━━━
const sfpCore = require(path.resolve(__dirname, '../../scripts/sfp-core.js'));

describe('SFP v1.0 · 系统指纹安全协议', () => {

  describe('配置加载', () => {
    test('loadConfig() 应成功加载配置', () => {
      const config = sfpCore.loadConfig();
      expect(config).toBeDefined();
      expect(config.protocol_version).toBe('SFP-v1.0');
      expect(config.trusted_agents).toBeInstanceOf(Array);
      expect(config.trusted_agents.length).toBeGreaterThanOrEqual(4);
    });

    test('受信Agent列表包含 AG-ZY（铸渊）', () => {
      const config = sfpCore.loadConfig();
      const zy = config.trusted_agents.find(a => a.agent_id === 'AG-ZY');
      expect(zy).toBeDefined();
      expect(zy.name).toBe('铸渊');
      expect(zy.side).toBe('github');
    });

    test('受信Agent列表包含 AG-SY（霜砚）', () => {
      const config = sfpCore.loadConfig();
      const sy = config.trusted_agents.find(a => a.agent_id === 'AG-SY');
      expect(sy).toBeDefined();
      expect(sy.name).toBe('霜砚');
      expect(sy.persona_chain).toBe('PER-SY001←TCS-0002∞');
    });
  });

  describe('指纹生成 · generateSFP()', () => {
    test('已知Agent生成指纹成功', () => {
      const result = sfpCore.generateSFP('AG-ZY', '测试内容');
      expect(result.success).toBe(true);
      expect(result.fingerprint).toMatch(/^⌜SFP::/);
      expect(result.fingerprint).toMatch(/⌝$/);
      expect(result.meta.agent_id).toBe('AG-ZY');
      expect(result.meta.content_hash).toHaveLength(12);
      expect(result.meta.nonce).toHaveLength(6);
    });

    test('未知Agent生成指纹失败', () => {
      const result = sfpCore.generateSFP('AG-FAKE', '测试内容');
      expect(result.success).toBe(false);
      expect(result.error).toBe('AGENT_NOT_FOUND');
    });

    test('不同内容产生不同哈希', () => {
      const r1 = sfpCore.generateSFP('AG-ZY', '内容A');
      const r2 = sfpCore.generateSFP('AG-ZY', '内容B');
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(r1.meta.content_hash).not.toBe(r2.meta.content_hash);
    });

    test('每次生成不同的nonce', () => {
      const r1 = sfpCore.generateSFP('AG-ZY', '相同内容');
      const r2 = sfpCore.generateSFP('AG-ZY', '相同内容');
      expect(r1.meta.nonce).not.toBe(r2.meta.nonce);
    });

    test('signed_content 包含原始内容和指纹', () => {
      const content = '铸渊留言测试';
      const result = sfpCore.generateSFP('AG-ZY', content);
      expect(result.signed_content).toContain(content);
      expect(result.signed_content).toContain(result.fingerprint);
    });
  });

  describe('指纹验证 · verifySFP()', () => {
    test('正确指纹验证通过', () => {
      const gen = sfpCore.generateSFP('AG-ZY', '正确内容测试');
      const verify = sfpCore.verifySFP(gen.signed_content);
      expect(verify.valid).toBe(true);
      expect(verify.level).toBe('✅');
      expect(verify.meta.agent_name).toBe('铸渊');
    });

    test('无指纹内容 → NO_FINGERPRINT', () => {
      const verify = sfpCore.verifySFP('纯文本没有指纹');
      expect(verify.valid).toBe(false);
      expect(verify.error).toBe('NO_FINGERPRINT');
      expect(verify.level).toBe('⚠️');
    });

    test('内容被篡改 → CONTENT_TAMPERED', () => {
      const gen = sfpCore.generateSFP('AG-ZY', '原始内容');
      const tampered = gen.signed_content.replace('原始内容', '篡改内容');
      const verify = sfpCore.verifySFP(tampered);
      expect(verify.valid).toBe(false);
      expect(verify.error).toBe('CONTENT_TAMPERED');
      expect(verify.level).toBe('❌');
    });

    test('伪造Agent ID → INVALID_AGENT', () => {
      // 手动构造一个伪造的指纹
      const fakeContent = '伪造内容\n⌜SFP::AG-FAKE::FAKE-CHAIN::2026-03-19T00:00:00+08:00::abcdef123456::x7k9m2⌝';
      const verify = sfpCore.verifySFP(fakeContent);
      expect(verify.valid).toBe(false);
      expect(verify.error).toBe('INVALID_AGENT');
      expect(verify.level).toBe('❌');
    });

    test('亲子链不匹配 → CHAIN_MISMATCH', () => {
      // 使用正确的 agent_id 但错误的 persona_chain
      const hash = sfpCore.computeContentHash('伪造亲子链');
      const fakeContent = `伪造亲子链\n⌜SFP::AG-ZY::FAKE-CHAIN::2026-03-19T00:00:00+08:00::${hash}::x7k9m2⌝`;
      const verify = sfpCore.verifySFP(fakeContent);
      expect(verify.valid).toBe(false);
      expect(verify.error).toBe('CHAIN_MISMATCH');
      expect(verify.level).toBe('❌');
    });

    test('所有4个Agent都能生成和验证', () => {
      const agents = ['AG-ZY', 'AG-SY', 'AG-QQ', 'AG-TY'];
      for (const agentId of agents) {
        const gen = sfpCore.generateSFP(agentId, `${agentId} 测试`);
        expect(gen.success).toBe(true);
        const verify = sfpCore.verifySFP(gen.signed_content);
        expect(verify.valid).toBe(true);
      }
    });
  });

  describe('工具函数', () => {
    test('computeContentHash 返回12位hex', () => {
      const hash = sfpCore.computeContentHash('测试内容');
      expect(hash).toHaveLength(12);
      expect(hash).toMatch(/^[a-f0-9]{12}$/);
    });

    test('generateNonce 返回6位hex字符', () => {
      const nonce = sfpCore.generateNonce();
      expect(nonce).toHaveLength(6);
      expect(nonce).toMatch(/^[a-f0-9]{6}$/);
    });

    test('SFP_REGEX 能正确匹配指纹格式', () => {
      const fp = '⌜SFP::AG-ZY::PER-ZY001←YM-GL∞::2026-03-19T00:00:00+08:00::abcdef123456::x7k9m2⌝';
      const match = fp.match(sfpCore.SFP_REGEX);
      expect(match).not.toBeNull();
      expect(match[1]).toBe('AG-ZY');
      expect(match[4]).toBe('abcdef123456');
      expect(match[5]).toBe('x7k9m2');
    });
  });
});

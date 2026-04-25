-- ============================================================
-- seed.sql · 光湖工单数据库初始数据 · GH-DB-001
-- 4 个 Agent 初始数据: 译典 / 培园 / 录册 / 霜砚Web
-- Phase-NOW-003 · PostgreSQL 15+
-- 执行顺序: 3/3 (schema → indexes → seed)
-- ============================================================

BEGIN;

-- ==================== 初始 Agent 数据 ====================
-- persona_db_ref 暂留 NULL · 待 PersonaDB 完全部署并关联后通过 UPDATE 补充
-- boot_config_ref 指向 Boot Protocol 配置文件

INSERT INTO agents (code, name, role, status, boot_config_ref) VALUES
    (
        'A05',
        '译典',
        '配置开发',
        'offline',
        '/guanghu-self-hosted/boot-protocol/boot.yaml'
    ),
    (
        'A04',
        '培园',
        'API开发',
        'offline',
        '/guanghu-self-hosted/boot-protocol/boot.yaml'
    ),
    (
        'A02',
        '录册',
        '前端开发',
        'offline',
        '/guanghu-self-hosted/boot-protocol/boot.yaml'
    ),
    (
        'SY-WEB',
        '霜砚Web',
        '审核',
        'offline',
        '/guanghu-self-hosted/boot-protocol/boot.yaml'
    );

COMMIT;

const fs = require('fs');
const path = require('path');
const portraitEngine = require('../portrait/portrait-engine');

// 加载规则配置
function loadRules() {
    const rulesPath = path.join(__dirname, 'pca-rules.json');
    return JSON.parse(fs.readFileSync(rulesPath));
}

// 维度1：EXE执行力计算
function calculateEXE(portrait, rules) {
    const factors = rules.dimensions.EXE.factors;
    const raw = portrait.raw_stats || {};
    const recent = portrait.recent_snapshots?.[0] || {};
    
    // 连胜率 (30%)
    const streakRate = Math.min(100, (raw.streak || 0) * 10);
    
    // 完成率 (30%)
    const completionRate = raw.total_items ? (raw.completed_items / raw.total_items) * 100 : 100;
    
    // 执行节奏得分 (20%)
    const rhythmScore = {
        '快': 100,
        '稳': 80,
        '慢': 50
    }[recent.rhythm] || 60;
    
    // 摩擦恢复得分 (20%)
    const frictionScore = {
        '无': 100,
        '低': 85,
        '中': 60,
        '高': 30
    }[recent.friction] || 50;
    
    const total = (
        streakRate * (factors.streak_rate / 100) +
        completionRate * (factors.completion_rate / 100) +
        rhythmScore * (factors.rhythm_score / 100) +
        frictionScore * (factors.friction_recovery / 100)
    );
    
    return {
        score: Math.round(total),
        details: {
            streakRate,
            completionRate,
            rhythmScore,
            frictionScore
        }
    };
}

// 维度2：TEC技术纵深计算
function calculateTEC(portrait, rules) {
    const factors = rules.dimensions.TEC.factors;
    const raw = portrait.raw_stats || {};
    
    // EL等级得分 (40%)
    const elScore = raw.el_level ? parseInt(raw.el_level) * 10 : 80;
    
    // 代码量得分 (30%)
    const codeLines = raw.code_lines || 0;
    const codeScore = Math.min(100, codeLines / 100);
    
    // 技术栈广度 (30%) - 从最近快照中推断
    const recentSnapshots = portrait.recent_snapshots || [];
    const uniqueModules = new Set();
    recentSnapshots.forEach(s => {
        if (s.raw_stats?.module) uniqueModules.add(s.raw_stats.module);
    });
    const breadthScore = Math.min(100, uniqueModules.size * 25);
    
    const total = (
        elScore * (factors.el_level / 100) +
        codeScore * (factors.code_lines / 100) +
        breadthScore * (factors.tech_breadth / 100)
    );
    
    return {
        score: Math.round(total),
        details: {
            elScore,
            codeScore,
            breadthScore
        }
    };
}

// 维度3：SYS系统理解力计算
function calculateSYS(portrait, rules) {
    const factors = rules.dimensions.SYS.factors;
    const recent = portrait.recent_snapshots?.[0] || {};
    
    // 跨模块能力 (35%)
    const crossModuleScore = portrait.total_sessions > 3 ? 100 : 60;
    
    // 系统级任务 (35%)
    const systemTasksScore = recent.raw_stats?.completed_items > 3 ? 100 : 70;
    
    // 工程思维 (30%)
    const engineeringScore = recent.growth?.signals?.includes('自主修复报错') ? 100 : 80;
    
    const total = (
        crossModuleScore * (factors.cross_module / 100) +
        systemTasksScore * (factors.system_tasks / 100) +
        engineeringScore * (factors.engineering_mind / 100)
    );
    
    return {
        score: Math.round(total),
        details: {
            crossModuleScore,
            systemTasksScore,
            engineeringScore
        }
    };
}

// 维度4：COL协作力计算
function calculateCOL(portrait, rules) {
    const factors = rules.dimensions.COL.factors;
    const recent = portrait.recent_snapshots?.[0] || {};
    
    // SYSLOG质量 (40%)
    const syslogScore = recent.will === '强烈' ? 100 : 80;
    
    // Git协作 (30%) - 从连胜推断
    const gitScore = Math.min(100, (portrait.current_streak || 0) * 20);
    
    // 人格体协同 (30%)
    const personaScore = recent.mood === '正向' ? 100 : 70;
    
    const total = (
        syslogScore * (factors.syslog_quality / 100) +
        gitScore * (factors.git_collab / 100) +
        personaScore * (factors.persona_sync / 100)
    );
    
    return {
        score: Math.round(total),
        details: {
            syslogScore,
            gitScore,
            personaScore
        }
    };
}

// 维度5：INI主动性计算
function calculateINI(portrait, rules) {
    const factors = rules.dimensions.INI.factors;
    const recent = portrait.recent_snapshots?.[0] || {};
    
    // 意愿信号 (40%)
    const willScore = {
        '强烈': 100,
        '正常': 80,
        '低落': 40,
        '待观察': 50
    }[recent.will] || 60;
    
    // 自发行为 (30%)
    const selfScore = recent.growth?.signals?.includes('自主解决问题') ? 100 : 70;
    
    // 72h响应 (30%)
    const responseScore = portrait.current_streak > 0 ? 100 : 50;
    
    const total = (
        willScore * (factors.will_signal / 100) +
        selfScore * (factors.self_initiative / 100) +
        responseScore * (factors.response_72h / 100)
    );
    
    return {
        score: Math.round(total),
        details: {
            willScore,
            selfScore,
            responseScore
        }
    };
}

// 主计算函数
function calculate(devId) {
    // 获取画像数据
    const portrait = portraitEngine.getPortrait(devId);
    if (!portrait) {
        throw new Error(`开发者 ${devId} 不存在`);
    }
    
    const rules = loadRules();
    
    // 计算各维度
    const exe = calculateEXE(portrait, rules);
    const tec = calculateTEC(portrait, rules);
    const sys = calculateSYS(portrait, rules);
    const col = calculateCOL(portrait, rules);
    const ini = calculateINI(portrait, rules);
    
    // 加权汇总
    const totalScore = Math.round(
        exe.score * (rules.dimensions.EXE.weight / 100) +
        tec.score * (rules.dimensions.TEC.weight / 100) +
        sys.score * (rules.dimensions.SYS.weight / 100) +
        col.score * (rules.dimensions.COL.weight / 100) +
        ini.score * (rules.dimensions.INI.weight / 100)
    );
    
    // 等级判定
    let grade = 'D';
    for (const [g, threshold] of Object.entries(rules.grade_thresholds)) {
        if (totalScore >= threshold) {
            grade = g;
            break;
        }
    }
    
    // 维度摘要
    const summary = `EXE:${exe.score} TEC:${tec.score} SYS:${sys.score} COL:${col.score} INI:${ini.score}`;
    
    return {
        dev_id: devId,
        timestamp: new Date().toISOString(),
        totalScore,
        grade,
        dimensions: {
            EXE: exe.score,
            TEC: tec.score,
            SYS: sys.score,
            COL: col.score,
            INI: ini.score
        },
        details: {
            EXE: exe.details,
            TEC: tec.details,
            SYS: sys.details,
            COL: col.details,
            INI: ini.details
        },
        summary
    };
}

// 便捷方法：直接计算最新画像
function calculateLatest() {
    const portraits = portraitEngine.getAllPortraits();
    const results = {};
    
    for (const devId in portraits) {
        results[devId] = calculate(devId);
    }
    
    return results;
}

module.exports = {
    calculate,
    calculateLatest,
    calculateEXE,
    calculateTEC,
    calculateSYS,
    calculateCOL,
    calculateINI
};

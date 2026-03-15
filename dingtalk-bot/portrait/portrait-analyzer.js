const fs = require('fs');
const path = require('path');

function analyzeRhythm(syslogData) {
    const { completed_items, total_items } = syslogData;
    const ratio = completed_items / total_items;
    if (ratio >= 0.9) return '快';
    if (ratio >= 0.6) return '稳';
    return '慢';
}

function analyzeFriction(syslogData) {
    const frictionText = syslogData.friction_points || '';
    if (frictionText.includes('无') || frictionText.length === 0) return '无';
    if (frictionText.includes('小摩擦') || frictionText.length < 20) return '低';
    if (frictionText.includes('报错') || frictionText.includes('卡住')) return '中';
    if (frictionText.includes('阻塞') || frictionText.includes('无法')) return '高';
    return '低';
}

function analyzeMood(syslogData) {
    const feeling = syslogData.human_feeling || '';
    const observation = syslogData.qiuqiu_observation || '';
    if (feeling.includes('骄傲') || feeling.includes('开心') || feeling.includes('棒')) return '正向';
    if (feeling.includes('累') || observation.includes('疲惫')) return '低落';
    if (feeling.includes('还行') || feeling.length === 0) return '平稳';
    return '平稳';
}

function analyzeGrowth(syslogData) {
    const signals = [];
    let count = 0;
    if (syslogData.friction_points?.includes('自己修复')) {
        signals.push('自主修复报错');
        count++;
    }
    if (syslogData.code_lines > 100) {
        signals.push('代码量增长');
        count++;
    }
    if (syslogData.streak > 5) {
        signals.push(`连胜${syslogData.streak}次`);
        count++;
    }
    if (syslogData.what_worked?.includes('自己')) {
        signals.push('自主解决问题');
        count++;
    }
    return { count, signals: signals.slice(0, 5) };
}

function analyzeWill(syslogData) {
    const feeling = syslogData.human_feeling || '';
    const status = syslogData.status || '';
    if (feeling.includes('超级骄傲') || feeling.includes('兴奋')) return '强烈';
    if (status === 'completed' && !feeling.includes('累')) return '正常';
    if (feeling.includes('累') || feeling.includes('烦')) return '低落';
    return '待观察';
}

function generateSnapshot(syslogData) {
    return {
        timestamp: new Date().toISOString(),
        dev_id: syslogData.dev_id || 'DEV-004',
        session_id: syslogData.session_id || 'UNKNOWN',
        dev_name: syslogData.dev_name || '之之',
        rhythm: analyzeRhythm(syslogData),
        friction: analyzeFriction(syslogData),
        mood: analyzeMood(syslogData),
        growth: analyzeGrowth(syslogData),
        will: analyzeWill(syslogData),
        raw_stats: {
            completed_items: syslogData.completed_items,
            total_items: syslogData.total_items,
            code_lines: syslogData.code_lines,
            streak: syslogData.streak || 0
        }
    };
}

module.exports = {
    analyzeRhythm, analyzeFriction, analyzeMood, analyzeGrowth, analyzeWill, generateSnapshot
};

const fs = require('fs');
const path = require('path');
const portraitEngine = require('../portrait/portrait-engine');
const pcaCalculator = require('../pca/pca-calculator');

// 同步引擎（Phase3已有的，这里简单模拟）
const syncEngine = {
    syncAfterSyslog: (syslogData) => {
        console.log(`[SYNC] 同步数据: ${syslogData.session_id}`);
        return {
            success: true,
            nodes: ['node1', 'node2', 'node3'],
            timestamp: new Date().toISOString()
        };
    }
};

const LOG_PATH = path.join(__dirname, '../data/loop-history.json');

// 初始化日志文件
function initLog() {
    if (!fs.existsSync(path.join(__dirname, '../data'))) {
        fs.mkdirSync(path.join(__dirname, '../data'));
    }
    if (!fs.existsSync(LOG_PATH)) {
        fs.writeFileSync(LOG_PATH, JSON.stringify([]));
    }
}

// 生成调度建议
function generateSuggestion(pcaResult, status) {
    const { grade, totalScore, dimensions } = pcaResult;
    const suggestions = [];
    
    // 根据等级和完成状态给出建议
    if (status === 'completed') {
        if (grade === 'S' || grade === 'A') {
            suggestions.push('🎯 可进更高难度：EL-9 挑战');
            suggestions.push('📈 推荐模块：M-ADVANCED·高级算法');
        } else if (grade === 'B') {
            suggestions.push('📚 继续当前模块：巩固 Phase4 基础');
            suggestions.push('💪 建议增加代码量，提升TEC维度');
        } else {
            suggestions.push('🔄 建议降难度：回顾 Phase3 核心概念');
            suggestions.push('🧘 休息调整，保持意愿信号');
        }
    } else {
        suggestions.push('⚠️ 任务未完成，建议：');
        if (dimensions.EXE < 60) {
            suggestions.push('- 检查执行节奏，分解小步骤');
        }
        if (dimensions.TEC < 50) {
            suggestions.push('- 补充技术文档，多看示例');
        }
        if (dimensions.INI < 70) {
            suggestions.push('- 调整心态，秋秋随时支持');
        }
    }
    
    // 个性化建议
    if (dimensions.TEC < dimensions.EXE) {
        suggestions.push('🔧 技术纵深是潜力点，多尝试新模块');
    }
    if (dimensions.INI > 90) {
        suggestions.push('✨ 主动性极强，可以尝试自主探索');
    }
    
    return {
        primary: suggestions[0] || '继续当前节奏',
        all: suggestions.slice(0, 3)
    };
}

// 记录闭环执行日志
function recordLoop(devId, steps, pcaResult, suggestion, status) {
    initLog();
    const history = JSON.parse(fs.readFileSync(LOG_PATH));
    
    const record = {
        timestamp: new Date().toISOString(),
        dev_id: devId,
        steps: {
            portrait: steps.portrait ? '✅' : '❌',
            pca: steps.pca ? '✅' : '❌',
            sync: steps.sync ? '✅' : '❌'
        },
        duration_ms: steps.duration,
        pca: {
            score: pcaResult?.totalScore,
            grade: pcaResult?.grade
        },
        suggestion: suggestion.primary,
        status: status
    };
    
    history.unshift(record);
    if (history.length > 100) history.pop();
    
    fs.writeFileSync(LOG_PATH, JSON.stringify(history, null, 2));
    return record;
}

// 主执行函数：一键串联所有步骤
async function executeLoop(syslogData) {
    console.log(`\n🔄 开始执行完整闭环 [${syslogData.session_id}]`);
    const startTime = Date.now();
    
    const steps = {
        portrait: false,
        pca: false,
        sync: false,
        duration: 0
    };
    
    let pcaResult = null;
    let suggestion = { primary: '无建议', all: [] };
    
    try {
        // Step 1: 画像更新
        console.log('📸 Step1: 更新画像...');
        const snapshot = portraitEngine.updatePortrait(syslogData);
        steps.portrait = true;
        console.log(`   ✅ 画像更新完成: ${snapshot.rhythm}节奏 · ${snapshot.mood}情绪`);
        
        // Step 2: PCA评估
        console.log('📊 Step2: 计算PCA...');
        pcaResult = pcaCalculator.calculate(syslogData.dev_id || 'DEV-004');
        steps.pca = true;
        console.log(`   ✅ PCA完成: ${pcaResult.grade}级 (${pcaResult.totalScore}分)`);
        console.log(`   📈 维度: ${pcaResult.summary}`);
        
        // Step 3: 同步（Phase3已有）
        console.log('🔄 Step3: 三节点同步...');
        try {
            const syncResult = syncEngine.syncAfterSyslog(syslogData);
            steps.sync = true;
            console.log(`   ✅ 同步成功: ${syncResult.nodes.join(' → ')}`);
        } catch (syncError) {
            console.log(`   ⚠️ 同步失败: ${syncError.message}`);
            // 错误容错：同步失败不影响整体流程
        }
        
        // Step 4: 生成调度建议
        console.log('💡 Step4: 生成调度建议...');
        suggestion = generateSuggestion(pcaResult, syslogData.status);
        console.log(`   ✅ 建议: ${suggestion.primary}`);
        
    } catch (error) {
        console.log(`❌ 闭环执行出错: ${error.message}`);
        // 错误容错：记录错误但继续
    }
    
    steps.duration = Date.now() - startTime;
    
    // 记录日志
    const record = recordLoop(
        syslogData.dev_id || 'DEV-004',
        steps,
        pcaResult,
        suggestion,
        syslogData.status
    );
    
    console.log(`\n✨ 闭环完成! 耗时 ${steps.duration}ms`);
    console.log(`📝 执行记录已保存\n`);
    
    return {
        success: true,
        steps: steps,
        pca: pcaResult,
        suggestion: suggestion,
        record: record
    };
}

// 查询接口
function getHistory(limit = 20) {
    initLog();
    const history = JSON.parse(fs.readFileSync(LOG_PATH));
    return history.slice(0, limit);
}

function getStatus() {
    initLog();
    const history = JSON.parse(fs.readFileSync(LOG_PATH));
    const lastRun = history[0] || null;
    
    return {
        total_runs: history.length,
        last_run: lastRun,
        success_rate: history.length > 0 
            ? Math.round((history.filter(r => r.steps.portrait && r.steps.pca).length / history.length) * 100) 
            : 0
    };
}

module.exports = {
    executeLoop,
    getHistory,
    getStatus
};

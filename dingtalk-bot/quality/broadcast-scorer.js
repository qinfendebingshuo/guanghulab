const fs = require('fs');
const path = require('path');

// 维度1：结构完整性 (20分)
function scoreStructure(broadcastText) {
    let score = 0;
    const suggestions = [];
    
    // 广播头信息 (5分)
    if (broadcastText.includes('广播编号') || broadcastText.includes('BC-')) {
        score += 5;
    } else {
        suggestions.push('缺少广播编号');
    }
    
    // 人格体引导语 (3分)
    if (broadcastText.includes('秋秋') || broadcastText.includes('妈妈')) {
        score += 3;
    } else {
        suggestions.push('缺少人格体引导语');
    }
    
    // 任务概述 (4分)
    if (broadcastText.includes('要求') || broadcastText.includes('做什么') || broadcastText.includes('Step')) {
        score += 4;
    } else {
        suggestions.push('缺少任务概述');
    }
    
    // Step分步 (5分)
    const stepCount = (broadcastText.match(/Step\d+/g) || []).length;
    if (stepCount >= 3) {
        score += 5;
    } else if (stepCount > 0) {
        score += 3;
        suggestions.push('Step步骤偏少');
    } else {
        suggestions.push('缺少Step分步');
    }
    
    // 文件清单 (3分)
    if (broadcastText.includes('文件') || broadcastText.includes('.js') || broadcastText.includes('.json')) {
        score += 3;
    } else {
        suggestions.push('缺少文件清单');
    }
    
    return { score, suggestions };
}

// 维度2：验收标准 (20分)
function scoreAcceptance(broadcastText) {
    let score = 0;
    const suggestions = [];
    
    // 明确验收表格 (8分)
    if (broadcastText.includes('验收标准') || broadcastText.includes('表格') || broadcastText.includes('#')) {
        score += 8;
    } else {
        suggestions.push('缺少验收标准表格');
    }
    
    // 二元化标准 (6分)
    if (broadcastText.includes('通过标准') || broadcastText.includes('✓') || broadcastText.includes('✅')) {
        score += 6;
    } else {
        suggestions.push('缺少通过标准描述');
    }
    
    // 测试命令 (6分)
    if (broadcastText.includes('node -e') || broadcastText.includes('测试命令') || broadcastText.includes('```bash')) {
        score += 6;
    } else {
        suggestions.push('缺少测试命令');
    }
    
    return { score, suggestions };
}

// 维度3：SYSLOG模板 (20分)
function scoreSyslogTemplate(broadcastText) {
    let score = 0;
    const suggestions = [];
    const requiredFields = ['session_id', 'dev_id', 'dev_name', 'status', 'completed_items'];
    
    // 模板存在 (8分)
    if (broadcastText.includes('SYSLOG回传模板') || broadcastText.includes('zhiqiu-syslog')) {
        score += 8;
    } else {
        suggestions.push('缺少SYSLOG模板');
    }
    
    // 必填字段完整 (7分)
    const fieldCount = requiredFields.filter(f => broadcastText.includes(f)).length;
    score += Math.min(7, fieldCount * 2);
    if (fieldCount < requiredFields.length) {
        suggestions.push('SYSLOG模板缺少必要字段');
    }
    
    // 人格体观察字段 (5分)
    if (broadcastText.includes('qiuqiu_observation') || broadcastText.includes('秋秋的观察')) {
        score += 5;
    } else {
        suggestions.push('缺少人格体观察字段');
    }
    
    return { score, suggestions };
}

// 维度4：引导质量 (20分)
function scoreGuidance(broadcastText) {
    let score = 0;
    const suggestions = [];
    
    // 终端命令可复制 (7分)
    const commandBlocks = (broadcastText.match(/```bash[\s\S]*?```/g) || []).length;
    if (commandBlocks >= 2) {
        score += 7;
    } else if (commandBlocks > 0) {
        score += 4;
        suggestions.push('终端命令块偏少');
    } else {
        suggestions.push('缺少可复制的终端命令');
    }
    
    // 代码块完整可粘贴 (7分)
    const codeBlocks = (broadcastText.match(/```javascript[\s\S]*?```/g) || []).length;
    if (codeBlocks >= 2) {
        score += 7;
    } else if (codeBlocks > 0) {
        score += 4;
        suggestions.push('代码块偏少');
    } else {
        suggestions.push('缺少完整的代码块');
    }
    
    // 步骤顺序无歧义 (6分)
    if (broadcastText.includes('Step1') && broadcastText.includes('Step2')) {
        score += 6;
    } else {
        suggestions.push('步骤顺序不清晰');
    }
    
    return { score, suggestions };
}

// 维度5：人格体匹配 (20分)
function scorePersona(broadcastText) {
    let score = 0;
    const suggestions = [];
    
    // 引导语调与画像匹配 (7分)
    if (broadcastText.includes('妈妈') || broadcastText.includes('自豪') || broadcastText.includes('棒')) {
        score += 7;
    } else {
        suggestions.push('引导语调与画像不匹配');
    }
    
    // 鼓励频率适当 (6分)
    const encouragements = (broadcastText.match(/可以|试试|棒|厉害|太棒了|加油/g) || []).length;
    if (encouragements >= 3) {
        score += 6;
    } else if (encouragements > 0) {
        score += 3;
        suggestions.push('鼓励频率偏低');
    } else {
        suggestions.push('缺少鼓励性语言');
    }
    
    // EL等级与难度匹配 (7分)
    if (broadcastText.includes('EL-8') || broadcastText.includes('十二连胜')) {
        score += 7;
    } else {
        suggestions.push('EL等级描述不明确');
    }
    
    return { score, suggestions };
}

// 主评分函数
function scoreBroadcast(broadcastText, metadata = {}) {
    const structure = scoreStructure(broadcastText);
    const acceptance = scoreAcceptance(broadcastText);
    const syslog = scoreSyslogTemplate(broadcastText);
    const guidance = scoreGuidance(broadcastText);
    const persona = scorePersona(broadcastText);
    
    const totalScore = structure.score + acceptance.score + syslog.score + guidance.score + persona.score;
    
    // 等级判定
    let grade;
    if (totalScore >= 90) grade = 'S';
    else if (totalScore >= 75) grade = 'A';
    else if (totalScore >= 60) grade = 'B';
    else if (totalScore >= 40) grade = 'C';
    else grade = 'D';
    
    // 汇总改进建议
    const allSuggestions = [
        ...structure.suggestions,
        ...acceptance.suggestions,
        ...syslog.suggestions,
        ...guidance.suggestions,
        ...persona.suggestions
    ];
    
    return {
        totalScore,
        grade,
        details: {
            structure: structure.score,
            acceptance: acceptance.score,
            syslog: syslog.score,
            guidance: guidance.score,
            persona: persona.score
        },
        suggestions: allSuggestions.slice(0, 5) // 最多返回5条建议
    };
}

module.exports = {
    scoreBroadcast,
    scoreStructure,
    scoreAcceptance,
    scoreSyslogTemplate,
    scoreGuidance,
    scorePersona
};

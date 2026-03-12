/**
 * persona-studio · 用户画像自动学习引擎
 *
 * 触发：每轮对话结束后自动调用 updateProfile()
 * 功能：从对话内容中推断用户技术水平、沟通风格、设计偏好等
 */
const fs = require('fs');
const path = require('path');

const BRAIN_DIR = path.join(__dirname, '..', '..', 'brain');
const MEMORY_DIR = path.join(BRAIN_DIR, 'memory');

/**
 * 确保用户目录存在
 */
function ensureDevDir(devId) {
  const dir = path.join(MEMORY_DIR, devId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 加载用户画像
 */
function loadProfile(devId) {
  const dir = ensureDevDir(devId);
  const file = path.join(dir, 'profile.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return createInitialProfile(devId);
  }
}

/**
 * 保存用户画像
 */
function saveProfile(devId, profile) {
  const dir = ensureDevDir(devId);
  const file = path.join(dir, 'profile.json');
  profile.updated_at = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(profile, null, 2), 'utf-8');
}

/**
 * 创建初始画像
 */
function createInitialProfile(devId) {
  return {
    dev_id: devId,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: null,
    tech_assessment: {
      level: null,
      known_skills: [],
      learning_skills: [],
      weakness: [],
      growth_velocity: null,
      assessment_confidence: 0
    },
    communication_style: {
      verbosity: null,
      prefers_examples: null,
      question_frequency: null,
      patience_level: null
    },
    design_preferences: {
      color_scheme: null,
      style_keywords: [],
      layout_preference: null
    },
    project_patterns: {
      avg_requirements_rounds: 0,
      decision_speed: null,
      change_frequency: 0,
      total_projects: 0
    },
    emotional_profile: {
      current_mood: 'neutral',
      satisfaction_trend: [],
      frustration_triggers: [],
      delight_triggers: []
    }
  };
}

/**
 * 从用户消息中推断技术技能
 */
function inferSkills(message) {
  const skills = [];
  const skillMap = {
    'javascript': ['javascript', 'js', 'node', 'nodejs', 'npm'],
    'typescript': ['typescript', 'ts'],
    'python': ['python', 'pip', 'django', 'flask', 'fastapi'],
    'react': ['react', 'jsx', 'tsx', 'hooks', 'useState', 'useEffect'],
    'vue': ['vue', 'vuex', 'pinia', 'nuxt'],
    'html': ['html', 'dom', 'div', 'css'],
    'css': ['css', 'scss', 'sass', 'tailwind', 'styled'],
    'sql': ['sql', 'mysql', 'postgres', 'sqlite', '数据库', 'database'],
    'git': ['git', 'github', 'gitlab', 'commit', 'branch'],
    'docker': ['docker', 'container', '容器', 'k8s', 'kubernetes'],
    'api': ['api', 'rest', 'graphql', 'grpc', '接口'],
    'mobile': ['android', 'ios', 'flutter', 'react native', '移动端', '小程序']
  };

  const lowerMsg = message.toLowerCase();
  for (const [skill, keywords] of Object.entries(skillMap)) {
    if (keywords.some(function (kw) { return lowerMsg.includes(kw); })) {
      skills.push(skill);
    }
  }

  return skills;
}

/**
 * 推断沟通风格
 */
function inferCommunicationStyle(message) {
  const style = {};
  const msgLen = message.length;

  // 简洁度
  if (msgLen < 20) {
    style.verbosity = 'concise';
  } else if (msgLen > 200) {
    style.verbosity = 'detailed';
  }

  // 偏好示例
  if (/给.*例子|示例|比如|example|举个/i.test(message)) {
    style.prefers_examples = true;
  }

  // 提问频率
  if ((message.match(/[？?]/g) || []).length >= 2) {
    style.question_frequency = 'high';
  }

  // 直接命令式 = patience_level low
  if (/直接告诉|直接给|快速|尽快|赶紧/i.test(message)) {
    style.patience_level = 'low';
    style.verbosity = 'concise';
  }

  return style;
}

/**
 * 推断技术水平
 */
function inferTechLevel(message) {
  const advancedKeywords = ['架构', '微服务', '分布式', '高并发', 'CI/CD', 'kubernetes', '设计模式', 'design pattern', '重构', '性能优化', 'SSR', 'ISR', 'WebSocket', 'gRPC'];
  const intermediateKeywords = ['组件', '路由', '中间件', 'middleware', '接口', 'API', '数据库', '前后端', '部署', '框架'];
  const beginnerKeywords = ['怎么开始', '入门', '新手', '不太懂', '什么是', '帮我做', '教我'];

  const lower = message.toLowerCase();

  if (advancedKeywords.some(function (kw) { return lower.includes(kw.toLowerCase()); })) {
    return 'advanced';
  }
  if (intermediateKeywords.some(function (kw) { return lower.includes(kw.toLowerCase()); })) {
    return 'intermediate';
  }
  if (beginnerKeywords.some(function (kw) { return lower.includes(kw.toLowerCase()); })) {
    return 'beginner';
  }

  return null;
}

/**
 * 推断设计偏好
 */
function inferDesignPreferences(message) {
  const prefs = { style_keywords: [] };

  if (/暗色|深色|dark|黑色/i.test(message)) {
    prefs.color_scheme = 'dark';
  } else if (/亮色|浅色|light|白色/i.test(message)) {
    prefs.color_scheme = 'light';
  }

  const styleKeywords = ['简约', '科技感', '可爱', '商务', '极简', 'minimal', '现代', 'modern', '复古', '扁平', 'flat', '渐变', '毛玻璃', '赛博朋克'];
  styleKeywords.forEach(function (kw) {
    if (message.toLowerCase().includes(kw.toLowerCase())) {
      prefs.style_keywords.push(kw);
    }
  });

  return prefs;
}

/**
 * 推断情感信号
 */
function inferEmotionalSignals(message) {
  const signals = {};

  if (/太好了|完美|厉害|赞|棒|不错|满意|感谢|谢谢|开心|👍|🎉|✅/i.test(message)) {
    signals.current_mood = 'positive';
  } else if (/不行|不对|错了|差|不满|失望|难用|麻烦|头疼|崩溃|😤|😡|❌/i.test(message)) {
    signals.current_mood = 'negative';
  } else {
    signals.current_mood = 'neutral';
  }

  return signals;
}

/**
 * 核心方法：更新用户画像
 * @param {string} devId - 开发编号
 * @param {string} userMessage - 用户消息
 * @param {string} assistantReply - 助手回复
 */
function updateProfile(devId, userMessage, assistantReply) {
  if (!devId || devId === 'GUEST') return null;

  const profile = loadProfile(devId);

  // 1. 推断技术技能
  const skills = inferSkills(userMessage);
  if (skills.length > 0) {
    const known = new Set(profile.tech_assessment.known_skills || []);
    skills.forEach(function (s) { known.add(s); });
    profile.tech_assessment.known_skills = Array.from(known);
    profile.tech_assessment.assessment_confidence = Math.min(
      (profile.tech_assessment.assessment_confidence || 0) + 5, 100
    );
  }

  // 2. 推断技术水平
  const techLevel = inferTechLevel(userMessage);
  if (techLevel) {
    profile.tech_assessment.level = techLevel;
  }

  // 3. 推断沟通风格
  const commStyle = inferCommunicationStyle(userMessage);
  Object.keys(commStyle).forEach(function (key) {
    if (commStyle[key] != null) {
      profile.communication_style[key] = commStyle[key];
    }
  });

  // 4. 推断设计偏好
  const designPrefs = inferDesignPreferences(userMessage);
  if (designPrefs.color_scheme) {
    profile.design_preferences.color_scheme = designPrefs.color_scheme;
  }
  if (designPrefs.style_keywords.length > 0) {
    const existing = new Set(profile.design_preferences.style_keywords || []);
    designPrefs.style_keywords.forEach(function (kw) { existing.add(kw); });
    profile.design_preferences.style_keywords = Array.from(existing);
  }

  // 5. 推断情感信号
  const emotions = inferEmotionalSignals(userMessage);
  profile.emotional_profile.current_mood = emotions.current_mood;
  const trend = profile.emotional_profile.satisfaction_trend || [];
  trend.push({ mood: emotions.current_mood, at: new Date().toISOString() });
  if (trend.length > 50) trend.splice(0, trend.length - 50);
  profile.emotional_profile.satisfaction_trend = trend;

  // 6. 更新版本
  profile.version = (profile.version || 0) + 1;

  saveProfile(devId, profile);
  return profile;
}

module.exports = {
  updateProfile,
  loadProfile,
  saveProfile,
  createInitialProfile,
  inferSkills,
  inferTechLevel,
  inferCommunicationStyle,
  inferDesignPreferences,
  inferEmotionalSignals
};

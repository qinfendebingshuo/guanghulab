# \U0001f4ca 光湖语料可视化面板

**工单编号**: LC-A02-002  
**阶段编号**: Phase-0-007  
**上游依赖**: corpus-cleaner (LC-A02-20260425-002)  
**负责Agent**: 录册A02  

## 功能

| Tab | 说明 |
|-----|------|
| \U0001f4c8 总览 | Session数/Turn数/Token数 + 分类概览 |
| \U0001f3f7\ufe0f 分类 | 6类分类分布 (Session级 + Turn级) |
| \u2b50 质量 | 1-5分质量评分分布 + 平均分 |
| \U0001f464 人格体 | 13个人格体出现频率 + 覆盖率 |
| \U0001f4ad 情感与复杂度 | 情感基调 + 对话复杂度 |
| \U0001f522 Token | Token消耗按分类分布 + 占比 |
| \U0001f50d 浏览器 | Session详情浏览 (筛选+分页) |

## 快速启动

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 确保上游数据已生成
# corpus-cleaner 输出:
#   cleaned_output/stats_report.json
#   cleaned_output/corpus_cleaned.jsonl

# 3. 启动面板
streamlit run app.py
```

## 配置

通过环境变量或侧边栏修改数据源路径:

```bash
export PANEL_STATS_PATH="../cleaned_output/stats_report.json"
export PANEL_CORPUS_PATH="../cleaned_output/corpus_cleaned.jsonl"
streamlit run app.py
```

## 数据格式

### stats_report.json

corpus-cleaner `stats.py` 生成的统计报告, 包含:
- `summary`: 总session数/turn数/token数
- `classification_by_session`: 分类分布 (session级)
- `classification_by_turn`: 分类分布 (turn级)
- `quality_distribution`: 质量评分分布
- `persona_distribution`: 人格体分布
- `emotion_distribution`: 情感基调分布
- `complexity_distribution`: 复杂度分布
- `tokens_by_classification`: Token消耗按分类

### corpus_cleaned.jsonl

每行一条turn, JSON格式:
```json
{
  "role": "user|assistant",
  "content": "...",
  "session_id": "...",
  "classification": "teaching|correction|creation|execution|architecture|chat",
  "tags": {
    "persona_involved": ["霜砚", "冰朔"],
    "emotion_tone": "positive|neutral|negative|mixed",
    "complexity": "simple|medium|complex",
    "quality_score": 1-5
  }
}
```

## 文件结构

```
streamlit-panel/
\u251c\u2500\u2500 app.py           # 主面板应用
\u251c\u2500\u2500 config.py        # 面板配置
\u251c\u2500\u2500 loader.py        # 数据加载器
\u251c\u2500\u2500 requirements.txt # 依赖清单
\u2514\u2500\u2500 README.md        # 本文件
```

## 架构位置

```
HLDP-ARCH-001 七层架构
\u2514\u2500\u2500 [L5] 可视化前端 (Human Dashboard)
    \u2514\u2500\u2500 streamlit-panel \u2190 本模块
```

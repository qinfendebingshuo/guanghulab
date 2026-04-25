#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
app.py — 光湖语料可视化面板 (Streamlit)
工单编号: LC-A02-002
阶段: Phase-0-007

功能:
  · 总览仪表盘 (session数/turn数/token数)
  · 分类分布 (6类: teaching/correction/creation/execution/chat/architecture)
  · 质量分布 (1-5分)
  · 人格体分布 (13个人格体)
  · 情感基调分布 (positive/neutral/negative/mixed)
  · 复杂度分布 (simple/medium/complex)
  · Token消耗按分类
  · Session详情浏览器 (筛选+分页)

上游依赖: corpus-cleaner (LC-A02-20260425-002)
输入: stats_report.json + corpus_cleaned.jsonl
启动: streamlit run app.py
"""

import streamlit as st
import pandas as pd
from collections import Counter

from config import PanelConfig
from loader import (
    load_stats,
    load_corpus,
    group_by_session,
    extract_all_personas,
    extract_all_classifications,
)


# ============================================================
# 页面配置
# ============================================================
config = PanelConfig()
st.set_page_config(
    page_title=config.page_title,
    page_icon=config.page_icon,
    layout=config.layout,
)

st.title("\U0001f4ca 光湖语料可视化面板")
st.caption(
    "语料清洗与分类结果可视化 · corpus-cleaner 产出分析 · "
    "LC-A02-002 · Phase-0-007"
)


# ============================================================
# 侧边栏: 数据源配置
# ============================================================
with st.sidebar:
    st.header("\u2699\ufe0f 数据源配置")
    stats_path = st.text_input(
        "统计报告路径",
        value=config.stats_path,
        help="corpus-cleaner 输出的 stats_report.json",
    )
    corpus_path = st.text_input(
        "清洗语料路径",
        value=config.corpus_path,
        help="corpus-cleaner 输出的 corpus_cleaned.jsonl",
    )
    st.divider()
    st.markdown("**工单信息**")
    st.markdown(
        "- 编号: `LC-A02-002`\n"
        "- 阶段: `Phase-0-007`\n"
        "- 上游: `corpus-cleaner`\n"
        "- 仓库: `guanghulab`"
    )


# ============================================================
# 数据加载 (缓存)
# ============================================================
@st.cache_data
def cached_load_stats(path: str):
    return load_stats(path)


@st.cache_data
def cached_load_corpus(path: str):
    return load_corpus(path)


stats = cached_load_stats(stats_path)
turns = cached_load_corpus(corpus_path)
sessions = group_by_session(turns)


# ============================================================
# 数据检查
# ============================================================
if stats is None and not turns:
    st.warning(
        "\u26a0\ufe0f 未找到数据文件。请确认路径配置正确。\n\n"
        "预期文件:\n"
        f"- 统计报告: `{stats_path}`\n"
        f"- 清洗语料: `{corpus_path}`\n\n"
        "请先运行 corpus-cleaner 生成数据后再打开面板。\n\n"
        "```bash\n"
        "cd corpus-cleaner && python cleaner.py\n"
        "```"
    )
    st.stop()


# ============================================================
# 辅助函数
# ============================================================
def _make_bar_df(data: dict, col_label: str, col_value: str) -> pd.DataFrame:
    """构造 bar_chart 所需的 DataFrame"""
    return pd.DataFrame(
        {col_label: list(data.keys()), col_value: list(data.values())}
    ).set_index(col_label)


def _cn_label(cls: str) -> str:
    """分类英文→中文"""
    return config.classification_cn.get(cls, cls)


def _compute_session_stats_from_turns() -> dict:
    """从turns实时计算session级统计(当stats.json不可用时的fallback)"""
    cls_counter: Counter = Counter()
    quality_counter: Counter = Counter()
    persona_counter: Counter = Counter()
    emotion_counter: Counter = Counter()
    complexity_counter: Counter = Counter()

    for sid, session_turns in sessions.items():
        if not session_turns:
            continue
        first = session_turns[0]
        cls_counter[first.get("classification", "unknown")] += 1
        tags = first.get("tags", {})
        quality_counter[tags.get("quality_score", 0)] += 1
        emotion_counter[tags.get("emotion_tone", "neutral")] += 1
        complexity_counter[tags.get("complexity", "medium")] += 1
        for p in tags.get("persona_involved", []):
            persona_counter[p] += 1

    return {
        "classification": dict(cls_counter.most_common()),
        "quality": dict(sorted(quality_counter.items())),
        "persona": dict(persona_counter.most_common()),
        "emotion": dict(sorted(emotion_counter.items())),
        "complexity": dict(sorted(complexity_counter.items())),
    }


# ============================================================
# Tab 布局
# ============================================================
tab_overview, tab_classify, tab_quality, tab_persona, tab_emotion, \
    tab_tokens, tab_explorer = st.tabs([
        "\U0001f4c8 总览",
        "\U0001f3f7\ufe0f 分类",
        "\u2b50 质量",
        "\U0001f464 人格体",
        "\U0001f4ad 情感与复杂度",
        "\U0001f522 Token",
        "\U0001f50d 浏览器",
    ])


# ============================================================
# Tab 1: 总览
# ============================================================
with tab_overview:
    st.header("\U0001f4c8 总览仪表盘")

    if stats and "summary" in stats:
        summary = stats["summary"]
        c1, c2, c3 = st.columns(3)
        c1.metric("总 Session 数", f"{summary.get('total_sessions', 0):,}")
        c2.metric("总 Turn 数", f"{summary.get('total_turns', 0):,}")
        c3.metric("估算 Token 数", f"{summary.get('total_estimated_tokens', 0):,}")
    elif turns:
        c1, c2, c3 = st.columns(3)
        c1.metric("总 Session 数", f"{len(sessions):,}")
        c2.metric("总 Turn 数", f"{len(turns):,}")
        c3.metric("估算 Token 数", "\u2014")

    st.divider()

    # 分类概览
    cls_data = None
    if stats and "classification_by_session" in stats:
        cls_data = stats["classification_by_session"]
    elif turns:
        fallback = _compute_session_stats_from_turns()
        cls_data = fallback["classification"]

    if cls_data:
        st.subheader("分类概览 (Session级)")
        cn_data = {_cn_label(k): v for k, v in cls_data.items()}
        st.bar_chart(_make_bar_df(cn_data, "分类", "Session数"))


# ============================================================
# Tab 2: 分类
# ============================================================
with tab_classify:
    st.header("\U0001f3f7\ufe0f 分类分布")

    cls_session = None
    cls_turn = None

    if stats:
        cls_session = stats.get("classification_by_session")
        cls_turn = stats.get("classification_by_turn")
    elif turns:
        fallback = _compute_session_stats_from_turns()
        cls_session = fallback["classification"]

    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Session 级")
        if cls_session:
            cn_data = {_cn_label(k): v for k, v in cls_session.items()}
            df = _make_bar_df(cn_data, "分类", "Session数")
            st.bar_chart(df)
            st.dataframe(df.reset_index(), use_container_width=True, hide_index=True)

    with col2:
        st.subheader("Turn 级")
        if cls_turn:
            cn_data = {_cn_label(k): v for k, v in cls_turn.items()}
            df = _make_bar_df(cn_data, "分类", "Turn数")
            st.bar_chart(df)
            st.dataframe(df.reset_index(), use_container_width=True, hide_index=True)
        else:
            st.info("Turn级分类数据需从 stats_report.json 加载")


# ============================================================
# Tab 3: 质量
# ============================================================
with tab_quality:
    st.header("\u2b50 质量分布")

    qd = None
    if stats and "quality_distribution" in stats:
        qd = stats["quality_distribution"]
    elif turns:
        fallback = _compute_session_stats_from_turns()
        qd = {str(k): v for k, v in fallback["quality"].items()}

    if qd:
        all_scores = {
            f"{i}分": qd.get(str(i), 0)
            for i in range(config.quality_min, config.quality_max + 1)
        }
        df = _make_bar_df(all_scores, "评分", "Session数")
        st.bar_chart(df)

        total = sum(all_scores.values())
        if total > 0:
            avg = sum(
                i * qd.get(str(i), 0)
                for i in range(config.quality_min, config.quality_max + 1)
            ) / total
            c1, c2 = st.columns(2)
            c1.metric("平均质量评分", f"{avg:.2f} / 5.0")
            c2.metric("总评估Session数", f"{total:,}")

        st.dataframe(df.reset_index(), use_container_width=True, hide_index=True)


# ============================================================
# Tab 4: 人格体
# ============================================================
with tab_persona:
    st.header("\U0001f464 人格体分布")

    pd_data = None
    if stats and "persona_distribution" in stats:
        pd_data = stats["persona_distribution"]
    elif turns:
        fallback = _compute_session_stats_from_turns()
        pd_data = fallback["persona"]

    if pd_data:
        df = _make_bar_df(pd_data, "人格体", "出现Session数")
        st.bar_chart(df)
        st.dataframe(df.reset_index(), use_container_width=True, hide_index=True)

        st.divider()
        total_sessions_count = len(sessions) if sessions else (
            stats["summary"]["total_sessions"] if stats and "summary" in stats else 0
        )
        if total_sessions_count > 0:
            st.subheader("覆盖率")
            for persona, count in pd_data.items():
                pct = count / total_sessions_count
                st.progress(min(pct, 1.0), text=f"{persona}: {count} ({pct:.1%})")
    else:
        st.info("暂无人格体分布数据")


# ============================================================
# Tab 5: 情感与复杂度
# ============================================================
with tab_emotion:
    st.header("\U0001f4ad 情感基调与复杂度")

    col1, col2 = st.columns(2)

    # 情感
    with col1:
        st.subheader("情感基调")
        ed = None
        if stats and "emotion_distribution" in stats:
            ed = stats["emotion_distribution"]
        elif turns:
            fallback = _compute_session_stats_from_turns()
            ed = fallback["emotion"]

        if ed:
            emotion_cn = {
                "positive": "积极", "negative": "消极",
                "neutral": "中性", "mixed": "复合",
            }
            cn_data = {emotion_cn.get(k, k): v for k, v in ed.items()}
            df = _make_bar_df(cn_data, "情感", "Session数")
            st.bar_chart(df)
            st.dataframe(df.reset_index(), use_container_width=True, hide_index=True)

    # 复杂度
    with col2:
        st.subheader("复杂度")
        cd = None
        if stats and "complexity_distribution" in stats:
            cd = stats["complexity_distribution"]
        elif turns:
            fallback = _compute_session_stats_from_turns()
            cd = fallback["complexity"]

        if cd:
            comp_cn = {
                "simple": "简单", "medium": "中等", "complex": "复杂",
            }
            cn_data = {comp_cn.get(k, k): v for k, v in cd.items()}
            df = _make_bar_df(cn_data, "复杂度", "Session数")
            st.bar_chart(df)
            st.dataframe(df.reset_index(), use_container_width=True, hide_index=True)


# ============================================================
# Tab 6: Token
# ============================================================
with tab_tokens:
    st.header("\U0001f522 Token 消耗分布")

    if stats and "tokens_by_classification" in stats:
        td = stats["tokens_by_classification"]
        if td:
            cn_data = {_cn_label(k): v for k, v in td.items()}
            df = _make_bar_df(cn_data, "分类", "估算Token")
            st.bar_chart(df)
            st.dataframe(df.reset_index(), use_container_width=True, hide_index=True)

            st.divider()
            total_tokens = sum(td.values())
            if total_tokens > 0:
                st.subheader("Token 占比")
                for cls, tokens in td.items():
                    pct = tokens / total_tokens
                    st.progress(
                        min(pct, 1.0),
                        text=f"{_cn_label(cls)}: {tokens:,} ({pct:.1%})",
                    )
    else:
        st.info(
            "Token分布数据需从 stats_report.json 加载。\n\n"
            "请运行 corpus-cleaner 生成统计报告。"
        )


# ============================================================
# Tab 7: Session 浏览器
# ============================================================
with tab_explorer:
    st.header("\U0001f50d Session 浏览器")

    if not turns:
        st.info(
            "需要加载 corpus_cleaned.jsonl 才能使用浏览器功能。\n\n"
            f"当前路径: `{corpus_path}`"
        )
    else:
        # 筛选器
        c1, c2, c3 = st.columns(3)

        all_cls = extract_all_classifications(turns)
        all_personas = extract_all_personas(turns)

        with c1:
            filter_cls = st.selectbox(
                "按分类筛选",
                ["全部"] + [f"{c} ({_cn_label(c)})" for c in all_cls],
                key="filter_cls",
            )
        with c2:
            filter_persona = st.selectbox(
                "按人格体筛选",
                ["全部"] + all_personas,
                key="filter_persona",
            )
        with c3:
            filter_quality = st.selectbox(
                "按质量筛选",
                ["全部"] + [str(i) for i in range(
                    config.quality_min, config.quality_max + 1
                )],
                key="filter_quality",
            )

        # 解析分类筛选值
        selected_cls = None
        if filter_cls != "全部":
            selected_cls = filter_cls.split(" (")[0]

        # 应用筛选
        filtered_sessions: dict[str, list[dict]] = {}
        for sid, session_turns in sessions.items():
            if not session_turns:
                continue
            first = session_turns[0]
            cls = first.get("classification", "unknown")
            tags = first.get("tags", {})
            personas = tags.get("persona_involved", [])
            quality = tags.get("quality_score", 0)

            if selected_cls is not None and cls != selected_cls:
                continue
            if filter_persona != "全部" and filter_persona not in personas:
                continue
            if filter_quality != "全部" and quality != int(filter_quality):
                continue

            filtered_sessions[sid] = session_turns

        st.caption(f"共 {len(filtered_sessions)} 个 Session")

        # 分页
        page_size = config.explorer_page_size
        total_pages = max(
            1, (len(filtered_sessions) + page_size - 1) // page_size
        )
        page = st.number_input(
            "页码", min_value=1, max_value=total_pages, value=1, key="page"
        )

        session_ids = list(filtered_sessions.keys())
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size

        for sid in session_ids[start_idx:end_idx]:
            s_turns = filtered_sessions[sid]
            first = s_turns[0]
            cls = first.get("classification", "unknown")
            tags = first.get("tags", {})
            q = tags.get("quality_score", "?")
            emo = tags.get("emotion_tone", "?")
            personas = ", ".join(tags.get("persona_involved", [])) or "\u2014"
            comp = tags.get("complexity", "?")

            label = (
                f"\U0001f4dd {sid}  |  "
                f"{_cn_label(cls)}  |  "
                f"\u2b50{q}  |  "
                f"\U0001f4ad{emo}  |  "
                f"\U0001f464{personas}  |  "
                f"{comp}"
            )

            with st.expander(label):
                for turn in s_turns:
                    role = turn.get("role", "?")
                    content = turn.get("content", "")
                    if role == "user":
                        icon = "\U0001f9d1"
                    elif role == "assistant":
                        icon = "\U0001f916"
                    else:
                        icon = "\u2699\ufe0f"

                    st.markdown(f"**{icon} {role}**")
                    preview = content[:config.content_preview_length]
                    if len(content) > config.content_preview_length:
                        preview += "..."
                    st.text(preview)
                    st.divider()

        st.caption(f"第 {page}/{total_pages} 页")


# ============================================================
# 底部
# ============================================================
st.divider()
st.caption(
    "光湖语料可视化面板 \u00b7 LC-A02-002 \u00b7 Phase-0-007 \u00b7 "
    "上游: corpus-cleaner (LC-A02-20260425-002) \u00b7 "
    "录册A02 开发"
)

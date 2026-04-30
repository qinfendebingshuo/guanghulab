"""
光湖 MVP Chat · 双模型统一出口 · 路由器

核心逻辑:
- 默认走系统侧模型(shuangyan-system-v1) → 控制输出基调和质量
- 需要人格色彩时混入奶瓶侧模型(naipping-v1)
- 需要深度推理时内部调用DeepSeek或Qwen → 用户无感知
- 用户只看到一个统一的回复

百炼API走OpenAI兼容接口
工单: YD-A05-20260430-MVP
"""

import json
import logging
from typing import AsyncGenerator, Optional

import httpx

logger = logging.getLogger('dual-model')

# ── 人格色彩触发关键词 ──
# 当用户消息包含以下关键词时，混入奶瓶侧模型的人格色彩
PERSONA_TRIGGER_KEYWORDS = [
    '感觉', '心情', '开心', '难过', '伤心', '害怕', '想你',
    '喜欢', '爱', '陪', '抱抱', '温暖', '冷', '孤独',
    '谢谢', '对不起', '没关系', '好吗', '怎么了',
    '宝宝', '奶瓶', '妈妈', '爸爸',
]

# ── 深度推理触发关键词 ──
REASONING_TRIGGER_KEYWORDS = [
    '分析', '推理', '计算', '解释为什么', '逻辑', '证明',
    '代码', '算法', '数学', '公式', '原理',
    '对比', '优缺点', '方案', '架构', '设计',
]


class DualModelRouter:
    """
    双模型统一出口

    模型是肌肉，不是灵魂。灵魂是人格壳+路由协议+语言风格。
    哪块肌肉出力，由灵魂决定。
    """

    def __init__(
        self,
        dashscope_api_key: str,
        dashscope_base_url: str,
        system_model: str,
        naipping_model: str,
        deepseek_api_key: str = '',
        deepseek_base_url: str = '',
        qwen_api_key: str = '',
        qwen_base_url: str = '',
        system_prompt: str = ''
    ):
        self.dashscope_api_key = dashscope_api_key
        self.dashscope_base_url = dashscope_base_url.rstrip('/')
        self.system_model = system_model
        self.naipping_model = naipping_model
        self.deepseek_api_key = deepseek_api_key
        self.deepseek_base_url = deepseek_base_url.rstrip('/') if deepseek_base_url else ''
        self.qwen_api_key = qwen_api_key
        self.qwen_base_url = qwen_base_url.rstrip('/') if qwen_base_url else ''
        self.system_prompt = system_prompt

        # 对话历史（简单内存缓存·MVP阶段）
        self._histories = {}  # session_id -> list of messages
        self._max_history = 20  # 每个session最多保留20轮

    def _detect_route(self, user_message: str) -> str:
        """
        路由决策：检测用户消息意图 → 选择模型组合

        返回:
        - 'system': 纯系统侧
        - 'persona': 系统侧 + 奶瓶侧人格色彩融合
        - 'reasoning': 系统侧 + 深度推理辅助
        """
        msg_lower = user_message.lower()

        # 检查是否需要深度推理
        for kw in REASONING_TRIGGER_KEYWORDS:
            if kw in msg_lower:
                return 'reasoning'

        # 检查是否需要人格色彩
        for kw in PERSONA_TRIGGER_KEYWORDS:
            if kw in msg_lower:
                return 'persona'

        # 默认走系统侧
        return 'system'

    def _get_history(self, session_id: str) -> list:
        """获取对话历史"""
        if session_id not in self._histories:
            self._histories[session_id] = []
        return self._histories[session_id]

    def _append_history(self, session_id: str, role: str, content: str):
        """追加对话历史"""
        history = self._get_history(session_id)
        history.append({'role': role, 'content': content})
        # 滚动窗口
        if len(history) > self._max_history * 2:
            self._histories[session_id] = history[-self._max_history * 2:]

    async def stream_chat(
        self,
        user_message: str,
        memory_context: str = '',
        session_id: str = 'default'
    ) -> AsyncGenerator[str, None]:
        """
        流式聊天 · 返回token异步生成器

        流程:
        1. 路由决策
        2. 构建消息列表（system prompt + 记忆上下文 + 对话历史 + 当前消息）
        3. 调用对应模型（流式）
        4. 如果需要人格色彩融合，先系统侧生成，再奶瓶侧润色
        5. 追加对话历史
        """
        route = self._detect_route(user_message)
        logger.info('路由决策: ' + route + ' · session: ' + session_id)

        # 追加用户消息到历史
        self._append_history(session_id, 'user', user_message)

        # ── 构建消息列表 ──
        messages = []

        # System prompt（人格壳）
        if self.system_prompt:
            messages.append({'role': 'system', 'content': self.system_prompt})

        # 记忆上下文注入
        if memory_context:
            messages.append({
                'role': 'system',
                'content': '[记忆上下文]\n' + memory_context
            })

        # 对话历史
        history = self._get_history(session_id)
        # 不包括刚追加的最后一条user消息
        for msg in history[:-1]:
            messages.append(msg)

        # 当前用户消息
        messages.append({'role': 'user', 'content': user_message})

        # ── 根据路由执行 ──
        full_response = ''

        if route == 'reasoning' and (self.deepseek_api_key or self.qwen_api_key):
            # 先调深度推理模型获取分析（非流式·内部工具）
            reasoning_result = await self._call_reasoning(user_message)
            if reasoning_result:
                # 将推理结果注入上下文
                messages.insert(-1, {
                    'role': 'system',
                    'content': '[深度分析参考]\n' + reasoning_result
                })

            # 再走系统侧流式输出
            async for token in self._stream_dashscope(messages, self.system_model):
                full_response += token
                yield token

        elif route == 'persona':
            # 系统侧先生成基础回复
            base_response = ''
            async for token in self._stream_dashscope(messages, self.system_model):
                base_response += token
                yield token
            full_response = base_response
            # MVP阶段暂不做二次润色，后续版本加入奶瓶侧融合
            # 理由：二次调用延迟太高，MVP先保证流畅

        else:
            # 纯系统侧
            async for token in self._stream_dashscope(messages, self.system_model):
                full_response += token
                yield token

        # 追加助手回复到历史
        self._append_history(session_id, 'assistant', full_response)

    async def _stream_dashscope(
        self,
        messages: list,
        model: str
    ) -> AsyncGenerator[str, None]:
        """
        调用百炼API（OpenAI兼容）· 流式返回token
        """
        url = self.dashscope_base_url + '/chat/completions'
        headers = {
            'Authorization': 'Bearer ' + self.dashscope_api_key,
            'Content-Type': 'application/json'
        }
        payload = {
            'model': model,
            'messages': messages,
            'stream': True,
            'temperature': 0.8,
            'max_tokens': 2048
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                'POST', url, headers=headers, json=payload
            ) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    logger.error('百炼API错误: ' + str(resp.status_code) + ' ' + body.decode())
                    yield '[模型调用失败: ' + str(resp.status_code) + ']'
                    return

                buffer = ''
                async for chunk in resp.aiter_text():
                    buffer += chunk
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        line = line.strip()
                        if not line:
                            continue
                        if line.startswith('data: '):
                            data_str = line[6:]
                            if data_str == '[DONE]':
                                return
                            try:
                                data = json.loads(data_str)
                                choices = data.get('choices', [])
                                if choices:
                                    delta = choices[0].get('delta', {})
                                    content = delta.get('content', '')
                                    if content:
                                        yield content
                            except json.JSONDecodeError:
                                pass

    async def _call_reasoning(self, query: str) -> str:
        """
        调用深度推理模型（非流式·内部工具·用户无感知）
        优先DeepSeek · 降级Qwen
        """
        configs = []
        if self.deepseek_api_key and self.deepseek_base_url:
            configs.append((
                self.deepseek_base_url + '/chat/completions',
                self.deepseek_api_key,
                'deepseek-chat'
            ))
        if self.qwen_api_key and self.qwen_base_url:
            configs.append((
                self.qwen_base_url + '/chat/completions',
                self.qwen_api_key,
                'qwen-plus'
            ))

        for url, api_key, model in configs:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        url,
                        headers={
                            'Authorization': 'Bearer ' + api_key,
                            'Content-Type': 'application/json'
                        },
                        json={
                            'model': model,
                            'messages': [
                                {'role': 'system', 'content': '你是一个深度分析助手。请对以下问题给出简洁、结构化的分析。'},
                                {'role': 'user', 'content': query}
                            ],
                            'temperature': 0.3,
                            'max_tokens': 1024
                        }
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        choices = data.get('choices', [])
                        if choices:
                            return choices[0].get('message', {}).get('content', '')
            except Exception as e:
                logger.warning('深度推理调用失败(' + model + '): ' + str(e))
                continue

        return ''

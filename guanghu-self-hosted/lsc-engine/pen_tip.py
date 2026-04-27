"""
笔尖 · PenTip · 代码生成层

职责: 接收自然语言需求描述，调用通义千问API生成可执行的Python函数代码。

技术:
  - 通义千问API（OpenAI兼容接口）
  - 标准库 http.client + json（零依赖）
  - 成本: 每次生成约 ¥0.001 ~ ¥0.01

作者: 译典A05 (5TH-LE-HK-A05)
工单: GH-LSC-001
"""

import json
import http.client
import ssl
from typing import Optional
from urllib.parse import urlparse


# 通义千问OpenAI兼容接口默认配置
DEFAULT_API_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DEFAULT_MODEL = "qwen-turbo"

# 系统提示词: 引导LLM生成干净的Python函数
SYSTEM_PROMPT = """你是光湖神笔引擎的代码生成器。你的任务是根据用户的自然语言描述，生成一个可执行的Python函数。

规则:
1. 只返回Python代码，不要任何解释、注释以外的文字
2. 代码必须包含至少一个def函数定义
3. 函数名要简洁有意义（英文，snake_case）
4. 优先使用Python标准库，避免第三方依赖
5. 包含必要的类型提示和docstring
6. 代码必须是完整可执行的（包含必要的import）
7. 不要包含if __name__ == "__main__"块
8. 不要包含任何危险操作（rm -rf、格式化磁盘等）
9. 不要访问/guanghu/tools/以外其他Agent的目录

只返回代码。"""


class PenTip:
    """
    笔尖 · 代码生成层。
    通过通义千问API将自然语言描述转换为可执行的Python函数。
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ):
        """
        初始化笔尖。
        
        Args:
            api_key: 通义千问API密钥
            api_base: API基础URL（OpenAI兼容端点）
            model: 模型名称
            temperature: 生成温度（低=更确定性）
            max_tokens: 最大生成token数
        """
        self.api_key = api_key
        self.api_base = api_base or DEFAULT_API_BASE
        self.model = model or DEFAULT_MODEL
        self.temperature = temperature
        self.max_tokens = max_tokens

    def generate(self, description: str) -> str:
        """
        根据自然语言描述生成Python函数代码。
        
        Args:
            description: 需求描述（如"写一个检查端口占用的函数"）
        
        Returns:
            生成的Python代码字符串
        
        Raises:
            ConnectionError: API调用失败
            ValueError: 响应解析失败
        """
        if not self.api_key:
            raise ValueError(
                "未配置API密钥。请设置QWEN_API_KEY环境变量或在/guanghu/config/.env中配置。"
            )

        # 构建请求
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"请生成以下功能的Python函数:\n{description}"},
        ]

        payload = json.dumps({
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        })

        # 解析URL
        parsed = urlparse(self.api_base)
        host = parsed.hostname
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        base_path = parsed.path.rstrip("/")
        endpoint = f"{base_path}/chat/completions"

        # 发送请求（标准库http.client，零依赖）
        try:
            if parsed.scheme == "https":
                context = ssl.create_default_context()
                conn = http.client.HTTPSConnection(host, port, context=context, timeout=60)
            else:
                conn = http.client.HTTPConnection(host, port, timeout=60)

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            }

            conn.request("POST", endpoint, body=payload, headers=headers)
            response = conn.getresponse()
            data = response.read().decode("utf-8")
            conn.close()
        except Exception as e:
            raise ConnectionError(f"笔尖API调用失败: {e}") from e

        # 解析响应
        if response.status != 200:
            raise ConnectionError(
                f"笔尖API返回错误 (HTTP {response.status}): {data[:500]}"
            )

        try:
            result = json.loads(data)
            content = result["choices"][0]["message"]["content"]
        except (json.JSONDecodeError, KeyError, IndexError) as e:
            raise ValueError(f"笔尖响应解析失败: {e}\n原始响应: {data[:500]}") from e

        # 清理: 去除markdown代码块标记
        code = self._clean_code(content)
        return code

    @staticmethod
    def _clean_code(raw: str) -> str:
        """
        清理LLM返回的代码（去除markdown代码块等）。
        
        Args:
            raw: 原始LLM输出
        
        Returns:
            干净的Python代码
        """
        text = raw.strip()

        # 去除 ```python ... ``` 包裹
        if text.startswith("```"):
            lines = text.split("\n")
            # 找到开头的 ```python 或 ```
            start = 1  # 跳过第一行
            # 找到结尾的 ```
            end = len(lines)
            for i in range(len(lines) - 1, 0, -1):
                if lines[i].strip() == "```":
                    end = i
                    break
            text = "\n".join(lines[start:end])

        return text.strip()

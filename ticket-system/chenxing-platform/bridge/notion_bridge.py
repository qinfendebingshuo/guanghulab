"""
notion_bridge.py · Notion读写桥接模块
开发: 培园·后端开发·5TH-LE-HK-A04
桔子晨星线 · 2026-04-30

思维逻辑:
    这个模块是整个平台和Notion之间的唯一桥梁。
    所有对Notion的读写操作都通过这个模块进行,
    其他模块(worldview_sync / chat_agent)不直接调Notion API,
    而是通过NotionBridge来操作。
    
    这样做的好处:
    1. Token管理集中 - 只在一个地方管理OAuth Token
    2. 错误处理统一 - Notion API的超时/限流/权限错误统一兜底
    3. 日志统一 - 所有Notion操作都有日志可追溯
    4. 后续扩展方便 - 如果要换其他知识库,只改这个模块

模块用途:
    封装Notion Public API的读写操作,提供以下能力:
    - 读取指定页面内容(Markdown/纯文本)
    - 读取数据库条目
    - 写入/更新页面内容
    - 写入数据库条目(交互记录回写)
    - 批量读取多个页面(世界观同步用)

模块类型: 自研发
"""

import os
import time
import logging
from typing import Optional

import httpx

logger = logging.getLogger("chenxing.bridge")

# Notion API 版本和基础URL
NOTION_API_VERSION = "2022-06-28"
NOTION_BASE_URL = "https://api.notion.com/v1"

# 重试配置
MAX_RETRIES = 3
RETRY_DELAY_BASE = 1  # 秒, 指数退避基数
RATE_LIMIT_WAIT = 1   # 被限流后等待秒数


class NotionBridge:
    """
    Notion读写桥接器
    
    所有对Notion API的操作都通过这个类进行。
    支持:
    - 页面读取(get_page / get_page_content)
    - 数据库查询(query_database)
    - 页面创建/更新(create_page / update_page_content)
    - 数据库条目创建(create_database_entry)
    """
    
    def __init__(self, token: Optional[str] = None, timeout: float = 30.0):
        """
        初始化桥接器
        
        Args:
            token: Notion Integration Token。
                   如果不传,从环境变量 NOTION_TOKEN 读取。
            timeout: HTTP请求超时时间(秒)
        """
        self.token = token or os.getenv("NOTION_TOKEN", "")
        if not self.token:
            raise ValueError(
                "Notion Token未配置。"
                "请在 .env 文件中设置 NOTION_TOKEN=你的Token，"
                "或在初始化时传入 token 参数。"
            )
        
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Notion-Version": NOTION_API_VERSION,
            "Content-Type": "application/json",
        }
        self.timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """获取或创建HTTP客户端(复用连接)"""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=NOTION_BASE_URL,
                headers=self.headers,
                timeout=self.timeout,
            )
        return self._client
    
    async def close(self):
        """关闭HTTP客户端"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
    
    async def _request(
        self,
        method: str,
        path: str,
        json_data: Optional[dict] = None,
        params: Optional[dict] = None,
    ) -> dict:
        """
        统一请求方法,带重试和错误处理
        
        Args:
            method: HTTP方法 (GET/POST/PATCH)
            path: API路径 (如 /pages/{page_id})
            json_data: 请求体JSON
            params: 查询参数
            
        Returns:
            API响应JSON
            
        Raises:
            NotionAPIError: Notion API返回错误
            httpx.TimeoutException: 请求超时
        """
        client = await self._get_client()
        last_error = None
        
        for attempt in range(MAX_RETRIES):
            try:
                response = await client.request(
                    method=method,
                    url=path,
                    json=json_data,
                    params=params,
                )
                
                # 限流处理: 429 Too Many Requests
                if response.status_code == 429:
                    retry_after = float(
                        response.headers.get("Retry-After", RATE_LIMIT_WAIT)
                    )
                    logger.warning(
                        f"Notion API限流, {retry_after}秒后重试 "
                        f"(尝试 {attempt + 1}/{MAX_RETRIES})"
                    )
                    time.sleep(retry_after)
                    continue
                
                # 服务端错误: 5xx
                if response.status_code >= 500:
                    logger.warning(
                        f"Notion API服务端错误 {response.status_code}, "
                        f"重试 (尝试 {attempt + 1}/{MAX_RETRIES})"
                    )
                    time.sleep(RETRY_DELAY_BASE * (2 ** attempt))
                    continue
                
                # 客户端错误: 4xx (非429)
                if response.status_code >= 400:
                    error_body = response.json()
                    error_msg = error_body.get("message", "未知错误")
                    raise NotionAPIError(
                        status_code=response.status_code,
                        message=f"Notion API错误 [{response.status_code}]: {error_msg}",
                        body=error_body,
                    )
                
                return response.json()
                
            except httpx.TimeoutException:
                last_error = f"请求超时 (尝试 {attempt + 1}/{MAX_RETRIES})"
                logger.warning(last_error)
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY_BASE * (2 ** attempt))
            except NotionAPIError:
                raise
            except Exception as e:
                last_error = str(e)
                logger.error(f"请求异常: {e} (尝试 {attempt + 1}/{MAX_RETRIES})")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY_BASE * (2 ** attempt))
        
        raise NotionAPIError(
            status_code=0,
            message=f"请求失败, 已重试{MAX_RETRIES}次: {last_error}",
        )
    
    # ========== 页面操作 ==========
    
    async def get_page(self, page_id: str) -> dict:
        """
        获取页面元数据(标题、属性等)
        
        Args:
            page_id: Notion页面ID (32位hex, 带或不带横线均可)
            
        Returns:
            页面对象JSON
        """
        page_id = self._normalize_id(page_id)
        logger.info(f"读取页面元数据: {page_id}")
        return await self._request("GET", f"/pages/{page_id}")
    
    async def get_page_content(self, page_id: str) -> str:
        """
        获取页面的全部内容,转换为纯文本/Markdown
        
        递归获取所有block子节点,拼接成可读文本。
        这是世界观同步的核心方法 - 把Notion页面"搬"到本地。
        
        Args:
            page_id: Notion页面ID
            
        Returns:
            页面内容的Markdown文本
        """
        page_id = self._normalize_id(page_id)
        logger.info(f"读取页面内容: {page_id}")
        
        blocks = await self._get_all_blocks(page_id)
        content_parts = []
        
        for block in blocks:
            text = self._block_to_text(block)
            if text:
                content_parts.append(text)
        
        return "\n".join(content_parts)
    
    async def _get_all_blocks(
        self, block_id: str, depth: int = 0, max_depth: int = 5
    ) -> list:
        """
        递归获取block的所有子节点
        
        Args:
            block_id: 父block ID
            depth: 当前递归深度
            max_depth: 最大递归深度(防止无限嵌套)
            
        Returns:
            所有block对象列表(已展平)
        """
        if depth > max_depth:
            return []
        
        all_blocks = []
        has_more = True
        start_cursor = None
        
        while has_more:
            params = {"page_size": 100}
            if start_cursor:
                params["start_cursor"] = start_cursor
            
            result = await self._request(
                "GET",
                f"/blocks/{block_id}/children",
                params=params,
            )
            
            for block in result.get("results", []):
                block["_depth"] = depth
                all_blocks.append(block)
                
                # 如果block有子节点,递归获取
                if block.get("has_children", False):
                    children = await self._get_all_blocks(
                        block["id"], depth + 1, max_depth
                    )
                    all_blocks.extend(children)
            
            has_more = result.get("has_more", False)
            start_cursor = result.get("next_cursor")
        
        return all_blocks
    
    def _block_to_text(self, block: dict) -> str:
        """
        将单个block转换为文本
        
        支持的block类型:
        - paragraph, heading_1/2/3
        - bulleted_list_item, numbered_list_item
        - to_do, toggle, quote, callout
        - code, divider
        - 其他类型返回空字符串(不影响核心功能)
        """
        block_type = block.get("type", "")
        depth = block.get("_depth", 0)
        indent = "  " * depth
        
        # 获取富文本内容
        type_data = block.get(block_type, {})
        rich_text = type_data.get("rich_text", [])
        text = self._rich_text_to_plain(rich_text)
        
        if block_type == "paragraph":
            return f"{indent}{text}" if text else ""
        elif block_type == "heading_1":
            return f"{indent}# {text}"
        elif block_type == "heading_2":
            return f"{indent}## {text}"
        elif block_type == "heading_3":
            return f"{indent}### {text}"
        elif block_type == "bulleted_list_item":
            return f"{indent}- {text}"
        elif block_type == "numbered_list_item":
            return f"{indent}1. {text}"
        elif block_type == "to_do":
            checked = "x" if type_data.get("checked", False) else " "
            return f"{indent}- [{checked}] {text}"
        elif block_type == "toggle":
            return f"{indent}▸ {text}"
        elif block_type == "quote":
            return f"{indent}> {text}"
        elif block_type == "callout":
            icon = ""
            icon_data = type_data.get("icon", {})
            if icon_data.get("type") == "emoji":
                icon = icon_data.get("emoji", "") + " "
            return f"{indent}{icon}{text}"
        elif block_type == "code":
            lang = type_data.get("language", "")
            return f"{indent}```{lang}\n{indent}{text}\n{indent}```"
        elif block_type == "divider":
            return f"{indent}---"
        elif block_type == "table_of_contents":
            return ""  # 目录block不需要搬
        else:
            # 未识别的block类型,如果有文本就保留
            return f"{indent}{text}" if text else ""
    
    def _rich_text_to_plain(self, rich_text_list: list) -> str:
        """
        将Notion富文本数组转换为纯文本
        
        保留基本格式标记(加粗/斜体/代码),
        但不保留颜色等复杂样式(网站侧不需要)。
        """
        parts = []
        for rt in rich_text_list:
            text = rt.get("plain_text", "")
            annotations = rt.get("annotations", {})
            
            if annotations.get("code"):
                text = f"`{text}`"
            if annotations.get("bold"):
                text = f"**{text}**"
            if annotations.get("italic"):
                text = f"*{text}*"
            if annotations.get("strikethrough"):
                text = f"~~{text}~~"
            
            parts.append(text)
        
        return "".join(parts)
    
    # ========== 数据库操作 ==========
    
    async def query_database(
        self,
        database_id: str,
        filter_obj: Optional[dict] = None,
        sorts: Optional[list] = None,
        page_size: int = 100,
    ) -> list:
        """
        查询数据库,返回所有匹配条目
        
        自动处理分页,返回完整结果列表。
        
        Args:
            database_id: 数据库ID
            filter_obj: Notion filter对象
            sorts: 排序规则
            page_size: 每页条目数
            
        Returns:
            数据库条目列表
        """
        database_id = self._normalize_id(database_id)
        logger.info(f"查询数据库: {database_id}")
        
        all_results = []
        has_more = True
        start_cursor = None
        
        while has_more:
            body = {"page_size": page_size}
            if filter_obj:
                body["filter"] = filter_obj
            if sorts:
                body["sorts"] = sorts
            if start_cursor:
                body["start_cursor"] = start_cursor
            
            result = await self._request(
                "POST",
                f"/databases/{database_id}/query",
                json_data=body,
            )
            
            all_results.extend(result.get("results", []))
            has_more = result.get("has_more", False)
            start_cursor = result.get("next_cursor")
        
        return all_results
    
    async def create_database_entry(
        self,
        database_id: str,
        properties: dict,
    ) -> dict:
        """
        在数据库中创建新条目
        
        用于交互记录回写到Notion交互记录数据库。
        
        Args:
            database_id: 目标数据库ID
            properties: 属性字典(Notion properties格式)
            
        Returns:
            创建的页面对象
        """
        database_id = self._normalize_id(database_id)
        logger.info(f"创建数据库条目: {database_id}")
        
        return await self._request(
            "POST",
            "/pages",
            json_data={
                "parent": {"database_id": database_id},
                "properties": properties,
            },
        )
    
    # ========== 页面写入 ==========
    
    async def append_page_content(
        self,
        page_id: str,
        blocks: list,
    ) -> dict:
        """
        向页面追加内容块
        
        Args:
            page_id: 目标页面ID
            blocks: Notion block对象列表
            
        Returns:
            API响应
        """
        page_id = self._normalize_id(page_id)
        logger.info(f"向页面追加内容: {page_id}, {len(blocks)}个block")
        
        return await self._request(
            "PATCH",
            f"/blocks/{page_id}/children",
            json_data={"children": blocks},
        )
    
    # ========== 工具方法 ==========
    
    @staticmethod
    def _normalize_id(raw_id: str) -> str:
        """
        标准化Notion ID格式
        
        Notion ID有时带横线有时不带,URL里也可能包含页面ID。
        统一处理成不带横线的32位hex。
        """
        # 如果是URL,提取ID部分
        if "/" in raw_id:
            raw_id = raw_id.split("/")[-1]
            # URL中的ID可能带查询参数
            if "?" in raw_id:
                raw_id = raw_id.split("?")[0]
            # URL中的ID可能是 title-hex 格式
            if "-" in raw_id and len(raw_id) > 32:
                raw_id = raw_id.split("-")[-1]
        
        # 去掉横线
        return raw_id.replace("-", "")
    
    @staticmethod
    def extract_page_title(page: dict) -> str:
        """
        从页面对象中提取标题
        
        Args:
            page: Notion页面对象
            
        Returns:
            页面标题文本
        """
        properties = page.get("properties", {})
        for prop in properties.values():
            if prop.get("type") == "title":
                title_parts = prop.get("title", [])
                return "".join(
                    t.get("plain_text", "") for t in title_parts
                )
        return "无标题"


class NotionAPIError(Exception):
    """Notion API错误"""
    
    def __init__(
        self,
        status_code: int = 0,
        message: str = "",
        body: Optional[dict] = None,
    ):
        self.status_code = status_code
        self.body = body or {}
        super().__init__(message)

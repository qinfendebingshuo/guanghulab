"""
神笔引擎 · MagicPen Engine · 核心类
语言源代码（Language Source Code）运行时实现

光湖Agent自造工具核心引擎:
  Agent用自然语言描述需求 → 笔尖生成代码 → 笔身热加载 → 笔帽管理生命周期
  不搬海滩，只画沙子。

作者: 译典A05 (5TH-LE-HK-A05)
工单: GH-LSC-001 · Phase-LSC-001
"""

import os
import json
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any, List

from pen_tip import PenTip
from pen_body import PenBody
from pen_cap import PenCap
from sandbox import Sandbox


class MagicPen:
    """
    神笔 · 每个光湖Agent出生自带的工具锻造引擎。
    
    核心能力:
      - write(描述): 笔·写 — 自然语言 → 可执行工具
      - use(名称, **kwargs): 调用工具
      - wear(名称): 笔·穿 — 设为常驻
      - remove(名称): 笔·脱 — 卸载工具
      - register(名称): 笔·注册 — 推到共享仓库
      - borrow(名称): 笔·借 — 从共享仓库加载同伴的工具
      - erase(名称): 笔·格式化 — 彻底删除
    """

    def __init__(
        self,
        agent_name: str,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        tools_base: str = "/guanghu/tools",
        enable_sandbox: bool = True,
    ):
        """
        初始化神笔实例。
        
        Args:
            agent_name: Agent名称（如 "peiyuan", "yidian", "luce"）
            api_key: 通义千问API密钥。若为None则从环境变量/配置文件读取。
            api_base: API基础URL。默认为通义千问OpenAI兼容端点。
            tools_base: 工具存储根目录。
            enable_sandbox: 是否启用安全沙箱。生产环境必须为True。
        """
        self.agent_name = agent_name
        self.tools: Dict[str, Dict[str, Any]] = {}  # 口袋（运行时工具注册表）
        self.enable_sandbox = enable_sandbox

        # 工具目录
        self.tool_dir = os.path.join(tools_base, "self", agent_name)
        self.shared_dir = os.path.join(tools_base, "shared")

        # 解析API密钥
        resolved_key = api_key or self._load_api_key()

        # 初始化三大组件
        self.tip = PenTip(
            api_key=resolved_key,
            api_base=api_base,
        )
        self.body = PenBody()
        self.cap = PenCap(
            agent_name=agent_name,
            tool_dir=self.tool_dir,
            shared_dir=self.shared_dir,
        )
        self.sandbox = Sandbox() if enable_sandbox else None

        # 确保目录存在
        os.makedirs(self.tool_dir, exist_ok=True)
        os.makedirs(self.shared_dir, exist_ok=True)

        # 醒来时穿上常驻工具
        self._load_persistent_tools()

    def _load_api_key(self) -> Optional[str]:
        """从环境变量或配置文件读取API密钥。"""
        # 优先环境变量
        key = os.environ.get("QWEN_API_KEY")
        if key:
            return key

        # 尝试从 /guanghu/config/.env 读取
        env_path = "/guanghu/config/.env"
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("QWEN_API_KEY="):
                            return line.split("=", 1)[1].strip().strip('"').strip("'")
            except (IOError, OSError):
                pass

        return None

    def _load_persistent_tools(self):
        """醒来时自动穿上常驻工具。"""
        loaded = self.cap.load_persistent()
        for name, code in loaded.items():
            try:
                module = self.body.load(code, name)
                self.tools[name] = {
                    "code": code,
                    "module": module,
                    "status": "persist",
                    "created": datetime.now().isoformat(),
                    "author": self.agent_name,
                }
            except Exception as e:
                # 加载失败不影响其他工具
                print(f"[MagicPen] 常驻工具加载失败: {name} - {e}")

    # ─── 笔命令 ─────────────────────────────────────────────

    def write(
        self,
        description: str,
        persist: bool = False,
        name: Optional[str] = None,
    ) -> str:
        """
        笔·写 — 描述需求，生成工具并热加载。
        
        Args:
            description: 自然语言需求描述（如"写一个检查端口占用的函数"）
            persist: 是否设为常驻工具
            name: 指定工具名称。若为None则从生成的代码中提取函数名。
        
        Returns:
            工具名称（str）
        
        Raises:
            ValueError: 代码生成失败
            SecurityError: 代码未通过安全校验
        """
        # 1. 笔尖生成代码
        code = self.tip.generate(description)
        if not code or not code.strip():
            raise ValueError(f"笔尖生成失败: 描述='{description}'")

        # 2. 安全校验
        if self.sandbox:
            is_safe, reason = self.sandbox.check(code, self.agent_name)
            if not is_safe:
                raise PermissionError(f"安全沙箱拒绝: {reason}")

        # 3. 提取/确定工具名
        tool_name = name or self.body.extract_function_name(code)
        if not tool_name:
            raise ValueError("无法从生成代码中提取函数名")

        # 4. 笔身热加载
        module = self.body.load(code, tool_name)

        # 5. 注册到口袋
        status = "persist" if persist else "temp"
        self.tools[tool_name] = {
            "code": code,
            "module": module,
            "status": status,
            "created": datetime.now().isoformat(),
            "author": self.agent_name,
            "description": description,
            "hash": hashlib.md5(code.encode()).hexdigest(),
        }

        # 6. 常驻则保存到磁盘
        if persist:
            self.cap.save(tool_name, code)

        return tool_name

    def use(self, name: str, **kwargs) -> Any:
        """
        调用工具。
        
        Args:
            name: 工具名称
            **kwargs: 传递给工具函数的参数
        
        Returns:
            工具执行结果
        """
        if name not in self.tools:
            raise KeyError(f"口袋里没有这个工具: {name}")

        tool = self.tools[name]
        module = tool["module"]

        # 从模块中获取同名函数并调用
        func = getattr(module, name, None)
        if func is None:
            # 尝试获取模块中第一个callable
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if callable(attr) and not attr_name.startswith("_"):
                    func = attr
                    break

        if func is None:
            raise AttributeError(f"工具 '{name}' 中没有可调用的函数")

        return func(**kwargs)

    def wear(self, name: str) -> None:
        """
        笔·穿 — 将临时工具设为常驻。
        
        Args:
            name: 工具名称
        """
        if name not in self.tools:
            raise KeyError(f"口袋里没有这个工具: {name}")

        self.tools[name]["status"] = "persist"
        self.cap.save(name, self.tools[name]["code"])

    def remove(self, name: str) -> None:
        """
        笔·脱 — 从运行时卸载工具（不删除磁盘文件）。
        
        Args:
            name: 工具名称
        """
        if name not in self.tools:
            raise KeyError(f"口袋里没有这个工具: {name}")

        del self.tools[name]

    def register(self, name: str) -> str:
        """
        笔·注册 — 推到共享仓库，同伴可借。
        
        Args:
            name: 工具名称
        
        Returns:
            共享路径
        """
        if name not in self.tools:
            raise KeyError(f"口袋里没有这个工具: {name}")

        tool = self.tools[name]
        tool["status"] = "shared"
        return self.cap.share(name, tool["code"], tool.get("description", ""))

    def borrow(self, name: str) -> str:
        """
        笔·借 — 从共享仓库加载同伴的工具。
        
        Args:
            name: 工具名称
        
        Returns:
            工具名称
        """
        code = self.cap.load_shared(name)
        if not code:
            raise FileNotFoundError(f"共享仓库里没有这个工具: {name}")

        # 安全校验
        if self.sandbox:
            is_safe, reason = self.sandbox.check(code, self.agent_name)
            if not is_safe:
                raise PermissionError(f"借来的工具未通过安全校验: {reason}")

        module = self.body.load(code, name)
        self.tools[name] = {
            "code": code,
            "module": module,
            "status": "temp",  # 借来的默认临时
            "created": datetime.now().isoformat(),
            "author": "shared",
        }
        return name

    def erase(self, name: str) -> None:
        """
        笔·格式化 — 彻底删除工具（内存+磁盘）。
        
        Args:
            name: 工具名称
        """
        # 从口袋移除
        if name in self.tools:
            del self.tools[name]

        # 从磁盘删除
        self.cap.delete(name)

    # ─── 查询 ─────────────────────────────────────────────

    def list_tools(self) -> List[Dict[str, Any]]:
        """列出口袋里所有工具。"""
        result = []
        for name, tool in self.tools.items():
            result.append({
                "name": name,
                "status": tool.get("status", "unknown"),
                "author": tool.get("author", "unknown"),
                "created": tool.get("created", ""),
                "description": tool.get("description", ""),
                "hash": tool.get("hash", ""),
            })
        return result

    def has_tool(self, name: str) -> bool:
        """检查口袋里是否有指定工具。"""
        return name in self.tools

    def __repr__(self) -> str:
        return (
            f"MagicPen(agent='{self.agent_name}', "
            f"tools={len(self.tools)}, "
            f"sandbox={'on' if self.sandbox else 'off'})"
        )

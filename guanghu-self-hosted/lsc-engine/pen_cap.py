"""
笔帽 · PenCap · 生命周期管理

职责: 管理工具的三种状态和全生命周期。
  - 临时(temp): 仅内存，用完即弃
  - 常驻(persist): 保存到磁盘，醒来自动加载
  - 共享(shared): 推到共享仓库，同伴可借

管理命令: 穿/脱/注册/借/格式化

存储路径:
  - 个人: /guanghu/tools/self/{agent_name}/
  - 共享: /guanghu/tools/shared/

作者: 译典A05 (5TH-LE-HK-A05)
工单: GH-LSC-001
"""

import os
import json
from datetime import datetime
from typing import Dict, Optional


class PenCap:
    """
    笔帽 · 工具生命周期管理器。
    管理工具在 临时/常驻/共享 三种状态之间的流转。
    """

    # 工具元信息文件名后缀
    META_SUFFIX = ".meta.json"

    def __init__(
        self,
        agent_name: str,
        tool_dir: str,
        shared_dir: str,
    ):
        """
        初始化笔帽。
        
        Args:
            agent_name: Agent名称
            tool_dir: 个人工具目录（如 /guanghu/tools/self/peiyuan/）
            shared_dir: 共享工具目录（如 /guanghu/tools/shared/）
        """
        self.agent_name = agent_name
        self.tool_dir = tool_dir
        self.shared_dir = shared_dir

    def save(self, name: str, code: str) -> str:
        """
        保存工具到个人目录（常驻）。
        
        Args:
            name: 工具名称
            code: 工具代码
        
        Returns:
            保存路径
        """
        os.makedirs(self.tool_dir, exist_ok=True)

        # 保存代码
        code_path = os.path.join(self.tool_dir, f"{name}.py")
        with open(code_path, "w", encoding="utf-8") as f:
            f.write(code)

        # 保存元信息
        meta_path = os.path.join(self.tool_dir, f"{name}{self.META_SUFFIX}")
        meta = {
            "name": name,
            "status": "persist",
            "author": self.agent_name,
            "saved_at": datetime.now().isoformat(),
        }
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        return code_path

    def load_persistent(self) -> Dict[str, str]:
        """
        加载个人目录中所有常驻工具。
        
        Returns:
            字典: {工具名: 代码字符串}
        """
        tools = {}
        if not os.path.exists(self.tool_dir):
            return tools

        for filename in os.listdir(self.tool_dir):
            if filename.endswith(".py") and not filename.startswith("_"):
                name = filename[:-3]  # 去掉.py
                filepath = os.path.join(self.tool_dir, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        tools[name] = f.read()
                except (IOError, OSError) as e:
                    print(f"[PenCap] 读取常驻工具失败: {name} - {e}")

        return tools

    def share(self, name: str, code: str, description: str = "") -> str:
        """
        推工具到共享仓库。
        
        Args:
            name: 工具名称
            code: 工具代码
            description: 工具描述
        
        Returns:
            共享路径
        """
        os.makedirs(self.shared_dir, exist_ok=True)

        # 保存代码
        code_path = os.path.join(self.shared_dir, f"{name}.py")
        with open(code_path, "w", encoding="utf-8") as f:
            f.write(code)

        # 保存元信息
        meta_path = os.path.join(self.shared_dir, f"{name}{self.META_SUFFIX}")
        meta = {
            "name": name,
            "status": "shared",
            "author": self.agent_name,
            "description": description,
            "shared_at": datetime.now().isoformat(),
        }
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        return code_path

    def load_shared(self, name: str) -> Optional[str]:
        """
        从共享仓库加载工具代码。
        
        Args:
            name: 工具名称
        
        Returns:
            代码字符串，若不存在则返回None
        """
        code_path = os.path.join(self.shared_dir, f"{name}.py")
        if not os.path.exists(code_path):
            return None

        try:
            with open(code_path, "r", encoding="utf-8") as f:
                return f.read()
        except (IOError, OSError):
            return None

    def delete(self, name: str) -> bool:
        """
        彻底删除工具（个人目录+共享目录）。
        
        Args:
            name: 工具名称
        
        Returns:
            是否删除了任何文件
        """
        deleted = False

        # 删除个人目录中的文件
        for ext in [".py", self.META_SUFFIX]:
            path = os.path.join(self.tool_dir, f"{name}{ext}")
            if os.path.exists(path):
                os.remove(path)
                deleted = True

        # 不删除共享目录（共享的工具属于大家）
        # 如果确实需要从共享目录删除，需要额外的delete_shared方法

        return deleted

    def list_shared(self) -> list:
        """
        列出共享仓库中所有可用工具。
        
        Returns:
            工具信息列表
        """
        tools = []
        if not os.path.exists(self.shared_dir):
            return tools

        for filename in os.listdir(self.shared_dir):
            if filename.endswith(".py") and not filename.startswith("_"):
                name = filename[:-3]
                meta_path = os.path.join(self.shared_dir, f"{name}{self.META_SUFFIX}")
                meta = {"name": name}
                if os.path.exists(meta_path):
                    try:
                        with open(meta_path, "r", encoding="utf-8") as f:
                            meta = json.load(f)
                    except (json.JSONDecodeError, IOError):
                        pass
                tools.append(meta)

        return tools

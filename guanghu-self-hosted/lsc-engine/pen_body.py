"""
笔身 · PenBody · 动态执行引擎

职责: 将生成的代码字符串热加载到Agent运行时，变成可调用的Python模块。

技术:
  - Python内置 exec() 执行代码
  - Python标准库 types.ModuleType 创建动态模块
  - 零依赖，Python自带
  - 毫秒级热加载

作者: 译典A05 (5TH-LE-HK-A05)
工单: GH-LSC-001
"""

import re
import sys
import types
from typing import Optional


class PenBody:
    """
    笔身 · 动态执行引擎。
    将代码字符串编译为Python模块并加载到运行时。
    """

    # 模块名前缀（避免与系统模块冲突）
    MODULE_PREFIX = "magicpen_tool_"

    def load(self, code: str, name: str) -> types.ModuleType:
        """
        将代码字符串热加载为Python模块。
        
        Args:
            code: Python代码字符串
            name: 模块/工具名称
        
        Returns:
            加载后的Python模块对象
        
        Raises:
            SyntaxError: 代码语法错误
            RuntimeError: 代码执行时错误
        """
        module_name = f"{self.MODULE_PREFIX}{name}"

        # 创建新模块
        module = types.ModuleType(module_name)
        module.__file__ = f"<magicpen:{name}>"
        module.__loader__ = None

        # 提供安全的内置环境
        module.__builtins__ = __builtins__

        try:
            # 编译（先检查语法）
            compiled = compile(code, f"<magicpen:{name}>", "exec")
            # 执行到模块命名空间
            exec(compiled, module.__dict__)
        except SyntaxError as e:
            raise SyntaxError(
                f"工具 '{name}' 代码语法错误: {e}"
            ) from e
        except Exception as e:
            raise RuntimeError(
                f"工具 '{name}' 加载执行失败: {e}"
            ) from e

        # 注册到sys.modules（可选，方便import引用）
        sys.modules[module_name] = module

        return module

    def unload(self, name: str) -> bool:
        """
        从运行时卸载指定工具模块。
        
        Args:
            name: 工具名称
        
        Returns:
            是否成功卸载
        """
        module_name = f"{self.MODULE_PREFIX}{name}"
        if module_name in sys.modules:
            del sys.modules[module_name]
            return True
        return False

    @staticmethod
    def extract_function_name(code: str) -> Optional[str]:
        """
        从代码中提取第一个顶层函数名。
        
        Args:
            code: Python代码字符串
        
        Returns:
            函数名，若未找到则返回None
        """
        # 匹配顶层 def 语句（不缩进的）
        pattern = r"^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\("
        match = re.search(pattern, code, re.MULTILINE)
        if match:
            return match.group(1)
        return None

    @staticmethod
    def list_functions(code: str) -> list:
        """
        列出代码中所有顶层函数名。
        
        Args:
            code: Python代码字符串
        
        Returns:
            函数名列表
        """
        pattern = r"^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\("
        return re.findall(pattern, code, re.MULTILINE)

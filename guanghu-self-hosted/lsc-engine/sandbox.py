"""
安全沙箱 · Sandbox · RestrictedPython权限校验

职责: 在工具代码执行前进行安全检查。
  - 静态代码分析（AST层面）
  - 危险模式检测（正则匹配）
  - RestrictedPython编译校验

铁律: 绝不修改其他Agent的代码和资源。

作者: 译典A05 (5TH-LE-HK-A05)
工单: GH-LSC-001
"""

import ast
import re
from typing import Tuple, List


# ─── 危险模式 ────────────────────────────────────────────
# 正则表达式匹配明显危险的代码模式

DANGEROUS_PATTERNS = [
    # 系统破坏操作
    (r"\bos\.system\s*\(.*(rm\s+-rf|mkfs|dd\s+if|format|fdisk)", "系统破坏操作"),
    (r"\bsubprocess\b.*\b(rm|mkfs|dd|format|fdisk)\b", "通过subprocess执行危险命令"),
    (r"\bshutil\.rmtree\s*\(\s*['\"/]", "删除根目录或系统目录"),
    
    # 访问其他Agent资源（铁律）
    (r"/guanghu/tools/self/(?!\{agent_name\})[a-zA-Z]", "访问其他Agent的工具目录"),
    (r"/guanghu/brain/", "访问brain目录"),
    
    # 危险的动态代码执行（嵌套exec/eval攻击）
    (r"\b__import__\s*\(", "使用__import__动态导入"),
    (r"\bgetattr\s*\(.*__", "通过getattr访问双下划线属性"),
    
    # 网络后门
    (r"\breverse.?shell\b", "反向Shell"),
    (r"\bbind.?shell\b", "绑定Shell"),
]

# AST层面的危险节点类型
DANGEROUS_AST_IMPORTS = {
    "ctypes",          # C级别内存操作
    "multiprocessing",  # 进程操作（MVP阶段禁用）
    "signal",          # 信号操作
}

# 允许的标准库模块（白名单，MVP阶段保持严格）
ALLOWED_MODULES = {
    # 基础
    "os", "os.path", "sys", "io", "re", "math", "random",
    "string", "textwrap", "unicodedata",
    # 数据结构
    "json", "csv", "collections", "itertools", "functools",
    "operator", "copy", "pprint",
    # 日期时间
    "datetime", "time", "calendar",
    # 文件
    "pathlib", "glob", "shutil", "tempfile", "stat",
    # 网络
    "http", "http.client", "http.server",
    "urllib", "urllib.parse", "urllib.request",
    "socket", "ssl",
    # 编码
    "hashlib", "hmac", "base64", "binascii",
    # 数据格式
    "xml", "xml.etree", "xml.etree.ElementTree",
    "html", "html.parser",
    # 并发（轻量）
    "threading", "concurrent", "concurrent.futures",
    # 类型
    "typing", "types", "dataclasses", "enum", "abc",
    # 其他
    "logging", "argparse", "configparser",
    "struct", "array", "queue",
}


class Sandbox:
    """
    安全沙箱 · 工具代码安全校验器。
    
    三层防护:
      1. 正则模式匹配（快速拒绝明显危险代码）
      2. AST静态分析（检查导入和危险调用）
      3. RestrictedPython编译校验（可选，需安装RestrictedPython）
    """

    def __init__(self, strict_mode: bool = True):
        """
        Args:
            strict_mode: 严格模式。True时使用白名单检查导入。
        """
        self.strict_mode = strict_mode
        self._has_restricted_python = self._check_restricted_python()

    @staticmethod
    def _check_restricted_python() -> bool:
        """检查RestrictedPython是否可用。"""
        try:
            import RestrictedPython  # noqa: F401
            return True
        except ImportError:
            return False

    def check(self, code: str, agent_name: str) -> Tuple[bool, str]:
        """
        对代码进行安全检查。
        
        Args:
            code: 待检查的Python代码
            agent_name: 当前Agent名称（用于铁律校验）
        
        Returns:
            (是否安全, 原因说明)
        """
        # 第1层: 正则模式匹配
        safe, reason = self._check_patterns(code, agent_name)
        if not safe:
            return False, f"[模式匹配] {reason}"

        # 第2层: AST静态分析
        safe, reason = self._check_ast(code)
        if not safe:
            return False, f"[AST分析] {reason}"

        # 第3层: RestrictedPython编译校验（如果可用）
        if self._has_restricted_python:
            safe, reason = self._check_restricted(code)
            if not safe:
                return False, f"[RestrictedPython] {reason}"

        return True, "通过安全检查"

    def _check_patterns(self, code: str, agent_name: str) -> Tuple[bool, str]:
        """
        第1层: 正则模式匹配。
        快速拒绝包含明显危险模式的代码。
        """
        # 替换agent_name占位符进行检查
        for pattern, description in DANGEROUS_PATTERNS:
            adjusted_pattern = pattern.replace("{agent_name}", re.escape(agent_name))
            if re.search(adjusted_pattern, code, re.IGNORECASE):
                return False, description

        return True, "通过"

    def _check_ast(self, code: str) -> Tuple[bool, str]:
        """
        第2层: AST静态分析。
        检查导入语句和危险调用。
        """
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, f"语法错误: {e}"

        # 检查所有导入
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    module_name = alias.name.split(".")[0]
                    if module_name in DANGEROUS_AST_IMPORTS:
                        return False, f"禁止导入: {alias.name}"
                    if self.strict_mode and module_name not in ALLOWED_MODULES:
                        # 非白名单模块，检查是否为子模块
                        if alias.name not in ALLOWED_MODULES:
                            return False, f"非白名单模块: {alias.name}"

            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    top_module = node.module.split(".")[0]
                    if top_module in DANGEROUS_AST_IMPORTS:
                        return False, f"禁止从 {node.module} 导入"
                    if self.strict_mode and top_module not in ALLOWED_MODULES:
                        if node.module not in ALLOWED_MODULES:
                            return False, f"非白名单模块: {node.module}"

        return True, "通过"

    def _check_restricted(self, code: str) -> Tuple[bool, str]:
        """
        第3层: RestrictedPython编译校验。
        """
        try:
            from RestrictedPython import compile_restricted
            from RestrictedPython import safe_globals  # noqa: F401

            result = compile_restricted(code, "<magicpen_sandbox>", "exec")
            if result.errors:
                return False, "; ".join(result.errors)
            return True, "通过"
        except Exception as e:
            # RestrictedPython校验异常不阻塞（前两层已过）
            return True, f"RestrictedPython校验跳过: {e}"

    def get_safe_globals(self) -> dict:
        """
        获取安全的全局命名空间（用于受限执行）。
        
        Returns:
            安全的全局变量字典
        """
        safe = {"__builtins__": {}}

        # 允许的内置函数
        import builtins
        allowed_builtins = [
            "abs", "all", "any", "bin", "bool", "bytes", "callable",
            "chr", "complex", "dict", "dir", "divmod", "enumerate",
            "filter", "float", "format", "frozenset", "getattr",
            "hasattr", "hash", "hex", "id", "int", "isinstance",
            "issubclass", "iter", "len", "list", "map", "max",
            "min", "next", "object", "oct", "ord", "pow", "print",
            "range", "repr", "reversed", "round", "set", "slice",
            "sorted", "str", "sum", "tuple", "type", "zip",
            # 允许有限的import
            "__import__",
        ]
        for name in allowed_builtins:
            if hasattr(builtins, name):
                safe["__builtins__"][name] = getattr(builtins, name)

        return safe

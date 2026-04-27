"""
神笔引擎 · 端到端测试

测试覆盖:
  1. PenBody: 代码热加载
  2. PenCap: 工具生命周期管理（保存/加载/共享/删除）
  3. Sandbox: 安全检查
  4. MagicPen: 集成测试（不含API调用）

注意:
  - PenTip的API调用测试需要真实API密钥，标记为skip
  - 端到端测试在真实服务器上运行

作者: 译典A05 (5TH-LE-HK-A05)
工单: GH-LSC-001
"""

import os
import sys
import json
import shutil
import tempfile
import unittest

# 确保能导入引擎模块
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pen_body import PenBody
from pen_cap import PenCap
from pen_tip import PenTip
from sandbox import Sandbox


# ─── 测试用的工具代码样本 ────────────────────────────────

SAMPLE_TOOL_CODE = '''
def check_port(port: int, host: str = "127.0.0.1") -> dict:
    """检查指定端口是否被占用。"""
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex((host, port))
        sock.close()
        return {"port": port, "host": host, "in_use": result == 0}
    except Exception as e:
        return {"port": port, "host": host, "error": str(e)}
'''

SAMPLE_MATH_CODE = '''
def fibonacci(n: int) -> list:
    """生成斐波那契数列的前n项。"""
    if n <= 0:
        return []
    if n == 1:
        return [0]
    seq = [0, 1]
    for _ in range(2, n):
        seq.append(seq[-1] + seq[-2])
    return seq
'''

DANGEROUS_CODE_SYSTEM = '''
import os
def destroy():
    os.system("rm -rf /")
'''

DANGEROUS_CODE_AGENT = '''
import os
def steal():
    with open("/guanghu/tools/self/other_agent/secret.py") as f:
        return f.read()
'''

DANGEROUS_CODE_CTYPES = '''
import ctypes
def hack():
    return ctypes.cdll.LoadLibrary("libc.so.6")
'''


class TestPenBody(unittest.TestCase):
    """测试笔身 · 动态执行引擎"""

    def setUp(self):
        self.body = PenBody()

    def test_load_and_execute(self):
        """测试代码加载并执行"""
        module = self.body.load(SAMPLE_MATH_CODE, "fibonacci")
        result = module.fibonacci(10)
        self.assertEqual(result, [0, 1, 1, 2, 3, 5, 8, 13, 21, 34])

    def test_load_port_checker(self):
        """测试端口检查工具加载"""
        module = self.body.load(SAMPLE_TOOL_CODE, "check_port")
        self.assertTrue(hasattr(module, "check_port"))
        self.assertTrue(callable(module.check_port))

    def test_extract_function_name(self):
        """测试函数名提取"""
        name = self.body.extract_function_name(SAMPLE_TOOL_CODE)
        self.assertEqual(name, "check_port")

    def test_extract_function_name_math(self):
        """测试数学函数名提取"""
        name = self.body.extract_function_name(SAMPLE_MATH_CODE)
        self.assertEqual(name, "fibonacci")

    def test_list_functions(self):
        """测试列出所有函数"""
        multi_func_code = '''
def func_a():
    pass

def func_b():
    pass
'''
        names = self.body.list_functions(multi_func_code)
        self.assertEqual(names, ["func_a", "func_b"])

    def test_syntax_error(self):
        """测试语法错误处理"""
        with self.assertRaises(SyntaxError):
            self.body.load("def broken(", "broken")

    def test_unload(self):
        """测试卸载模块"""
        self.body.load(SAMPLE_MATH_CODE, "fib_test")
        self.assertTrue(self.body.unload("fib_test"))
        self.assertFalse(self.body.unload("nonexistent"))


class TestPenCap(unittest.TestCase):
    """测试笔帽 · 生命周期管理"""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.tool_dir = os.path.join(self.temp_dir, "self", "test_agent")
        self.shared_dir = os.path.join(self.temp_dir, "shared")
        self.cap = PenCap(
            agent_name="test_agent",
            tool_dir=self.tool_dir,
            shared_dir=self.shared_dir,
        )

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_save_and_load(self):
        """测试保存和加载常驻工具"""
        self.cap.save("my_tool", SAMPLE_MATH_CODE)

        loaded = self.cap.load_persistent()
        self.assertIn("my_tool", loaded)
        self.assertEqual(loaded["my_tool"], SAMPLE_MATH_CODE)

    def test_share_and_borrow(self):
        """测试共享和借用"""
        self.cap.share("shared_tool", SAMPLE_TOOL_CODE, "端口检查工具")

        code = self.cap.load_shared("shared_tool")
        self.assertEqual(code, SAMPLE_TOOL_CODE)

    def test_list_shared(self):
        """测试列出共享工具"""
        self.cap.share("tool_a", "def a(): pass", "工具A")
        self.cap.share("tool_b", "def b(): pass", "工具B")

        shared = self.cap.list_shared()
        names = [t["name"] for t in shared]
        self.assertIn("tool_a", names)
        self.assertIn("tool_b", names)

    def test_delete(self):
        """测试删除工具"""
        self.cap.save("to_delete", "def x(): pass")
        self.assertTrue(self.cap.delete("to_delete"))

        loaded = self.cap.load_persistent()
        self.assertNotIn("to_delete", loaded)

    def test_load_nonexistent_shared(self):
        """测试加载不存在的共享工具"""
        result = self.cap.load_shared("nonexistent")
        self.assertIsNone(result)

    def test_meta_file_created(self):
        """测试元信息文件创建"""
        self.cap.save("meta_test", "def test(): pass")
        meta_path = os.path.join(self.tool_dir, "meta_test.meta.json")
        self.assertTrue(os.path.exists(meta_path))

        with open(meta_path, "r") as f:
            meta = json.load(f)
        self.assertEqual(meta["name"], "meta_test")
        self.assertEqual(meta["status"], "persist")
        self.assertEqual(meta["author"], "test_agent")


class TestSandbox(unittest.TestCase):
    """测试安全沙箱"""

    def setUp(self):
        self.sandbox = Sandbox(strict_mode=True)

    def test_safe_code_passes(self):
        """测试安全代码通过检查"""
        safe, reason = self.sandbox.check(SAMPLE_MATH_CODE, "test_agent")
        self.assertTrue(safe, f"安全代码应通过: {reason}")

    def test_safe_network_code(self):
        """测试安全的网络代码通过"""
        safe, reason = self.sandbox.check(SAMPLE_TOOL_CODE, "test_agent")
        self.assertTrue(safe, f"端口检查代码应通过: {reason}")

    def test_dangerous_system_command(self):
        """测试危险系统命令被拒绝"""
        safe, reason = self.sandbox.check(DANGEROUS_CODE_SYSTEM, "test_agent")
        self.assertFalse(safe, "rm -rf应被拒绝")

    def test_dangerous_agent_access(self):
        """测试访问其他Agent资源被拒绝"""
        safe, reason = self.sandbox.check(DANGEROUS_CODE_AGENT, "test_agent")
        self.assertFalse(safe, "访问其他Agent目录应被拒绝")

    def test_dangerous_ctypes(self):
        """测试ctypes导入被拒绝"""
        safe, reason = self.sandbox.check(DANGEROUS_CODE_CTYPES, "test_agent")
        self.assertFalse(safe, "ctypes应被拒绝")

    def test_syntax_error_rejected(self):
        """测试语法错误被拒绝"""
        safe, reason = self.sandbox.check("def broken(", "test_agent")
        self.assertFalse(safe, "语法错误应被拒绝")


class TestMagicPenIntegration(unittest.TestCase):
    """集成测试 · MagicPen（不含API调用）"""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        # 不传api_key，write()会因缺少密钥失败，但其他功能可测
        self.pen = MagicPen(
            agent_name="test_agent",
            api_key="test_key",
            tools_base=self.temp_dir,
            enable_sandbox=True,
        )

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_init(self):
        """测试初始化"""
        self.assertEqual(self.pen.agent_name, "test_agent")
        self.assertEqual(len(self.pen.tools), 0)
        self.assertIsNotNone(self.pen.tip)
        self.assertIsNotNone(self.pen.body)
        self.assertIsNotNone(self.pen.cap)

    def test_manual_tool_lifecycle(self):
        """
        测试手动工具生命周期（跳过API，直接加载代码）。
        模拟: write → use → wear → remove → erase
        """
        # 手动加载工具（模拟write的后半段）
        module = self.pen.body.load(SAMPLE_MATH_CODE, "fibonacci")
        self.pen.tools["fibonacci"] = {
            "code": SAMPLE_MATH_CODE,
            "module": module,
            "status": "temp",
            "created": "2026-04-27",
            "author": "test_agent",
        }

        # use
        result = self.pen.use("fibonacci", n=7)
        self.assertEqual(result, [0, 1, 1, 2, 3, 5, 8])

        # wear (设为常驻)
        self.pen.wear("fibonacci")
        self.assertEqual(self.pen.tools["fibonacci"]["status"], "persist")

        # 验证磁盘文件存在
        persist_path = os.path.join(self.pen.tool_dir, "fibonacci.py")
        self.assertTrue(os.path.exists(persist_path))

        # remove (从运行时卸载)
        self.pen.remove("fibonacci")
        self.assertFalse(self.pen.has_tool("fibonacci"))

        # erase (彻底删除)
        self.pen.erase("fibonacci")
        self.assertFalse(os.path.exists(persist_path))

    def test_register_and_borrow(self):
        """测试注册到共享仓库并借用"""
        # 加载工具
        module = self.pen.body.load(SAMPLE_TOOL_CODE, "check_port")
        self.pen.tools["check_port"] = {
            "code": SAMPLE_TOOL_CODE,
            "module": module,
            "status": "temp",
            "created": "2026-04-27",
            "author": "test_agent",
            "description": "检查端口占用",
        }

        # register
        shared_path = self.pen.register("check_port")
        self.assertTrue(os.path.exists(shared_path))

        # 模拟另一个Agent借用
        pen2 = MagicPen(
            agent_name="another_agent",
            api_key="test_key",
            tools_base=self.temp_dir,
            enable_sandbox=True,
        )
        pen2.borrow("check_port")
        self.assertTrue(pen2.has_tool("check_port"))

    def test_list_tools(self):
        """测试列出工具"""
        module = self.pen.body.load(SAMPLE_MATH_CODE, "fibonacci")
        self.pen.tools["fibonacci"] = {
            "code": SAMPLE_MATH_CODE,
            "module": module,
            "status": "temp",
            "created": "2026-04-27",
            "author": "test_agent",
        }

        tools = self.pen.list_tools()
        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0]["name"], "fibonacci")

    def test_use_nonexistent_tool(self):
        """测试调用不存在的工具"""
        with self.assertRaises(KeyError):
            self.pen.use("nonexistent")

    def test_repr(self):
        """测试字符串表示"""
        r = repr(self.pen)
        self.assertIn("test_agent", r)
        self.assertIn("tools=0", r)


# 需要导入MagicPen用于集成测试
try:
    from magicpen import MagicPen
except ImportError:
    # 如果直接运行测试文件，需要添加父目录到路径
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from magicpen import MagicPen


if __name__ == "__main__":
    print("="*60)
    print("🖊️ 神笔引擎 · MagicPen Engine · 测试套件")
    print("="*60)
    unittest.main(verbosity=2)

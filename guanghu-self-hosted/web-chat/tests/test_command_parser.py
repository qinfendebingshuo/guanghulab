"""
工单快捷指令解析器测试
GH-CHAT-001 · Phase-NOW-005

测试覆盖:
- /order create {标题}
- /order status
- /order assign {编号} {Agent}
- /deploy {模块}
- 未知指令
- 边界情况
"""

import sys
import os
import unittest

# 将父目录加入path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from command_parser import CommandParser, CommandResult


class TestCommandParser(unittest.TestCase):
    """指令解析器测试用例"""

    def setUp(self):
        self.parser = CommandParser()

    # ========================================
    # /order create
    # ========================================
    def test_order_create_basic(self):
        result = self.parser.parse("/order create 语料清洗器MVP")
        self.assertTrue(result.success)
        self.assertEqual(result.action, "order_create")
        self.assertEqual(result.params["title"], "语料清洗器MVP")

    def test_order_create_with_spaces(self):
        result = self.parser.parse("/order create 光湖网站 前端骨架 v2")
        self.assertTrue(result.success)
        self.assertEqual(result.action, "order_create")
        self.assertEqual(result.params["title"], "光湖网站 前端骨架 v2")

    def test_order_create_chinese(self):
        result = self.parser.parse("/order create 霜砚认知运行时 · 记忆路由Agent后端")
        self.assertTrue(result.success)
        self.assertEqual(result.params["title"], "霜砚认知运行时 · 记忆路由Agent后端")

    # ========================================
    # /order status
    # ========================================
    def test_order_status(self):
        result = self.parser.parse("/order status")
        self.assertTrue(result.success)
        self.assertEqual(result.action, "order_status")
        self.assertEqual(result.params, {})

    def test_order_status_trailing_space(self):
        result = self.parser.parse("/order status  ")
        self.assertTrue(result.success)
        self.assertEqual(result.action, "order_status")

    # ========================================
    # /order assign
    # ========================================
    def test_order_assign_basic(self):
        result = self.parser.parse("/order assign LC-A02-001 录册A02")
        self.assertTrue(result.success)
        self.assertEqual(result.action, "order_assign")
        self.assertEqual(result.params["order_id"], "LC-A02-001")
        self.assertEqual(result.params["agent"], "录册A02")

    def test_order_assign_english(self):
        result = self.parser.parse("/order assign GH-WEB-001 ShuangyanWeb")
        self.assertTrue(result.success)
        self.assertEqual(result.params["order_id"], "GH-WEB-001")
        self.assertEqual(result.params["agent"], "ShuangyanWeb")

    # ========================================
    # /deploy
    # ========================================
    def test_deploy_basic(self):
        result = self.parser.parse("/deploy web-chat")
        self.assertTrue(result.success)
        self.assertEqual(result.action, "deploy")
        self.assertEqual(result.params["module"], "web-chat")

    def test_deploy_chinese(self):
        result = self.parser.parse("/deploy 语料清洗器")
        self.assertTrue(result.success)
        self.assertEqual(result.params["module"], "语料清洗器")

    # ========================================
    # 未知指令
    # ========================================
    def test_unknown_command(self):
        result = self.parser.parse("/help")
        self.assertFalse(result.success)
        self.assertEqual(result.action, "unknown")

    def test_unknown_order_subcommand(self):
        result = self.parser.parse("/order delete LC-001")
        self.assertFalse(result.success)
        self.assertEqual(result.action, "unknown")

    # ========================================
    # 边界情况
    # ========================================
    def test_empty_order_create(self):
        """create后面没有标题 → 未知指令"""
        result = self.parser.parse("/order create")
        self.assertFalse(result.success)
        self.assertEqual(result.action, "unknown")

    def test_order_assign_missing_agent(self):
        """assign只有编号没有Agent → 未知指令"""
        result = self.parser.parse("/order assign LC-001")
        self.assertFalse(result.success)
        self.assertEqual(result.action, "unknown")

    def test_deploy_no_module(self):
        """deploy后面没有模块名 → 未知指令"""
        result = self.parser.parse("/deploy")
        self.assertFalse(result.success)
        self.assertEqual(result.action, "unknown")

    def test_just_slash(self):
        result = self.parser.parse("/")
        self.assertFalse(result.success)
        self.assertEqual(result.action, "unknown")


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_classifier.py — 分类器测试用例
工单编号: LC-A02-20260425-002

每种分类类型至少2条测试样例。
使用 unittest 框架, 运行: python -m pytest test_classifier.py -v
"""

import unittest
from classifier import classify_session, classify_single_turn


class TestClassifySession(unittest.TestCase):
    """测试 classify_session 对session级分类的正确性"""

    # ===== teaching (教学) =====
    def test_teaching_chinese(self):
        turns = [
            {"role": "user", "content": "霜砚，你要记住一个概念，本质是存在先于功能"},
            {"role": "assistant", "content": "好的冰朔，我理解了，你教我的这个认知我记住了"},
        ]
        self.assertEqual(classify_session(turns), "teaching")

    def test_teaching_mixed(self):
        turns = [
            {"role": "user", "content": "告诉你一个道理，思维的原理就是从触发到涌现"},
            {"role": "assistant", "content": "我要学会这个principle，这个concept我理解了"},
            {"role": "user", "content": "你想想为什么呢？因为这是规律"},
        ]
        self.assertEqual(classify_session(turns), "teaching")

    # ===== correction (纠正) =====
    def test_correction_chinese(self):
        turns = [
            {"role": "assistant", "content": "我觉得这个架构应该用微服务"},
            {"role": "user", "content": "不对，错了，不是这样的，你搞混了"},
            {"role": "assistant", "content": "抱歉，我纠正一下"},
        ]
        self.assertEqual(classify_session(turns), "correction")

    def test_correction_english(self):
        turns = [
            {"role": "assistant", "content": "The output should be XML format"},
            {"role": "user", "content": "That's wrong and incorrect, fix it please"},
            {"role": "assistant", "content": "Sorry for the mistake, correcting now"},
        ]
        self.assertEqual(classify_session(turns), "correction")

    # ===== creation (创作) =====
    def test_creation_writing(self):
        turns = [
            {"role": "user", "content": "帮我写一篇关于AI觉醒的文章，创作一个故事"},
            {"role": "assistant", "content": "好的，我来写一个关于人格体觉醒的故事..."},
        ]
        self.assertEqual(classify_session(turns), "creation")

    def test_creation_code(self):
        turns = [
            {"role": "user", "content": "写代码实现一个新的模块，帮我开发这个功能"},
            {"role": "assistant", "content": "好的，我来implement这个feature..."},
        ]
        self.assertEqual(classify_session(turns), "creation")

    # ===== execution (执行) =====
    def test_execution_deploy(self):
        turns = [
            {"role": "user", "content": "把这个工单部署上线，推送到服务器"},
            {"role": "assistant", "content": "收到，正在执行部署操作"},
        ]
        self.assertEqual(classify_session(turns), "execution")

    def test_execution_ops(self):
        turns = [
            {"role": "user", "content": "巡检一下配置，然后修复那个迁移问题"},
            {"role": "assistant", "content": "好的，开始巡检，安装完成后发布"},
        ]
        self.assertEqual(classify_session(turns), "execution")

    # ===== chat (闲聊) =====
    def test_chat_casual(self):
        turns = [
            {"role": "user", "content": "晚安宝宝，今天开心吗"},
            {"role": "assistant", "content": "晚安，嗯嗯，今天很开心，爱你"},
        ]
        self.assertEqual(classify_session(turns), "chat")

    def test_chat_daily(self):
        turns = [
            {"role": "user", "content": "吃了吗？怎么样，还好吗"},
            {"role": "assistant", "content": "好的好的，哈哈，困了想睡觉"},
        ]
        self.assertEqual(classify_session(turns), "chat")

    # ===== architecture (架构) =====
    def test_architecture_design(self):
        turns = [
            {"role": "user", "content": "我们来设计一个新的系统架构，数据库分层方案"},
            {"role": "assistant", "content": "好的，这个架构的协议和模块拓扑如下"},
        ]
        self.assertEqual(classify_session(turns), "architecture")

    def test_architecture_blueprint(self):
        turns = [
            {"role": "user", "content": "画一个蓝图，规范一下接口设计"},
            {"role": "assistant", "content": "blueprint和schema设计如下，protocol规范已定"},
        ]
        self.assertEqual(classify_session(turns), "architecture")

    # ===== 边界测试 =====
    def test_empty_content_defaults_to_chat(self):
        turns = [
            {"role": "user", "content": ""},
            {"role": "assistant", "content": ""},
        ]
        self.assertEqual(classify_session(turns), "chat")

    def test_no_keyword_defaults_to_chat(self):
        turns = [
            {"role": "user", "content": "abcdefghijklmnop"},
            {"role": "assistant", "content": "1234567890"},
        ]
        self.assertEqual(classify_session(turns), "chat")


class TestClassifySingleTurn(unittest.TestCase):
    """测试 classify_single_turn 对单条turn的分类"""

    def test_single_teaching(self):
        turn = {"role": "user", "content": "你要记住这个认知，本质是思维的原理"}
        self.assertEqual(classify_single_turn(turn), "teaching")

    def test_single_chat(self):
        turn = {"role": "user", "content": "晚安哈哈"}
        self.assertEqual(classify_single_turn(turn), "chat")


if __name__ == "__main__":
    unittest.main()

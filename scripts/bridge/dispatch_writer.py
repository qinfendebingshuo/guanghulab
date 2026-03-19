import os
import sys
import requests
import json
from datetime import datetime, timezone, timedelta

NOTION_API_KEY = os.environ.get('NOTION_API_KEY')
DISPATCH_DB_ID = os.environ.get('NOTION_DISPATCH_DB_ID')
NOTION_API_URL = 'https://api.notion.com/v1/pages'

def create_dispatch_page(fields):
    """在Notion调度队列数据库中创建一条新记录"""
    if not NOTION_API_KEY:
        print('ERROR: NOTION_API_KEY not set in environment')
        sys.exit(1)
    if not DISPATCH_DB_ID:
        print('ERROR: NOTION_DISPATCH_DB_ID not set in environment')
        sys.exit(1)

    now_cst = datetime.now(timezone(timedelta(hours=8)))

    properties = {
        "任务名称": {
            "title": [{"text": {"content": fields.get("task_name", "SYSLOG-AUTO")}}]
        },
        "类型": {
            "select": {"name": fields.get("type", "SYSLOG_RECEIVED")}
        },
        "DEV编号": {
            "rich_text": [{"text": {"content": fields.get("dev_id", "")}}]
        },
        "人格体编号": {
            "rich_text": [{"text": {"content": fields.get("persona_id", "")}}]
        },
        "广播编号": {
            "rich_text": [{"text": {"content": fields.get("broadcast_id", "")}}]
        },
        "来源渠道": {
            "select": {"name": fields.get("source_channel", "direct")}
        },
        "处理状态": {
            "status": {"name": "待处理"}
        },
        "Payload": {
            "rich_text": [{"text": {"content": fields.get("payload", "{}")[:2000]}}]
        },
        "提交时间": {
            "rich_text": [{"text": {"content": now_cst.strftime("%Y-%m-%d %H:%M CST")}}]
        }
    }

    payload = {
        "parent": {"database_id": DISPATCH_DB_ID},
        "properties": properties
    }

    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }

    response = requests.post(NOTION_API_URL, headers=headers, json=payload)

    if response.status_code == 200:
        page_id = response.json()['id']
        print(f'OK dispatch_page_created id={page_id}')
        return page_id
    else:
        print(f'ERROR notion_api status={response.status_code}')
        print(response.text)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            fields = json.load(f)
    else:
        fields = json.load(sys.stdin)

    create_dispatch_page(fields)

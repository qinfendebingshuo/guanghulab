import json
import sys

def parse_syslog(raw_payload):
    """解析来自各IM渠道的SYSLOG原始数据"""
    if isinstance(raw_payload, str):
        data = json.loads(raw_payload)
    else:
        data = raw_payload

    if 'event' in data:
        content = data['event'].get('message', {}).get('content', '{}')
        syslog_text = json.loads(content).get('text', '')
    elif 'text' in data and isinstance(data['text'], dict):
        syslog_text = data['text'].get('content', '')
    elif 'Content' in data:
        syslog_text = data['Content']
    else:
        syslog_text = json.dumps(data)

    try:
        cleaned = syslog_text.strip()
        if cleaned.startswith('```'):
            lines = cleaned.split('\n')
            cleaned = '\n'.join(lines[1:-1])
        syslog = json.loads(cleaned)
    except (json.JSONDecodeError, TypeError):
        syslog = {
            "header": {"raw_text": str(syslog_text)[:500]},
            "parse_error": True
        }
    return syslog

def extract_dispatch_fields(syslog):
    header = syslog.get('header', {})
    persona = syslog.get('persona', {})
    return {
        "task_name": header.get('broadcast_id', 'SYSLOG-AUTO'),
        "type": "SYSLOG_RECEIVED",
        "dev_id": header.get('dev_id', ''),
        "persona_id": persona.get('persona_id', ''),
        "broadcast_id": header.get('broadcast_id', ''),
        "source_channel": header.get('source_channel', 'direct'),
        "status": "待处理",
        "payload": json.dumps(syslog, ensure_ascii=False, indent=2)
    }

if __name__ == '__main__':
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            raw = json.load(f)
    else:
        raw = json.load(sys.stdin)

    syslog = parse_syslog(raw)
    fields = extract_dispatch_fields(syslog)
    print(json.dumps(fields, ensure_ascii=False, indent=2))

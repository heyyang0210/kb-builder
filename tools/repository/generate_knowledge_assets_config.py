import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

root = Path(__file__).resolve().parents[2]
source = root / 'runtime/pingcode/web/spaces/positive/batches/batch_31583e4c802a4b83/pages/1d95fbc3-知识服务全景图.md'
target = root / 'config/knowledge-center/state/knowledge-assets.json'
rows = []
for line in source.read_text(encoding='utf-8').splitlines():
    if not line.startswith('|') or line.startswith('| ---') or '编号 | 手册名' in line:
        continue
    cells = [part.strip() for part in line.strip('|').split('|')]
    if len(cells) != 7 or not re.fullmatch(r'(DB|YMP|YCM|YDC)-\d{3}', cells[0]):
        continue
    code, name, atomic, external, owner_a, owner_b, summary = cells
    def owner(value):
        value = value if value and value != '-' else None
        return {'displayName': value, 'userId': None, 'bindingStatus': 'pending' if value else 'unassigned'}
    rows.append({
        'handbookId': code,
        'productType': 'YashanDB' if code.startswith('DB-') else code.split('-', 1)[0],
        'name': name,
        'isAtomic': atomic.startswith('是'),
        'externalVisible': external.startswith('是'),
        'ownerA': owner(owner_a),
        'ownerB': owner(owner_b),
        'summary': summary,
        'outline': {'outlineId': None, 'outlineVersion': None, 'bindingStatus': 'not_created'},
        'documentSummary': {'total': None, 'published': None, 'inProgress': None},
        'sourceStatus': 'imported',
    })
payload = {
    'schemaVersion': '1.0',
    'handbooks': rows,
}
target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'generated {len(rows)} handbooks -> {target}')

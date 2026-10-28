"""专项本地上传收尾；复用服务跨进程锁，不开放产品删除接口。"""
import importlib.util
import json
import re
import shutil
import sys
from pathlib import Path

root, data_root, manifest = map(Path, sys.argv[1:4])
spec = importlib.util.spec_from_file_location('performance_store', root / 'apps/pingcode-api/app/store.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
plan = json.loads(manifest.read_text())
store = module.JsonStore(data_root / 'state.json')
removed = []
with store._locked():
    data = store._read()
    for item in plan:
        sid, bid, name = item['sessionId'], item.get('batchId'), item['name']
        if not re.fullmatch(r'upload_[a-f0-9]+', sid) or bid and not re.fullmatch(r'batch_[a-f0-9]+', bid):
            raise ValueError('非法上传ID')
        session = data.get('uploadSessions', {}).get(sid)
        batch = data.get('batches', {}).get(bid) if bid else None
        if not session or session['name'] != name or session.get('batchId') != bid:
            raise ValueError('上传归属不一致')
        if batch and (batch['name'] != name or batch.get('source', {}).get('sourceId') != sid or batch.get('activeTaskIds') or batch.get('latestDatasetVersionId')):
            raise ValueError('批次归属或生命周期不允许清理')
        if bid and any(bid in json.dumps(records) for key, records in data.items() if key not in ['batches', 'uploadSessions']):
            raise ValueError('批次仍有任务或数据集引用')
        for relative in [Path('staging/uploads') / sid] + ([Path('batches') / bid] if bid else []):
            target = data_root / relative
            if target.is_symlink() or data_root.resolve() not in target.resolve().parents:
                raise ValueError('目录越界')
        removed.append(item)
    # Validate the entire plan before writing or removing anything.
    for item in removed:
        for relative in [Path('staging/uploads') / item['sessionId']] + ([Path('batches') / item['batchId']] if item.get('batchId') else []):
            target = data_root / relative
            if target.exists():
                shutil.rmtree(target)
    for item in removed:
        data.get('uploadSessions', {}).pop(item['sessionId'], None)
        data.get('batches', {}).pop(item.get('batchId'), None)
    store._write(data)
print(json.dumps({'removed': removed}))

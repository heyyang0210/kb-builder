#!/usr/bin/env python3
"""Verify pinned REA static analysis without executing the fixture application."""
import hashlib
import json
from pathlib import Path
import subprocess

PLUGIN = Path(__file__).resolve().parents[1]
ROOT = PLUGIN.parents[2]
OUTPUT = ROOT / 'runtime/rea/smoke'
LAUNCHER = PLUGIN / 'scripts/rea.sh'


def run_cli(*args):
    result = subprocess.run(['bash', str(LAUNCHER), *map(str, args), '--json'],
                            cwd=ROOT, capture_output=True, text=True, timeout=120)
    if result.returncode:
        raise RuntimeError(result.stderr + result.stdout)
    value = json.loads(result.stdout)
    if 'error' in value:
        raise RuntimeError(str(value))
    return value


def main():
    provenance = json.loads((PLUGIN / 'provenance.json').read_text())
    for relative, digest in provenance['filesSha256'].items():
        assert hashlib.sha256((PLUGIN / relative).read_bytes()).hexdigest() == digest, relative
    app = OUTPUT / 'app'
    app.mkdir(parents=True, exist_ok=True)
    fixtures = {
        'package.json': '{"name":"rea-plugin-smoke","version":"1.0.0","main":"main.js"}',
        'main.js': "const {ipcMain}=require('electron');ipcMain.handle('knowledge:search',async(_event,query)=>({items:[],query}));",
        'preload.js': "const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('knowledge',{search:query=>ipcRenderer.invoke('knowledge:search',query)});",
    }
    for name, content in fixtures.items():
        (app / name).write_text(content)
    evidence = run_cli('analyze-javascript-application', app)
    (OUTPUT / 'evidence.json').write_text(json.dumps(evidence))
    ipc = evidence['normalized_result']['summary']['ipc']
    assert ipc['main_handlers'] == 1 and ipc['paired_renderer_transmissions'] == 1, ipc
    request = OUTPUT / 'view-request.json'
    request.write_text(json.dumps({'source': {'kind': 'inline', 'evidence': evidence},
                                   'view': {'kind': 'summary'}}))
    summary = run_cli('inspect-analysis-view', request)
    (OUTPUT / 'summary.json').write_text(json.dumps(summary))
    assert summary['normalized_result']['parent_evidence_id'] == evidence['evidence_id']
    print(json.dumps({'passed': True, 'evidence_id': evidence['evidence_id'],
                      'ipc_pairings': ipc['paired_renderer_transmissions'],
                      'output': str(OUTPUT)}, ensure_ascii=False))


if __name__ == '__main__':
    main()

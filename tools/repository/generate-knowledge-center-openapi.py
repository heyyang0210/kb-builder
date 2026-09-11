#!/usr/bin/env python3
"""生成资料加工 FastAPI 的版本化 OpenAPI 字段契约快照。"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "apps" / "pingcode-api"
OUTPUT = ROOT / "packages" / "platform-contracts" / "knowledge-center" / "v1" / "openapi.json"
sys.path.insert(0, str(BACKEND))

from app.main import app  # noqa: E402


def main():
    document = app.openapi()
    OUTPUT.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已生成 OpenAPI 字段契约：{len(document.get('paths', {}))} 条路径")


if __name__ == "__main__":
    main()

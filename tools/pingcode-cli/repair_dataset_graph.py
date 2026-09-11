#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.main import training


def main() -> int:
    parser = argparse.ArgumentParser(description="回填数据集关键词/文档块上下文图谱")
    parser.add_argument("dataset_id", help="需要修复的数据集版本 ID")
    args = parser.parse_args()

    summary = training.repair_dataset_graph(args.dataset_id)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

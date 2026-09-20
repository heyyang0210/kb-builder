#!/usr/bin/env python3
"""Validate project product-experience-critique Memory records."""
from pathlib import Path
import sys
import yaml

ROOT = Path(__file__).resolve().parents[1]
MEMORY = ROOT / "memory"
required = (
    "id",
    "source_cases",
    "principle",
    "applicable_when",
    "not_applicable_when",
    "counterexample",
    "effect_evidence",
    "status",
)
errors = []
for path in sorted(MEMORY.rglob("*.md")):
    if path.name == "index.md":
        continue
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n") or "\n---\n" not in text[4:]:
        errors.append(f"{path}: missing YAML frontmatter")
        continue
    raw = text.split("---\n", 2)[1]
    metadata = yaml.safe_load(raw) or {}
    missing = [key for key in required if not metadata.get(key)]
    if missing:
        errors.append(f"{path}: missing fields: {', '.join(missing)}")
    if not all("prompt.md" in str(item) for item in metadata.get("source_cases", [])):
        errors.append(f"{path}: missing source trace")
if errors:
    print("Memory validation failed:")
    print("\n".join(errors))
    sys.exit(1)
print(f"Memory validation passed: {len(list(MEMORY.rglob('*.md')))} files")

#!/usr/bin/env python3
"""Validate a JSON memory candidate and write it to the runtime evolution area."""
from argparse import ArgumentParser
from datetime import datetime
import json
from pathlib import Path
import re
import sys
import yaml

REQUIRED = (
    "sourceCases",
    "observedPattern",
    "rootCause",
    "reusablePrinciple",
    "applicableWhen",
    "notApplicableWhen",
    "counterexample",
    "effectEvidence",
    "confidence",
)


def find_repo_root(start):
    for parent in (start, *start.parents):
        if (parent / "AGENTS.md").exists() and (parent / "prompt.md").exists():
            return parent
    raise RuntimeError("repository root not found")


def main():
    parser = ArgumentParser()
    parser.add_argument("input", type=Path, help="JSON candidate produced from a verified implementation case")
    parser.add_argument("--id", required=True, help="stable candidate id")
    args = parser.parse_args()
    candidate_id = re.sub(r"[^a-z0-9-]+", "-", args.id.lower()).strip("-")
    if not candidate_id:
        print("candidate id is empty after normalization", file=sys.stderr)
        return 1
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    missing = [field for field in REQUIRED if not payload.get(field)]
    if missing:
        print(f"missing candidate fields: {', '.join(missing)}", file=sys.stderr)
        return 1
    if payload["confidence"] not in ("low", "medium", "high"):
        print("confidence must be low, medium, or high", file=sys.stderr)
        return 1
    repo = find_repo_root(Path(__file__).resolve())
    output_dir = repo / "runtime" / "skill-evolution" / "product-experience-critique" / "candidates"
    output_dir.mkdir(parents=True, exist_ok=True)
    payload["candidateId"] = candidate_id
    payload["status"] = "proposed"
    payload["createdAt"] = datetime.now().astimezone().isoformat(timespec="seconds")
    output = output_dir / f"{candidate_id}.yaml"
    if output.exists():
        print(f"candidate already exists: {output}", file=sys.stderr)
        return 1
    output.write_text(yaml.safe_dump(payload, allow_unicode=True, sort_keys=False), encoding="utf-8")
    print(output.relative_to(repo))
    return 0


if __name__ == "__main__":
    sys.exit(main())

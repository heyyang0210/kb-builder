#!/usr/bin/env python3
"""Validate eval corpus and optionally grade externally produced eval results."""
from argparse import ArgumentParser
import json
from pathlib import Path
import sys
import yaml

ROOT = Path(__file__).resolve().parents[1]
CASES = ROOT / "evals" / "cases"
BASELINE = ROOT / "evals" / "baselines" / "v0.1.json"
ROUTE_FIELDS = {"trigger", "jobs_lens", "implementation", "route_to_implementation"}


def load_cases():
    loaded = []
    for path in sorted(CASES.glob("*.yaml")):
        payload = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        for case in payload.get("cases", []):
            case["_source"] = str(path.relative_to(ROOT))
            loaded.append(case)
    return loaded


def validate(cases):
    errors = []
    ids = set()
    for case in cases:
        case_id = case.get("id")
        if not case_id:
            errors.append(f"{case.get('_source')}: case missing id")
            continue
        if case_id in ids:
            errors.append(f"duplicate case id: {case_id}")
        ids.add(case_id)
        if not case.get("prompt"):
            errors.append(f"{case_id}: missing prompt")
        if not case.get("expect"):
            errors.append(f"{case_id}: missing expect")
    return errors


def grade(cases, result_path):
    payload = json.loads(result_path.read_text(encoding="utf-8"))
    results = {item["id"]: item for item in payload.get("cases", [])}
    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    errors = []
    scores = []
    for case in cases:
        case_id = case["id"]
        actual = results.get(case_id)
        if not actual:
            errors.append(f"{case_id}: missing result")
            continue
        checks = actual.get("checks", {})
        for key, expected in case["expect"].items():
            if key in ROUTE_FIELDS:
                if actual.get(key) != expected:
                    errors.append(f"{case_id}: {key} expected {expected!r}, got {actual.get(key)!r}")
            elif checks.get(key) is not True:
                errors.append(f"{case_id}: expected check did not pass: {key}")
        if actual.get("hard_gates_passed") is not True:
            errors.append(f"{case_id}: hard gates failed")
        score = actual.get("quality_score")
        if score is None:
            errors.append(f"{case_id}: missing quality_score")
        else:
            try:
                numeric_score = float(score)
            except (TypeError, ValueError):
                errors.append(f"{case_id}: invalid quality_score: {score!r}")
            else:
                if not 0 <= numeric_score <= 1:
                    errors.append(f"{case_id}: quality_score must be between 0 and 1")
                else:
                    scores.append(numeric_score)
    minimum = float(baseline["minimumAverageQualityScore"])
    if len(scores) == len(cases) and sum(scores) / len(scores) < minimum:
        errors.append(f"average quality score below {minimum}: {sum(scores) / len(scores):.3f}")
    return errors


def main():
    parser = ArgumentParser()
    parser.add_argument("--results", type=Path, help="JSON results produced by an external eval runner")
    args = parser.parse_args()
    cases = load_cases()
    errors = validate(cases)
    if args.results and not errors:
        errors.extend(grade(cases, args.results))
    if errors:
        print("Eval validation failed:")
        print("\n".join(errors))
        return 1
    print(f"Eval validation passed: {len(cases)} behavioral cases")
    return 0


if __name__ == "__main__":
    sys.exit(main())

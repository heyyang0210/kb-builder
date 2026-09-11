#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
CONFIG_DIR="${YASDB_CONFIG_DIR:-$REPO_ROOT/config/database}"
export YASDB_CONFIG_DIR="$CONFIG_DIR"

eval "$(python3 - "$CONFIG_DIR/yashandb.example.json" "$CONFIG_DIR/yashandb.local.json" <<'PY'
import json
import pathlib
import shlex
import sys

example_path = pathlib.Path(sys.argv[1])
local_path = pathlib.Path(sys.argv[2])
example = json.loads(example_path.read_text(encoding="utf-8"))
local = json.loads(local_path.read_text(encoding="utf-8")) if local_path.exists() else {}

def reject_secrets(value, location="config"):
    if not isinstance(value, dict):
        return
    for key, child in value.items():
        lowered = key.lower()
        if any(marker in lowered for marker in ("password", "token", "secret", "api_key", "apikey")):
            raise SystemExit(f"数据库配置禁止包含敏感字段：{location}.{key}")
        reject_secrets(child, f"{location}.{key}")

reject_secrets(example)
reject_secrets(local)

def merge(base, override):
    result = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = merge(result[key], value)
        elif value not in (None, ""):
            result[key] = value
    return result

data = merge(example, local)
storage = data.get("storage", {})
jdbc = data.get("jdbc", {})
exp_imp = data.get("expImp", {})
values = {
    "YASDB_JDBC_URL": jdbc.get("url"),
    "YASDB_USERNAME": jdbc.get("username"),
    "YASDB_JDBC_JAR": jdbc.get("driverJar"),
    "YASDB_STORAGE_URL": storage.get("url"),
    "YASDB_STORAGE_HOST": storage.get("host"),
    "YASDB_STORAGE_PORT": storage.get("port"),
    "YASDB_STORAGE_TIMEOUT_MS": storage.get("timeoutMs"),
    "YASDB_STORAGE_THREADS": storage.get("threads"),
    "YASDB_STORAGE_MAX_BODY_BYTES": storage.get("maxBodyBytes"),
    "YASDB_STORAGE_SQL_DIR": storage.get("sqlDir"),
    "YASDB_EXP_SERVER_HOST": exp_imp.get("serverHost"),
    "YASDB_EXP_OWNER": exp_imp.get("owner"),
    "YASDB_IMP_FROMUSER": exp_imp.get("fromUser"),
    "YASDB_IMP_TOUSER": exp_imp.get("toUser"),
    "YASDB_EXP_OUTPUT_DIR": exp_imp.get("outputDir"),
    "YASDB_EXP_LOG_DIR": exp_imp.get("logDir"),
    "YASDB_EXP_ROWS": exp_imp.get("rows"),
    "YASDB_EXP_LOG_LEVEL": exp_imp.get("logLevel"),
}
for key, value in values.items():
    if value not in (None, ""):
        print(f'if [[ -z "${{{key}:-}}" ]]; then export {key}={shlex.quote(str(value))}; fi')
PY
)"

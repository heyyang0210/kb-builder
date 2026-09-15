#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
CONFIG_DIR="${YASDB_CONFIG_DIR:-$REPO_ROOT/config/yashandb}"
CONFIG_FILE="$CONFIG_DIR/service.env"
export YASDB_CONFIG_DIR="$CONFIG_DIR"

[[ -f "$CONFIG_FILE" ]] || { echo "数据库配置文件不存在：$CONFIG_FILE" >&2; return 1 2>/dev/null || exit 1; }

while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line#${line%%[![:space:]]*}}"
  [[ -z "$line" || "$line" == \#* ]] && continue
  [[ "$line" =~ ^(export[[:space:]]+)?YASDB_[A-Z_]+= ]] || { echo "数据库配置格式错误：$CONFIG_FILE" >&2; return 1 2>/dev/null || exit 1; }
  key="${line%%=*}"
  key="${key#export }"
  value="${line#*=}"
  value="${value#${value%%[![:space:]]*}}"
  if [[ "$value" == \"*\" && "$value" == *\" ]] || [[ "$value" == \'*\' && "$value" == *\' ]]; then value="${value:1:${#value}-2}"; fi
  if [[ -z "${!key+x}" ]]; then export "$key=$value"; fi
done < "$CONFIG_FILE"

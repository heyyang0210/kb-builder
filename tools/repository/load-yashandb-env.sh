#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
CONFIG_DIR="${YASDB_CONFIG_DIR:-$REPO_ROOT/config/yashandb}"
CONFIG_FILE="$CONFIG_DIR/service.env"
export YASDB_CONFIG_DIR="$CONFIG_DIR"

decode_double_quoted_env_value() {
  local encoded="$1"
  local decoded=""
  local char next
  local index
  for ((index = 0; index < ${#encoded}; index++)); do
    char="${encoded:index:1}"
    if [[ "$char" != '\' || $((index + 1)) -ge ${#encoded} ]]; then
      decoded+="$char"
      continue
    fi
    index=$((index + 1))
    next="${encoded:index:1}"
    case "$next" in
      '"') decoded+='"' ;;
      '\') decoded="${decoded}\\" ;;
      n) decoded+=$'\n' ;;
      r) decoded+=$'\r' ;;
      t) decoded+=$'\t' ;;
      *) decoded+="\\$next" ;;
    esac
  done
  printf '%s' "$decoded"
}

[[ -f "$CONFIG_FILE" ]] || { echo "数据库配置文件不存在：$CONFIG_FILE" >&2; return 1 2>/dev/null || exit 1; }

database_environment_preconfigured=0
if [[ -n "${YASDB_JDBC_URL:-}" || -n "${YASDB_USERNAME:-}" || -n "${YASDB_PASSWORD:-}" ]]; then
  database_environment_preconfigured=1
fi

# service.env is the single persistent database connection source. Explicit
# process variables may override it for this process only.
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line#${line%%[![:space:]]*}}"
  [[ -z "$line" || "$line" == \#* ]] && continue
  [[ "$line" =~ ^(export[[:space:]]+)?YASDB_[A-Z_]+= ]] || { echo "数据库配置格式错误：$CONFIG_FILE" >&2; return 1 2>/dev/null || exit 1; }
  key="${line%%=*}"
  key="${key#export }"
  value="${line#*=}"
  value="${value#${value%%[![:space:]]*}}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="$(decode_double_quoted_env_value "${value:1:${#value}-2}")"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  if [[ -z "${!key+x}" ]]; then export "$key=$value"; fi
done < "$CONFIG_FILE"

if (( database_environment_preconfigured == 1 )); then
  export KNOWLEDGE_CENTER_DATABASE_CONFIG_SOURCE="${KNOWLEDGE_CENTER_DATABASE_CONFIG_SOURCE:-environment}"
else
  export KNOWLEDGE_CENTER_DATABASE_CONFIG_SOURCE="${KNOWLEDGE_CENTER_DATABASE_CONFIG_SOURCE:-deployment}"
fi

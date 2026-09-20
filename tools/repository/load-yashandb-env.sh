#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
CONFIG_DIR="${YASDB_CONFIG_DIR:-$REPO_ROOT/config/yashandb}"
CONFIG_FILE="$CONFIG_DIR/service.env"
PLATFORM_CONFIG_RESOLVER="$REPO_ROOT/tools/repository/yashandb-platform-config.js"
export YASDB_CONFIG_DIR="$CONFIG_DIR"

[[ -f "$CONFIG_FILE" ]] || { echo "数据库配置文件不存在：$CONFIG_FILE" >&2; return 1 2>/dev/null || exit 1; }

database_environment_preconfigured=0
if [[ -n "${YASDB_JDBC_URL:-}" || -n "${YASDB_USERNAME:-}" || -n "${YASDB_PASSWORD:-}" ]]; then
  database_environment_preconfigured=1
  export KNOWLEDGE_CENTER_DATABASE_CONFIG_SOURCE="${KNOWLEDGE_CENTER_DATABASE_CONFIG_SOURCE:-environment}"
fi

if (( database_environment_preconfigured == 0 )) && [[ -f "$PLATFORM_CONFIG_RESOLVER" ]]; then
  platform_config_output="$(node "$PLATFORM_CONFIG_RESOLVER" resolve)" || {
    echo "无法读取已保存的平台数据库配置" >&2
    return 1 2>/dev/null || exit 1
  }
  if [[ -n "$platform_config_output" ]]; then
    while IFS='=' read -r key encoded_value; do
      [[ "$key" =~ ^(YASDB_JDBC_URL|YASDB_USERNAME|YASDB_PASSWORD|KNOWLEDGE_CENTER_DATABASE_STARTUP_VERSION)$ ]] || {
        echo "平台数据库配置返回了非法字段" >&2
        return 1 2>/dev/null || exit 1
      }
      decoded_value="$(printf '%s' "$encoded_value" | base64 --decode)" || {
        echo "平台数据库配置解码失败" >&2
        return 1 2>/dev/null || exit 1
      }
      export "$key=$decoded_value"
    done <<< "$platform_config_output"
    export KNOWLEDGE_CENTER_DATABASE_CONFIG_SOURCE=platform
  fi
fi

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

if [[ -z "${KNOWLEDGE_CENTER_DATABASE_CONFIG_SOURCE:-}" ]]; then
  export KNOWLEDGE_CENTER_DATABASE_CONFIG_SOURCE=deployment
fi

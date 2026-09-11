#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/load-yashandb-env.sh"
DEFAULT_OUTPUT_DIR="${YASDB_EXP_OUTPUT_DIR:-$REPO_ROOT/runtime/agent-runner/tmp}"
DEFAULT_OUTPUT_FILE="${DEFAULT_OUTPUT_DIR}/knowledge-center-owner-$(date +%Y%m%d-%H%M%S).dump"
EXP_BIN="${YASDB_EXP_BIN:-}"

if [[ -z "$EXP_BIN" ]]; then
  EXP_BIN="$(command -v exp || true)"
fi
if [[ -z "$EXP_BIN" && -x "/home/hey/.yasboot/yashandb_yasdb_home/bin/exp" ]]; then
  EXP_BIN="/home/hey/.yasboot/yashandb_yasdb_home/bin/exp"
fi
if [[ -z "$EXP_BIN" || ! -x "$EXP_BIN" ]]; then
  echo "未找到 YashanDB exp，请设置 YASDB_EXP_BIN。" >&2
  exit 1
fi

require_value() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    read -r -p "请输入 ${name}: " value
    export "$name=$value"
  fi
  if [[ -z "$value" ]]; then
    echo "${name} 不能为空。" >&2
    exit 1
  fi
}

require_value YASDB_EXP_USER
require_value YASDB_EXP_SERVER_HOST
require_value YASDB_EXP_OWNER

if [[ -z "${YASDB_EXP_PASSWORD:-}" ]]; then
  read -r -s -p "请输入 YASDB_EXP_PASSWORD（不会回显）: " YASDB_EXP_PASSWORD
  echo
fi
if [[ -z "$YASDB_EXP_PASSWORD" ]]; then
  echo "YASDB_EXP_PASSWORD 不能为空。" >&2
  exit 1
fi

OUTPUT_FILE="${1:-$DEFAULT_OUTPUT_FILE}"
LOG_DIR="${YASDB_EXP_LOG_DIR:-$(dirname "$OUTPUT_FILE")}"
mkdir -p "$(dirname "$OUTPUT_FILE")" "$LOG_DIR"

if [[ -e "$OUTPUT_FILE" ]]; then
  echo "导出文件已存在，不覆盖：$OUTPUT_FILE" >&2
  exit 1
fi

echo "即将执行 YashanDB OWNER 导出："
echo "  数据库：$YASDB_EXP_SERVER_HOST"
echo "  导出用户：$YASDB_EXP_OWNER"
echo "  输出文件：$OUTPUT_FILE"
read -r -p "确认开始导出？[y/N] " confirmation
if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
  echo "已取消导出。"
  exit 0
fi

"$EXP_BIN" "$YASDB_EXP_USER/$YASDB_EXP_PASSWORD@$YASDB_EXP_SERVER_HOST" \
  "FILE=$OUTPUT_FILE" \
  "OWNER=$YASDB_EXP_OWNER" \
  "ROWS=${YASDB_EXP_ROWS:-Y}" \
  "LOG_PATH=$LOG_DIR" \
  "LOG_LEVEL=${YASDB_EXP_LOG_LEVEL:-INFO}"

echo "导出完成：$OUTPUT_FILE"

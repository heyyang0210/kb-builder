#!/usr/bin/env bash
set -euo pipefail

YASDB_REFRESH_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
YASDB_REFRESH_CONFIG_FILE="$YASDB_REFRESH_SCRIPT_DIR/config.json"

load_yasdb_refresh_config() {
  command -v jq >/dev/null 2>&1 || { echo '缺少 jq，请安装后重试。' >&2; return 1; }
  [[ -f "$YASDB_REFRESH_CONFIG_FILE" ]] || {
    echo "找不到配置文件：$YASDB_REFRESH_CONFIG_FILE（可参考 config.example.json）" >&2; return 1;
  }
  [[ "$(stat -c '%a' "$YASDB_REFRESH_CONFIG_FILE")" == 600 ]] || {
    echo '配置文件权限必须为 0600。' >&2; return 1;
  }

  local json="$YASDB_REFRESH_CONFIG_FILE"
  local_value() { jq -er "$1 | select(type == \"string\" and length > 0)" "$json"; }
  local_port() { jq -er "$1 | select(type == \"number\" and floor == . and . >= 1 and . <= 65535)" "$json"; }

  YASDB_SOURCE_HOST="$(local_value '.sourceDatabase.host')"
  YASDB_SOURCE_PORT="$(local_port '.sourceDatabase.port')"
  YASDB_SOURCE_USER="$(local_value '.sourceDatabase.username')"
  YASDB_SOURCE_OWNER="$(local_value '.sourceDatabase.owner')"
  YASDB_SOURCE_PASSWORD="$(local_value '.sourceDatabase.password')"
  YASDB_TARGET_HOST="$(local_value '.personalDatabase.host')"
  YASDB_TARGET_PORT="$(local_port '.personalDatabase.port')"
  YASDB_TARGET_USER="$(local_value '.personalDatabase.username')"
  YASDB_TARGET_OWNER="$(local_value '.personalDatabase.owner')"
  YASDB_TARGET_PASSWORD="$(local_value '.personalDatabase.password')"

  [[ "$YASDB_SOURCE_USER" =~ ^[A-Za-z][A-Za-z0-9_\$#]{0,127}$ && "$YASDB_TARGET_USER" =~ ^[A-Za-z][A-Za-z0-9_\$#]{0,127}$ && \
    "$YASDB_SOURCE_OWNER" =~ ^[A-Za-z][A-Za-z0-9_\$#]{0,127}$ && "$YASDB_TARGET_OWNER" =~ ^[A-Za-z][A-Za-z0-9_\$#]{0,127}$ ]] || {
    echo '用户名和 Schema 必须是普通 YashanDB 标识符。' >&2; return 1;
  }
  [[ "$YASDB_SOURCE_HOST" =~ ^[A-Za-z0-9.-]+$ && "$YASDB_TARGET_HOST" =~ ^[A-Za-z0-9.-]+$ ]] || {
    echo '数据库主机名或 IP 格式无效。' >&2; return 1;
  }
  YASDB_SOURCE_SERVER="$YASDB_SOURCE_HOST:$YASDB_SOURCE_PORT"
  YASDB_TARGET_SERVER="$YASDB_TARGET_HOST:$YASDB_TARGET_PORT"
  YASDB_SOURCE_CONNECTION="$YASDB_SOURCE_USER/$YASDB_SOURCE_PASSWORD@$YASDB_SOURCE_SERVER"
  YASDB_TARGET_CONNECTION="$YASDB_TARGET_USER/$YASDB_TARGET_PASSWORD@$YASDB_TARGET_SERVER"
  [[ "$YASDB_SOURCE_SERVER/$YASDB_SOURCE_OWNER" != "$YASDB_TARGET_SERVER/$YASDB_TARGET_OWNER" ]] || {
    echo '源 Schema 与个人目标 Schema 不能指向同一地址。' >&2; return 1;
  }
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  load_yasdb_refresh_config
  printf '源数据库：%s / Schema %s\n个人数据库：%s / Schema %s\n配置文件有效：%s\n' \
    "$YASDB_SOURCE_SERVER" "$YASDB_SOURCE_OWNER" "$YASDB_TARGET_SERVER" "$YASDB_TARGET_OWNER" "$YASDB_REFRESH_CONFIG_FILE"
fi

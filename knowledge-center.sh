#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
ENV_FILE="${KNOWLEDGE_CENTER_ENV_FILE:-$REPO_ROOT/config/knowledge-center/.env}"
ACTION="${1:-help}"

load_dotenv() {
  local file="$1" line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*$ || "$line" =~ ^[[:space:]]*# ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || {
      echo "错误：环境配置包含非法变量名：$file" >&2
      return 1
    }
    if [[ "$line" != *=* ]]; then
      echo "错误：环境配置缺少等号：$file" >&2
      return 1
    fi
    [[ -v "$key" ]] && continue
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi
    export "$key=$value"
  done <"$file"
}

if [[ -f "$ENV_FILE" ]]; then
  load_dotenv "$ENV_FILE"
fi
YASDB_CONFIG_DIR="${YASDB_CONFIG_DIR:-$REPO_ROOT/config/yashandb}"
SERVICE_ENV_FILE="$YASDB_CONFIG_DIR/service.env"
export YASDB_CONFIG_DIR
# 数据库存储服务与 Node/Python 入口共享 config/yashandb 的连接参数。
# 显式注入的环境变量优先，开发环境无需手工导出密码。
if [[ -f "$SERVICE_ENV_FILE" && -f "$REPO_ROOT/tools/repository/load-yashandb-env.sh" ]]; then
  source "$REPO_ROOT/tools/repository/load-yashandb-env.sh"
fi

is_placeholder() {
  [[ "${1:-}" == \<*\> || "${1:-}" == *'<YOUR_'* || "${1:-}" == *'<PORT>'* ]]
}

# .env.example contains safe placeholders. They are valid dotenv values but
# must not override operational defaults in the restart script.
if is_placeholder "${KNOWLEDGE_CENTER_PUBLIC_HOST:-}"; then
  unset KNOWLEDGE_CENTER_PUBLIC_HOST
fi
if is_placeholder "${KNOWLEDGE_CENTER_PUBLIC_BASE_URL:-}"; then
  unset KNOWLEDGE_CENTER_PUBLIC_BASE_URL
fi
if is_placeholder "${KNOWLEDGE_CENTER_INTERNAL_HOST:-}"; then
  unset KNOWLEDGE_CENTER_INTERNAL_HOST
fi

DOCUMENT_DIR="$REPO_ROOT/apps/knowledge-center-api"
AUTH_DIR="$REPO_ROOT/apps/knowledge-center-auth"
FRONTEND_DIR="$REPO_ROOT/apps/knowledge-center-web"
PINGCODE_API_DIR="$REPO_ROOT/apps/pingcode-api"
PINGCODE_CORE_DIR="$REPO_ROOT/packages/pingcode-core"
STORAGE_DIR="$REPO_ROOT/apps/yashandb-storage"
RUNTIME_DIR="$REPO_ROOT/runtime/agent-runner"
BUILD_SCRIPT="$REPO_ROOT/tools/repository/build-knowledge-center.sh"
BUILD_ROOT_REL="${KNOWLEDGE_CENTER_BUILD_ROOT:-runtime/build/knowledge-center}"
case "$BUILD_ROOT_REL" in
  /*|[A-Za-z]:*|\\*|//*) echo "错误：KNOWLEDGE_CENTER_BUILD_ROOT 必须是仓库内相对路径" >&2; exit 2 ;;
esac
[[ "$BUILD_ROOT_REL" == runtime/build/* && "$BUILD_ROOT_REL" != *"/../"* && "$BUILD_ROOT_REL" != ../* && "$BUILD_ROOT_REL" != */.. ]] || {
  echo "错误：KNOWLEDGE_CENTER_BUILD_ROOT 必须位于 runtime/build/ 且不得包含 .." >&2
  exit 2
}
BUILD_DIR="$REPO_ROOT/$BUILD_ROOT_REL/current"
LOG_DIR="${KNOWLEDGE_CENTER_LOG_DIR:-$RUNTIME_DIR/logs/knowledge-center-isolated}"
STATE_DIR="${KNOWLEDGE_CENTER_STATE_DIR:-$RUNTIME_DIR/.runtime/knowledge-center-isolated}"
RUN_OWNER="${KNOWLEDGE_CENTER_RUN_OWNER:-}"
EXPECTED_OWNER="${KNOWLEDGE_CENTER_EXPECTED_OWNER:-}"
NO_TAKEOVER="${KNOWLEDGE_CENTER_NO_TAKEOVER:-0}"
OPERATION_ACTOR="${KNOWLEDGE_CENTER_OPERATION_ACTOR:-${USER:-unknown}}"
STOP_REASON="${KNOWLEDGE_CENTER_STOP_REASON:-manual}"

FRONTEND_PORT="${KNOWLEDGE_CENTER_FRONTEND_PORT:-13510}"
DOCUMENT_API_PORT="${KNOWLEDGE_CENTER_DOCUMENT_API_PORT:-14110}"
PINGCODE_API_PORT="${KNOWLEDGE_CENTER_PINGCODE_API_PORT:-18010}"
AUTH_API_PORT="${KNOWLEDGE_CENTER_AUTH_PORT:-14200}"
INTERNAL_HOST="${KNOWLEDGE_CENTER_INTERNAL_HOST:-127.0.0.1}"
PINGCODE_HOST="${KNOWLEDGE_CENTER_PINGCODE_HOST:-127.0.0.1}"
KNOWLEDGE_CENTER_ENVIRONMENT="${KNOWLEDGE_CENTER_ENV:-${KNOWLEDGE_CENTER_ENVIRONMENT:-development}}"
export KNOWLEDGE_CENTER_ENVIRONMENT
PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-}"
if [[ -z "$PLAYWRIGHT_BROWSERS_PATH" && -d "$REPO_ROOT/runtime/browsers/playwright" ]]; then
  PLAYWRIGHT_BROWSERS_PATH="$REPO_ROOT/runtime/browsers/playwright"
fi
if [[ -n "$PLAYWRIGHT_BROWSERS_PATH" && "$PLAYWRIGHT_BROWSERS_PATH" != /* ]]; then
  PLAYWRIGHT_BROWSERS_PATH="$REPO_ROOT/$PLAYWRIGHT_BROWSERS_PATH"
fi
[[ -z "$PLAYWRIGHT_BROWSERS_PATH" ]] || export PLAYWRIGHT_BROWSERS_PATH
PUBLIC_BASE_URL="${KNOWLEDGE_CENTER_PUBLIC_BASE_URL:-}"
LEGACY_PUBLIC_HOST_USED=0
if [[ -z "$PUBLIC_BASE_URL" && -n "${KNOWLEDGE_CENTER_PUBLIC_HOST:-}" ]]; then
  PUBLIC_BASE_URL="http://${KNOWLEDGE_CENTER_PUBLIC_HOST}:$FRONTEND_PORT"
  LEGACY_PUBLIC_HOST_USED=1
elif [[ -z "$PUBLIC_BASE_URL" && "$KNOWLEDGE_CENTER_ENVIRONMENT" == development ]]; then
  PUBLIC_BASE_URL="http://127.0.0.1:$FRONTEND_PORT"
fi
PUBLIC_BASE_URL="${PUBLIC_BASE_URL%/}"
PUBLIC_APP_URL="${PUBLIC_BASE_URL:+$PUBLIC_BASE_URL/knowledge-center/}"
PUBLIC_SERVICE_URL="$PUBLIC_APP_URL"
PUBLIC_OAUTH_REDIRECT_URI="${PUBLIC_BASE_URL:+$PUBLIC_BASE_URL/knowledge-center/api/gitlab/oauth/callback}"
if [[ "$PUBLIC_BASE_URL" == https://* ]]; then
  COOKIE_SECURE=true
else
  COOKIE_SECURE=false
fi
if [[ "$KNOWLEDGE_CENTER_ENVIRONMENT" == production || "$KNOWLEDGE_CENTER_ENVIRONMENT" == staging ]]; then
  MIGRATION_CHECKSUM_POLICY=strict
else
  MIGRATION_CHECKSUM_POLICY="${YASDB_MIGRATION_CHECKSUM_POLICY:-warn}"
fi
STOP_TIMEOUT="${KNOWLEDGE_CENTER_STOP_TIMEOUT:-10}"
START_TIMEOUT="${KNOWLEDGE_CENTER_START_TIMEOUT:-45}"
DB_PROBE_TIMEOUT="${KNOWLEDGE_CENTER_DB_PROBE_TIMEOUT:-15}"
NODE_BIN="${KNOWLEDGE_CENTER_NODE_BIN:-node}"
NPM_BIN="${KNOWLEDGE_CENTER_NPM_BIN:-npm}"
PYTHON_BIN="${KNOWLEDGE_CENTER_PYTHON_BIN:-}"
JAVA_BIN="${KNOWLEDGE_CENTER_JAVA_BIN:-java}"
NODE_MODULE_PATH="${KNOWLEDGE_CENTER_NODE_PATH:-$REPO_ROOT/node_modules:$RUNTIME_DIR/node_modules}"
PYTHON_MODULE_PATH="$PINGCODE_API_DIR:$PINGCODE_CORE_DIR${PYTHONPATH:+:$PYTHONPATH}"
OUTLINE_INTERNAL_TOKEN="${KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN:-}"
NO_BUILD=0
VERBOSE=0
DOCTOR_FORMAT=human
FAILURE_COMPONENT=""
FAILURE_LOG=""
FAILURE_REASON=""
shift $(( $# > 0 ? 1 : 0 ))
LOG_SUBACTION=""
LOG_ARGS=()
if [[ "$ACTION" == logs ]]; then
  LOG_SUBACTION="${1:-}"
  [[ $# -eq 0 ]] || shift
  LOG_ARGS=("$@")
fi
while (( $# > 0 )) && [[ "$ACTION" != logs ]]; do
  case "$1" in
    --no-build)
      [[ "$ACTION" == start || "$ACTION" == restart ]] || { echo "错误：--no-build 仅适用于 start/restart" >&2; exit 2; }
      NO_BUILD=1
      ;;
    --verbose)
      [[ "$ACTION" == status ]] || { echo "错误：--verbose 仅适用于 status" >&2; exit 2; }
      VERBOSE=1
      ;;
    --commands)
      [[ "$ACTION" == doctor ]] || { echo "错误：--commands 仅适用于 doctor" >&2; exit 2; }
      DOCTOR_FORMAT=commands
      ;;
    --json)
      [[ "$ACTION" == doctor ]] || { echo "错误：--json 仅适用于 doctor" >&2; exit 2; }
      DOCTOR_FORMAT=json
      ;;
    *) [[ "$ACTION" == logs ]] || { echo "错误：未知参数：$1" >&2; exit 2; } ;;
  esac
  shift
done

if [[ -z "$PYTHON_BIN" ]]; then
  if [[ -x "$REPO_ROOT/runtime/venvs/knowledge-center/bin/python" ]] && "$REPO_ROOT/runtime/venvs/knowledge-center/bin/python" -c 'import uvicorn' >/dev/null 2>&1; then
    PYTHON_BIN="$REPO_ROOT/runtime/venvs/knowledge-center/bin/python"
  elif [[ -x "$PINGCODE_API_DIR/.venv/bin/python" ]] && "$PINGCODE_API_DIR/.venv/bin/python" -c 'import uvicorn' >/dev/null 2>&1; then
    PYTHON_BIN="$PINGCODE_API_DIR/.venv/bin/python"
  else
    PYTHON_BIN="python3"
  fi
fi

mkdir -p "$LOG_DIR" "$STATE_DIR"

DOCTOR_LIBRARY="$REPO_ROOT/tools/deployment/knowledge-center-doctor.sh"
[[ -f "$DOCTOR_LIBRARY" ]] || { echo "错误：缺少诊断库：tools/deployment/knowledge-center-doctor.sh" >&2; exit 2; }
source "$DOCTOR_LIBRARY"

print_legacy_public_host_warning() {
  (( LEGACY_PUBLIC_HOST_USED == 0 )) || echo "警告：KNOWLEDGE_CENTER_PUBLIC_HOST 已弃用，请改用 KNOWLEDGE_CENTER_PUBLIC_BASE_URL=$PUBLIC_BASE_URL" >&2
}

lifecycle_event() {
  local action="$1" service="$2" detail="${3:-}"
  printf '%s\taction=%s\tservice=%s\tactor=%s\tdetail=%s\n' \
    "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$action" "$service" "$OPERATION_ACTOR" "$detail" >>"$LOG_DIR/lifecycle.log"
}

if [[ "$ACTION" == logs ]]; then
  command -v "$PYTHON_BIN" >/dev/null 2>&1 || { echo "错误：缺少 Python 命令：$PYTHON_BIN" >&2; exit 2; }
  case "$LOG_SUBACTION" in
    compress|status)
      if maintenance_output=$("$PYTHON_BIN" "$REPO_ROOT/tools/logging/log_maintenance.py" "$LOG_SUBACTION" --root "$RUNTIME_DIR/logs" --root "$LOG_DIR"); then
        printf '%s\n' "$maintenance_output"
        lifecycle_event "logs.$LOG_SUBACTION" "knowledge-center" "$maintenance_output"
      else
        maintenance_status=$?
        lifecycle_event "logs.$LOG_SUBACTION.failed" "knowledge-center" "exit=$maintenance_status"
        exit "$maintenance_status"
      fi
      ;;
    collect)
      [[ ${#LOG_ARGS[@]} -eq 2 && ( "${LOG_ARGS[0]}" == --request-id || "${LOG_ARGS[0]}" == --correlation-id || "${LOG_ARGS[0]}" == --task-id || "${LOG_ARGS[0]}" == --run-id ) && -n "${LOG_ARGS[1]}" ]] || { echo "用法：$0 logs collect {--request-id|--correlation-id|--task-id|--run-id} <id>" >&2; exit 2; }
      if maintenance_output=$("$PYTHON_BIN" "$REPO_ROOT/tools/logging/log_maintenance.py" collect --root "$RUNTIME_DIR/logs" --root "$LOG_DIR" --identifier "${LOG_ARGS[1]}"); then
        printf '%s\n' "$maintenance_output"
        lifecycle_event logs.collect knowledge-center "identifier=${LOG_ARGS[1]} output=$maintenance_output"
      else
        maintenance_status=$?
        lifecycle_event logs.collect.failed knowledge-center "exit=$maintenance_status"
        exit "$maintenance_status"
      fi
      ;;
    *) echo "用法：$0 logs {compress|collect --request-id ID|collect --correlation-id ID|collect --task-id ID|collect --run-id ID|status}"; exit 2 ;;
  esac
  exit $?
fi

archive_service_log() {
  local logfile="$1" name timestamp
  [[ -s "$logfile" ]] || return 0
  name="$(basename "$logfile")"
  timestamp="$(date '+%Y%m%d-%H%M%S')"
  mkdir -p "$LOG_DIR/history"
  mv "$logfile" "$LOG_DIR/history/${name%.log}-$timestamp.log"
}

acquire_operation_lock() {
  command -v flock >/dev/null 2>&1 || { echo "错误：缺少命令：flock" >&2; return 1; }
  exec 9>"$STATE_DIR/operation.lock"
  flock -n 9 || { echo "错误：已有知识中心启停操作正在执行，请稍后重试" >&2; return 1; }
}

pid_file() {
  printf '%s/%s.pid' "$STATE_DIR" "$1"
}

owner_file() {
  printf '%s/run-owner' "$STATE_DIR"
}

assert_expected_owner() {
  local actual
  [[ -n "$EXPECTED_OWNER" ]] || return 0
  actual="$(tr -d '\r\n' <"$(owner_file)" 2>/dev/null || true)"
  [[ -n "$actual" && "$actual" == "$EXPECTED_OWNER" ]] || {
    echo "错误：运行所有权校验失败，拒绝停止当前知识中心实例" >&2
    return 1
  }
}

service_cwd() {
  case "$1" in
    document) printf '%s' "$DOCUMENT_DIR" ;;
    pingcode) printf '%s' "$PINGCODE_API_DIR" ;;
    auth) printf '%s' "$AUTH_DIR" ;;
    frontend) printf '%s' "$FRONTEND_DIR" ;;
    storage) printf '%s' "$STORAGE_DIR" ;;
    *) return 1 ;;
  esac
}

service_pattern() {
  case "$1" in
    document) printf '%s' 'node server.js' ;;
    pingcode) printf '%s' 'uvicorn app.main:app' ;;
    auth) printf '%s' 'node auth-server.js' ;;
    frontend) printf '%s' 'node frontend-server.js' ;;
    storage) printf '%s' 'java -cp' ;;
    *) return 1 ;;
  esac
}

service_url() {
  case "$1" in
    document) printf 'http://%s:%s/api/health' "$INTERNAL_HOST" "$DOCUMENT_API_PORT" ;;
    # PingCode API does not expose /api/health; platform context is its
    # lightweight authenticated-independent readiness endpoint.
    pingcode) printf 'http://%s:%s/api/platform/context' "$PINGCODE_HOST" "$PINGCODE_API_PORT" ;;
    auth) printf 'http://%s:%s/knowledge-center/api/auth/config' "$INTERNAL_HOST" "$AUTH_API_PORT" ;;
    frontend) printf 'http://%s:%s/knowledge-center/' "$INTERNAL_HOST" "$FRONTEND_PORT" ;;
    storage) printf 'http://%s:%s/health' "${YASDB_STORAGE_HOST:-127.0.0.1}" "${YASDB_STORAGE_PORT:-14210}" ;;
    *) return 1 ;;
  esac
}

process_matches() {
  local pid="$1" expected_cwd="$2" expected_pattern="$3" state
  [[ "$pid" =~ ^[0-9]+$ && -d "/proc/$pid" ]] || return 1
  state="$(awk '/^State:/ {print $2}' "/proc/$pid/status" 2>/dev/null || true)"
  [[ "$state" != "Z" ]] || return 1
  [[ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)" == "$expected_cwd" ]] || return 1
  tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null | grep -F -- "$expected_pattern" >/dev/null
}

service_process_matches() {
  local service="$1" pid="$2" cmdline classpath jar classes build_base
  if [[ "$service" != storage ]]; then
    if process_matches "$pid" "$(service_cwd "$service")" "$(service_pattern "$service")"; then
      return 0
    fi
    # Older/manual launches may run the frontend from the repository root
    # with its repository-relative entrypoint. Keep this compatibility path
    # exact so unrelated node processes are never adopted.
    if [[ "$service" == frontend && "$pid" =~ ^[0-9]+$ && -d "/proc/$pid" \
      && "$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)" == "$REPO_ROOT" ]]; then
      cmdline="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
      [[ "$cmdline" == *"node apps/knowledge-center-web/frontend-server.js"* ]] && return 0
    fi
    return 1
  fi

  [[ "$pid" =~ ^[0-9]+$ && -d "/proc/$pid" ]] || return 1
  [[ "$(awk '/^State:/ {print $2}' "/proc/$pid/status" 2>/dev/null || true)" != "Z" ]] || return 1
  local process_cwd
  process_cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
  [[ "$process_cwd" == "$STORAGE_DIR" || "$process_cwd" == "$REPO_ROOT" ]] || return 1
  cmdline="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
  [[ "$cmdline" == *java* ]] || return 1
  classpath="${cmdline#* -cp }"
  [[ "$classpath" != "$cmdline" && "$classpath" == *" Main "* ]] || return 1
  classpath="${classpath%% Main *}"
  jar="${classpath%%:*}"
  classes="${classpath#*:}"
  [[ "$classes" != "$classpath" ]] || return 1
  if [[ "$jar" == "$STORAGE_DIR/lib/yashandb-jdbc.jar" && "$classes" == "$RUNTIME_DIR/.runtime/yashandb-storage/classes/" ]]; then
    return 0
  fi
  if [[ "$jar" == "$STORAGE_DIR/lib/yashandb-jdbc.jar" \
    && "$classes" == "$REPO_ROOT"/runtime/build/*/current/java/classes ]]; then
    return 0
  fi
  [[ "$jar" == "$REPO_ROOT"/runtime/build/*/current/java/lib/yashandb-jdbc.jar ]] || return 1
  build_base="${jar%/java/lib/yashandb-jdbc.jar}"
  [[ "$classes" == "$build_base/java/classes" ]]
}

listener_pid() {
  ss -ltnp "sport = :$1" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | head -n 1
}

service_port() {
  case "$1" in
    document) printf '%s' "$DOCUMENT_API_PORT" ;;
    pingcode) printf '%s' "$PINGCODE_API_PORT" ;;
    auth) printf '%s' "$AUTH_API_PORT" ;;
    frontend) printf '%s' "$FRONTEND_PORT" ;;
    storage) printf '%s' "${YASDB_STORAGE_PORT:-14210}" ;;
    *) return 1 ;;
  esac
}

http_ready() {
  curl -fsS --connect-timeout 1 --max-time 3 "$1" >/dev/null 2>&1
}

process_alive() {
  local pid="$1"
  [[ "$pid" =~ ^[0-9]+$ && -d "/proc/$pid" ]] || return 1
  [[ "$(awk '/^State:/ {print $2}' "/proc/$pid/status" 2>/dev/null || true)" != "Z" ]]
}

validate_positive_integer() {
  local name="$1" value="$2"
  [[ "$value" =~ ^[1-9][0-9]*$ ]] || {
    echo "错误：$name 必须为正整数，当前值：$value" >&2
    return 1
  }
}

validate_port_configuration() {
  local name value
  local -A owners=()
  for name in FRONTEND_PORT DOCUMENT_API_PORT PINGCODE_API_PORT YASDB_STORAGE_PORT; do
    case "$name" in
      FRONTEND_PORT) value="$FRONTEND_PORT" ;;
      DOCUMENT_API_PORT) value="$DOCUMENT_API_PORT" ;;
      PINGCODE_API_PORT) value="$PINGCODE_API_PORT" ;;
      YASDB_STORAGE_PORT) value="${YASDB_STORAGE_PORT:-14210}" ;;
    esac
    [[ "$value" =~ ^[0-9]+$ ]] && (( value >= 1 && value <= 65535 )) || {
      echo "错误：$name 必须是 1-65535 的端口，当前值：$value" >&2
      return 1
    }
    [[ -z "${owners[$value]:-}" ]] || {
      echo "错误：端口 $value 同时分配给 ${owners[$value]} 和 $name" >&2
      return 1
    }
    owners[$value]="$name"
  done
}

validate_environment() {
  local command_name directory version major minor mode
  validate_positive_integer KNOWLEDGE_CENTER_STOP_TIMEOUT "$STOP_TIMEOUT" || return 1
  validate_positive_integer KNOWLEDGE_CENTER_START_TIMEOUT "$START_TIMEOUT" || return 1
  validate_port_configuration || return 1
  [[ -n "$INTERNAL_HOST" && -n "$PINGCODE_HOST" ]] || {
    echo "错误：服务监听地址不能为空" >&2
    return 1
  }
  [[ -n "$PUBLIC_BASE_URL" && "$PUBLIC_BASE_URL" =~ ^https?://[^/[:space:]]+/?$ ]] || {
    echo "错误：KNOWLEDGE_CENTER_PUBLIC_BASE_URL 必须是完整 http(s)://host[:port] 原点，IP 或域名均可" >&2
    return 1
  }
  for command_name in "$NODE_BIN" "$NPM_BIN" "$PYTHON_BIN" "$JAVA_BIN" curl ss setsid sha256sum; do
    if [[ "$command_name" == */* ]]; then
      [[ -x "$command_name" ]] || { echo "错误：命令不可执行：$command_name" >&2; return 1; }
    else
      command -v "$command_name" >/dev/null 2>&1 || { echo "错误：缺少命令：$command_name" >&2; return 1; }
    fi
  done
  version="$("$JAVA_BIN" -version 2>&1 | head -n 1 | sed -E 's/.*version "?([^" ]+).*/\1/')"
  major="$(doctor_version_major "$version")"
  [[ "$major" =~ ^[0-9]+$ ]] && (( major >= 17 )) || {
    echo "错误：Java 必须为 17+，当前为 ${version:-unknown}" >&2
    echo "查看安装命令：$0 doctor --commands" >&2
    return 1
  }
  version="$("$NODE_BIN" --version 2>/dev/null || true)"
  major="$(doctor_version_major "$version")"
  [[ "$major" =~ ^[0-9]+$ ]] && (( major >= 20 )) || {
    echo "错误：Node.js 必须为 20+，当前为 ${version:-unknown}" >&2
    echo "查看安装命令：$0 doctor --commands" >&2
    return 1
  }
  version="$("$PYTHON_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
  major="${version%%.*}"
  minor="${version#*.}"
  [[ "$major" == 3 && "$minor" =~ ^[0-9]+$ ]] && (( minor >= 10 )) || {
    echo "错误：Python 必须为 3.10+，当前为 ${version:-unknown}" >&2
    echo "查看安装命令：$0 doctor --commands" >&2
    return 1
  }
  "$PYTHON_BIN" -c 'from pathlib import Path; import uvicorn, fastapi, pydantic; from playwright.sync_api import sync_playwright; p = sync_playwright().start(); executable = Path(p.chromium.executable_path); p.stop(); raise SystemExit(0 if executable.is_file() else 1)' >/dev/null 2>&1 || {
    echo "错误：Python 运行依赖或 Playwright Chromium 制品不完整" >&2
    echo "自动安装：$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply --component python" >&2
    return 1
  }
  NODE_PATH="$NODE_MODULE_PATH" "$NODE_BIN" -e "require('express'); require('socket.io'); require('xlsx')" >/dev/null 2>&1 || {
    echo "错误：Node.js 缺少 express/socket.io/xlsx 中的一个或多个模块" >&2
    echo "自动安装：$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply --component node" >&2
    return 1
  }
  [[ -f "$SERVICE_ENV_FILE" ]] || {
    echo "错误：数据库唯一配置不存在：$SERVICE_ENV_FILE" >&2
    echo "初始化：$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply --component config" >&2
    return 1
  }
  mode="$(stat -c '%a' "$SERVICE_ENV_FILE" 2>/dev/null || true)"
  [[ "$mode" == 600 || "$mode" == 400 ]] || { echo "错误：$SERVICE_ENV_FILE 权限必须为 0600 或更严格，当前为 ${mode:-unknown}" >&2; return 1; }
  if [[ "$KNOWLEDGE_CENTER_ENVIRONMENT" == production || "$KNOWLEDGE_CENTER_ENVIRONMENT" == staging ]]; then
    [[ -f "$ENV_FILE" ]] || { echo "错误：$KNOWLEDGE_CENTER_ENVIRONMENT 环境必须提供 $ENV_FILE" >&2; return 1; }
    mode="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || true)"
    [[ "$mode" == 600 || "$mode" == 400 ]] || { echo "错误：$ENV_FILE 权限必须为 0600 或更严格" >&2; return 1; }
    [[ -n "${KNOWLEDGE_CENTER_ADMIN_PASSWORD:-}" && "${KNOWLEDGE_CENTER_ADMIN_PASSWORD:-}" != admin ]] || { echo "错误：共享/生产环境禁止使用默认管理员密码" >&2; return 1; }
    [[ -n "$OUTLINE_INTERNAL_TOKEN" ]] || { echo "错误：共享/生产环境必须配置 KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN" >&2; return 1; }
  fi
  for directory in "$DOCUMENT_DIR" "$FRONTEND_DIR" "$PINGCODE_API_DIR" "$PINGCODE_CORE_DIR" "$STORAGE_DIR"; do
    [[ -d "$directory" ]] || { echo "错误：目录不存在：$directory" >&2; return 1; }
  done
  [[ -f "$DOCUMENT_DIR/server.js" ]] || { echo "错误：文档 API 入口不存在" >&2; return 1; }
  [[ -f "$FRONTEND_DIR/frontend-server.js" ]] || { echo "错误：Web 网关入口不存在" >&2; return 1; }
  [[ -f "$PINGCODE_API_DIR/app/main.py" ]] || { echo "错误：资料加工 API 入口不存在" >&2; return 1; }
  [[ -f "$STORAGE_DIR/start.sh" ]] || { echo "错误：YashanDB 存储服务入口不存在" >&2; return 1; }
  [[ -x "$BUILD_SCRIPT" ]] || { echo "错误：统一构建脚本不存在或不可执行：tools/repository/build-knowledge-center.sh" >&2; return 1; }
}

validate_database_connection() {
  local probe_log="$LOG_DIR/database-probe.log"
  validate_positive_integer KNOWLEDGE_CENTER_DB_PROBE_TIMEOUT "$DB_PROBE_TIMEOUT" || return 1
  validate_build_artifact || return 1
  : >"$probe_log"
  if ! timeout --signal=TERM --kill-after=3s "${DB_PROBE_TIMEOUT}s" \
    env KNOWLEDGE_CENTER_BUILD_ROOT="$BUILD_ROOT_REL" \
      YASDB_STORAGE_SQL_DIR="$BUILD_DIR/java/sql" \
      "$JAVA_BIN" -cp "$BUILD_DIR/java/lib/yashandb-jdbc.jar:$BUILD_DIR/java/classes" Main probe \
      >"$probe_log" 2>&1; then
    FAILURE_COMPONENT="YashanDB 数据库连接"
    FAILURE_LOG="$probe_log"
    echo "错误：无法连接 YashanDB，未启动或停止任何平台服务。" >&2
    if grep -Eiq 'invalid username/password|login denied|认证|authorization' "$probe_log"; then
      echo "诊断：数据库账号或密码不正确，请更新 $SERVICE_ENV_FILE 中的 YASDB_USERNAME/YASDB_PASSWORD。" >&2
    elif grep -Eiq 'connect|timeout|refused|超时|连接' "$probe_log"; then
      echo "诊断：数据库地址或网络不可用，请检查 YASDB_JDBC_URL 与数据库监听状态。" >&2
    fi
    tail -n 20 "$probe_log" >&2 || true
    return 1
  fi
}

validate_build_artifact() {
  [[ -f "$BUILD_DIR/manifest.json" ]] || { echo "错误：缺少统一构建清单，请先执行 $BUILD_SCRIPT" >&2; return 1; }
  [[ -f "$BUILD_DIR/manifest.sha256" ]] || { echo "错误：缺少统一构建摘要，请先执行 $BUILD_SCRIPT" >&2; return 1; }
  (cd "$BUILD_DIR" && sha256sum -c manifest.sha256 >/dev/null) || { echo "错误：统一构建产物摘要校验失败" >&2; return 1; }
  [[ -f "$BUILD_DIR/web/platform/knowledge-center/knowledge-center-management.html" ]] || { echo "错误：知识中心 Web 构建产物不完整" >&2; return 1; }
  [[ -f "$BUILD_DIR/java/classes/Main.class" ]] || { echo "错误：YashanDB Storage 构建产物不完整" >&2; return 1; }
}

build_platform() {
  echo "构建知识中心统一产物..."
  if ! KNOWLEDGE_CENTER_BUILD_ROOT="$BUILD_ROOT_REL" \
    KNOWLEDGE_CENTER_PYTHON_BIN="$PYTHON_BIN" \
    "$BUILD_SCRIPT" >"$LOG_DIR/knowledge-center-build.log" 2>&1; then
    FAILURE_COMPONENT="统一构建"
    FAILURE_LOG="$LOG_DIR/knowledge-center-build.log"
    echo "错误：知识中心构建失败：$LOG_DIR/knowledge-center-build.log" >&2
    tail -n 40 "$LOG_DIR/knowledge-center-build.log" >&2 || true
    return 1
  fi
  validate_build_artifact || return 1
}

stop_service() {
  local name="$1" file pid deadline force_deadline
  file="$(pid_file "$name")"
  [[ -f "$file" ]] || return 0
  pid="$(tr -d '[:space:]' <"$file" 2>/dev/null || true)"
  if ! service_process_matches "$name" "$pid"; then
    if process_alive "$pid"; then
      echo "警告：PID 记录指向非本仓库进程，保留该进程并移除记录：$name $pid" >&2
    fi
    rm -f "$file"
    return 0
  fi
  kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  deadline=$((SECONDS + STOP_TIMEOUT))
  while service_process_matches "$name" "$pid" && (( SECONDS < deadline )); do
    sleep 1
  done
  if service_process_matches "$name" "$pid"; then
    echo "警告：$name 未在 ${STOP_TIMEOUT}s 内退出，对已确认的本仓库进程执行强制终止" >&2
    kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    force_deadline=$((SECONDS + 3))
    while service_process_matches "$name" "$pid" && (( SECONDS < force_deadline )); do
      sleep 1
    done
    if service_process_matches "$name" "$pid"; then
      echo "错误：$name 强制终止后仍然存活，保留 PID 记录以便诊断：$file" >&2
      return 1
    fi
  fi
  rm -f "$file"
  lifecycle_event stop "$name" "$STOP_REASON"
  echo "$name 已停止"
}

stop_all() {
  local failed=0 name
  # auth 已并入 frontend 平台进程；仍受控清理历史独立进程。
  for name in frontend auth pingcode document storage; do
    stop_service "$name" || failed=1
  done
  return "$failed"
}

assert_port_available() {
  local port="$1" listener service pid
  listener="$(ss -ltnp "sport = :$port" 2>/dev/null || true)"
  if grep -q LISTEN <<<"$listener"; then
    if [[ "$NO_TAKEOVER" == "1" ]]; then
      echo "错误：独立实例端口 $port 已被占用，禁止接管或停止现有进程" >&2
      return 1
    fi
    pid="$(sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' <<<"$listener" | head -n 1)"
    for service in document pingcode auth frontend storage; do
      if [[ -n "$pid" ]] && service_process_matches "$service" "$pid"; then
        printf '%s\n' "$pid" >"$(pid_file "$service")"
        echo "检测到 $service 的遗留进程（pid=$pid），先执行受控停止"
        stop_service "$service"
        listener="$(ss -ltnp "sport = :$port" 2>/dev/null || true)"
        if grep -q LISTEN <<<"$listener"; then
          echo "错误：已停止 $service，但端口 $port 仍被占用" >&2
          ss -ltnp "sport = :$port" >&2 || true
          return 1
        fi
        return 0
      fi
    done
    echo "错误：端口 $port 已被未知进程占用，保留现场并停止重启" >&2
    ss -ltnp "sport = :$port" >&2 || true
    return 1
  fi
}

reconcile_known_services() {
  local service port pid
  for service in frontend auth pingcode document storage; do
    port="$(service_port "$service")"
    pid="$(listener_pid "$port")"
    if [[ -n "$pid" ]] && service_process_matches "$service" "$pid"; then
      printf '%s\n' "$pid" >"$(pid_file "$service")"
    fi
  done
}

start_service() {
  local name="$1" cwd="$2" logfile="$3"
  shift 3
  (( $# > 0 )) || { echo "错误：$name 缺少启动命令" >&2; return 1; }
  [[ -d "$cwd" ]] || { echo "错误：$name 工作目录不存在：$cwd" >&2; return 1; }
  archive_service_log "$logfile"
  (
    # 子服务不得继承平台运维锁，否则主脚本退出后锁仍会被长期持有。
    exec 9>&-
    cd "$cwd"
    exec setsid "$@" >"$logfile" 2>&1
  ) &
  local pid=$!
  echo "$pid" >"$(pid_file "$name")"
  lifecycle_event start "$name" "pid=$pid owner=${RUN_OWNER:-shared}"
  STARTED_SERVICES+=("$name")
}

print_component_diagnostic() {
  local name="$1" logfile="$2" mismatch pending
  [[ -f "$logfile" ]] || return 0
  if grep -Fq '数据库迁移摘要不一致' "$logfile"; then
    mismatch="$(grep -F '数据库迁移摘要不一致' "$logfile" | head -n 1 | sed 's/^[[:space:]]*//')"
    echo "诊断：$name 数据库迁移完整性校验失败，平台已停止启动且未修改数据库。" >&2
    echo "详情：$mismatch" >&2
    echo "处理建议：先核对当前数据库环境与构建版本；不要修改已执行 SQL，也不要直接更新 KC_SCHEMA_MIGRATION。" >&2
  elif grep -Fq '存在待执行的数据库迁移' "$logfile"; then
    pending="$(sed -n 's/.*存在待执行的数据库迁移.*：\([0-9][0-9][0-9]_[a-z0-9_]*\).*/\1/p' "$logfile" | head -n 1)"
    echo "原因：数据库还未执行结构迁移${pending:+ $pending}，普通启动不会修改数据库。" >&2
    echo "处理：负责人核对数据库及结构快照后，运行一条修复命令：" >&2
    if [[ "${YASDB_STORAGE_TARGET_CLASS:-}" == personal ]]; then
      echo "  YASDB_STORAGE_TARGET_CLASS=personal ./knowledge-center.sh repair-migrations" >&2
    else
      echo "  YASDB_STORAGE_TARGET_CLASS=shared ./knowledge-center.sh repair-migrations" >&2
      echo "  若目标实际为个人开发库，请将 shared 改为 personal。共享库将在终端要求确认。" >&2
    fi
  elif grep -Eq 'Connection refused|连接.*失败|认证失败|authentication|password' "$logfile"; then
    echo "诊断：$name 无法连接依赖服务，请检查 config/yashandb/ 连接配置、网络和凭据。" >&2
  fi
}

preflight_storage_migrations() {
  local logfile="$LOG_DIR/storage-preflight.log"
  if ! timeout --signal=TERM --kill-after=3s "${DB_PROBE_TIMEOUT}s" \
    env KNOWLEDGE_CENTER_BUILD_ROOT="$BUILD_ROOT_REL" \
      YASDB_STORAGE_SQL_DIR="$BUILD_DIR/java/sql" \
      YASDB_MIGRATION_CHECKSUM_POLICY="$MIGRATION_CHECKSUM_POLICY" \
      "$STORAGE_DIR/start.sh" verify >"$logfile" 2>&1; then
    FAILURE_COMPONENT="storage"
    FAILURE_LOG="$logfile"
    if grep -Fq '存在待执行的数据库迁移' "$logfile"; then
      FAILURE_REASON="pending_migration"
      echo "启动已暂停，现有服务未停止。" >&2
      print_component_diagnostic storage "$logfile"
    else
      echo "错误：数据库结构检查失败，现有服务未停止。详情：$logfile" >&2
      tail -n 12 "$logfile" >&2 || true
    fi
    return 1
  fi
}

print_component_failure_details() {
  local name="$1" logfile="$2"
  if [[ "$name" == storage ]] && grep -Fq '存在待执行的数据库迁移' "$logfile"; then
    print_component_diagnostic "$name" "$logfile"
  else
    tail -n 40 "$logfile" >&2 || true
    print_component_diagnostic "$name" "$logfile"
  fi
}

print_component_warnings() {
  local name="$1" logfile="$2" warning
  [[ -f "$logfile" ]] || return 0
  warning="$(grep -F '警告：数据库迁移摘要不一致' "$logfile" | tail -n 1 || true)"
  if [[ -n "$warning" ]]; then
    echo "启动告警：$name：${warning#警告：}" >&2
  fi
}

wait_ready() {
  local name="$1" url="$2" deadline pid port owner
  deadline=$((SECONDS + START_TIMEOUT))
  pid="$(cat "$(pid_file "$name")")"
  port="$(service_port "$name")"
  while (( SECONDS < deadline )); do
    if ! process_alive "$pid"; then
      FAILURE_COMPONENT="$name"
      FAILURE_LOG="$LOG_DIR/$name.log"
      echo "错误：$name 进程已退出：$LOG_DIR/$name.log" >&2
      print_component_failure_details "$name" "$LOG_DIR/$name.log"
      return 1
    fi
    owner="$(listener_pid "$port")"
    if service_process_matches "$name" "$pid" && [[ "$owner" == "$pid" ]] && http_ready "$url"; then
      print_component_warnings "$name" "$LOG_DIR/$name.log"
      echo "$name 已就绪：$url"
      return 0
    fi
    sleep 1
  done
  FAILURE_COMPONENT="$name"
  FAILURE_LOG="$LOG_DIR/$name.log"
  echo "错误：$name 在 ${START_TIMEOUT}s 内未就绪：$LOG_DIR/$name.log" >&2
  print_component_failure_details "$name" "$LOG_DIR/$name.log"
  return 1
}

rollback_started() {
  local index
  for ((index=${#STARTED_SERVICES[@]} - 1; index >= 0; index--)); do
    stop_service "${STARTED_SERVICES[$index]}" || true
  done
}

start_platform() {
  local token
  validate_environment || return 1
  if (( NO_BUILD == 0 )); then
    build_platform || return 1
  else
    validate_build_artifact || return 1
  fi
  validate_database_connection || return 1
  if [[ "$NO_TAKEOVER" != "1" ]]; then
    reconcile_known_services
    # 14200 是旧认证服务端口。认证模块已并入平台进程，启动时受控清理遗留实例。
    stop_service auth || return 1
  fi
  assert_port_available "$FRONTEND_PORT" || return 1
  assert_port_available "$DOCUMENT_API_PORT" || return 1
  assert_port_available "$PINGCODE_API_PORT" || return 1
  assert_port_available "${YASDB_STORAGE_PORT:-14210}" || return 1

  token="$OUTLINE_INTERNAL_TOKEN"
  if [[ -z "$token" ]]; then
    token="$($NODE_BIN -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
  fi

  STARTED_SERVICES=()
  start_service storage "$STORAGE_DIR" "$LOG_DIR/storage.log" \
    env KNOWLEDGE_CENTER_RUNTIME_DIR="$RUNTIME_DIR" KNOWLEDGE_CENTER_BUILD_ROOT="$BUILD_ROOT_REL" KNOWLEDGE_CENTER_JAVA_BIN="$JAVA_BIN" \
    YASDB_MIGRATION_CHECKSUM_POLICY="$MIGRATION_CHECKSUM_POLICY" \
    YASDB_STORAGE_CLASSES_DIR="$BUILD_DIR/java/classes" YASDB_JDBC_JAR="$BUILD_DIR/java/lib/yashandb-jdbc.jar" \
    YASDB_STORAGE_SQL_DIR="$BUILD_DIR/java/sql" "$STORAGE_DIR/start.sh" || return 1
  wait_ready storage "$(service_url storage)" || { rollback_started; return 1; }
  # 仅统一测试入口显式启用；在业务恢复扫描前完成已批准的隔离夹具初始化。
  if [[ "${KNOWLEDGE_CENTER_E2E_INITIALIZE_PRODUCTION:-0}" == 1 ]]; then
    "$NODE_BIN" "$REPO_ROOT/tools/repository/initialize-e2e-production.cjs" || { rollback_started; return 1; }
  fi

  start_service document "$DOCUMENT_DIR" "$LOG_DIR/document.log" \
    env NODE_PATH="$NODE_MODULE_PATH" PORT="$DOCUMENT_API_PORT" HOST="$INTERNAL_HOST" \
    KNOWLEDGE_CENTER_AUTH_HOST="$INTERNAL_HOST" KNOWLEDGE_CENTER_AUTH_PORT="$FRONTEND_PORT" \
    KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN="$token" "$NODE_BIN" server.js || { rollback_started; return 1; }
  wait_ready document "$(service_url document)" || { rollback_started; return 1; }

  start_service pingcode "$PINGCODE_API_DIR" "$LOG_DIR/pingcode.log" \
    env PYTHONPATH="$PYTHON_MODULE_PATH" PINGCODE_WEB_PORT="$PINGCODE_API_PORT" PINGCODE_WEB_HOST="$PINGCODE_HOST" \
    "$PYTHON_BIN" -m uvicorn app.main:app --host "$PINGCODE_HOST" --port "$PINGCODE_API_PORT" || { rollback_started; return 1; }
  wait_ready pingcode "$(service_url pingcode)" || { rollback_started; return 1; }

  start_service frontend "$FRONTEND_DIR" "$LOG_DIR/frontend.log" \
    env NODE_PATH="$NODE_MODULE_PATH" PORT="$FRONTEND_PORT" KNOWLEDGE_STORAGE_MODE="${KNOWLEDGE_STORAGE_MODE:-database}" YASDB_PASSWORD="${YASDB_PASSWORD:-}" YASDB_STORAGE_URL="${YASDB_STORAGE_URL:-http://127.0.0.1:14210}" YASDB_STORAGE_HOST="${YASDB_STORAGE_HOST:-127.0.0.1}" YASDB_STORAGE_PORT="${YASDB_STORAGE_PORT:-14210}" YASDB_STORAGE_TIMEOUT_MS="${YASDB_STORAGE_TIMEOUT_MS:-15000}" DOCUMENT_API_HOST="$INTERNAL_HOST" DOCUMENT_API_PORT="$DOCUMENT_API_PORT" \
    PINGCODE_API_HOST="$PINGCODE_HOST" PINGCODE_API_PORT="$PINGCODE_API_PORT" \
    KNOWLEDGE_CENTER_PUBLIC_BASE_URL="$PUBLIC_BASE_URL" KNOWLEDGE_CENTER_SERVICE_URL="$PUBLIC_SERVICE_URL" \
    KNOWLEDGE_CENTER_ENVIRONMENT="$KNOWLEDGE_CENTER_ENVIRONMENT" KNOWLEDGE_CENTER_TEST_RUN_ID="${KNOWLEDGE_CENTER_TEST_RUN_ID:-}" \
    KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI="$PUBLIC_OAUTH_REDIRECT_URI" KNOWLEDGE_CENTER_COOKIE_SECURE="$COOKIE_SECURE" \
    KNOWLEDGE_CENTER_FRONTEND_ROOT="$BUILD_DIR/web/platform" \
    KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN="$token" "$NODE_BIN" frontend-server.js || { rollback_started; return 1; }
  wait_ready frontend "$(service_url frontend)" || { rollback_started; return 1; }

  if [[ "${KNOWLEDGE_CENTER_VERIFY_PUBLIC_URL:-1}" == 1 ]] && ! http_ready "$PUBLIC_APP_URL"; then
    FAILURE_COMPONENT="外部访问地址"
    FAILURE_LOG="$LOG_DIR/frontend.log"
    echo "错误：内部服务已就绪，但外部地址不可访问：$PUBLIC_APP_URL" >&2
    echo "处理建议：检查 KNOWLEDGE_CENTER_PUBLIC_BASE_URL、本机路由、防火墙和反向代理。" >&2
    rollback_started
    return 1
  fi

  if [[ -n "$RUN_OWNER" ]]; then
    printf '%s\n' "$RUN_OWNER" >"$(owner_file)"
  else
    rm -f "$(owner_file)"
  fi

  echo "知识中心管理平台已启动：$PUBLIC_APP_URL"
  echo "状态目录：$STATE_DIR"
  echo "日志目录：$LOG_DIR"
}

restart_platform() {
  validate_environment || return 1
  if (( NO_BUILD == 0 )); then
    build_platform || return 1
    NO_BUILD=1
  fi
  validate_database_connection || return 1
  preflight_storage_migrations || return 1
  # restart may follow a manually started or previously interrupted instance
  # whose PID files were not persisted. Reconcile only processes that match
  # this repository's cwd and command contract; unknown listeners remain
  # protected by assert_port_available during start.
  reconcile_known_services
  stop_all || return 1
  start_platform || return 1
}

repair_migrations() {
  local name target_class="${YASDB_STORAGE_TARGET_CLASS:-}"
  case "$target_class" in
    personal) ;;
    shared)
      if [[ ! -t 0 && ( -z "${MIGRATION_APPROVAL_REF:-}" || "${MIGRATION_APPROVAL_REF:-}" == *'<'* || "${MIGRATION_APPROVAL_REF:-}" == *'>'* ) ]]; then
        echo "错误：共享库非交互执行须提供实际的 MIGRATION_APPROVAL_REF；负责人在终端执行时可交互确认。" >&2
        return 1
      fi
      if [[ ! -t 0 && -z "${YASDB_SCHEMA_SNAPSHOT_PATH:-}" ]]; then
        echo "错误：共享库非交互执行须指定 YASDB_SCHEMA_SNAPSHOT_PATH。" >&2
        return 1
      fi
      ;;
    *) echo "错误：请显式设置 YASDB_STORAGE_TARGET_CLASS=personal 或 shared，核对目标库后重试" >&2; return 1 ;;
  esac
  if [[ -n "$(git -C "$REPO_ROOT" status --porcelain -- 'apps/yashandb-storage/sql/*.sql' apps/yashandb-storage/sql/migration-aliases.properties)" ]]; then
    echo "错误：迁移 SQL 尚有未提交修改；请先完成验证并构建已提交版本，当前不会执行旧产物。" >&2
    return 1
  fi
  validate_environment || return 1
  validate_build_artifact || return 1
  for name in frontend auth pingcode document storage; do
    if [[ -n "$(listener_pid "$(service_port "$name")")" ]]; then
      echo "错误：$name 端口仍被占用，请先停止平台并确认目标库无运行中的写入" >&2
      return 1
    fi
  done
  validate_database_connection || return 1
  if [[ "$target_class" == shared ]]; then
    confirm_shared_migration || return 1
  fi
  echo "目标类别：$target_class；迁移来源：$BUILD_DIR/java/sql/migration-source.properties"
  "$STORAGE_DIR/start.sh" migrate || return 1
  YASDB_MIGRATION_CHECKSUM_POLICY=strict "$STORAGE_DIR/start.sh" verify || return 1
  NO_BUILD=1
  start_platform
}

confirm_shared_migration() {
  local reply approval_log snapshot_path="${YASDB_SCHEMA_SNAPSHOT_PATH:-}" snapshot_sha approval_method approval_ref="${MIGRATION_APPROVAL_REF:-}"
  if [[ -z "$snapshot_path" && -t 0 ]]; then
    read -r -p '请输入目标库迁移前结构快照文件的绝对路径：' snapshot_path
  fi
  [[ "$snapshot_path" == /* && -f "$snapshot_path" && -s "$snapshot_path" && -r "$snapshot_path" ]] || {
    echo "错误：结构快照必须是目标库导出的可读、非空文件，不能填 SQL 源目录。" >&2
    return 1
  }
  snapshot_sha="$(sha256sum "$snapshot_path" | awk '{print $1}')"
  if [[ -n "${MIGRATION_APPROVAL_REF:-}" && "${MIGRATION_APPROVAL_REF}" != *'<'* && "${MIGRATION_APPROVAL_REF}" != *'>'* ]]; then
    approval_method=reference
  else
    if [[ ! -t 0 ]]; then
      echo "错误：共享库非交互执行须提供实际的 MIGRATION_APPROVAL_REF。" >&2
      return 1
    fi
    echo "即将迁移共享数据库：${YASDB_JDBC_URL:-未配置}；SQL 来源：$BUILD_DIR/java/sql/migration-source.properties" >&2
    echo "结构快照：$snapshot_path（SHA-256：$snapshot_sha）" >&2
    echo "确认已获批准，且已核对目标库、快照和迁移 SQL。" >&2
    read -r -p '负责人请输入“批准执行共享库迁移”继续：' reply
    [[ "$reply" == '批准执行共享库迁移' ]] || { echo "已取消共享库迁移。" >&2; return 1; }
    approval_method=terminal
    approval_ref=""
  fi
  umask 077
  approval_log="$(mktemp "$STATE_DIR/migration-approval-$(date +%Y%m%dT%H%M%S)-XXXXXX.log")"
  printf 'approvedAt=%s\napprovedBy=%s\ntarget=%s\nsource=%s\nmethod=%s\napprovalRef=%s\nsnapshot=%s\nsnapshotSha256=%s\n' \
    "$(date -Is)" "${OPERATION_ACTOR}" "${YASDB_JDBC_URL:-}" \
    "$BUILD_DIR/java/sql/migration-source.properties" "$approval_method" "$approval_ref" \
    "$snapshot_path" "$snapshot_sha" >"$approval_log"
  echo "本次确认记录：$approval_log"
}

print_failure_summary() {
  echo "知识中心操作失败。" >&2
  if [[ "$FAILURE_REASON" == pending_migration ]]; then
    echo "迁移检查日志：$FAILURE_LOG" >&2
    return 0
  fi
  if [[ -n "$FAILURE_COMPONENT" ]]; then
    echo "失败阶段：$FAILURE_COMPONENT" >&2
  fi
  if [[ -n "$FAILURE_LOG" ]]; then
    echo "失败日志：$FAILURE_LOG" >&2
  fi
  if validate_port_configuration >/dev/null 2>&1 \
    && [[ -n "$INTERNAL_HOST" && -n "$PUBLIC_BASE_URL" && -n "$PINGCODE_HOST" ]]; then
    echo "当前组件状态：" >&2
    status_platform 1>&2 || true
  else
    echo "当前配置无法安全计算组件状态；未基于非法端口执行健康判断。" >&2
  fi
  echo "日志目录：$LOG_DIR" >&2
  echo "构建日志：$LOG_DIR/knowledge-center-build.log" >&2
  echo "完整诊断：$0 doctor" >&2
  echo "依赖安装：$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply" >&2
}

status_platform() {
  local failed=0 healthy=0 total=4 name pid url port owner state reason
  for name in document pingcode frontend storage; do
    pid="$(cat "$(pid_file "$name")" 2>/dev/null || true)"
    url="$(service_url "$name")"
    port="$(service_port "$name")"
    owner="$(listener_pid "$port")"
    if service_process_matches "$name" "$pid" && [[ "$owner" == "$pid" ]] && http_ready "$url"; then
      state=running
      reason=healthy
      healthy=$((healthy + 1))
    else
      state=stopped-or-unhealthy
      failed=1
      if [[ -z "$pid" ]]; then
        reason=pid-file-missing
      elif ! process_alive "$pid"; then
        reason=process-exited
      elif ! service_process_matches "$name" "$pid"; then
        reason=process-identity-mismatch
      elif [[ -z "$owner" ]]; then
        reason=port-not-listening
      elif [[ "$owner" != "$pid" ]]; then
        reason="port-owned-by-$owner"
      else
        reason=http-health-check-failed
      fi
    fi
    if (( VERBOSE == 1 )); then
      echo "$name: $state reason=$reason pid=${pid:-unknown} url=$url"
    fi
  done
  if (( failed == 0 )); then
    echo "知识中心管理平台：运行中"
  else
    echo "知识中心管理平台：部分组件异常"
  fi
  echo "访问地址：$PUBLIC_APP_URL"
  echo "内部组件：$healthy/$total 正常（认证作为平台内置模块运行）"
  (( VERBOSE == 1 )) || echo "详细诊断：$0 status --verbose"
  return "$failed"
}

platform_healthy() {
  status_platform >/dev/null 2>&1
}

case "$ACTION" in
  help|-h|--help)
    echo "用法：$0 {start|stop|restart|repair-migrations|status|doctor|logs} [--no-build|--verbose|--commands|--json]"
    echo "  start    启动知识中心平台；已运行的同名服务会先受控接管"
    echo "  stop     停止知识中心平台服务，不操作 YashanDB 数据库实例"
    echo "  restart  停止后重新启动全部平台服务"
    echo "  repair-migrations  显式迁移、严格校验并启动平台；要求声明目标类别"
    echo "  status   显示统一平台状态，不暴露内部诊断端点"
    echo "  doctor   只诊断当前环境，不安装或修改系统"
    echo "  logs     压缩日志、生成诊断包或查看日志占用"
    echo "  --no-build  启动/重启时复用已有统一构建产物"
    echo "  --verbose   status 时显示内部组件、PID 和诊断端点"
    echo "  --commands  doctor 时只输出可复制的处置命令"
    echo "  --json      doctor 时输出结构化 JSON"
    ;;
  doctor)
    [[ "$DOCTOR_FORMAT" == json ]] || print_legacy_public_host_warning
    run_doctor "$DOCTOR_FORMAT"
    ;;
  start)
    print_legacy_public_host_warning
    acquire_operation_lock
    validate_environment || { print_failure_summary; exit 1; }
    if [[ "$NO_TAKEOVER" != "1" ]]; then
      reconcile_known_services
      stop_service auth
      if platform_healthy; then
        echo "知识中心管理平台已在运行：$PUBLIC_APP_URL"
        exit 0
      fi
      stop_all || { print_failure_summary; exit 1; }
    fi
    start_platform || { print_failure_summary; exit 1; }
    ;;
  restart)
    print_legacy_public_host_warning
    acquire_operation_lock
    restart_platform || { print_failure_summary; exit 1; }
    ;;
  repair-migrations)
    print_legacy_public_host_warning
    acquire_operation_lock
    repair_migrations || { print_failure_summary; exit 1; }
    ;;
  status)
    print_legacy_public_host_warning
    status_platform
    ;;
  stop)
    acquire_operation_lock
    validate_positive_integer KNOWLEDGE_CENTER_STOP_TIMEOUT "$STOP_TIMEOUT"
    validate_port_configuration
    assert_expected_owner
    reconcile_known_services
    stop_all || { print_failure_summary; exit 1; }
    rm -f "$(owner_file)"
    ;;
  *)
    echo "用法：$0 {start|stop|restart|repair-migrations|status|doctor}" >&2
    exit 2
    ;;
esac

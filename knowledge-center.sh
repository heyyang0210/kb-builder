#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
ENV_FILE="${KNOWLEDGE_CENTER_ENV_FILE:-$REPO_ROOT/config/knowledge-center/.env}"

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
# 数据库存储服务与 Node/Python 入口共享 config/yashandb 的连接参数。
# 显式注入的环境变量优先，开发环境无需手工导出密码。
if [[ -f "$REPO_ROOT/tools/repository/load-yashandb-env.sh" ]]; then
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
if is_placeholder "${KNOWLEDGE_CENTER_INTERNAL_HOST:-}"; then
  unset KNOWLEDGE_CENTER_INTERNAL_HOST
fi

DOCUMENT_DIR="$REPO_ROOT/apps/knowledge-center-api"
AUTH_DIR="$REPO_ROOT/apps/knowledge-center-auth"
FRONTEND_DIR="$REPO_ROOT/apps/knowledge-center-web"
PINGCODE_API_DIR="$REPO_ROOT/apps/pingcode-api"
PINGCODE_WEB_DIR="$REPO_ROOT/apps/pingcode-web"
PINGCODE_CORE_DIR="$REPO_ROOT/packages/pingcode-core"
STORAGE_DIR="$REPO_ROOT/apps/yashandb-storage"
RUNTIME_DIR="$REPO_ROOT/runtime/agent-runner"
LOG_DIR="${KNOWLEDGE_CENTER_LOG_DIR:-$RUNTIME_DIR/logs/knowledge-center-isolated}"
STATE_DIR="${KNOWLEDGE_CENTER_STATE_DIR:-$RUNTIME_DIR/.runtime/knowledge-center-isolated}"

FRONTEND_PORT="${KNOWLEDGE_CENTER_FRONTEND_PORT:-13510}"
DOCUMENT_API_PORT="${KNOWLEDGE_CENTER_DOCUMENT_API_PORT:-14110}"
PINGCODE_API_PORT="${KNOWLEDGE_CENTER_PINGCODE_API_PORT:-18010}"
AUTH_API_PORT="${KNOWLEDGE_CENTER_AUTH_PORT:-14200}"
INTERNAL_HOST="${KNOWLEDGE_CENTER_INTERNAL_HOST:-127.0.0.1}"
PUBLIC_HOST="${KNOWLEDGE_CENTER_PUBLIC_HOST:-192.168.130.180}"
PINGCODE_HOST="${KNOWLEDGE_CENTER_PINGCODE_HOST:-127.0.0.1}"
STOP_TIMEOUT="${KNOWLEDGE_CENTER_STOP_TIMEOUT:-10}"
START_TIMEOUT="${KNOWLEDGE_CENTER_START_TIMEOUT:-45}"
NODE_BIN="${KNOWLEDGE_CENTER_NODE_BIN:-node}"
NPM_BIN="${KNOWLEDGE_CENTER_NPM_BIN:-npm}"
PYTHON_BIN="${KNOWLEDGE_CENTER_PYTHON_BIN:-}"
NODE_MODULE_PATH="${KNOWLEDGE_CENTER_NODE_PATH:-$REPO_ROOT/node_modules:$RUNTIME_DIR/node_modules}"
PYTHON_MODULE_PATH="$PINGCODE_API_DIR:$PINGCODE_CORE_DIR${PYTHONPATH:+:$PYTHONPATH}"
OUTLINE_INTERNAL_TOKEN="${KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN:-}"
ACTION="${1:-help}"
NO_BUILD=0
if [[ -n "${2:-}" ]]; then
  [[ "$2" == "--no-build" ]] || { echo "错误：未知参数：$2" >&2; exit 2; }
  [[ "$ACTION" == start || "$ACTION" == restart ]] || { echo "错误：--no-build 仅适用于 start/restart" >&2; exit 2; }
  NO_BUILD=1
fi
[[ -z "${3:-}" ]] || { echo "错误：参数过多" >&2; exit 2; }

if [[ -z "$PYTHON_BIN" ]]; then
  if [[ -x "$PINGCODE_API_DIR/.venv/bin/python" ]] && "$PINGCODE_API_DIR/.venv/bin/python" -c 'import uvicorn' >/dev/null 2>&1; then
    PYTHON_BIN="$PINGCODE_API_DIR/.venv/bin/python"
  else
    PYTHON_BIN="python3"
  fi
fi

mkdir -p "$LOG_DIR" "$STATE_DIR"

acquire_operation_lock() {
  command -v flock >/dev/null 2>&1 || { echo "错误：缺少命令：flock" >&2; return 1; }
  exec 9>"$STATE_DIR/operation.lock"
  flock -n 9 || { echo "错误：已有知识中心启停操作正在执行，请稍后重试" >&2; return 1; }
}

pid_file() {
  printf '%s/%s.pid' "$STATE_DIR" "$1"
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
  local service="$1" pid="$2" cmdline
  if [[ "$service" != storage ]]; then
    process_matches "$pid" "$(service_cwd "$service")" "$(service_pattern "$service")"
    return
  fi

  [[ "$pid" =~ ^[0-9]+$ && -d "/proc/$pid" ]] || return 1
  [[ "$(awk '/^State:/ {print $2}' "/proc/$pid/status" 2>/dev/null || true)" != "Z" ]] || return 1
  cmdline="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
  [[ "$cmdline" == *java* ]] || return 1
  [[ "$cmdline" == *"$STORAGE_DIR/src/Main.java"* || "$cmdline" == *"$STORAGE_DIR/lib/yashandb-jdbc.jar"*Main* ]]
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

validate_environment() {
  local command_name directory
  for command_name in "$NODE_BIN" "$NPM_BIN" "$PYTHON_BIN" curl ss setsid java sha256sum; do
    if [[ "$command_name" == */* ]]; then
      [[ -x "$command_name" ]] || { echo "错误：命令不可执行：$command_name" >&2; return 1; }
    else
      command -v "$command_name" >/dev/null 2>&1 || { echo "错误：缺少命令：$command_name" >&2; return 1; }
    fi
  done
  for directory in "$DOCUMENT_DIR" "$AUTH_DIR" "$FRONTEND_DIR" "$PINGCODE_API_DIR" "$PINGCODE_WEB_DIR" "$PINGCODE_CORE_DIR" "$STORAGE_DIR"; do
    [[ -d "$directory" ]] || { echo "错误：目录不存在：$directory" >&2; return 1; }
  done
  [[ -f "$DOCUMENT_DIR/server.js" ]] || { echo "错误：文档 API 入口不存在" >&2; return 1; }
  [[ -f "$AUTH_DIR/auth-server.js" ]] || { echo "错误：认证 API 入口不存在" >&2; return 1; }
  [[ -f "$FRONTEND_DIR/frontend-server.js" ]] || { echo "错误：Web 网关入口不存在" >&2; return 1; }
  [[ -f "$PINGCODE_API_DIR/app/main.py" ]] || { echo "错误：资料加工 API 入口不存在" >&2; return 1; }
  [[ -f "$STORAGE_DIR/start.sh" ]] || { echo "错误：YashanDB 存储服务入口不存在" >&2; return 1; }
}

build_frontend() {
  echo "构建 PingCode Web..."
  if ! "$NPM_BIN" --prefix "$PINGCODE_WEB_DIR" run build >"$LOG_DIR/pingcode-web-build.log" 2>&1; then
    echo "错误：PingCode Web 构建失败：$LOG_DIR/pingcode-web-build.log" >&2
    return 1
  fi
}

stop_service() {
  local name="$1" file pid deadline
  file="$(pid_file "$name")"
  [[ -f "$file" ]] || return 0
  pid="$(tr -d '[:space:]' <"$file" 2>/dev/null || true)"
  if ! service_process_matches "$name" "$pid"; then
    echo "警告：移除失效 PID 记录，不停止未知进程：$name ${pid:-空}" >&2
    rm -f "$file"
    return 0
  fi
  kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  deadline=$((SECONDS + STOP_TIMEOUT))
  while service_process_matches "$name" "$pid" && (( SECONDS < deadline )); do
    sleep 1
  done
  if service_process_matches "$name" "$pid"; then
    echo "错误：$name 未在 ${STOP_TIMEOUT}s 内退出，拒绝强制终止" >&2
    return 1
  fi
  rm -f "$file"
  echo "$name 已停止"
}

stop_all() {
  local failed=0 name
  for name in frontend auth pingcode document storage; do
    stop_service "$name" || failed=1
  done
  return "$failed"
}

assert_port_available() {
  local port="$1" listener service pid
  listener="$(ss -ltnp "sport = :$port" 2>/dev/null || true)"
  if grep -q LISTEN <<<"$listener"; then
    pid="$(sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' <<<"$listener" | head -n 1)"
    for service in document pingcode auth frontend storage; do
      if [[ -n "$pid" ]] && service_process_matches "$service" "$pid"; then
        printf '%s\n' "$pid" >"$(pid_file "$service")"
        echo "检测到 $service 的遗留进程（pid=$pid），先执行受控停止"
        stop_service "$service"
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
  (
    # 子服务不得继承平台运维锁，否则主脚本退出后锁仍会被长期持有。
    exec 9>&-
    cd "$cwd"
    exec setsid "$@" >"$logfile" 2>&1
  ) &
  local pid=$!
  echo "$pid" >"$(pid_file "$name")"
  STARTED_SERVICES+=("$name")
}

wait_ready() {
  local name="$1" url="$2" deadline pid port owner
  deadline=$((SECONDS + START_TIMEOUT))
  pid="$(cat "$(pid_file "$name")")"
  port="$(service_port "$name")"
  while (( SECONDS < deadline )); do
    if ! process_alive "$pid"; then
      echo "错误：$name 进程已退出：$LOG_DIR/$name.log" >&2
      tail -n 40 "$LOG_DIR/$name.log" >&2 || true
      return 1
    fi
    owner="$(listener_pid "$port")"
    if service_process_matches "$name" "$pid" && [[ "$owner" == "$pid" ]] && http_ready "$url"; then
      echo "$name 已就绪：$url"
      return 0
    fi
    sleep 1
  done
  echo "错误：$name 在 ${START_TIMEOUT}s 内未就绪：$LOG_DIR/$name.log" >&2
  tail -n 40 "$LOG_DIR/$name.log" >&2 || true
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
  validate_environment
  if (( NO_BUILD == 0 )); then build_frontend; fi
  reconcile_known_services
  assert_port_available "$FRONTEND_PORT"
  assert_port_available "$AUTH_API_PORT"
  assert_port_available "$DOCUMENT_API_PORT"
  assert_port_available "$PINGCODE_API_PORT"
  assert_port_available "${YASDB_STORAGE_PORT:-14210}"

  token="$OUTLINE_INTERNAL_TOKEN"
  if [[ -z "$token" ]]; then
    token="$($NODE_BIN -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
  fi

  STARTED_SERVICES=()
  start_service storage "$STORAGE_DIR" "$LOG_DIR/storage.log" \
    env KNOWLEDGE_CENTER_RUNTIME_DIR="$RUNTIME_DIR" "$STORAGE_DIR/start.sh"
  wait_ready storage "$(service_url storage)" || { rollback_started; return 1; }

  start_service document "$DOCUMENT_DIR" "$LOG_DIR/document.log" \
    env NODE_PATH="$NODE_MODULE_PATH" PORT="$DOCUMENT_API_PORT" HOST="$INTERNAL_HOST" \
    KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN="$token" "$NODE_BIN" server.js
  wait_ready document "$(service_url document)" || { rollback_started; return 1; }

  start_service pingcode "$PINGCODE_API_DIR" "$LOG_DIR/pingcode.log" \
    env PYTHONPATH="$PYTHON_MODULE_PATH" PINGCODE_WEB_PORT="$PINGCODE_API_PORT" PINGCODE_WEB_HOST="$PINGCODE_HOST" \
    "$PYTHON_BIN" -m uvicorn app.main:app --host "$PINGCODE_HOST" --port "$PINGCODE_API_PORT"
  wait_ready pingcode "$(service_url pingcode)" || { rollback_started; return 1; }

  start_service auth "$AUTH_DIR" "$LOG_DIR/auth.log" \
    env NODE_PATH="$NODE_MODULE_PATH" KNOWLEDGE_CENTER_AUTH_PORT="$AUTH_API_PORT" KNOWLEDGE_CENTER_AUTH_HOST="$INTERNAL_HOST" \
    KNOWLEDGE_CENTER_SERVICE_URL="http://$PUBLIC_HOST:$FRONTEND_PORT/knowledge-center/" KNOWLEDGE_CENTER_COOKIE_SECURE=false \
    "$NODE_BIN" auth-server.js
  wait_ready auth "$(service_url auth)" || { rollback_started; return 1; }

  start_service frontend "$FRONTEND_DIR" "$LOG_DIR/frontend.log" \
    env NODE_PATH="$NODE_MODULE_PATH" PORT="$FRONTEND_PORT" KNOWLEDGE_STORAGE_MODE="${KNOWLEDGE_STORAGE_MODE:-database}" YASDB_PASSWORD="${YASDB_PASSWORD:-}" YASDB_STORAGE_URL="${YASDB_STORAGE_URL:-http://127.0.0.1:14210}" YASDB_STORAGE_HOST="${YASDB_STORAGE_HOST:-127.0.0.1}" YASDB_STORAGE_PORT="${YASDB_STORAGE_PORT:-14210}" YASDB_STORAGE_TIMEOUT_MS="${YASDB_STORAGE_TIMEOUT_MS:-15000}" DOCUMENT_API_HOST="$INTERNAL_HOST" DOCUMENT_API_PORT="$DOCUMENT_API_PORT" \
    PINGCODE_API_HOST="$PINGCODE_HOST" PINGCODE_API_PORT="$PINGCODE_API_PORT" KNOWLEDGE_CENTER_AUTH_HOST="$INTERNAL_HOST" \
    KNOWLEDGE_CENTER_AUTH_PORT="$AUTH_API_PORT" KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN="$token" "$NODE_BIN" frontend-server.js
  wait_ready frontend "$(service_url frontend)" || { rollback_started; return 1; }

  echo "知识中心管理平台已启动：http://$PUBLIC_HOST:$FRONTEND_PORT/knowledge-center/"
  echo "状态目录：$STATE_DIR"
  echo "日志目录：$LOG_DIR"
}

restart_platform() {
  validate_environment
  if (( NO_BUILD == 0 )); then
    build_frontend
    NO_BUILD=1
  fi
  stop_all
  start_platform
}

status_platform() {
  local failed=0 name pid url port owner
  for name in document pingcode auth frontend storage; do
    pid="$(cat "$(pid_file "$name")" 2>/dev/null || true)"
    url="$(service_url "$name")"
    port="$(service_port "$name")"
    owner="$(listener_pid "$port")"
    if service_process_matches "$name" "$pid" && [[ "$owner" == "$pid" ]] && http_ready "$url"; then
      echo "$name: running pid=$pid url=$url"
    else
      echo "$name: stopped-or-unhealthy url=$url"
      failed=1
    fi
  done
  return "$failed"
}

platform_healthy() {
  status_platform >/dev/null 2>&1
}

case "$ACTION" in
  help|-h|--help)
    echo "用法：$0 {start|stop|restart|status} [--no-build]"
    echo "  start    启动知识中心平台；已运行的同名服务会先受控接管"
    echo "  stop     停止知识中心平台服务，不操作 YashanDB 数据库实例"
    echo "  restart  停止后重新启动全部平台服务"
    echo "  status   检查进程、端口归属和健康接口"
    echo "  --no-build  启动/重启时跳过 PingCode Web 构建"
    ;;
  start)
    acquire_operation_lock
    reconcile_known_services
    if platform_healthy; then
      echo "知识中心管理平台已在运行：http://$PUBLIC_HOST:$FRONTEND_PORT/knowledge-center/"
      exit 0
    fi
    stop_all
    start_platform
    ;;
  restart)
    acquire_operation_lock
    restart_platform
    ;;
  status)
    status_platform
    ;;
  stop)
    acquire_operation_lock
    reconcile_known_services
    stop_all
    ;;
  *)
    echo "用法：$0 {start|stop|restart|status} [--no-build]" >&2
    exit 2
    ;;
esac

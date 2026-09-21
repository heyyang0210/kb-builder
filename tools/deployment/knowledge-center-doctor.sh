#!/usr/bin/env bash

# 由根目录 knowledge-center.sh 加载。本文件只定义诊断函数，不单独修改系统。

doctor_reset() {
  DOCTOR_STATUS=()
  DOCTOR_CODE=()
  DOCTOR_LABEL=()
  DOCTOR_CURRENT=()
  DOCTOR_REQUIREMENT=()
  DOCTOR_IMPACT=()
  DOCTOR_COMMAND=()
  DOCTOR_AUTOMATIC=()
  DOCTOR_VERIFY=()
  DOCTOR_FAIL_COUNT=0
  DOCTOR_WARN_COUNT=0
}

doctor_label() {
  case "$1" in
    os-family) printf '%s' '操作系统适配' ;;
    base-tools) printf '%s' '基础系统工具' ;;
    java-version) printf '%s' 'Java 运行时' ;;
    node-version) printf '%s' 'Node.js 运行时' ;;
    python-version) printf '%s' 'Python 运行时' ;;
    python-modules) printf '%s' 'Python 运行依赖' ;;
    playwright-browser) printf '%s' 'Playwright Chromium' ;;
    node-modules) printf '%s' 'Node.js 运行依赖' ;;
    public-url) printf '%s' '对外访问地址' ;;
    platform-env) printf '%s' '平台环境配置' ;;
    database-env) printf '%s' '数据库唯一配置' ;;
    admin-password) printf '%s' '管理员密码' ;;
    internal-token) printf '%s' '内部服务令牌' ;;
    build-artifact) printf '%s' '统一构建产物' ;;
    database-probe) printf '%s' '数据库连通性' ;;
    migration-integrity) printf '%s' '数据库迁移完整性' ;;
    disk-space) printf '%s' '磁盘空间' ;;
    memory) printf '%s' '可用内存' ;;
    time-sync) printf '%s' '系统时间同步' ;;
    *) printf '%s' "$1" ;;
  esac
}

doctor_add() {
  local status="$1" code="$2" current="$3" requirement="$4" impact="$5"
  local command="${6:-}" automatic="${7:-}" verify="${8:-}"
  DOCTOR_STATUS+=("$status")
  DOCTOR_CODE+=("$code")
  DOCTOR_LABEL+=("$(doctor_label "$code")")
  DOCTOR_CURRENT+=("$current")
  DOCTOR_REQUIREMENT+=("$requirement")
  DOCTOR_IMPACT+=("$impact")
  DOCTOR_COMMAND+=("$command")
  DOCTOR_AUTOMATIC+=("$automatic")
  DOCTOR_VERIFY+=("$verify")
  [[ "$status" != FAIL ]] || DOCTOR_FAIL_COUNT=$((DOCTOR_FAIL_COUNT + 1))
  [[ "$status" != WARN ]] || DOCTOR_WARN_COUNT=$((DOCTOR_WARN_COUNT + 1))
}

doctor_command_exists() {
  local command_name="$1"
  if [[ "$command_name" == */* ]]; then
    [[ -x "$command_name" ]]
  else
    command -v "$command_name" >/dev/null 2>&1
  fi
}

doctor_version_major() {
  local version="$1"
  version="${version#v}"
  version="${version#1.}"
  printf '%s' "${version%%[^0-9]*}"
}

doctor_detect_platform() {
  local os_file="${KNOWLEDGE_CENTER_OS_RELEASE_FILE:-/etc/os-release}"
  DOCTOR_OS_ID=unknown
  DOCTOR_OS_LIKE=""
  if [[ -r "$os_file" ]]; then
    DOCTOR_OS_ID="$(sed -n 's/^ID=//p' "$os_file" | head -n 1 | tr -d '"' | tr '[:upper:]' '[:lower:]')"
    DOCTOR_OS_LIKE="$(sed -n 's/^ID_LIKE=//p' "$os_file" | head -n 1 | tr -d '"' | tr '[:upper:]' '[:lower:]')"
  fi
  if [[ "$DOCTOR_OS_ID $DOCTOR_OS_LIKE" =~ (kylin|rhel|fedora|centos|rocky|almalinux|anolis|opencloudos) ]]; then
    if command -v dnf >/dev/null 2>&1; then
      DOCTOR_PACKAGE_MANAGER=dnf
    else
      DOCTOR_PACKAGE_MANAGER=yum
    fi
    DOCTOR_PLATFORM_FAMILY=rpm
  elif [[ "$DOCTOR_OS_ID $DOCTOR_OS_LIKE" =~ (ubuntu|debian) ]]; then
    DOCTOR_PACKAGE_MANAGER=apt-get
    DOCTOR_PLATFORM_FAMILY=deb
  else
    DOCTOR_PACKAGE_MANAGER=""
    DOCTOR_PLATFORM_FAMILY=unknown
  fi
}

doctor_package_command() {
  local component="$1"
  case "$DOCTOR_PLATFORM_FAMILY:$component" in
    rpm:base) printf 'sudo %s install -y curl ca-certificates tar gzip unzip git procps-ng iproute util-linux' "$DOCTOR_PACKAGE_MANAGER" ;;
    deb:base) printf 'sudo apt-get update && sudo apt-get install -y curl ca-certificates tar gzip unzip git procps iproute2 util-linux' ;;
    rpm:java) printf 'sudo %s install -y java-17-openjdk-headless' "$DOCTOR_PACKAGE_MANAGER" ;;
    deb:java) printf 'sudo apt-get update && sudo apt-get install -y openjdk-17-jre-headless' ;;
    rpm:python) printf 'sudo %s install -y python3.11 python3.11-pip' "$DOCTOR_PACKAGE_MANAGER" ;;
    deb:python) printf 'sudo apt-get update && sudo apt-get install -y python3.11 python3.11-venv python3-pip' ;;
    rpm:node) printf 'sudo %s install -y nodejs npm' "$DOCTOR_PACKAGE_MANAGER" ;;
    deb:node) printf 'sudo apt-get update && sudo apt-get install -y nodejs npm' ;;
    *) printf '%s' '当前发行版未内置在线安装命令，请使用 --offline-bundle' ;;
  esac
}

doctor_file_mode() {
  stat -c '%a' "$1" 2>/dev/null || printf unknown
}

doctor_collect() {
  local current version major missing="" command_name mode available_kb memory_kb ntp_state
  local service_env="${YASDB_CONFIG_DIR:-$REPO_ROOT/config/yashandb}/service.env"
  doctor_reset
  doctor_detect_platform

  if [[ "$DOCTOR_PLATFORM_FAMILY" == unknown ]]; then
    doctor_add WARN os-family "操作系统 ${DOCTOR_OS_ID:-unknown}" "Kylin/RPM 系或 Ubuntu/DEB 系 Linux" \
      "无法生成经验证的在线包管理命令" "使用经校验的离线包" \
      "$REPO_ROOT/tools/deployment/install-knowledge-center.sh --offline-bundle <目录>" "cat /etc/os-release"
  else
    doctor_add PASS os-family "$DOCTOR_OS_ID（$DOCTOR_PLATFORM_FAMILY）" "受支持的 Linux 发行系" "可生成对应安装命令"
  fi

  for command_name in curl ss setsid sha256sum flock git tar gzip; do
    doctor_command_exists "$command_name" || missing+="${missing:+, }$command_name"
  done
  if [[ -n "$missing" ]]; then
    doctor_add FAIL base-tools "缺少：$missing" "curl/ss/setsid/sha256sum/flock/git/tar/gzip 可用" \
      "无法执行安全启停、摘要校验或安装" "$(doctor_package_command base)" \
      "$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply --component base" "command -v curl ss setsid sha256sum flock git tar gzip"
  else
    doctor_add PASS base-tools "基础命令已就绪" "基础运维命令可用" "可执行启停与安装"
  fi

  if doctor_command_exists "$JAVA_BIN"; then
    version="$("$JAVA_BIN" -version 2>&1 | head -n 1 | sed -E 's/.*version "?([^" ]+).*/\1/')"
    major="$(doctor_version_major "$version")"
    if [[ "$major" =~ ^[0-9]+$ ]] && (( major >= 17 )); then
      doctor_add PASS java-version "Java $version" "Java 17+" "YashanDB Storage 可运行"
    else
      doctor_add FAIL java-version "Java ${version:-unknown}" "Java 17+" "无法加载已编译的存储服务 class" \
        "$(doctor_package_command java)" "$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply --component java" 'java -version'
    fi
  else
    doctor_add FAIL java-version "未找到 $JAVA_BIN" "Java 17+" "无法启动 YashanDB Storage" \
      "$(doctor_package_command java)" "$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply --component java" 'java -version'
  fi

  if doctor_command_exists "$NODE_BIN"; then
    version="$("$NODE_BIN" --version 2>/dev/null || true)"
    major="$(doctor_version_major "$version")"
    if [[ "$major" =~ ^[0-9]+$ ]] && (( major >= 20 )); then
      doctor_add PASS node-version "Node.js $version" "Node.js 20+" "Node 服务与前端构建可运行"
    else
      doctor_add FAIL node-version "Node.js ${version:-unknown}" "Node.js 20+" "构建或 Node 服务可能不兼容" \
        "$(doctor_package_command node)" "$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply --component node" 'node --version && npm --version'
    fi
  else
    doctor_add FAIL node-version "未找到 $NODE_BIN" "Node.js 20+" "无法构建或启动 Node 服务" \
      "$(doctor_package_command node)" "$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply --component node" 'node --version && npm --version'
  fi

  if doctor_command_exists "$PYTHON_BIN"; then
    version="$("$PYTHON_BIN" -c 'import platform; print(platform.python_version())' 2>/dev/null || true)"
    major="${version%%.*}"
    current="${version#*.}"
    current="${current%%.*}"
    if [[ "$major" =~ ^[0-9]+$ && "$current" =~ ^[0-9]+$ ]] && (( major > 3 || (major == 3 && current >= 10) )); then
      doctor_add PASS python-version "Python $version" "Python 3.10+" "PingCode API 可运行"
    else
      doctor_add FAIL python-version "Python ${version:-unknown}" "Python 3.10+" "FastAPI 与当前依赖无法可靠运行" \
        "$(doctor_package_command python)" "$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply --component python" 'runtime/venvs/knowledge-center/bin/python --version'
    fi
    if "$PYTHON_BIN" -c 'import uvicorn, fastapi, pydantic, playwright' >/dev/null 2>&1; then
      doctor_add PASS python-modules "uvicorn/fastapi/pydantic/playwright 可导入" "Python 运行依赖完整" "PingCode API 和抓取能力可加载"
    else
      doctor_add FAIL python-modules "缺少一个或多个必需 Python 模块" "uvicorn/fastapi/pydantic/playwright 全部可导入" \
        "PingCode API 可在启动时失败" \
        "$PYTHON_BIN -m pip install -r $REPO_ROOT/apps/pingcode-api/requirements.txt" \
        "$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply --component python" \
        "$PYTHON_BIN -c 'import uvicorn, fastapi, pydantic, playwright'"
    fi
    if "$PYTHON_BIN" -c 'from pathlib import Path; from playwright.sync_api import sync_playwright; p = sync_playwright().start(); executable = Path(p.chromium.executable_path); p.stop(); raise SystemExit(0 if executable.is_file() else 1)' >/dev/null 2>&1; then
      doctor_add PASS playwright-browser "Chromium 可执行制品已安装" "Playwright Chromium 可用" "PingCode 浏览器抓取链路可启动"
    else
      doctor_add FAIL playwright-browser "Chromium 可执行制品缺失" "Playwright Chromium 安装在项目运行目录" \
        "PingCode 首次启动浏览器时会失败" \
        "PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-$REPO_ROOT/runtime/browsers/playwright} $PYTHON_BIN -m playwright install chromium" \
        "$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply --component python" \
        "$PYTHON_BIN -c 'from playwright.sync_api import sync_playwright; p=sync_playwright().start(); b=p.chromium.launch(headless=True); b.close(); p.stop()'"
    fi
  else
    doctor_add FAIL python-version "未找到 $PYTHON_BIN" "Python 3.10+" "无法启动 PingCode API" \
      "$(doctor_package_command python)" "$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply --component python" 'python3 --version'
  fi

  if doctor_command_exists "$NODE_BIN" && NODE_PATH="$NODE_MODULE_PATH" "$NODE_BIN" -e "require('express'); require('socket.io'); require('xlsx')" >/dev/null 2>&1; then
    doctor_add PASS node-modules "express/socket.io/xlsx 可加载" "Node 运行依赖完整" "文档与平台服务可加载"
  else
    doctor_add FAIL node-modules "缺少一个或多个必需 Node 模块" "express/socket.io/xlsx 可加载" \
      "Node 服务可在启动时失败" "cd $REPO_ROOT && npm ci" \
      "$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply --component node" \
      "NODE_PATH=$NODE_MODULE_PATH $NODE_BIN -e \"require('express'); require('socket.io'); require('xlsx')\""
  fi

  if [[ -n "$PUBLIC_BASE_URL" && "$PUBLIC_BASE_URL" =~ ^https?://[^/[:space:]]+/?$ ]]; then
    doctor_add PASS public-url "$PUBLIC_BASE_URL" "完整 http(s)://host[:port] 原点，IP 或域名均可" "可派生平台、CAS 和 OAuth 地址"
  else
    doctor_add FAIL public-url "${PUBLIC_BASE_URL:-未配置}" "完整 http(s)://host[:port] 原点" \
      "无法生成可靠的对外访问和认证回调地址" \
      "在 $ENV_FILE 中配置 KNOWLEDGE_CENTER_PUBLIC_BASE_URL=http://<服务器IP>:$FRONTEND_PORT" \
      "编辑 $ENV_FILE 后重新运行 doctor" "grep '^KNOWLEDGE_CENTER_PUBLIC_BASE_URL=' $ENV_FILE"
  fi

  if [[ -f "$ENV_FILE" ]]; then
    mode="$(doctor_file_mode "$ENV_FILE")"
    if [[ "$mode" == 600 || "$mode" == 400 ]]; then
      doctor_add PASS platform-env "已配置，权限 $mode" "配置文件仅所有者可读写" "环境配置不向其他用户暴露"
    else
      doctor_add FAIL platform-env "权限 $mode" "权限 0600 或更严格" "可能泄漏管理员凭据或 OAuth 密钥" \
        "chmod 600 $ENV_FILE" "chmod 600 $ENV_FILE" "stat -c '%a %n' $ENV_FILE"
    fi
  else
    doctor_add FAIL platform-env "文件不存在" "从 .env.example 初始化当前环境配置" "共享/生产环境无法确定外部地址与安全参数" \
      "install -m 600 $REPO_ROOT/config/knowledge-center/.env.example $ENV_FILE" \
      "$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply --component config" "stat -c '%a %n' $ENV_FILE"
  fi

  if [[ -f "$service_env" ]]; then
    mode="$(doctor_file_mode "$service_env")"
    if [[ "$mode" == 600 || "$mode" == 400 ]]; then
      doctor_add PASS database-env "service.env 权限 $mode" "数据库唯一事实源仅所有者可读写" "数据库凭据受保护"
    else
      doctor_add FAIL database-env "service.env 权限 $mode" "权限 0600 或更严格" "数据库密码可能泄漏" \
        "chmod 600 $service_env" "chmod 600 $service_env" "stat -c '%a %n' $service_env"
    fi
  else
    doctor_add FAIL database-env "service.env 不存在" "config/yashandb/service.env 为唯一持久数据库配置" \
      "无法连接 YashanDB" "install -m 600 $REPO_ROOT/config/yashandb/service.env.example $service_env" \
      "$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply --component config" "stat -c '%a %n' $service_env"
  fi

  if [[ "$KNOWLEDGE_CENTER_ENVIRONMENT" == production || "$KNOWLEDGE_CENTER_ENVIRONMENT" == staging ]]; then
    if [[ -z "${KNOWLEDGE_CENTER_ADMIN_PASSWORD:-}" || "${KNOWLEDGE_CENTER_ADMIN_PASSWORD:-}" == admin ]]; then
      doctor_add FAIL admin-password "未配置或仍为默认值" "共享/生产环境使用非默认强密码" "默认管理员凭据可被直接利用" \
        "在受控配置中设置 KNOWLEDGE_CENTER_ADMIN_PASSWORD" "由运维或密钥系统注入" "test -n \"\$KNOWLEDGE_CENTER_ADMIN_PASSWORD\""
    else
      doctor_add PASS admin-password "已配置（值已隐藏）" "非默认管理员密码" "默认凭据门禁通过"
    fi
    if [[ -z "$OUTLINE_INTERNAL_TOKEN" ]]; then
      doctor_add FAIL internal-token "未配置" "共享/生产环境持久化内部令牌" "重启后随机令牌改变，且无法统一治理" \
        "生成随机值并安全写入 KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN" "由密钥系统注入" "test -n \"\$KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN\""
    else
      doctor_add PASS internal-token "已配置（值已隐藏）" "内部令牌持久化" "内部调用身份稳定"
    fi
  fi

  if [[ -f "$BUILD_DIR/manifest.json" && -f "$BUILD_DIR/manifest.sha256" ]] \
    && (cd "$BUILD_DIR" && sha256sum -c manifest.sha256 >/dev/null 2>&1) \
    && [[ -f "$BUILD_DIR/java/classes/Main.class" && -f "$BUILD_DIR/java/lib/yashandb-jdbc.jar" ]]; then
    doctor_add PASS build-artifact "统一构建产物完整且摘要匹配" "manifest、Web 产物、Java class 和 JDBC 驱动完整" "可执行 --no-build 启动"
  else
    doctor_add FAIL build-artifact "构建产物缺失或摘要失配" "统一构建产物通过 SHA-256 校验" "不能安全启动或复用现有产物" \
      "cd $REPO_ROOT && npm run build" "cd $REPO_ROOT && npm run build" "cd $BUILD_DIR && sha256sum -c manifest.sha256"
  fi

  if [[ "${KNOWLEDGE_CENTER_DOCTOR_SKIP_DATABASE:-0}" == 1 ]]; then
    doctor_add WARN database-probe "根据显式配置跳过" "真实执行 SELECT 1 FROM DUAL" "未验证数据库连通性"
  elif [[ -f "$service_env" && -f "$BUILD_DIR/java/classes/Main.class" && -f "$BUILD_DIR/java/lib/yashandb-jdbc.jar" ]] && doctor_command_exists "$JAVA_BIN"; then
    if KNOWLEDGE_CENTER_JAVA_BIN="$JAVA_BIN" "$STORAGE_DIR/start.sh" probe >/dev/null 2>&1; then
      doctor_add PASS database-probe "YashanDB SELECT 1 探测成功" "真实数据库连接可用" "存储服务可建立 JDBC 连接"
      if KNOWLEDGE_CENTER_JAVA_BIN="$JAVA_BIN" YASDB_MIGRATION_CHECKSUM_POLICY=strict "$STORAGE_DIR/start.sh" verify >/dev/null 2>&1; then
        doctor_add PASS migration-integrity "已执行迁移与当前构建匹配" "迁移版本、别名和摘要完整" "存储服务可通过启动前校验"
      elif [[ "$KNOWLEDGE_CENTER_ENVIRONMENT" == development ]]; then
        doctor_add WARN migration-integrity "严格迁移完整性校验失败；开发环境可按 warn 策略运行" \
          "共享/生产发布前迁移版本、别名和摘要必须完整" "当前可用于开发，但不得作为生产发布依据" \
          "审核构建迁移源与目标库，不要直接改 KC_SCHEMA_MIGRATION" \
          "审核后显式执行 apps/yashandb-storage/start.sh migrate" \
          "YASDB_MIGRATION_CHECKSUM_POLICY=strict apps/yashandb-storage/start.sh verify"
      else
        doctor_add FAIL migration-integrity "迁移完整性校验失败" "已执行迁移与当前构建匹配" "存储服务将拒绝启动" \
          "审核构建迁移源与目标库，不要直接改 KC_SCHEMA_MIGRATION" \
          "审核后显式执行 apps/yashandb-storage/start.sh migrate" "apps/yashandb-storage/start.sh verify"
      fi
    else
      doctor_add FAIL database-probe "YashanDB 真实探测失败" "通过 service.env 执行 SELECT 1 FROM DUAL" "平台无法使用权威数据源" \
        "检查 $service_env、网络、账号和数据库状态" \
        "KNOWLEDGE_CENTER_JAVA_BIN=$JAVA_BIN $STORAGE_DIR/start.sh probe" "$STORAGE_DIR/start.sh probe"
    fi
  else
    doctor_add FAIL database-probe "缺少配置、Java 或构建产物" "具备真实 JDBC 探测条件" "无法验证数据库连通性" \
      "先修复 doctor 中的配置、Java 和构建产物问题" "$REPO_ROOT/tools/deployment/install-knowledge-center.sh --apply" "$STORAGE_DIR/start.sh probe"
  fi

  available_kb="$(df -Pk "$REPO_ROOT" 2>/dev/null | awk 'NR==2 {print $4}')"
  if [[ "$available_kb" =~ ^[0-9]+$ ]] && (( available_kb >= 2097152 )); then
    doctor_add PASS disk-space "$((available_kb / 1024)) MiB 可用" "至少 2048 MiB 可用空间" "可容纳构建、日志和依赖"
  else
    doctor_add WARN disk-space "${available_kb:-unknown} KiB 可用" "建议至少 2048 MiB" "构建或日志写入可能失败" \
      "清理非持久缓存或扩容；不要整体删除 runtime" "由运维执行磁盘治理" "df -h $REPO_ROOT"
  fi
  memory_kb="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || true)"
  if [[ "$memory_kb" =~ ^[0-9]+$ ]] && (( memory_kb >= 2097152 )); then
    doctor_add PASS memory "$((memory_kb / 1024)) MiB 可用" "运行建议至少 2048 MiB，压缩构建建议约 8 GiB" "运行资源可用"
  else
    doctor_add WARN memory "${memory_kb:-unknown} KiB 可用" "运行建议至少 2048 MiB" "构建或多服务启动可能被 OOM 终止" \
      "增加可用内存或在其他机器生成离线构建产物" "由运维执行资源调整" "awk '/MemAvailable:/ {print}' /proc/meminfo"
  fi

  if command -v timedatectl >/dev/null 2>&1; then
    ntp_state="$(timedatectl show -p NTPSynchronized --value 2>/dev/null || true)"
    if [[ "$ntp_state" == yes ]]; then
      doctor_add PASS time-sync "NTP 已同步" "系统时间可信" "构建时间、会话和审计时间一致"
    else
      doctor_add WARN time-sync "NTP 未确认同步" "部署机时间与标准时间同步" "可出现产物时间在未来、会话或审计偏差" \
        "sudo timedatectl set-ntp true" "由运维确认 NTP 服务" "timedatectl status"
    fi
  fi
}

doctor_json_escape() {
  local value="$1"
  value="${value//\/\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

doctor_print_human() {
  local index status
  for ((index = 0; index < ${#DOCTOR_STATUS[@]}; index++)); do
    status="${DOCTOR_STATUS[$index]}"
    printf '[%s] %s\n' "$status" "${DOCTOR_LABEL[$index]}"
    printf '当前：%s\n要求：%s\n影响：%s\n' "${DOCTOR_CURRENT[$index]}" "${DOCTOR_REQUIREMENT[$index]}" "${DOCTOR_IMPACT[$index]}"
    if [[ "$status" != PASS ]]; then
      [[ -z "${DOCTOR_COMMAND[$index]}" ]] || printf '建议执行：\n%s\n' "${DOCTOR_COMMAND[$index]}"
      [[ -z "${DOCTOR_AUTOMATIC[$index]}" ]] || printf '也可以自动处理：\n%s\n' "${DOCTOR_AUTOMATIC[$index]}"
      [[ -z "${DOCTOR_VERIFY[$index]}" ]] || printf '验证命令：\n%s\n' "${DOCTOR_VERIFY[$index]}"
    fi
    printf '\n'
  done
  printf '诊断摘要：FAIL=%s WARN=%s PASS=%s\n' "$DOCTOR_FAIL_COUNT" "$DOCTOR_WARN_COUNT" \
    "$((${#DOCTOR_STATUS[@]} - DOCTOR_FAIL_COUNT - DOCTOR_WARN_COUNT))"
}

doctor_print_commands() {
  local index
  for ((index = 0; index < ${#DOCTOR_STATUS[@]}; index++)); do
    [[ "${DOCTOR_STATUS[$index]}" == PASS ]] && continue
    printf '# %s：%s\n%s\n' "${DOCTOR_STATUS[$index]}" "${DOCTOR_LABEL[$index]}" "${DOCTOR_COMMAND[$index]}"
  done
}

doctor_print_json() {
  local index comma=""
  printf '{"environment":"%s","osFamily":"%s","failCount":%s,"warnCount":%s,"checks":[' \
    "$(doctor_json_escape "$KNOWLEDGE_CENTER_ENVIRONMENT")" "$(doctor_json_escape "$DOCTOR_PLATFORM_FAMILY")" "$DOCTOR_FAIL_COUNT" "$DOCTOR_WARN_COUNT"
  for ((index = 0; index < ${#DOCTOR_STATUS[@]}; index++)); do
    printf '%s{"status":"%s","code":"%s","label":"%s","current":"%s","requirement":"%s","impact":"%s","command":"%s","automatic":"%s","verify":"%s"}' \
      "$comma" "${DOCTOR_STATUS[$index]}" "$(doctor_json_escape "${DOCTOR_CODE[$index]}")" \
      "$(doctor_json_escape "${DOCTOR_LABEL[$index]}")" "$(doctor_json_escape "${DOCTOR_CURRENT[$index]}")" \
      "$(doctor_json_escape "${DOCTOR_REQUIREMENT[$index]}")" "$(doctor_json_escape "${DOCTOR_IMPACT[$index]}")" \
      "$(doctor_json_escape "${DOCTOR_COMMAND[$index]}")" "$(doctor_json_escape "${DOCTOR_AUTOMATIC[$index]}")" \
      "$(doctor_json_escape "${DOCTOR_VERIFY[$index]}")"
    comma=,
  done
  printf ']}\n'
}

run_doctor() {
  local format="${1:-human}"
  doctor_collect
  case "$format" in
    human) doctor_print_human ;;
    commands) doctor_print_commands ;;
    json) doctor_print_json ;;
    *) echo "错误：未知 doctor 输出格式：$format" >&2; return 2 ;;
  esac
  (( DOCTOR_FAIL_COUNT == 0 ))
}

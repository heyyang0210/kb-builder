#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OS_RELEASE_FILE="${KNOWLEDGE_CENTER_OS_RELEASE_FILE:-/etc/os-release}"
VENV_DIR="${KNOWLEDGE_CENTER_VENV_DIR:-$REPO_ROOT/runtime/venvs/knowledge-center}"
TOOLCHAIN_ROOT="${KNOWLEDGE_CENTER_TOOLCHAIN_ROOT:-$REPO_ROOT/runtime/toolchains}"
PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$REPO_ROOT/runtime/browsers/playwright}"
[[ "$PLAYWRIGHT_BROWSERS_PATH" == /* ]] || PLAYWRIGHT_BROWSERS_PATH="$REPO_ROOT/$PLAYWRIGHT_BROWSERS_PATH"
export PLAYWRIGHT_BROWSERS_PATH
MODE=""
COMPONENT=all
OFFLINE_BUNDLE=""
PACKAGE_MANAGER=""
PLATFORM_FAMILY=unknown
PYTHON_CANDIDATE=""

usage() {
  cat <<'EOF'
用法：
  install-knowledge-center.sh --check [--component base|java|python|node|config|all]
  install-knowledge-center.sh --apply [--component base|java|python|node|config|all]
  install-knowledge-center.sh --offline-bundle <目录> [--component java|python|node|config|all]

--check          只展示将执行的安装动作
--apply          显式执行在线安装和项目依赖初始化
--offline-bundle 仅使用经 manifest.sha256 校验的离线目录
EOF
}

while (( $# > 0 )); do
  case "$1" in
    --check|--apply)
      [[ -z "$MODE" ]] || { echo "错误：安装模式只能选择一种" >&2; exit 2; }
      MODE="${1#--}"
      shift
      ;;
    --offline-bundle)
      [[ -z "$MODE" ]] || { echo "错误：安装模式只能选择一种" >&2; exit 2; }
      [[ -n "${2:-}" ]] || { echo "错误：--offline-bundle 缺少目录" >&2; exit 2; }
      MODE=offline
      OFFLINE_BUNDLE="$2"
      shift 2
      ;;
    --component)
      [[ -n "${2:-}" ]] || { echo "错误：--component 缺少值" >&2; exit 2; }
      COMPONENT="$2"
      shift 2
      ;;
    help|-h|--help)
      usage
      exit 0
      ;;
    *) echo "错误：未知参数：$1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$MODE" ]] || { echo "错误：必须指定 --check、--apply 或 --offline-bundle" >&2; usage >&2; exit 2; }
case "$COMPONENT" in base|java|python|node|config|all) ;; *) echo "错误：未知组件：$COMPONENT" >&2; exit 2 ;; esac
[[ "$MODE" != offline || "$COMPONENT" != base ]] || { echo "错误：离线包不安装系统 base 包" >&2; exit 2; }

component_selected() {
  [[ "$COMPONENT" == all || "$COMPONENT" == "$1" ]]
}

detect_platform() {
  local os_id=unknown os_like=""
  if [[ -r "$OS_RELEASE_FILE" ]]; then
    os_id="$(sed -n 's/^ID=//p' "$OS_RELEASE_FILE" | head -n 1 | tr -d '"' | tr '[:upper:]' '[:lower:]')"
    os_like="$(sed -n 's/^ID_LIKE=//p' "$OS_RELEASE_FILE" | head -n 1 | tr -d '"' | tr '[:upper:]' '[:lower:]')"
  fi
  if [[ "$os_id $os_like" =~ (kylin|rhel|fedora|centos|rocky|almalinux|anolis|opencloudos) ]]; then
    PLATFORM_FAMILY=rpm
    if command -v dnf >/dev/null 2>&1; then PACKAGE_MANAGER=dnf; else PACKAGE_MANAGER=yum; fi
  elif [[ "$os_id $os_like" =~ (ubuntu|debian) ]]; then
    PLATFORM_FAMILY=deb
    PACKAGE_MANAGER=apt-get
  fi
  printf '检测平台：ID=%s family=%s packageManager=%s\n' "$os_id" "$PLATFORM_FAMILY" "${PACKAGE_MANAGER:-none}"
}

privileged_prefix() {
  if (( EUID == 0 )); then
    printf '%s' ''
  elif command -v sudo >/dev/null 2>&1; then
    printf '%s' 'sudo '
  else
    echo "错误：需要安装系统包，但当前用户非 root 且系统没有 sudo" >&2
    return 1
  fi
}

package_command() {
  local component="$1" prefix
  prefix="$(privileged_prefix)" || return 1
  case "$PLATFORM_FAMILY:$component" in
    rpm:base) printf '%s%s install -y curl ca-certificates tar gzip unzip git procps-ng iproute util-linux' "$prefix" "$PACKAGE_MANAGER" ;;
    deb:base) printf '%sapt-get update && %sapt-get install -y curl ca-certificates tar gzip unzip git procps iproute2 util-linux' "$prefix" "$prefix" ;;
    rpm:java) printf '%s%s install -y java-17-openjdk-headless' "$prefix" "$PACKAGE_MANAGER" ;;
    deb:java) printf '%sapt-get update && %sapt-get install -y openjdk-17-jre-headless' "$prefix" "$prefix" ;;
    rpm:python) printf '%s%s install -y python3.11 python3.11-pip' "$prefix" "$PACKAGE_MANAGER" ;;
    deb:python) printf '%sapt-get update && %sapt-get install -y python3.11 python3.11-venv python3-pip' "$prefix" "$prefix" ;;
    rpm:node) printf '%s%s install -y nodejs npm' "$prefix" "$PACKAGE_MANAGER" ;;
    deb:node) printf '%sapt-get update && %sapt-get install -y nodejs npm' "$prefix" "$prefix" ;;
    rpm:browser) printf '%s%s install -y alsa-lib atk at-spi2-atk cups-libs gtk3 libdrm libXcomposite libXdamage libXfixes libXrandr libxcb libxkbcommon mesa-libgbm nss pango' "$prefix" "$PACKAGE_MANAGER" ;;
    *) echo "错误：当前发行版不支持在线自动安装，请使用 --offline-bundle" >&2; return 1 ;;
  esac
}

run_or_print() {
  local description="$1" command="$2"
  printf '%s\n  %s\n' "$description" "$command"
  [[ "$MODE" != apply ]] || bash -c "$command"
}

version_major() {
  local version="$1"
  version="${version#v}"
  version="${version#1.}"
  printf '%s' "${version%%[^0-9]*}"
}

java_ready() {
  local bin="${KNOWLEDGE_CENTER_JAVA_BIN:-java}" version major
  command -v "$bin" >/dev/null 2>&1 || [[ -x "$bin" ]] || return 1
  version="$("$bin" -version 2>&1 | head -n 1 | sed -E 's/.*version "?([^" ]+).*/\1/')"
  major="$(version_major "$version")"
  [[ "$major" =~ ^[0-9]+$ ]] && (( major >= 17 ))
}

node_ready() {
  local bin="${KNOWLEDGE_CENTER_NODE_BIN:-node}" version major
  command -v "$bin" >/dev/null 2>&1 || [[ -x "$bin" ]] || return 1
  version="$("$bin" --version 2>/dev/null || true)"
  major="$(version_major "$version")"
  [[ "$major" =~ ^[0-9]+$ ]] && (( major >= 20 ))
}

find_python() {
  local candidate version minor
  for candidate in "${KNOWLEDGE_CENTER_PYTHON_BIN:-}" "$VENV_DIR/bin/python" python3.12 python3.11 python3.10 python3; do
    [[ -n "$candidate" ]] || continue
    command -v "$candidate" >/dev/null 2>&1 || [[ -x "$candidate" ]] || continue
    version="$("$candidate" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
    minor="${version#*.}"
    if [[ "${version%%.*}" == 3 && "$minor" =~ ^[0-9]+$ ]] && (( minor >= 10 )); then
      PYTHON_CANDIDATE="$candidate"
      return 0
    fi
  done
  return 1
}

initialize_config() {
  local platform_env="$REPO_ROOT/config/knowledge-center/.env" database_env="$REPO_ROOT/config/yashandb/service.env"
  if [[ ! -e "$platform_env" ]]; then
    printf '初始化：%s\n' "$platform_env"
    [[ "$MODE" == check ]] || install -m 600 "$REPO_ROOT/config/knowledge-center/.env.example" "$platform_env"
  else
    printf '保留已有配置：%s\n' "$platform_env"
  fi
  if [[ ! -e "$database_env" ]]; then
    printf '初始化：%s\n' "$database_env"
    [[ "$MODE" == check ]] || install -m 600 "$REPO_ROOT/config/yashandb/service.env.example" "$database_env"
  else
    printf '保留已有数据库唯一配置：%s\n' "$database_env"
  fi
}

install_python_dependencies() {
  find_python || { echo "错误：安装后仍未找到 Python 3.10+，请使用离线 Python 运行时" >&2; return 1; }
  printf '使用 Python：%s\n' "$PYTHON_CANDIDATE"
  if [[ "$MODE" == check ]]; then
    printf '将创建虚拟环境、安装：%s，并安装 Playwright Chromium 到 %s\n' "$REPO_ROOT/apps/pingcode-api/requirements.txt" "$PLAYWRIGHT_BROWSERS_PATH"
    if [[ "$PLATFORM_FAMILY" == rpm ]]; then
      printf '将安装 Chromium 系统运行库：%s\n' "$(package_command browser)"
    else
      printf '将通过 playwright install --with-deps 安装 Chromium 系统运行库\n'
    fi
    return 0
  fi
  if [[ "$PYTHON_CANDIDATE" != "$VENV_DIR/bin/python" ]]; then
    "$PYTHON_CANDIDATE" -m venv "$VENV_DIR"
  fi
  "$VENV_DIR/bin/python" -m pip install --upgrade pip
  "$VENV_DIR/bin/python" -m pip install -r "$REPO_ROOT/apps/pingcode-api/requirements.txt"
  if [[ "$PLATFORM_FAMILY" == rpm ]]; then
    run_or_print "安装 Chromium 系统运行库" "$(package_command browser)"
    "$VENV_DIR/bin/python" -m playwright install chromium
  else
    "$VENV_DIR/bin/python" -m playwright install --with-deps chromium
  fi
  "$VENV_DIR/bin/python" -c 'import uvicorn, fastapi, pydantic, playwright'
  "$VENV_DIR/bin/python" -c 'from playwright.sync_api import sync_playwright; p=sync_playwright().start(); b=p.chromium.launch(headless=True); b.close(); p.stop()'
}

install_node_dependencies() {
  if [[ "$MODE" == check ]]; then
    printf '将执行：cd %s && npm ci\n' "$REPO_ROOT"
    return 0
  fi
  node_ready || { echo "错误：安装后的 Node.js 低于 20，请使用离线 Node.js 20 运行时" >&2; return 1; }
  (cd "$REPO_ROOT" && npm ci)
  NODE_PATH="$REPO_ROOT/node_modules" node -e "require('express'); require('socket.io'); require('xlsx')"
}

safe_extract_node_modules() {
  local archive="$1" entry
  while IFS= read -r entry; do
    [[ "$entry" != /* && "$entry" != *'..'* && ( "$entry" == node_modules || "$entry" == node_modules/* ) ]] || {
      echo "错误：Node 离线归档包含越界路径：$entry" >&2
      return 1
    }
  done < <(tar -tzf "$archive")
  tar -xzf "$archive" -C "$REPO_ROOT"
}

copy_toolchain() {
  local source="$1" target="$2"
  [[ -d "$source" ]] || return 1
  if [[ -e "$target" ]]; then
    printf '保留已有运行时：%s\n' "$target"
    return 0
  fi
  mkdir -p "$(dirname "$target")"
  cp -a "$source" "$target"
}

install_offline() {
  local bundle="$OFFLINE_BUNDLE" python_bin node_archive browser_source
  [[ -d "$bundle" ]] || { echo "错误：离线目录不存在：$bundle" >&2; return 1; }
  [[ -f "$bundle/manifest.sha256" ]] || { echo "错误：离线目录缺少 manifest.sha256" >&2; return 1; }
  (cd "$bundle" && sha256sum -c manifest.sha256)

  if component_selected java; then
    copy_toolchain "$bundle/toolchains/java-17" "$TOOLCHAIN_ROOT/java-17" || { echo "错误：离线包缺少 toolchains/java-17" >&2; return 1; }
    KNOWLEDGE_CENTER_JAVA_BIN="$TOOLCHAIN_ROOT/java-17/bin/java"
    export KNOWLEDGE_CENTER_JAVA_BIN
    java_ready || { echo "错误：离线 Java 运行时不满足 17+" >&2; return 1; }
  fi
  if component_selected python; then
    copy_toolchain "$bundle/toolchains/python-3.11" "$TOOLCHAIN_ROOT/python-3.11" || { echo "错误：离线包缺少 toolchains/python-3.11" >&2; return 1; }
    python_bin="$TOOLCHAIN_ROOT/python-3.11/bin/python3"
    [[ -x "$python_bin" ]] || python_bin="$TOOLCHAIN_ROOT/python-3.11/bin/python"
    [[ -x "$python_bin" ]] || { echo "错误：离线 Python 运行时缺少可执行入口" >&2; return 1; }
    [[ -d "$bundle/python-wheels" ]] || { echo "错误：离线包缺少 python-wheels" >&2; return 1; }
    "$python_bin" -m venv "$VENV_DIR"
    "$VENV_DIR/bin/python" -m pip install --no-index --find-links "$bundle/python-wheels" -r "$REPO_ROOT/apps/pingcode-api/requirements.txt"
    browser_source="$bundle/playwright-browsers"
    [[ -d "$browser_source" ]] || { echo "错误：离线包缺少 playwright-browsers" >&2; return 1; }
    mkdir -p "$(dirname "$PLAYWRIGHT_BROWSERS_PATH")"
    if [[ ! -e "$PLAYWRIGHT_BROWSERS_PATH" ]]; then cp -a "$browser_source" "$PLAYWRIGHT_BROWSERS_PATH"; fi
    "$VENV_DIR/bin/python" -c 'import uvicorn, fastapi, pydantic, playwright'
    "$VENV_DIR/bin/python" -c 'from playwright.sync_api import sync_playwright; p=sync_playwright().start(); b=p.chromium.launch(headless=True); b.close(); p.stop()'
  fi
  if component_selected node; then
    copy_toolchain "$bundle/toolchains/node-20" "$TOOLCHAIN_ROOT/node-20" || { echo "错误：离线包缺少 toolchains/node-20" >&2; return 1; }
    export KNOWLEDGE_CENTER_NODE_BIN="$TOOLCHAIN_ROOT/node-20/bin/node"
    export KNOWLEDGE_CENTER_NPM_BIN="$TOOLCHAIN_ROOT/node-20/bin/npm"
    node_ready || { echo "错误：离线 Node.js 运行时不满足 20+" >&2; return 1; }
    node_archive="$bundle/node-dependencies/node_modules.tar.gz"
    [[ -f "$node_archive" ]] || { echo "错误：离线包缺少 node-dependencies/node_modules.tar.gz" >&2; return 1; }
    safe_extract_node_modules "$node_archive"
    NODE_PATH="$REPO_ROOT/node_modules" "$KNOWLEDGE_CENTER_NODE_BIN" -e "require('express'); require('socket.io'); require('xlsx')"
  fi
  component_selected config && initialize_config
}

detect_platform

if [[ "$MODE" == offline ]]; then
  install_offline
  echo "离线依赖安装完成。请将 runtime/toolchains 与 runtime/venvs 中的实际路径写入 config/knowledge-center/.env。"
  exit 0
fi

[[ "$PLATFORM_FAMILY" != unknown ]] || { echo "错误：当前 Linux 发行版未支持在线安装，请使用 --offline-bundle" >&2; exit 1; }

if component_selected base; then
  run_or_print "基础系统工具" "$(package_command base)"
fi
if component_selected java; then
  if java_ready; then
    echo "Java 17+ 已就绪，跳过安装。"
  else
    run_or_print "安装 Java 17" "$(package_command java)"
    [[ "$MODE" == check ]] || java_ready || { echo "错误：软件源安装后 Java 仍低于 17，请使用离线运行时" >&2; exit 1; }
  fi
fi
if component_selected python; then
  if ! find_python; then
    run_or_print "安装 Python 3.11 与 venv" "$(package_command python)"
  fi
  install_python_dependencies
fi
if component_selected node; then
  if ! node_ready; then
    run_or_print "安装 Node.js 与 npm（安装后必须验证 Node.js 20+）" "$(package_command node)"
  fi
  install_node_dependencies
fi
component_selected config && initialize_config

if [[ "$MODE" == check ]]; then
  echo "以上为安装计划，未修改系统。使用 --apply 显式执行。"
else
  echo "依赖安装完成，正在执行 doctor 复检。"
  exec "$REPO_ROOT/knowledge-center.sh" doctor
fi

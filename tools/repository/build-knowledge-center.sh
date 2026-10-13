#!/usr/bin/env bash

set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"
cd "$repo_root"

build_root_rel="${KNOWLEDGE_CENTER_BUILD_ROOT:-runtime/build/knowledge-center}"
python_bin="${KNOWLEDGE_CENTER_PYTHON_BIN:-python3}"

fail() {
  echo "构建失败：$*" >&2
  exit 1
}

validate_relative_build_root() {
  local value="$1" segment
  [[ -n "$value" ]] || fail "构建目录不能为空"
  case "$value" in
    /*|[A-Za-z]:*|\\* ) fail "构建目录必须是仓库内相对路径：$value" ;;
  esac
  [[ "$value" == runtime/build/* ]] || fail "构建目录必须位于 runtime/build/：$value"
  IFS='/' read -r -a segments <<<"$value"
  for segment in "${segments[@]}"; do
    [[ -n "$segment" && "$segment" != "." && "$segment" != ".." ]] || fail "构建目录包含非法路径段：$value"
  done
}

validate_relative_build_root "$build_root_rel"

for command_name in git node npm java sha256sum tar; do
  command -v "$command_name" >/dev/null 2>&1 || fail "缺少构建命令：$command_name"
done
command -v "$python_bin" >/dev/null 2>&1 || [[ -x "$python_bin" ]] \
  || fail "缺少 Python 构建命令：$python_bin"

jdbc_source_rel="apps/yashandb-storage/lib/yashandb-jdbc.jar"
[[ -f "$jdbc_source_rel" ]] || fail "缺少 YashanDB JDBC 驱动：$jdbc_source_rel"
vditor_dist_rel="node_modules/vditor/dist"
vditor_license_rel="node_modules/vditor/LICENSE"
[[ -f "$vditor_dist_rel/index.min.js" && -f "$vditor_dist_rel/index.css" ]] \
  || fail "缺少 Vditor 静态资源，请先运行 npm install"
[[ -f "$vditor_license_rel" ]] || fail "缺少 Vditor LICENSE"

source_revision="$(git rev-parse HEAD 2>/dev/null || printf 'unknown')"
source_dirty=false
if [[ -n "$(git status --porcelain --untracked-files=normal -- . ':(exclude)runtime/**')" ]]; then
  source_dirty=true
fi
migration_source_dirty=false
if ! git diff --quiet HEAD -- 'apps/yashandb-storage/sql/*.sql' apps/yashandb-storage/sql/migration-aliases.properties \
  || [[ -n "$(git ls-files --others --exclude-standard -- 'apps/yashandb-storage/sql/*.sql' apps/yashandb-storage/sql/migration-aliases.properties)" ]]; then
  migration_source_dirty=true
fi
migration_source_sha256="$({
  find apps/yashandb-storage/sql -maxdepth 1 -type f \
    \( -name '[0-9][0-9][0-9]_*.sql' -o -name 'migration-aliases.properties' \) -print0 \
    | sort -z | xargs -0 sha256sum
} | sha256sum | awk '{print $1}')"
node_version="$(node --version)"
npm_version="$(npm --version)"
python_version="$("$python_bin" --version 2>&1 | awk '{print $2}')"
pingcode_vite_node_options="${KNOWLEDGE_CENTER_VITE_NODE_OPTIONS:---max-old-space-size=1536}"
fingerprint_inputs=(
  package.json
  package-lock.json
  apps/knowledge-center-api
  apps/knowledge-center-web/frontend
  apps/knowledge-center-web/frontend-server.js
  apps/pingcode-api
  apps/pingcode-web
  apps/yashandb-storage/src
  apps/yashandb-storage/sql
  packages/agent-runner-core
  packages/pingcode-core
  packages/platform-contracts
  tools/repository/build-knowledge-center.sh
)
for fingerprint_input in "${fingerprint_inputs[@]}"; do
  [[ -e "$fingerprint_input" ]] || fail "构建指纹输入不存在：$fingerprint_input"
done

source_fingerprint="$({
  find "${fingerprint_inputs[@]}" \
    -type f \
    ! -path '*/node_modules/*' \
    ! -path '*/.venv/*' \
    ! -path '*/dist/*' \
    ! -path '*/__pycache__/*' \
    ! -name '*.pyc' \
    -print0
  printf '%s\0' "$jdbc_source_rel"
} | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}')"

stage_rel="${build_root_rel}/.staging-${source_fingerprint:0:12}-$$"
current_rel="${build_root_rel}/current"
previous_rel="${build_root_rel}/.previous-$$"

cache_manifest_matches() {
  [[ -f "$current_rel/manifest.json" && -f "$current_rel/manifest.sha256" ]] || return 1
  node - "$current_rel/manifest.json" \
    "$source_fingerprint" "$migration_source_sha256" \
    "$node_version" "$npm_version" "$python_version" <<'NODE'
const fs = require('fs');
const [manifestPath, sourceFingerprint, migrationSha, nodeVersion, npmVersion, pythonVersion] = process.argv.slice(2);
try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const matches = manifest.schemaVersion === 1
    && manifest.sourceFingerprint === sourceFingerprint
    && manifest.migrationSourceSha256 === migrationSha
    && manifest.toolchain?.node === nodeVersion
    && manifest.toolchain?.npm === npmVersion
    && manifest.toolchain?.python === pythonVersion;
  process.exit(matches ? 0 : 1);
} catch (_) {
  process.exit(1);
}
NODE
}

cache_artifacts_are_valid() {
  [[ -d "$current_rel/web/platform" \
    && -d "$current_rel/web/pingcode" \
    && -d "$current_rel/java/classes" \
    && -f "$current_rel/java/lib/yashandb-jdbc.jar" \
    && -f "$current_rel/java/sql/migration-source.properties" ]] || return 1
  (cd "$current_rel" && sha256sum -c manifest.sha256 >/dev/null 2>&1)
}

if cache_manifest_matches && cache_artifacts_are_valid; then
  echo "构建缓存命中：$current_rel（sourceFingerprint=$source_fingerprint）"
  exit 0
fi

# Java 编译器只在缓存未命中、确实需要重新编译 Storage 时必需。
# 已校验的同源构建产物可在仅安装 JRE 17 的离线生产机上安全复用。
java_compiler=javac
if command -v javac >/dev/null 2>&1; then
  java_compiler_version="$(javac -version 2>&1 | awk '{print $2}')"
elif java --list-modules 2>/dev/null | grep -q '^jdk.compiler@'; then
  java_compiler=module
  java_compiler_version="$(java --list-modules 2>/dev/null | awk -F@ '/^jdk\.compiler@/ {print $2; exit}')"
else
  fail "当前源码与构建缓存不一致，重新构建需要 JDK 17+；仅有 JRE 时请从可信构建机同步同源且摘要有效的统一构建产物"
fi

remove_managed_path() {
  local target="$1"
  [[ "$target" == "${build_root_rel}/"* ]] || fail "拒绝清理非构建目录：$target"
  node - "$target" <<'NODE'
const fs = require('fs');
const target = process.argv[2];
fs.rmSync(target, { recursive: true, force: true });
NODE
}

cleanup_stage() {
  if [[ -e "$stage_rel" ]]; then
    remove_managed_path "$stage_rel"
  fi
}
trap cleanup_stage EXIT

mkdir -p "$stage_rel/web/platform" "$stage_rel/web/pingcode" \
  "$stage_rel/java/classes" "$stage_rel/java/lib" "$stage_rel/java/sql" \
  "$stage_rel/.work/pingcode-web"

echo "[1/6] 检查 Node.js 语法"
node tools/repository/check-node-syntax.js

echo "[2/6] 检查 Python 语法"
"$python_bin" - <<'PY'
from pathlib import Path

for root in (Path("apps/pingcode-api"), Path("packages/pingcode-core")):
    for path in sorted(root.rglob("*.py")):
        if "__pycache__" in path.parts or ".venv" in path.parts:
            continue
        compile(path.read_text(encoding="utf-8"), path.as_posix(), "exec")
PY

echo "[3/6] 构建 PingCode Web"
npm_cache="${KNOWLEDGE_CENTER_NPM_CACHE:-$repo_root/runtime/deployment/npm-cache}"
npm_install_args=(ci --include=dev --ignore-scripts --no-audit --no-fund)
if [[ -n "${KNOWLEDGE_CENTER_NPM_CACHE:-}" || -d "$npm_cache" ]]; then
  [[ -d "$npm_cache" ]] || fail "指定的 npm 离线缓存不存在：$npm_cache"
  [[ "$npm_cache" == /* ]] || npm_cache="$repo_root/$npm_cache"
  npm_install_args+=(--offline --cache "$npm_cache")
  echo "使用 npm 离线缓存：$npm_cache（按 Web lockfile 校验并安装本机架构依赖）"
fi
tar -cf - \
  --exclude='./node_modules' \
  --exclude='./dist' \
  -C apps/pingcode-web . | tar -xf - -C "$stage_rel/.work/pingcode-web"
(
  cd "$stage_rel/.work/pingcode-web"
  npm "${npm_install_args[@]}" || fail "PingCode Web 依赖安装失败；离线环境请按 apps/pingcode-web/package-lock.json 补齐 npm 缓存，详情见 npm 日志。现有产物未替换"
  [[ -x node_modules/.bin/vite ]] || fail "PingCode Web 依赖不完整：缺少 Vite 入口，拒绝继续构建"
  # 运行配置可以使用 NODE_ENV=development，但发布构建必须固定为 production。
  # 否则 Vue 会把组件绝对文件名写入 chunk，破坏可重复构建并泄漏开发机路径。
  NODE_ENV=production NODE_OPTIONS="$pingcode_vite_node_options" npm run build -- --outDir ../../web/pingcode --emptyOutDir \
    || fail "PingCode Web 构建失败，现有产物未替换"
) || fail "PingCode Web 构建阶段失败，现有产物未替换"

echo "[4/6] 准备知识中心静态前端"
tar -cf - -C apps/knowledge-center-web/frontend . | tar -xf - -C "$stage_rel/web/platform"
vditor_target="$stage_rel/web/platform/knowledge-center/common/vendor/vditor"
mkdir -p "$vditor_target"
cp -R "$vditor_dist_rel" "$vditor_target/dist"
cp "$vditor_license_rel" "$vditor_target/LICENSE"

echo "[5/6] 编译 YashanDB Storage"
cp "$jdbc_source_rel" "$stage_rel/java/lib/yashandb-jdbc.jar"
cp -R apps/yashandb-storage/sql/. "$stage_rel/java/sql/"
{
  printf 'sourceRevision=%s\n' "$source_revision"
  printf 'sourceDirty=%s\n' "$migration_source_dirty"
  printf 'aggregateSha256=%s\n' "$migration_source_sha256"
} > "$stage_rel/java/sql/migration-source.properties"
java_compile_args=(
  -encoding UTF-8
  -cp "$stage_rel/java/lib/yashandb-jdbc.jar"
  -d "$stage_rel/java/classes"
  apps/yashandb-storage/src/Main.java
  apps/yashandb-storage/src/HandbookProjectionRepository.java
  apps/yashandb-storage/src/PrincipalRepository.java
  apps/yashandb-storage/src/PlatformAuthRepository.java
  apps/yashandb-storage/src/PlatformGitLabRepository.java
  apps/yashandb-storage/src/StorageSchemaDao.java
  apps/yashandb-storage/src/migration/SchemaMigrationManager.java
)
if [[ "$java_compiler" == javac ]]; then
  javac "${java_compile_args[@]}"
else
  java -m jdk.compiler/com.sun.tools.javac.Main "${java_compile_args[@]}"
fi

remove_managed_path "$stage_rel/.work"

echo "[6/6] 生成构建清单"
node - \
  "$stage_rel/manifest.json" \
  "$source_revision" \
  "$source_dirty" \
  "$migration_source_dirty" \
  "$migration_source_sha256" \
  "$source_fingerprint" \
  "$current_rel" \
  "$node_version" \
  "$npm_version" \
  "$python_version" \
  "$java_compiler_version" <<'NODE'
const fs = require('fs');
const output = process.argv[2];
const manifest = {
  schemaVersion: 1,
  sourceRevision: process.argv[3],
  sourceDirty: process.argv[4] === 'true',
  migrationSourceDirty: process.argv[5] === 'true',
  migrationSourceSha256: process.argv[6],
  sourceFingerprint: process.argv[7],
  outputPath: process.argv[8],
  toolchain: {
    node: process.argv[9],
    npm: process.argv[10],
    python: process.argv[11],
    javaCompiler: process.argv[12]
  },
  components: {
    platformWeb: "web/platform",
    pingcodeWeb: "web/pingcode",
    storageClasses: "java/classes",
    storageJdbc: "java/lib/yashandb-jdbc.jar",
    storageSql: "java/sql"
  }
};
fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + "\n");
NODE

(
  cd "$stage_rel"
  find web java -type f -print0 \
    | sort -z \
    | xargs -0 sha256sum > manifest.sha256
  sha256sum manifest.json >> manifest.sha256
)

absolute_leaks="$(grep -R -I -F -l "$repo_root" "$stage_rel" 2>/dev/null || true)"
[[ -z "$absolute_leaks" ]] || fail "构建产物包含仓库绝对路径：$absolute_leaks"

if [[ -e "$previous_rel" ]]; then
  remove_managed_path "$previous_rel"
fi
if [[ -e "$current_rel" ]]; then
  mv "$current_rel" "$previous_rel"
fi
if ! mv "$stage_rel" "$current_rel"; then
  if [[ -e "$previous_rel" && ! -e "$current_rel" ]]; then
    mv "$previous_rel" "$current_rel"
  fi
  fail "无法切换统一构建目录"
fi
if [[ -e "$previous_rel" ]]; then
  remove_managed_path "$previous_rel"
fi

trap - EXIT
echo "构建完成：$current_rel"

#!/usr/bin/env bash

set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"
cd "$repo_root"

build_root_rel="${KNOWLEDGE_CENTER_BUILD_ROOT:-runtime/build/knowledge-center}"

fail() {
  echo "构建失败：$*" >&2
  exit 1
}

validate_relative_build_root() {
  local value="$1" segment
  [[ -n "$value" ]] || fail "构建目录不能为空"
  case "$value" in
    /*|[A-Za-z]:*|\\*|//* ) fail "构建目录必须是仓库内相对路径：$value" ;;
  esac
  [[ "$value" == runtime/build/* ]] || fail "构建目录必须位于 runtime/build/：$value"
  IFS='/' read -r -a segments <<<"$value"
  for segment in "${segments[@]}"; do
    [[ -n "$segment" && "$segment" != "." && "$segment" != ".." ]] || fail "构建目录包含非法路径段：$value"
  done
}

validate_relative_build_root "$build_root_rel"

for command_name in git node npm python3 java sha256sum tar; do
  command -v "$command_name" >/dev/null 2>&1 || fail "缺少构建命令：$command_name"
done

java_compiler=javac
if command -v javac >/dev/null 2>&1; then
  java_compiler_version="$(javac -version 2>&1 | awk '{print $2}')"
elif java --list-modules 2>/dev/null | grep -q '^jdk.compiler@'; then
  java_compiler=module
  java_compiler_version="$(java --list-modules 2>/dev/null | awk -F@ '/^jdk\.compiler@/ {print $2; exit}')"
else
  fail "缺少 Java 编译器，请安装 JDK 17+"
fi

jdbc_source_rel="apps/yashandb-storage/lib/yashandb-jdbc.jar"
[[ -f "$jdbc_source_rel" ]] || fail "缺少 YashanDB JDBC 驱动：$jdbc_source_rel"

source_revision="$(git rev-parse HEAD 2>/dev/null || printf 'unknown')"
source_dirty=false
if [[ -n "$(git status --porcelain --untracked-files=normal -- . ':(exclude)runtime/**')" ]]; then
  source_dirty=true
fi
node_version="$(node --version)"
npm_version="$(npm --version)"
python_version="$(python3 --version 2>&1 | awk '{print $2}')"

source_fingerprint="$({
  find \
    package.json package-lock.json \
    apps/knowledge-center-api apps/knowledge-center-web/frontend apps/knowledge-center-web/frontend-server.js \
    apps/pingcode-api apps/pingcode-web apps/yashandb-storage/src apps/yashandb-storage/sql \
    packages/agent-runner-core packages/pingcode-core packages/platform-config packages/platform-contracts \
    tools/repository/build-knowledge-center.sh \
    -type f \
    ! -path '*/node_modules/*' \
    ! -path '*/dist/*' \
    ! -path '*/__pycache__/*' \
    ! -name '*.pyc' \
    -print0
  printf '%s\0' "$jdbc_source_rel"
} | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}')"

stage_rel="${build_root_rel}/.staging-${source_fingerprint:0:12}-$$"
current_rel="${build_root_rel}/current"
previous_rel="${build_root_rel}/.previous-$$"

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
python3 - <<'PY'
from pathlib import Path

for root in (Path("apps/pingcode-api"), Path("packages/pingcode-core")):
    for path in sorted(root.rglob("*.py")):
        if "__pycache__" in path.parts or ".venv" in path.parts:
            continue
        compile(path.read_text(encoding="utf-8"), path.as_posix(), "exec")
PY

echo "[3/6] 构建 PingCode Web"
tar -cf - \
  --exclude='./node_modules' \
  --exclude='./dist' \
  -C apps/pingcode-web . | tar -xf - -C "$stage_rel/.work/pingcode-web"
(
  cd "$stage_rel/.work/pingcode-web"
  npm ci --ignore-scripts --no-audit --no-fund
  # 运行配置可以使用 NODE_ENV=development，但发布构建必须固定为 production。
  # 否则 Vue 会把组件绝对文件名写入 chunk，破坏可重复构建并泄漏开发机路径。
  NODE_ENV=production npm run build -- --outDir ../../web/pingcode --emptyOutDir
)

echo "[4/6] 准备知识中心静态前端"
tar -cf - -C apps/knowledge-center-web/frontend . | tar -xf - -C "$stage_rel/web/platform"

echo "[5/6] 编译 YashanDB Storage"
cp "$jdbc_source_rel" "$stage_rel/java/lib/yashandb-jdbc.jar"
cp -R apps/yashandb-storage/sql/. "$stage_rel/java/sql/"
java_compile_args=(
  -encoding UTF-8
  -cp "$stage_rel/java/lib/yashandb-jdbc.jar"
  -d "$stage_rel/java/classes"
  apps/yashandb-storage/src/Main.java
  apps/yashandb-storage/src/HandbookProjectionRepository.java
  apps/yashandb-storage/src/PrincipalRepository.java
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
  sourceFingerprint: process.argv[5],
  outputPath: process.argv[6],
  toolchain: {
    node: process.argv[7],
    npm: process.argv[8],
    python: process.argv[9],
    javaCompiler: process.argv[10]
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

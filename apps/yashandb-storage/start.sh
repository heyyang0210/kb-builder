#!/usr/bin/env bash
set -euo pipefail

service_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${service_dir}/../.." && pwd)"
if [[ -f "${repo_root}/tools/repository/load-yashandb-env.sh" ]]; then
  # 开发环境读取统一配置；部署环境可预先注入同名变量覆盖。
  source "${repo_root}/tools/repository/load-yashandb-env.sh"
fi
build_root="${KNOWLEDGE_CENTER_BUILD_ROOT:-runtime/build/knowledge-center}"
case "$build_root" in
  /*|[A-Za-z]:*|\\*|//*) echo "KNOWLEDGE_CENTER_BUILD_ROOT 必须是仓库内相对路径" >&2; exit 1 ;;
esac
[[ "$build_root" == runtime/build/* && "$build_root" != *"/../"* && "$build_root" != ../* && "$build_root" != */.. ]] || {
  echo "KNOWLEDGE_CENTER_BUILD_ROOT 必须位于 runtime/build/ 且不得包含 .." >&2
  exit 1
}
build_root="${repo_root}/${build_root}"
classes_dir="${YASDB_STORAGE_CLASSES_DIR:-${build_root}/current/java/classes}"
export YASDB_STORAGE_SQL_DIR="${YASDB_STORAGE_SQL_DIR:-${build_root}/current/java/sql}"
jdbc_jar="${YASDB_JDBC_JAR:-${build_root}/current/java/lib/yashandb-jdbc.jar}"
[[ "$jdbc_jar" == /* ]] || jdbc_jar="$repo_root/$jdbc_jar"
[[ "$classes_dir" == /* ]] || classes_dir="$repo_root/$classes_dir"
[[ "$YASDB_STORAGE_SQL_DIR" == /* ]] || export YASDB_STORAGE_SQL_DIR="$repo_root/$YASDB_STORAGE_SQL_DIR"

if [[ ! -f "${jdbc_jar}" ]]; then
  echo "未找到已构建的 YashanDB JDBC 驱动，请先运行 tools/repository/build-knowledge-center.sh" >&2
  exit 1
fi
if [[ ! -f "${classes_dir}/Main.class" || ! -f "${classes_dir}/StorageSchemaDao.class" ]]; then
  echo "未找到已编译的 YashanDB Storage class，请先运行 tools/repository/build-knowledge-center.sh" >&2
  exit 1
fi

: "${YASDB_JDBC_URL:?必须设置 YASDB_JDBC_URL}"
: "${YASDB_USERNAME:?必须设置 YASDB_USERNAME}"
# 开发环境密码由 load-yashandb-env.sh 自动读取；不强制手工导出。
# 缺少密码时交由 JDBC 返回明确认证错误，便于开发阶段迭代配置。
YASDB_PASSWORD="${YASDB_PASSWORD:-}"
export YASDB_PASSWORD

classpath_separator=:
if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* || "$(uname -s)" == CYGWIN* ]]; then
  jdbc_jar="$(cygpath -w "${jdbc_jar}")"
  classes_dir="$(cygpath -w "${classes_dir}")"
  classpath_separator=';'
fi

exec java -cp "${jdbc_jar}${classpath_separator}${classes_dir}" Main

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

if [[ "${1:-}" == migrate ]]; then
  migration_source_metadata="${YASDB_STORAGE_SQL_DIR}/migration-source.properties"
  [[ -f "$migration_source_metadata" ]] || {
    echo "拒绝执行迁移：构建产物缺少迁移来源证据，请先重新构建" >&2
    exit 1
  }
  migration_source_dirty="$(sed -n 's/^sourceDirty=//p' "$migration_source_metadata")"
  migration_source_revision="$(sed -n 's/^sourceRevision=//p' "$migration_source_metadata")"
  migration_source_expected_sha="$(sed -n 's/^aggregateSha256=//p' "$migration_source_metadata")"
  migration_source_actual_sha="$({
    find "$YASDB_STORAGE_SQL_DIR" -maxdepth 1 -type f \
      \( -name '[0-9][0-9][0-9]_*.sql' -o -name 'migration-aliases.properties' \) -print0 \
      | sort -z | while IFS= read -r -d '' migration_file; do
          migration_digest="$(sha256sum "$migration_file" | awk '{print $1}')"
          printf '%s  apps/yashandb-storage/sql/%s\n' "$migration_digest" "$(basename "$migration_file")"
        done
  } | sha256sum | awk '{print $1}')"
  [[ "$migration_source_dirty" == false && -n "$migration_source_revision" && "$migration_source_revision" != unknown \
    && -n "$migration_source_expected_sha" && "$migration_source_actual_sha" == "$migration_source_expected_sha" ]] || {
    echo "拒绝执行迁移：SQL 必须来自已提交的 Git 版本，当前构建包含未提交迁移变更" >&2
    exit 1
  }
fi

classpath_separator=:
if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* || "$(uname -s)" == CYGWIN* ]]; then
  jdbc_jar="$(cygpath -w "${jdbc_jar}")"
  classes_dir="$(cygpath -w "${classes_dir}")"
  classpath_separator=';'
fi

java_bin="${KNOWLEDGE_CENTER_JAVA_BIN:-java}"
exec "$java_bin" -cp "${jdbc_jar}${classpath_separator}${classes_dir}" Main "$@"

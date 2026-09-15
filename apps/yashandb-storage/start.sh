#!/usr/bin/env bash
set -euo pipefail

service_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${service_dir}/../.." && pwd)"
if [[ -f "${repo_root}/tools/repository/load-yashandb-env.sh" ]]; then
  # 开发环境读取统一配置；部署环境可预先注入同名变量覆盖。
  source "${repo_root}/tools/repository/load-yashandb-env.sh"
fi
jdbc_jar="${YASDB_JDBC_JAR:-${service_dir}/lib/yashandb-jdbc.jar}"
runtime_root="${KNOWLEDGE_CENTER_RUNTIME_DIR:-${repo_root}/runtime/agent-runner}"
export YASDB_STORAGE_SQL_DIR="${YASDB_STORAGE_SQL_DIR:-${service_dir}/sql}"
[[ "$jdbc_jar" == /* ]] || jdbc_jar="$repo_root/$jdbc_jar"
[[ "$YASDB_STORAGE_SQL_DIR" == /* ]] || export YASDB_STORAGE_SQL_DIR="$repo_root/$YASDB_STORAGE_SQL_DIR"

if [[ ! -f "${jdbc_jar}" ]]; then
  echo "未找到 YashanDB JDBC 驱动，请设置 YASDB_JDBC_JAR" >&2
  exit 1
fi

: "${YASDB_JDBC_URL:?必须设置 YASDB_JDBC_URL}"
: "${YASDB_USERNAME:?必须设置 YASDB_USERNAME}"
# 开发环境密码由 load-yashandb-env.sh 自动读取；不强制手工导出。
# 缺少密码时交由 JDBC 返回明确认证错误，便于开发阶段迭代配置。
YASDB_PASSWORD="${YASDB_PASSWORD:-}"
export YASDB_PASSWORD

source_files=(
  "${service_dir}/src/Main.java"
  "${service_dir}/src/StorageSchemaDao.java"
)
source_fingerprint="$({ sha256sum "${source_files[@]}" "${jdbc_jar}"; java -version 2>&1; } | sha256sum | awk '{print $1}')"
classes_dir="${runtime_root}/.runtime/yashandb-storage/classes/${source_fingerprint}"

if [[ ! -f "${classes_dir}/Main.class" || ! -f "${classes_dir}/StorageSchemaDao.class" ]]; then
  mkdir -p "${classes_dir}"
  if command -v javac >/dev/null 2>&1; then
    javac -cp "${jdbc_jar}" -d "${classes_dir}" "${source_files[@]}"
  elif java --list-modules 2>/dev/null | grep -q '^jdk.compiler@'; then
    java -m jdk.compiler/com.sun.tools.javac.Main \
      -cp "${jdbc_jar}" -d "${classes_dir}" "${source_files[@]}"
  else
    echo "未找到 Java 编译器，请安装 JDK 17+" >&2
    exit 1
  fi
fi

exec java -cp "${jdbc_jar}:${classes_dir}" Main

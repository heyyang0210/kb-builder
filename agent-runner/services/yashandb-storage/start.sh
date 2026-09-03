#!/usr/bin/env bash
set -euo pipefail

service_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
jdbc_jar="${YASDB_JDBC_JAR:-${service_dir}/lib/yashandb-jdbc.jar}"
export YASDB_STORAGE_SQL_DIR="${YASDB_STORAGE_SQL_DIR:-${service_dir}/sql}"

if [[ ! -f "${jdbc_jar}" ]]; then
  echo "未找到 YashanDB JDBC 驱动，请设置 YASDB_JDBC_JAR" >&2
  exit 1
fi

: "${YASDB_JDBC_URL:?必须设置 YASDB_JDBC_URL}"
: "${YASDB_USERNAME:?必须设置 YASDB_USERNAME}"
: "${YASDB_PASSWORD:?必须设置 YASDB_PASSWORD}"

exec java -cp "${jdbc_jar}" "${service_dir}/src/Main.java"

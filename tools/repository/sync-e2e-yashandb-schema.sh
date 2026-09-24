#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
source_config_dir="${YASDB_E2E_SOURCE_CONFIG_DIR:-$repo_root/config/yashandb}"
target_config_dir="${YASDB_E2E_TARGET_CONFIG_DIR:-$repo_root/runtime/test-config/yashandb}"
output_dir="${YASDB_E2E_SYNC_OUTPUT_DIR:-$repo_root/runtime/test-results/database-sync/manual-$(date +%Y%m%d-%H%M%S)}"
lock_file="${YASDB_E2E_SYNC_LOCK_FILE:-$repo_root/runtime/test-results/database-sync/test-hy.lock}"
expected_source="${YASDB_E2E_SOURCE_SCHEMA:-pf_knowledge}"
expected_target="${YASDB_E2E_TARGET_SCHEMA:-test_hy}"
exp_bin="${YASDB_EXP_BIN:-/home/hey/.yasboot/yashandb_yasdb_home/bin/exp}"
yasql_bin="${YASDB_YASQL_BIN:-/home/hey/.yasboot/yashandb_yasdb_home/bin/yasql}"

mkdir -p "$output_dir" "$(dirname "$lock_file")"
if [[ "${KNOWLEDGE_CENTER_E2E_DB_LOCK_HELD:-0}" != 1 ]]; then
  exec 9>"$lock_file"
  flock -w "${YASDB_E2E_SYNC_LOCK_TIMEOUT_SECONDS:-600}" 9 || {
    echo "等待 test_hy 独占锁超时：$lock_file" >&2
    exit 1
  }
fi

for executable in "$exp_bin" "$yasql_bin"; do
  [[ -x "$executable" ]] || { echo "缺少 YashanDB 工具：$executable" >&2; exit 1; }
done
for config_file in "$source_config_dir/service.env" "$target_config_dir/service.env"; do
  [[ -f "$config_file" ]] || { echo "数据库配置不存在：$config_file" >&2; exit 1; }
done

load_database_config() {
  local config_dir="$1"
  unset YASDB_JDBC_URL YASDB_USERNAME YASDB_PASSWORD KNOWLEDGE_CENTER_DATABASE_CONFIG_SOURCE
  YASDB_CONFIG_DIR="$config_dir"
  export YASDB_CONFIG_DIR
  # shellcheck disable=SC1091
  source "$script_dir/load-yashandb-env.sh"
}

jdbc_server() {
  local jdbc_url="$1"
  local server="${jdbc_url#jdbc:yasdb://}"
  printf '%s' "${server%/*}"
}

load_database_config "$source_config_dir"
source_url="$YASDB_JDBC_URL"
source_user="$YASDB_USERNAME"
source_password="${YASDB_PASSWORD:-}"
source_server="$(jdbc_server "$source_url")"
source_jdbc_jar="${YASDB_JDBC_JAR:-$repo_root/runtime/build/knowledge-center/current/java/lib/yashandb-jdbc.jar}"
[[ "$source_jdbc_jar" == /* ]] || source_jdbc_jar="$repo_root/$source_jdbc_jar"

load_database_config "$target_config_dir"
target_url="$YASDB_JDBC_URL"
target_user="$YASDB_USERNAME"
target_password="${YASDB_PASSWORD:-}"
target_server="$(jdbc_server "$target_url")"

[[ "${source_user,,}" == "${expected_source,,}" ]] || {
  echo "拒绝同步：源 Schema 必须是 $expected_source，实际为 $source_user" >&2
  exit 1
}
[[ "${target_user,,}" == "${expected_target,,}" ]] || {
  echo "拒绝同步：目标 Schema 必须是 $expected_target，实际为 $target_user" >&2
  exit 1
}
[[ "${source_user,,}" != "${target_user,,}" ]] || { echo "拒绝同步：源和目标 Schema 不得相同" >&2; exit 1; }
[[ -n "$source_password" && -n "$target_password" ]] || { echo "源或目标数据库密码未配置" >&2; exit 1; }
[[ -f "$source_jdbc_jar" ]] || { echo "缺少 YashanDB JDBC 驱动：$source_jdbc_jar" >&2; exit 1; }

schema_file="$output_dir/source-schema.sql"
target_schema_file="$output_dir/target-schema.sql"
pre_data_file="$output_dir/target-schema-pre-data.sql"
post_data_file="$output_dir/target-schema-post-data.sql"
drop_file="$output_dir/drop-target-schema.sql"
table_file="$output_dir/source-tables.txt"
log_dir="$output_dir/logs"
report_file="$output_dir/report.json"
mkdir -p "$log_dir"
[[ ! -e "$schema_file" ]] || { echo "拒绝覆盖已有结构文件：$schema_file" >&2; exit 1; }

echo "[1/5] 从 $expected_source 只读导出结构 SQL"
export_output="$output_dir/export.out"
"$exp_bin" --sql "$source_user/$source_password@$source_server" \
  "FILE=$schema_file" "OWNER=$source_user" ROWS=N \
  "LOG_PATH=$log_dir" LOG_LEVEL=INFO | tee "$export_output"
grep -Fq "export metadata sql terminated successfully" "$export_output" || {
  echo "源 Schema 结构导出失败" >&2
  exit 1
}

sql_output() {
  local user="$1" password="$2" server="$3" statement="$4"
  "$yasql_bin" -S "$user/$password@$server" -c "$statement"
}

table_names() {
  sql_output "$1" "$2" "$3" "select table_name from user_tables order by table_name;" \
    | awk '/^-{5,}/{reading=1; next} /rows fetched/{reading=0} reading {gsub(/^[[:space:]]+|[[:space:]]+$/, ""); if ($0 != "") print $0}'
}

table_count() {
  sql_output "$1" "$2" "$3" "select count(*) from $4;" \
    | awk '/^-{5,}/{getline; gsub(/[[:space:]]/, ""); print; exit}'
}

mapfile -t source_tables < <(table_names "$source_user" "$source_password" "$source_server")
(( ${#source_tables[@]} > 0 )) || { echo "源 Schema 没有可同步表" >&2; exit 1; }
printf '%s\n' "${source_tables[@]}" > "$table_file"

sed "s/\"${source_user^^}\"/\"${target_user^^}\"/g; /^ALTER SESSION SET CURRENT_SCHEMA/d" "$schema_file" > "$target_schema_file"
awk 'BEGIN{post=0} /^CREATE INDEX /{post=1} !post{print}' "$target_schema_file" > "$pre_data_file"
awk 'BEGIN{post=0} /^CREATE INDEX /{post=1} post{print}' "$target_schema_file" > "$post_data_file"
[[ -s "$pre_data_file" && -s "$post_data_file" ]] || { echo "无法拆分结构 SQL" >&2; exit 1; }

mapfile -t target_tables_before < <(table_names "$target_user" "$target_password" "$target_server")
mapfile -t target_sequences_before < <(
  sql_output "$target_user" "$target_password" "$target_server" "select sequence_name from user_sequences order by sequence_name;" \
    | awk '/^-{5,}/{reading=1; next} /rows fetched/{reading=0} reading {gsub(/^[[:space:]]+|[[:space:]]+$/, ""); if ($0 != "") print $0}'
)
{
  for table in "${target_tables_before[@]}"; do printf 'DROP TABLE "%s" CASCADE CONSTRAINTS;\n' "$table"; done
  for sequence in "${target_sequences_before[@]}"; do printf 'DROP SEQUENCE "%s";\n' "$sequence"; done
} > "$drop_file"

run_yasql_file() {
  local file="$1" output="$2"
  set +e
  "$yasql_bin" -S "$target_user/$target_password@$target_server" -f "$file" > "$output" 2>&1
  local status=$?
  set -e
  if (( status != 0 )) || grep -Eq '(^|[^A-Z])YAS-[0-9]+' "$output"; then
    cat "$output" >&2
    return 1
  fi
}

echo "[2/5] 重建 $expected_target 表和序列"
run_yasql_file "$drop_file" "$output_dir/drop.out"
run_yasql_file "$pre_data_file" "$output_dir/create-tables.out"

echo "[3/5] 通过双连接 JDBC 流式复制表数据"
class_dir="$output_dir/classes"
mkdir -p "$class_dir"
if command -v javac >/dev/null 2>&1; then
  javac -cp "$source_jdbc_jar" -d "$class_dir" "$script_dir/SyncYashanDbSchemaData.java"
else
  java -m jdk.compiler/com.sun.tools.javac.Main -cp "$source_jdbc_jar" -d "$class_dir" "$script_dir/SyncYashanDbSchemaData.java"
fi
SYNC_SOURCE_JDBC_URL="$source_url" SYNC_SOURCE_USERNAME="$source_user" SYNC_SOURCE_PASSWORD="$source_password" \
SYNC_TARGET_JDBC_URL="$target_url" SYNC_TARGET_USERNAME="$target_user" SYNC_TARGET_PASSWORD="$target_password" \
  java -cp "$source_jdbc_jar:$class_dir" SyncYashanDbSchemaData "$table_file" | tee "$output_dir/data-copy.tsv"

echo "[4/5] 重建索引和约束"
run_yasql_file "$post_data_file" "$output_dir/create-constraints.out"

echo "[5/5] 对账源/目标表和行数"
mapfile -t target_tables < <(table_names "$target_user" "$target_password" "$target_server")

missing_tables=()
row_mismatches=()
row_report="$output_dir/row-counts.tsv"
: > "$row_report"
for table in "${source_tables[@]}"; do
  if ! printf '%s\n' "${target_tables[@]}" | grep -Fxq "$table"; then
    missing_tables+=("$table")
    continue
  fi
  source_count="$(table_count "$source_user" "$source_password" "$source_server" "$table")"
  target_count="$(table_count "$target_user" "$target_password" "$target_server" "$table")"
  printf '%s\t%s\t%s\n' "$table" "$source_count" "$target_count" >> "$row_report"
  [[ "$source_count" == "$target_count" ]] || row_mismatches+=("$table:$source_count:$target_count")
done

python3 - "$report_file" "$source_user" "$target_user" "$source_server" "$row_report" "${missing_tables[*]:-}" "${row_mismatches[*]:-}" <<'PY'
import json
import sys
from datetime import datetime
from pathlib import Path

report_path, source, target, server, counts_path, missing_text, mismatch_text = sys.argv[1:]
rows = []
for line in Path(counts_path).read_text(encoding="utf-8").splitlines():
    table, source_count, target_count = line.split("\t")
    rows.append({"table": table, "sourceRows": int(source_count), "targetRows": int(target_count)})
payload = {
    "generatedAt": datetime.now().astimezone().isoformat(),
    "sourceSchema": source,
    "targetSchema": target,
    "server": server,
    "tablesCompared": len(rows),
    "missingTables": missing_text.split() if missing_text else [],
    "rowMismatches": mismatch_text.split() if mismatch_text else [],
    "rowCounts": rows,
}
payload["passed"] = not payload["missingTables"] and not payload["rowMismatches"]
Path(report_path).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY

if (( ${#missing_tables[@]} > 0 || ${#row_mismatches[@]} > 0 )); then
  echo "Schema 同步对账失败，详见：$report_file" >&2
  exit 1
fi
echo "Schema 同步完成：${#source_tables[@]} 张表对账通过，报告：$report_file"

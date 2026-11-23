#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=read-config.sh
source "$script_dir/read-config.sh"
load_yasdb_refresh_config

exp_bin="${YASDB_EXP_BIN:-$(command -v exp || true)}"
imp_bin="${YASDB_IMP_BIN:-$(command -v imp || true)}"
yasql_bin="${YASDB_YASQL_BIN:-$(command -v yasql || true)}"
for tool in "$exp_bin" "$imp_bin" "$yasql_bin"; do
  [[ -n "$tool" && -x "$tool" ]] || { echo '找不到可执行的 exp、imp 或 yasql。' >&2; exit 1; }
done

repo_root="$(cd "$script_dir/../../../../../.." && pwd)"
run_dir="$repo_root/runtime/database-refresh/migration-$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$run_dir/source-exp-logs" "$run_dir/target-imp-logs"
chmod 700 "$repo_root/runtime/database-refresh" "$run_dir"
started_epoch="$(date +%s)"

query_rows() {
  local connection="$1" sql="$2"
  "$yasql_bin" -S "$connection" -c "$sql" \
    | awk '/^-{5,}/{reading=1;next}/rows fetched/{reading=0}reading{gsub(/^[[:space:]]+|[[:space:]]+$/, ""); if ($0 != "") print}'
}

"$yasql_bin" -S "$YASDB_SOURCE_CONNECTION" -c 'select 1 from dual;' > "$run_dir/source-connect.log" 2>&1
"$yasql_bin" -S "$YASDB_TARGET_CONNECTION" -c 'select 1 from dual;' > "$run_dir/target-connect.log" 2>&1
query_rows "$YASDB_SOURCE_CONNECTION" "select table_name from all_tables where owner = UPPER('$YASDB_SOURCE_OWNER') order by table_name;" > "$run_dir/source-tables.txt"
query_rows "$YASDB_SOURCE_CONNECTION" "select object_name || chr(9) || object_type from all_objects where owner = UPPER('$YASDB_SOURCE_OWNER') order by object_type, object_name;" > "$run_dir/source-objects.tsv"
query_rows "$YASDB_SOURCE_CONNECTION" "select table_name || chr(9) || replace(replace(replace(nvl(comments, '未填写'), chr(9), ' '), chr(10), ' '), chr(13), ' ') from all_tab_comments where owner = UPPER('$YASDB_SOURCE_OWNER') and table_type = 'TABLE' order by table_name;" > "$run_dir/source-table-meanings.tsv"
[[ -s "$run_dir/source-tables.txt" ]] || { echo '源 Schema 没有可导出的表，停止。' >&2; exit 1; }
[[ -s "$run_dir/source-objects.tsv" ]] || { echo '无法读取源 Schema 元数据清单，停止。' >&2; exit 1; }
query_rows "$YASDB_TARGET_CONNECTION" "select object_name || chr(9) || object_type from all_objects where owner = UPPER('$YASDB_TARGET_OWNER') order by object_type, object_name;" > "$run_dir/target-objects-before-import.tsv"
[[ ! -s "$run_dir/target-objects-before-import.tsv" ]] || {
  echo '个人目标 Schema 尚未清理，请先运行 clean-personal-db.sh。' >&2; exit 1;
}

printf '开始全量导出：%s / Schema %s\n' "$YASDB_SOURCE_SERVER" "$YASDB_SOURCE_OWNER"
"$exp_bin" "$YASDB_SOURCE_CONNECTION" "FILE=$run_dir/source-full.dmp" "OWNER=$YASDB_SOURCE_OWNER" ROWS=Y \
  "LOG_PATH=$run_dir/source-exp-logs" LOG_LEVEL=INFO > "$run_dir/exp.log" 2>&1
chmod 600 "$run_dir/source-full.dmp" "$run_dir/exp.log"
if grep -Eiq '(^|[[:space:]])warning(:|[[:space:]]|$)|YAS-[0-9]+|failed to|skipping|skipped' \
  "$run_dir/exp.log" "$run_dir"/source-exp-logs/* 2>/dev/null; then
  echo "源库导出日志包含警告或跳过；为避免导入不完整数据，已停止。日志：$run_dir" >&2; exit 1
fi
query_rows "$YASDB_SOURCE_CONNECTION" "select table_name from all_tables where owner = UPPER('$YASDB_SOURCE_OWNER') order by table_name;" > "$run_dir/source-tables-after-export.txt"
query_rows "$YASDB_SOURCE_CONNECTION" "select object_name || chr(9) || object_type from all_objects where owner = UPPER('$YASDB_SOURCE_OWNER') order by object_type, object_name;" > "$run_dir/source-objects-after-export.tsv"
if ! diff -u "$run_dir/source-tables.txt" "$run_dir/source-tables-after-export.txt" > "$run_dir/source-table-change.diff" || \
  ! diff -u "$run_dir/source-objects.tsv" "$run_dir/source-objects-after-export.tsv" > "$run_dir/source-object-change.diff"; then
  echo "导出期间源 Schema 对象发生变化，停止导入以避免报告与导出文件不符。详情：$run_dir" >&2; exit 1
fi

printf '开始全量导入：%s / Schema %s\n' "$YASDB_TARGET_SERVER" "$YASDB_TARGET_OWNER"
"$imp_bin" "$YASDB_TARGET_CONNECTION" "FILE=$run_dir/source-full.dmp" \
  "FROMUSER=$YASDB_SOURCE_OWNER" "TOUSER=$YASDB_TARGET_OWNER" ROWS=Y \
  "LOG_PATH=$run_dir/target-imp-logs" LOG_LEVEL=INFO > "$run_dir/imp.log" 2>&1
chmod 600 "$run_dir/imp.log"

declare -A exported_rows=()
declare -A imported_rows=()
shopt -s nocasematch
while IFS= read -r log_line; do
  if [[ "$log_line" =~ exporting[[:space:]]table[[:space:]]([^[:space:]]+)[[:space:]]+([0-9]+)[[:space:]]rows[[:space:]]exported ]]; then
    table_name="${BASH_REMATCH[1]##*.}"
    exported_rows["${table_name^^}"]="${BASH_REMATCH[2]}"
  fi
done < <(cat "$run_dir/exp.log" "$run_dir"/source-exp-logs/* 2>/dev/null || true)
while IFS= read -r log_line; do
  if [[ "$log_line" =~ importing[[:space:]]table[[:space:]]([^[:space:]]+)[[:space:]]+([0-9]+)[[:space:]]rows[[:space:]]imported ]]; then
    table_name="${BASH_REMATCH[1]##*.}"
    imported_rows["${table_name^^}"]="${BASH_REMATCH[2]}"
  fi
done < <(cat "$run_dir/imp.log" "$run_dir"/target-imp-logs/* 2>/dev/null || true)
shopt -u nocasematch

row_mismatch=0
declare -A expected_tables=()
while IFS= read -r table_name; do
  key="${table_name^^}"
  expected_tables["$key"]=1
  [[ -n "${exported_rows[$key]:-}" && -n "${imported_rows[$key]:-}" ]] || row_mismatch=1
  [[ "${exported_rows[$key]:-}" == "${imported_rows[$key]:-}" ]] || row_mismatch=1
done < "$run_dir/source-tables.txt"
for key in "${!exported_rows[@]}" "${!imported_rows[@]}"; do
  [[ -n "${expected_tables[$key]:-}" ]] || row_mismatch=1
done
tool_warning=0
if grep -Eiq '(^|[[:space:]])warning(:|[[:space:]]|$)|YAS-[0-9]+|failed to|skipping|skipped' \
  "$run_dir/exp.log" "$run_dir/imp.log" "$run_dir"/source-exp-logs/* "$run_dir"/target-imp-logs/* 2>/dev/null; then
  tool_warning=1
fi

completed_epoch="$(date +%s)"
duration_seconds=$((completed_epoch - started_epoch))
report_file="$run_dir/report.md"
{
  printf '# YashanDB 全量迁移报告\n\n'
  printf -- '- 迁移耗时时间：%s 秒\n' "$duration_seconds"
  printf -- '- 源数据库：%s / Schema %s\n' "$YASDB_SOURCE_SERVER" "$YASDB_SOURCE_OWNER"
  printf -- '- 个人数据库：%s / Schema %s\n' "$YASDB_TARGET_SERVER" "$YASDB_TARGET_OWNER"
  if (( row_mismatch == 0 && tool_warning == 0 )); then
    printf -- '- 结果：完成，逐表导入行数与导出行数一致。\n\n'
  else
    printf -- '- 结果：异常，请核查行数及 exp/imp 日志。\n\n'
  fi
  printf '## 表 1：元数据信息\n\n| 对象名称 | 对象类型 |\n| --- | --- |\n'
  while IFS=$'\t' read -r object_name object_type; do
    [[ -n "$object_name" ]] || continue
    printf '| %s | %s |\n' "$object_name" "$object_type"
  done < "$run_dir/source-objects.tsv"
  printf '\n## 表 2：数据信息\n\n| 表名称 | 表含义 | 导出数据行数 | 导入数据行数 |\n| --- | --- | ---: | ---: |\n'
  while IFS= read -r table_name; do
    key="${table_name^^}"
    meaning="$(awk -F '\t' -v name="$key" 'toupper($1)==name {sub(/^[^\t]*\t/, ""); print; exit}' "$run_dir/source-table-meanings.tsv")"
    [[ -n "$meaning" ]] || meaning='未填写'
    meaning="$(printf '%s' "$meaning" | sed 's/|/&#124;/g; s/`/\&#96;/g')"
    printf '| %s | %s | %s | %s |\n' "$table_name" "$meaning" \
      "${exported_rows[$key]:-未记录}" "${imported_rows[$key]:-未记录}"
  done < "$run_dir/source-tables.txt"
} > "$report_file"

find "$run_dir" -type f -exec chmod 600 {} +
printf '报告：%s\n' "$report_file"
if (( row_mismatch != 0 || tool_warning != 0 )); then
  echo '报告已生成，但逐表行数不一致或 exp/imp 日志包含警告。' >&2
  exit 1
fi

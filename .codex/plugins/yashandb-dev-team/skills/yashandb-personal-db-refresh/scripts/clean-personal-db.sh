#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=read-config.sh
source "$script_dir/read-config.sh"
load_yasdb_refresh_config

yasql_bin="${YASDB_YASQL_BIN:-$(command -v yasql || true)}"
exp_bin="${YASDB_EXP_BIN:-$(command -v exp || true)}"
[[ -n "$yasql_bin" && -x "$yasql_bin" && -n "$exp_bin" && -x "$exp_bin" ]] || {
  echo '找不到可执行的 yasql 或 exp。' >&2; exit 1;
}

repo_root="$(cd "$script_dir/../../../../../.." && pwd)"
run_dir="$repo_root/runtime/database-refresh/cleanup-$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$run_dir"
chmod 700 "$repo_root/runtime/database-refresh" "$run_dir"

query_rows() {
  "$yasql_bin" -S "$YASDB_TARGET_CONNECTION" -c "$1" \
    | awk '/^-{5,}/{reading=1;next}/rows fetched/{reading=0}reading{gsub(/^[[:space:]]+|[[:space:]]+$/, ""); if ($0 != "") print}'
}

"$yasql_bin" -S "$YASDB_TARGET_CONNECTION" -c 'select 1 from dual;' > "$run_dir/connect.log" 2>&1
query_rows "select object_name || chr(9) || object_type from all_objects where owner = UPPER('$YASDB_TARGET_OWNER') order by object_type, object_name;" > "$run_dir/objects-before.tsv"
"$yasql_bin" -S "$YASDB_TARGET_CONNECTION" -c 'select count(*) from user_recyclebin;' > "$run_dir/recyclebin-before.log" 2>&1

awk -F '\t' -v owner="$YASDB_TARGET_OWNER" '
  $1 !~ /^[A-Za-z][A-Za-z0-9_$#]*$/ { bad=1; next }
  $2 == "VIEW" { printf "DROP VIEW \"%s\".\"%s\";\n", toupper(owner), $1; next }
  $2 == "TABLE" { printf "DROP TABLE \"%s\".\"%s\" CASCADE CONSTRAINTS;\n", toupper(owner), $1; next }
  $2 == "MATERIALIZED VIEW" { printf "DROP MATERIALIZED VIEW \"%s\".\"%s\";\n", toupper(owner), $1; next }
  $2 == "SEQUENCE" { printf "DROP SEQUENCE \"%s\".\"%s\";\n", toupper(owner), $1; next }
  $2 == "PROCEDURE" { printf "DROP PROCEDURE \"%s\".\"%s\";\n", toupper(owner), $1; next }
  $2 == "FUNCTION" { printf "DROP FUNCTION \"%s\".\"%s\";\n", toupper(owner), $1; next }
  $2 == "PACKAGE" { printf "DROP PACKAGE \"%s\".\"%s\";\n", toupper(owner), $1; next }
  $2 == "SYNONYM" { printf "DROP SYNONYM \"%s\".\"%s\";\n", toupper(owner), $1; next }
  $2 == "TYPE" { printf "DROP TYPE \"%s\".\"%s\" FORCE;\n", toupper(owner), $1; next }
  $2 == "PACKAGE BODY" || $2 == "TYPE BODY" { next }
  $2 == "INDEX" || $2 == "INDEX PARTITION" || $2 == "TABLE PARTITION" || \
    $2 == "TRIGGER" || $2 == "LOB" || $2 == "LOB PARTITION" { next }
  { bad=1 }
  END { if (bad) exit 3 }
' "$run_dir/objects-before.tsv" > "$run_dir/drop-target.sql" || {
  echo "目标 Schema 含不支持清理的对象类型；未删除任何对象。清单：$run_dir/objects-before.tsv" >&2; exit 1;
}
printf 'PURGE RECYCLEBIN;\n' >> "$run_dir/drop-target.sql"

mkdir -p "$run_dir/backup-logs"
"$exp_bin" "$YASDB_TARGET_CONNECTION" "FILE=$run_dir/target-before.dmp" "OWNER=$YASDB_TARGET_OWNER" ROWS=Y \
  "LOG_PATH=$run_dir/backup-logs" LOG_LEVEL=INFO > "$run_dir/backup.log" 2>&1
chmod 600 "$run_dir/target-before.dmp" "$run_dir/backup.log"
if grep -Eiq '(^|[[:space:]])warning(:|[[:space:]]|$)|YAS-[0-9]+|failed to|skipping|skipped' \
  "$run_dir/backup.log" "$run_dir"/backup-logs/* 2>/dev/null; then
  echo "目标备份日志包含警告或跳过，未清理目标。请检查：$run_dir" >&2; exit 1
fi
printf '个人目标库：%s / Schema %s\n备份文件：%s\n对象清单：%s\n回收站记录检查：%s\n' \
  "$YASDB_TARGET_SERVER" "$YASDB_TARGET_OWNER" "$run_dir/target-before.dmp" "$run_dir/objects-before.tsv" "$run_dir/recyclebin-before.log"
read -r -p '将清理 Schema 并永久清空该用户回收站。输入 host:port/SCHEMA 确认：' confirmation
[[ "$confirmation" == "$YASDB_TARGET_SERVER/$YASDB_TARGET_OWNER" ]] || { echo '确认不匹配，已取消。'; exit 1; }

query_rows "select object_name || chr(9) || object_type from all_objects where owner = UPPER('$YASDB_TARGET_OWNER') order by object_type, object_name;" > "$run_dir/objects-before-drop.tsv"
if ! diff -u "$run_dir/objects-before.tsv" "$run_dir/objects-before-drop.tsv" > "$run_dir/object-list-change.diff"; then
  echo "备份期间目标对象清单发生变化，未执行清理。请重新运行；差异：$run_dir/object-list-change.diff" >&2; exit 1
fi
"$yasql_bin" -S "$YASDB_TARGET_CONNECTION" -f "$run_dir/drop-target.sql" > "$run_dir/cleanup.log" 2>&1
if grep -Eq 'YAS(-|QL-)[0-9]+' "$run_dir/cleanup.log"; then cat "$run_dir/cleanup.log" >&2; exit 1; fi
query_rows "select object_name || chr(9) || object_type from all_objects where owner = UPPER('$YASDB_TARGET_OWNER') order by object_type, object_name;" > "$run_dir/objects-after.tsv"
if [[ -s "$run_dir/objects-after.tsv" ]]; then
  echo "清理后仍存在目标对象，请检查清单：$run_dir/objects-after.tsv" >&2; exit 1
fi
find "$run_dir" -type f -exec chmod 600 {} +
printf '个人 Schema 已清理。备份和日志：%s\n' "$run_dir"

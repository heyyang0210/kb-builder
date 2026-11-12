#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
PROTECTED_PATHS_FILE=${REVIEW_PROTECTED_PATHS_FILE:-tools/repository/verify-change-protected-paths.txt}
cd "$REPOSITORY_ROOT"

echo '[1/5] 检查工作区与暂存区空白'
git diff --check
git diff --cached --check

echo '[2/5] 检查暂存区保护文件'
while IFS= read -r protected_path; do
  [[ -z "$protected_path" || "$protected_path" == \#* ]] && continue
  if git diff --cached --name-only --diff-filter=ACMR -- "$protected_path" | rg -Fxq "$protected_path"; then
    echo "错误：$protected_path 不得进入普通功能提交；请取消暂存，或在用户明确授权后单独提交对应资产。" >&2
    exit 1
  fi
done < "$PROTECTED_PATHS_FILE"

echo '[3/5] 按变更类型执行语法检查'
changed_files=$({ git diff --name-only HEAD; git ls-files --others --exclude-standard; } | sort -u)
if printf '%s\n' "$changed_files" | rg -q '\.(cjs|js|mjs)$'; then
  npm run check:node
else
  echo '未发现 JavaScript 变更，跳过 Node.js 语法检查。'
fi

echo '[4/5] 检查知识中心 UI 契约'
npm run check:ui

echo '[5/5] 展示提交范围'
git diff --cached --stat
git status --short

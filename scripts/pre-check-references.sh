#!/usr/bin/env bash
# ============================================================
# 前置检查脚本：资料引用环境检查
# 用途：在生成文档前检查资料引用环境是否就绪
# 使用：bash scripts/pre-check-references.sh
# ============================================================

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 统计
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

# 获取脚本所在目录的上级目录（即仓库根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo ""
echo "============================================"
echo "  YashanDB 知识库 Skill 仓库 - 前置检查"
echo "============================================"
echo ""
echo "仓库路径：${REPO_ROOT}"
echo ""

# ----------------------------------------------------------
# 检查1：YashanDB 知识库 MCP 配置
# ----------------------------------------------------------
echo -e "${BLUE}[检查1] YashanDB 知识库 MCP 配置${NC}"

MCP_CONFIGURED=false

# 检查常见的 MCP 配置文件位置
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
MCP_CONFIG_FILES=(
    "${CODEX_HOME}/mcp.json"
    "${CODEX_HOME}/config/mcp.json"
    "${REPO_ROOT}/.codex/mcp.json"
    "${REPO_ROOT}/mcp.json"
)

for config_file in "${MCP_CONFIG_FILES[@]}"; do
    if [[ -f "$config_file" ]]; then
        if grep -q "yashandb" "$config_file" 2>/dev/null; then
            echo -e "  ${GREEN}✓ 发现 YashanDB MCP 配置：${config_file}${NC}"
            MCP_CONFIGURED=true
            break
        fi
    fi
done

if [[ "$MCP_CONFIGURED" == false ]]; then
    echo -e "  ${YELLOW}⚠ YashanDB 知识库 MCP 未配置${NC}"
    echo -e "    → 将降级使用本地静态资料（references/ 目录）"
    echo -e "    → 配置方法：参见 references/mcp-yashandb-kb/README.md"
    echo -e "    → 配置后重新运行此脚本验证"
    WARN_COUNT=$((WARN_COUNT + 1))
else
    PASS_COUNT=$((PASS_COUNT + 1))
fi
echo ""

# ----------------------------------------------------------
# 检查2：references/ 目录结构完整性
# ----------------------------------------------------------
echo -e "${BLUE}[检查2] references/ 目录结构${NC}"

REQUIRED_DIRS=(
    "references/oracle-kb"
    "references/design-docs"
    "references/test-cases"
    "references/source"
    "references/mcp-yashandb-kb"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    full_path="${REPO_ROOT}/${dir}"
    if [[ -d "$full_path" ]]; then
        echo -e "  ${GREEN}✓ ${dir}/${NC}"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "  ${RED}✗ ${dir}/ 目录缺失${NC}"
        echo -e "    → 请创建：mkdir -p ${full_path}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
done
echo ""

# ----------------------------------------------------------
# 检查3：Oracle 知识库文档完整性
# ----------------------------------------------------------
echo -e "${BLUE}[检查3] Oracle 知识库文档完整性${NC}"

ORACLE_KB_DIR="${REPO_ROOT}/references/oracle-kb"
EXPECTED_ORACLE_DOCS=(
    "01-Oracle集群基础概念与架构.md"
    "02-集群核心组件与内部机制.md"
    "03-集群资源管理与日常运维.md"
    "04-集群性能监控与诊断.md"
    "05-集群性能调优实战.md"
    "06-高可用与容灾架构.md"
    "07-集群内核机制深度解析.md"
)

ORACLE_MISSING=0
for doc in "${EXPECTED_ORACLE_DOCS[@]}"; do
    if [[ -f "${ORACLE_KB_DIR}/${doc}" ]]; then
        echo -e "  ${GREEN}✓ ${doc}${NC}"
    else
        echo -e "  ${RED}✗ ${doc} 缺失${NC}"
        ORACLE_MISSING=$((ORACLE_MISSING + 1))
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
done

if [[ $ORACLE_MISSING -eq 0 ]]; then
    echo -e "  ${GREEN}Oracle 知识库文档完整（7/7）${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "  ${RED}Oracle 知识库文档不完整（缺失 ${ORACLE_MISSING}/7）${NC}"
fi
echo ""

# ----------------------------------------------------------
# 检查4：核心配置文件完整性
# ----------------------------------------------------------
echo -e "${BLUE}[检查4] 核心配置文件完整性${NC}"

REQUIRED_CONFIGS=(
    "config/资料引用策略.md"
    "config/全局格式规范.md"
    "config/质量验证标准.md"
)

for config in "${REQUIRED_CONFIGS[@]}"; do
    full_path="${REPO_ROOT}/${config}"
    if [[ -f "$full_path" ]]; then
        echo -e "  ${GREEN}✓ ${config}${NC}"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "  ${RED}✗ ${config} 缺失${NC}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
done
echo ""

# ----------------------------------------------------------
# 检查5：Skill 文件完整性
# ----------------------------------------------------------
echo -e "${BLUE}[检查5] Skill 文件完整性${NC}"

REQUIRED_SKILLS=(
    "skills/00-通用生成-skill.md"
    "skills/01-理论机制-skill.md"
    "skills/02-实战调优-skill.md"
    "skills/03-架构对比-skill.md"
    "skills/04-运维SOP-skill.md"
    "skills/05-SQL开发参考-skill.md"
    "skills/06-兼容性差异-skill.md"
)

SKILL_MISSING=0
for skill in "${REQUIRED_SKILLS[@]}"; do
    full_path="${REPO_ROOT}/${skill}"
    if [[ -f "$full_path" ]]; then
        echo -e "  ${GREEN}✓ ${skill}${NC}"
    else
        echo -e "  ${RED}✗ ${skill} 缺失${NC}"
        SKILL_MISSING=$((SKILL_MISSING + 1))
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
done

if [[ $SKILL_MISSING -eq 0 ]]; then
    echo -e "  ${GREEN}Skill 文件完整（7/7）${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "  ${RED}Skill 文件不完整（缺失 ${SKILL_MISSING}/7）${NC}"
fi
echo ""

# ----------------------------------------------------------
# 检查6：模板文件完整性
# ----------------------------------------------------------
echo -e "${BLUE}[检查6] 模板文件完整性${NC}"

REQUIRED_TEMPLATES=(
    "templates/01-通用基础模板.md"
    "templates/02-理论机制类模板.md"
    "templates/03-实战调优类模板.md"
    "templates/04-架构对比类模板.md"
    "templates/05-运维SOP类模板.md"
    "templates/06-SQL开发参考类模板.md"
    "templates/07-兼容性差异类模板.md"
)

TEMPLATE_MISSING=0
for tpl in "${REQUIRED_TEMPLATES[@]}"; do
    full_path="${REPO_ROOT}/${tpl}"
    if [[ -f "$full_path" ]]; then
        echo -e "  ${GREEN}✓ ${tpl}${NC}"
    else
        echo -e "  ${RED}✗ ${tpl} 缺失${NC}"
        TEMPLATE_MISSING=$((TEMPLATE_MISSING + 1))
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
done

if [[ $TEMPLATE_MISSING -eq 0 ]]; then
    echo -e "  ${GREEN}模板文件完整（7/7）${NC}"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "  ${RED}模板文件不完整（缺失 ${TEMPLATE_MISSING}/7）${NC}"
fi
echo ""

# ----------------------------------------------------------
# 汇总报告
# ----------------------------------------------------------
echo "============================================"
echo "  检查结果汇总"
echo "============================================"
echo ""
echo -e "  ${GREEN}通过：${PASS_COUNT}${NC}"
echo -e "  ${YELLOW}警告：${WARN_COUNT}${NC}"
echo -e "  ${RED}失败：${FAIL_COUNT}${NC}"
echo ""

if [[ $FAIL_COUNT -eq 0 && $WARN_COUNT -eq 0 ]]; then
    echo -e "  ${GREEN}✓ 所有检查通过，可以开始生成文档！${NC}"
elif [[ $FAIL_COUNT -eq 0 ]]; then
    echo -e "  ${YELLOW}⚠ 基本检查通过，但有警告项需关注。${NC}"
    echo -e "    可以生成文档，但建议使用 MCP 获取最新资料。"
else
    echo -e "  ${RED}✗ 存在失败项，请先修复后再开始生成文档。${NC}"
    echo ""
    echo "  修复建议："
    echo "    1. 缺失目录：按提示创建目录"
    echo "    2. 缺失文件：从源仓库复制或按命名规范补充"
    echo "    3. MCP 配置：参见 references/mcp-yashandb-kb/README.md"
fi

echo ""
echo "============================================"

# 返回退出码：有失败项返回1，否则返回0
if [[ $FAIL_COUNT -gt 0 ]]; then
    exit 1
else
    exit 0
fi

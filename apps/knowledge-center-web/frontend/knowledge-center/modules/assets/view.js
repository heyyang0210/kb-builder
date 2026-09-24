import { pendingState } from '../../common/components/ui.js';
import { escapeHtml } from '../../common/utils/dom.js';

const stages = [['asset_created','待创建'],['outline_editing','完善大纲'],['outline_published','大纲已发布'],['content_building','内容构建中'],['handbook_published','已发布']];
const assetId = item => item.handbookId || item.id || '';
const ownerName = value => {
  if (typeof value === 'string') return value || '待绑定';
  if (value && typeof value === 'object') return value.displayName || value.userId || '待绑定';
  return '待绑定';
};
const ownerId = value => value && typeof value === 'object' ? String(value.principalId || value.userId || value.id || '') : '';
function ownerOptions(principals, selected, required = false) {
  const selectedId = ownerId(selected);
  const empty = required ? '<option value="">请选择责任人</option>' : '<option value="">不设置</option>';
  return empty + principals.map(person => {
    const id = String(person.principalId || person.id || '');
    const name = person.displayName || '未命名人员';
    const search = person.casLoginName || '';
    return `<option value="${escapeHtml(id)}" data-display-name="${escapeHtml(name)}" data-search="${escapeHtml(search)}" ${id === selectedId ? 'selected' : ''}>${escapeHtml(name)}</option>`;
  }).join('');
}
const statusName = item => item.statusDisplayName || stages.find(([key]) => key === item.status)?.[1] || '状态暂不可用';
const productName = item => String(item.productName || item.product?.name || item.productType || '').trim() || '未指定产品';
const count = value => Number.isFinite(Number(value)) ? String(Number(value)) : '暂无数据';
const timeText = value => value ? `更新于 ${new Date(value).toLocaleString('zh-CN', { hour12: false })}` : '更新时间暂不可用';

export function renderAssetStatistics(item) {
  if (item.statisticsStatus === 'loading') return '<span>章节 正在统计</span><small>文档 正在统计</small>';
  if (item.statisticsStatus === 'forbidden') return '<span>统计 无权读取</span><small>请检查仓库授权</small>';
  if (item.statisticsStatus === 'unavailable') return '<span>统计暂不可用</span><small>请稍后重试</small>';
  return `<span>章节 ${count(item.chapterCount)}</span><small>文档 ${count(item.documentCount)}</small>`;
}

function renderStageSummary(catalog) {
  const values = catalog.statistics || {};
  return `<nav class="asset-stage-grid" aria-label="手册阶段筛选">${stages.map(([key,label]) => `<a href="/knowledge-center/assets?status=${key}" data-asset-stage="${key}"><strong>${values[key] ?? '暂无'}</strong><span>${label}</span></a>`).join('')}</nav>`;
}

function renderFilters(catalog, params, inactive) {
  const products = Array.isArray(catalog.products) ? catalog.products : [];
  const status = inactive ? '' : `<label>状态<select name="status"><option value="">全部</option>${stages.map(([key,label]) => `<option value="${key}" ${params.get('status')===key?'selected':''}>${label}</option>`).join('')}</select></label>`;
  return `<form class="asset-filters" data-asset-filter><label>搜索手册<input name="q" value="${escapeHtml(params.get('q') || '')}" placeholder="手册名称"></label><label>搜索责任人<input name="owner" value="${escapeHtml(params.get('owner') || '')}" placeholder="A 角或 B 角"></label>${status}<label>产品<select name="productId" data-searchable-select><option value="">全部</option>${products.map(product => { const id=product.id||product.productId||product; return `<option value="${escapeHtml(id)}" ${params.get('productId')===String(id)?'selected':''}>${escapeHtml(product.name||product.displayName||product)}</option>`; }).join('')}</select></label><button class="button tertiary" type="submit">筛选</button></form>`;
}

function renderList(items, selectedId, inactive) {
  if (!items.length) return pendingState('没有符合条件的手册', '请调整搜索或筛选条件。');
  const rows = items.map(item => {
    const id = assetId(item); const selected = String(id) === String(selectedId);
    const branches = item.repository?.enabledBranches || [];
    const branch = item.selectedBranch || item.repository?.defaultBranch || '';
    const branchCell = item.repositoryMapped
      ? `<select class="asset-branch-select" data-asset-branch="${escapeHtml(id)}" data-searchable-select aria-label="${escapeHtml(item.name || '手册')}仓库版本">${branches.map(value => `<option value="${escapeHtml(value)}" ${value === branch ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select>`
      : '<span class="muted">尚未映射</span>';
    return `<tr class="${selected ? 'selected' : ''}"><td data-table-column="name"><a class="asset-name" href="/knowledge-center/assets?handbookId=${encodeURIComponent(id)}" data-asset-id="${escapeHtml(id)}"><strong>${escapeHtml(item.name || '未命名手册')}</strong></a></td><td data-table-column="product"><span class="asset-product">${escapeHtml(productName(item))}</span></td><td data-table-column="owners"><span>A：${escapeHtml(ownerName(item.ownerA || item.primaryOwnerId))}</span><small>B：${escapeHtml(ownerName(item.ownerB || item.assistantOwnerId))}</small></td><td data-table-column="status"><span class="asset-status">${escapeHtml(statusName(item))}</span>${item.statusConflict ? '<small class="asset-status-conflict">待确认</small>' : ''}</td><td data-table-column="branch">${branchCell}</td><td data-table-column="statistics" data-asset-statistics="${escapeHtml(id)}" ${item.statisticsStatus === 'loading' ? 'aria-busy="true"' : ''}>${renderAssetStatistics(item)}</td></tr>`;
  }).join('');
  return `<div class="asset-table-wrap"><table class="asset-table" data-table-view-id="asset-catalog" data-table-view-schema="1" data-table-view-label="知识资产"><caption class="sr-only">${inactive ? '已停用' : '在用'}手册资产列表</caption><thead><tr><th data-table-column="name" data-table-column-required="true" data-table-column-label="手册名称" data-table-column-width="260px">手册名称</th><th data-table-column="product" data-table-column-label="产品">产品</th><th data-table-column="owners" data-table-column-label="责任人">责任人</th><th data-table-column="status" data-table-column-label="状态">状态</th><th data-table-column="branch" data-table-column-label="仓库版本">仓库版本</th><th data-table-column="statistics" data-table-column-label="内容规模">内容规模</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderActionPanel(item, admin) {
  if (!item) return '';
  const id=assetId(item);
  const repositoryMapped = item.repositoryMapped || item.repository?.status === 'confirmed';
  const reviewHref = repositoryMapped ? `/knowledge-center/assets/${encodeURIComponent(id)}/repository` : `/knowledge-center/review?handbookId=${encodeURIComponent(id)}`;
  const management = admin ? `${item.canEdit!==false?`<button class="asset-action-row" type="button" data-asset-edit-open="${escapeHtml(id)}"><span><strong>管理手册</strong><small>修改基本信息、责任人和状态</small></span></button>`:''}<button class="asset-action-row" type="button" data-repository-mapping-open="${escapeHtml(id)}"><span><strong>${repositoryMapped ? '维护仓库映射' : '配置仓库映射'}</strong><small>设置仓库、分支和内容路径</small></span></button>${item.archived&&item.canRestore!==false?`<button class="asset-action-row" type="button" data-asset-restore="${escapeHtml(id)}"><span><strong>重新启用</strong><small>恢复到在用资产列表</small></span></button>`:''}` : '';
  return `<aside class="asset-workspace-detail" aria-label="当前手册操作"><a class="asset-mobile-back" href="/knowledge-center/assets" data-asset-detail-back>返回手册列表</a><header><div><h2>${escapeHtml(item.name||'未命名手册')}</h2></div><div class="asset-detail-heading-actions"><span class="asset-status">${escapeHtml(statusName(item))}</span><button class="icon-button asset-detail-close" type="button" data-asset-detail-close aria-label="关闭手册操作" title="关闭手册操作"><i data-lucide="x" aria-hidden="true"></i></button></div></header><nav class="asset-detail-sections" aria-label="手册操作"><a class="asset-action-row" href="/knowledge-center/outlines/${encodeURIComponent(id)}"><span><strong>大纲管理</strong><small>维护章节结构与内容范围</small></span></a><a class="asset-action-row" href="/knowledge-center/production/handbook/${encodeURIComponent(id)}"><span><strong>文档生产</strong><small>进入手册目录并编写文档正文</small></span></a><a class="asset-action-row" href="${reviewHref}"><span><strong>审核与发布</strong><small>${repositoryMapped ? '查看仓库内容、审阅并发布' : '处理候选内容和发布流程'}</small></span></a>${management}</nav></aside>`;
}

function renderPagination(catalog) {
  const page=Number(catalog.page||1), pageSize=Number(catalog.pageSize||20), total=Number(catalog.total||0), pages=Math.max(1,Math.ceil(total/pageSize));
  return `<nav class="asset-pagination" aria-label="手册分页"><span>第 ${page} / ${pages} 页，共 ${total} 本</span><button class="button tertiary compact" type="button" data-asset-page="${page-1}" ${page<=1?'disabled':''}>上一页</button><button class="button tertiary compact" type="button" data-asset-page="${page+1}" ${page>=pages?'disabled':''}>下一页</button><label>每页<select data-asset-page-size><option value="10" ${pageSize===10?'selected':''}>10</option><option value="20" ${pageSize===20?'selected':''}>20</option><option value="50" ${pageSize===50?'selected':''}>50</option></select></label></nav>`;
}


function buildMappingDialog(selected, connections, closeButton) {
  const handbookId = assetId(selected);
  const connectionOptions = connections.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name || item.project || item.id)}</option>`).join('');
  return `<dialog class="asset-dialog mapping-dialog" data-repository-mapping-dialog>
    <form data-repository-mapping-form data-handbook-id="${escapeHtml(handbookId)}">
      <header class="mapping-dialog-header"><div><span class="eyebrow">仓库映射</span><h2>配置 ${escapeHtml(selected.name || handbookId)}</h2><p>选择真实分支和中英文内容根目录，保存后即可进入仓库阅读。</p></div>${closeButton}</header>
      <div class="mapping-steps">
        <div class="mapping-step" data-step="1">
          <div class="mapping-step-header"><span class="mapping-step-number">1</span><h3>连接与分支</h3><span class="mapping-step-hint">先建立读取上下文</span></div>
          <div class="mapping-step-body">
            <div class="mapping-inline-grid"><label>GitLab 连接<select name="connectionId" class="mapping-connection-select" data-mapping-connection-select data-searchable-select required><option value="">请选择</option>${connectionOptions}</select></label><label>选择分支<select name="defaultBranch" class="mapping-branch-select" data-mapping-default-branch data-searchable-select required><option value="">先选择连接</option></select></label></div>
            <fieldset class="mapping-enabled-branches"><legend>允许在知识资产中切换的分支</legend><div data-mapping-enabled-branches><span class="muted">选择连接后读取分支</span></div></fieldset>
            <div class="mapping-connection-hint" data-mapping-connection-hint>连接后自动加载可用分支；如果提示 401，请先连接 GitLab 账号。</div>
          </div>
        </div>
        <div class="mapping-step" data-step="2">
          <div class="mapping-step-header"><span class="mapping-step-number">2</span><h3>手册映射路径</h3><span class="mapping-step-hint">从当前分支目录树选择中文或英文内容根目录</span></div>
          <div class="mapping-step-body">
            <div class="mapping-language-selector">
              <div><strong>当前选择目标</strong><small>先选择内容语言，再从下方真实目录中选择路径</small></div>
              <div class="mapping-language-options" role="group" aria-label="内容路径语言">
                <button class="active" type="button" data-mapping-language="zh" aria-pressed="true">中文内容</button>
                <button type="button" data-mapping-language="en" aria-pressed="false">英文内容</button>
              </div>
            </div>
            <label class="mapping-tree-search"><span>搜索仓库目录</span><input type="search" data-mapping-tree-search placeholder="按目录或文件名搜索"></label><div class="mapping-path-browser" data-mapping-path-browser>
              <div class="mapping-path-empty">请先选择 GitLab 连接和分支，然后浏览仓库目录树</div>
            </div>
            <div class="mapping-selected-paths">
              <div class="mapping-path-group">
                <div class="mapping-path-group-heading"><strong>已选中文路径</strong><small>只能从仓库目录选择</small></div>
                <div class="mapping-path-tags" data-mapping-zh-tags></div>
              </div>
              <div class="mapping-path-group">
                <div class="mapping-path-group-heading"><strong>已选英文路径</strong><small>只能从仓库目录选择</small></div>
                <div class="mapping-path-tags" data-mapping-en-tags></div>
              </div>
            </div>
          </div>
        </div>
        <div class="mapping-step" data-step="3">
          <div class="mapping-step-header"><span class="mapping-step-number">3</span><h3>确认映射</h3><span class="mapping-step-hint">保存前检查范围</span></div>
          <div class="mapping-step-body">
            <div class="mapping-preview">
              <h4>映射预览</h4>
              <div class="mapping-preview-content" data-mapping-preview>
                <div class="mapping-preview-empty">完成路径选择后，预览将在此显示</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <footer>
        <span data-asset-form-status role="status"></span>
        <button class="button tertiary" type="button" data-asset-dialog-close>取消</button>
        <button class="button secondary" type="submit">保存映射</button>
      </footer>
    </form>
  </dialog>`;
}

function selectedDialogs(selected, admin, connections = [], principals = []) {
  if (!admin || !selected) return '';
  const closeButton='<button class="icon-button asset-dialog-close" type="button" data-asset-dialog-close aria-label="关闭" title="关闭"><i data-lucide="x" aria-hidden="true"></i></button>';
  const statusOptions=stages.filter(([key])=>key!=='handbook_published').map(([key,label])=>`<option value="${key}" ${selected?.status===key?'selected':''}>${label}</option>`).join('');
  const conflict=selected?.statusConflict?`<section class="asset-status-conflict-panel"><strong>状态存在差异</strong><span>系统识别：${escapeHtml(selected.systemStatusDisplayName||'暂不可用')}；人工设置：${escapeHtml(statusName(selected))}</span><div><button class="button tertiary compact" type="button" data-asset-status-resolve="accept_system">使用系统状态</button><button class="button tertiary compact" type="button" data-asset-status-resolve="keep_manual">保留人工状态</button></div></section>`:'';
  const handbookId=escapeHtml(assetId(selected));
  const handbookName=escapeHtml(selected.name||'未命名手册');
  const edit=`<dialog class="asset-dialog asset-manage-dialog" data-asset-edit-dialog aria-labelledby="asset-edit-title"><form data-asset-edit-form data-asset-edit="${handbookId}" data-asset-version="${Number(selected.assetVersion||1)}"><header><h2 id="asset-edit-title">管理手册</h2>${closeButton}</header><fieldset><legend>基本信息</legend><label>手册名称<input name="name" value="${escapeHtml(selected.name||'')}" required></label></fieldset><fieldset><legend>责任人</legend><label>A 角<select name="ownerA" data-searchable-select required>${ownerOptions(principals,selected.ownerA||selected.primaryOwnerId,true)}</select></label><label>B 角<select name="ownerB" data-searchable-select>${ownerOptions(principals,selected.ownerB||selected.assistantOwnerId,false)}</select></label><small class="muted">责任人必须从知识中心人员列表选择；待首次登录人员也可提前分配。</small></fieldset><fieldset><legend>当前阶段</legend><label>手册状态<select name="status">${statusOptions}</select></label><small class="muted">调整阶段不会撤销已有大纲或正式发布版本；正式撤回请进入审核与发布。</small><label>变更原因<textarea name="statusReason" rows="2" placeholder="状态发生变化时必填"></textarea></label>${conflict}</fieldset>${!selected.archived?`<details class="asset-advanced-actions" data-asset-advanced-actions><summary>高级操作</summary><div class="asset-danger-zone"><div><strong>停用手册</strong><small>从在用资产中隐藏；仓库映射、文档、责任和审计记录继续保留。</small></div><button class="button danger" type="button" data-asset-archive-open="${handbookId}">停用手册</button></div></details>`:''}<footer><span data-asset-form-status role="status" tabindex="-1"></span><button class="button tertiary" type="button" data-asset-dialog-close>取消</button><button class="button secondary" type="submit">保存修改</button></footer></form></dialog>`;
  const chapterCount=selected.chapterCount !== null && selected.chapterCount !== undefined && Number.isFinite(Number(selected.chapterCount)) ? `${Number(selected.chapterCount)} 个章节` : '章节数暂不可用';
  const documentCount=selected.documentCount !== null && selected.documentCount !== undefined && Number.isFinite(Number(selected.documentCount)) ? `${Number(selected.documentCount)} 份文档` : '文档数暂不可用';
  const archive=!selected.archived?`<dialog class="asset-dialog asset-archive-dialog" data-asset-archive-dialog aria-labelledby="asset-archive-title" aria-describedby="asset-archive-description"><form data-asset-archive-confirm-form data-asset-archive="${handbookId}"><header><h2 id="asset-archive-title">确认停用“${handbookName}”？</h2><button class="icon-button asset-dialog-close" type="button" data-asset-archive-cancel aria-label="关闭" title="关闭"><i data-lucide="x" aria-hidden="true"></i></button></header><div class="asset-archive-content" id="asset-archive-description"><p>停用后，该手册将从在用资产列表和阶段统计中隐藏。</p><ul><li>仓库映射、文档和版本继续保留</li><li>责任关系和审计记录继续保留</li><li>可在“已停用资产”中重新启用</li></ul><p class="asset-archive-counts">当前记录：${chapterCount}，${documentCount}。</p></div><footer><span data-asset-archive-status role="alert"></span><button class="button tertiary" type="button" data-asset-archive-cancel autofocus>取消</button><button class="button danger" type="submit">确认停用</button></footer></form></dialog>`:'';
  const mapping=selected?buildMappingDialog(selected, connections, closeButton):'';
  return `${edit}${archive}${mapping}`;
}

function dialogs(selected, admin, products, connections = [], principals = []) {
  if (!admin) return '';
  const options=products.map(product=>`<option value="${escapeHtml(product.id||product.productId||product)}">${escapeHtml(product.name||product.displayName||product)}</option>`).join('');
  const closeButton='<button class="icon-button asset-dialog-close" type="button" data-asset-dialog-close aria-label="关闭" title="关闭"><i data-lucide="x" aria-hidden="true"></i></button>';
  const create=`<dialog class="asset-dialog asset-create-dialog" data-asset-create-dialog aria-labelledby="asset-create-title" aria-describedby="asset-create-description"><form data-asset-create-form><header class="asset-dialog-heading"><div><h2 id="asset-create-title">新增手册</h2><p id="asset-create-description">建立基础信息，创建后继续完善大纲。</p></div>${closeButton}</header><label>手册名称 <span aria-hidden="true">*</span><input name="name" placeholder="请输入手册名称" required></label><label>所属产品 <span aria-hidden="true">*</span><select name="productId" data-searchable-select required><option value="">请选择产品</option>${options}</select></label><fieldset class="asset-owner-fields"><legend>手册责任人</legend><label>A 角负责人 <span aria-hidden="true">*</span><select name="ownerA" data-searchable-select required>${ownerOptions(principals,null,true)}</select></label><label>B 角负责人<select name="ownerB" data-searchable-select>${ownerOptions(principals,null,false)}</select></label></fieldset><label class="asset-visibility-setting"><span><strong>对外可见</strong><small>允许通过正式发布渠道对外使用</small></span><span class="asset-switch"><input type="checkbox" name="externalVisible" role="switch"><span aria-hidden="true"></span></span></label><details class="asset-summary-disclosure"><summary>添加概要说明</summary><label>概要说明<textarea name="summary" rows="3" placeholder="简要说明手册用途"></textarea></label></details><footer><span data-asset-form-status role="status"></span><button class="button tertiary" type="button" data-asset-dialog-close>取消</button><button class="button secondary" type="submit">创建手册</button></footer></form></dialog>`;
  return `${create}${selectedDialogs(selected,admin,connections,principals)}`;
}

export function renderAssetSelection({ selected, principalProjection, gitlabProjection, platformAdmin=false }) {
  return {
    actionPanel: selected ? renderActionPanel(selected, platformAdmin) : '',
    dialogs: selectedDialogs(selected, platformAdmin, gitlabProjection?.connections || [], principalProjection?.items || []),
  };
}

export function renderAssets({ assetCatalog, principalProjection, gitlabProjection, platformAdmin=false }) {
  const catalog=assetCatalog||{}, items=Array.isArray(catalog.items)?catalog.items:Array.isArray(catalog.handbooks)?catalog.handbooks:[], params=new URLSearchParams(window.location.search), inactive=platformAdmin&&params.get('lifecycle')==='inactive', selectedId=params.get('handbookId')||'', selected=selectedId?items.find(item=>String(assetId(item))===String(selectedId)):null, products=Array.isArray(catalog.products)?catalog.products:[];
  const moreMenu=platformAdmin&&!inactive?`<details class="asset-more-menu" data-asset-more-menu><summary class="button tertiary asset-more-trigger">更多<i data-lucide="chevron-down" aria-hidden="true"></i></summary><div class="asset-more-menu-panel"><a href="/knowledge-center/assets?lifecycle=inactive" data-asset-lifecycle="inactive"><strong>查看已停用资产</strong><small>查询历史资产并重新启用</small></a></div></details>`:'';
  const headingTitle=inactive?'<div class="asset-page-title"><a href="/knowledge-center/assets" data-asset-lifecycle="active">知识资产</a><span aria-hidden="true">/</span><h2>已停用资产</h2></div>':'<h2>知识资产</h2>';
  const headingActions=platformAdmin?(inactive?'<a class="button tertiary" href="/knowledge-center/assets" data-asset-lifecycle="active">返回在用资产</a>':`<button class="button tertiary asset-create-trigger" type="button" data-asset-create-open>新增手册</button>${moreMenu}`):'';
  const heading=`<div class="page-intro asset-page-intro">${headingTitle}<div class="asset-page-actions"><span class="data-note">${timeText(catalog.generatedAt||catalog.updatedAt)}</span>${headingActions}</div></div>`;
  const listHeading=`<div class="asset-list-heading"><h2 class="sr-only">${inactive?'历史手册列表':'手册资产列表'}</h2>${renderPagination(catalog)}</div>`;
  const list=`<section class="asset-workspace-list">${listHeading}${renderFilters(catalog,params,inactive)}${items.length?renderList(items,selectedId,inactive):pendingState(inactive?'暂无已停用资产':'尚未创建手册',inactive?'停用的手册会在这里保留历史记录。':'当前没有可展示的手册资产。')}</section>`;
  const workspace=`<div class="asset-workspace ${selected?'asset-detail-open':''}" data-asset-loaded="${Boolean(assetCatalog)}">${list}${selected?renderActionPanel(selected,platformAdmin):''}</div>`;
  return `${heading}${inactive?'':renderStageSummary(catalog)}${workspace}${dialogs(selected,platformAdmin,products,gitlabProjection?.connections||[],principalProjection?.items||[])}`;
}

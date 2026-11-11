/* Offline enhancement; the static report remains readable without JavaScript. */
(() => {
  'use strict';
  let index = globalThis.KC_REPORT_CASES;
  let loading = null;
  const search = document.querySelector('[data-case-search]');
  if (!search) return;
  const panel = document.querySelector('[data-search-panel]');
  const results = document.querySelector('[data-search-results]');
  const summary = document.querySelector('[data-search-summary]');
  const buttons = [...document.querySelectorAll('[data-status-filter]')];
  const labels = {PASS:'通过',FAIL:'失败',SKIP:'跳过',NOT_RUN:'未执行',TIMEOUT:'超时',INTERRUPTED:'中断'};
  const prefix = document.body.dataset.prefix || '';
  const params = new URLSearchParams(location.hash.slice(1));
  let status = buttons.some(button => button.dataset.statusFilter === params.get('status')) ? params.get('status') : 'ALL';
  search.value = params.get('q') || '';
  const classes = state => state === 'PASS' ? 'pass' : ['FAIL','TIMEOUT','INTERRUPTED'].includes(state) ? 'fail' : state === 'SKIP' ? 'skip' : '';
  function update() {
    const query = search.value.trim().toLocaleLowerCase();
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.statusFilter === status)));
    results.replaceChildren();
    const active = Boolean(query) || status !== 'ALL';
    results.hidden = !active;
    if (!active) { summary.textContent = `可搜索全部 ${document.body.dataset.caseCount} 条已采集明细，范围覆盖所有场景和分页。`; return; }
    if (!index) {
      summary.textContent = '正在加载全部场景的用例索引…';
      if (!loading) {
        const script = document.createElement('script');
        script.src = prefix + 'assets/case-index.js';
        loading = script;
        script.onload = () => { index = globalThis.KC_REPORT_CASES || []; update(); };
        script.onerror = () => {
          script.remove(); loading = null;
          summary.textContent = '用例索引加载失败，请再次输入或筛选重试，也可通过场景分页浏览。';
        };
        document.head.append(script);
      }
      return;
    }
    const matched = index.filter(item => (status === 'ALL' || item.status === status || (status === 'FAIL' && ['TIMEOUT','INTERRUPTED'].includes(item.status))) && (!query || [item.name,item.file,item.scene,item.framework,item.detail].join(' ').toLocaleLowerCase().includes(query)));
    summary.textContent = matched.length ? `匹配 ${matched.length} 条用例${matched.length > 100 ? '，显示前 100 条；请增加关键词缩小范围' : ''}。点击用例可直达所在分页和详情。` : '没有匹配的用例。请调整关键词或清除筛选。';
    const fragment = document.createDocumentFragment();
    matched.slice(0,100).forEach(item => {
      const li = document.createElement('li');
      const badge = document.createElement('span'); badge.className = `badge ${classes(item.status)}`; badge.textContent = labels[item.status] || item.status;
      const link = document.createElement('a'); link.href = prefix + item.href; link.textContent = item.name || '未命名用例';
      const meta = document.createElement('small'); meta.textContent = [item.scene,item.framework,item.file].filter(Boolean).join(' · ');
      li.append(badge,link,meta); fragment.append(li);
    });
    results.append(fragment);
  }
  search.addEventListener('input', update);
  buttons.forEach(button => button.addEventListener('click', () => { status = button.dataset.statusFilter; update(); }));
  document.querySelector('[data-clear-search]').addEventListener('click', () => { search.value = ''; status = 'ALL'; update(); search.focus(); });
  panel.hidden = false;
  update();
  function revealTarget() {
    if (!location.hash.startsWith('#case-')) return;
    const target = document.getElementById(location.hash.slice(1));
    if (!target) return;
    target.querySelectorAll('details').forEach(detail => { detail.open = true; });
    target.setAttribute('tabindex','-1'); target.focus({preventScroll:true}); target.scrollIntoView({block:'center'});
  }
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#status=')) {
      const state = new URLSearchParams(location.hash.slice(1)).get('status');
      if (buttons.some(button => button.dataset.statusFilter === state)) {
        status = state;
        search.value = '';
        update();
        panel.scrollIntoView({block:'start'});
        search.focus({preventScroll:true});
      }
    }
    revealTarget();
  });
  revealTarget();
})();

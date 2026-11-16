/* Offline enhancement; the static report remains readable without JavaScript. */
(() => {
  'use strict';
  document.querySelectorAll('.table-wrap[role="region"][tabindex="0"]').forEach(region => {
    region.addEventListener('keydown', event => {
      const maxScroll = region.scrollWidth - region.clientWidth;
      if (maxScroll <= 0) return;
      if (event.key === 'ArrowRight') region.scrollBy({left: 48});
      else if (event.key === 'ArrowLeft') region.scrollBy({left: -48});
      else if (event.key === 'Home') region.scrollTo({left: 0});
      else if (event.key === 'End') region.scrollTo({left: maxScroll});
      else return;
      event.preventDefault();
    });
  });
  let index = globalThis.KC_REPORT_CASES;
  let loading = null;
  const search = document.querySelector('[data-case-search]');
  if (!search) return;
  const panel = document.querySelector('[data-search-panel]');
  const results = document.querySelector('[data-search-results]');
  const summary = document.querySelector('[data-search-summary]');
  const pagination = document.querySelector('[data-search-pagination]');
  const pageLabel = document.querySelector('[data-search-page]');
  const previous = document.querySelector('[data-search-previous]');
  const next = document.querySelector('[data-search-next]');
  const buttons = [...document.querySelectorAll('[data-status-filter]')];
  const pageSize = 50;
  let page = 1;
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
    pagination.hidden = true;
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
    const pages = Math.max(1, Math.ceil(matched.length / pageSize));
    page = Math.min(page, pages);
    const start = (page - 1) * pageSize;
    summary.textContent = matched.length ? `匹配 ${matched.length} 条用例，显示第 ${start + 1}–${Math.min(start + pageSize, matched.length)} 条。点击用例可直达所在分页和详情。` : '没有匹配的用例。请调整关键词或清除筛选。';
    pagination.hidden = matched.length <= pageSize;
    pageLabel.textContent = `第 ${page} / ${pages} 页`;
    previous.disabled = page === 1;
    next.disabled = page === pages;
    const fragment = document.createDocumentFragment();
    matched.slice(start,start + pageSize).forEach(item => {
      const li = document.createElement('li');
      const badge = document.createElement('span'); badge.className = `badge ${classes(item.status)}`; badge.textContent = labels[item.status] || item.status;
      const link = document.createElement('a'); link.href = prefix + item.href; link.textContent = item.name || '未命名用例';
      const meta = document.createElement('small'); meta.textContent = [item.scene,item.framework,item.file].filter(Boolean).join(' · ');
      li.append(badge,link,meta); fragment.append(li);
    });
    results.append(fragment);
  }
  search.addEventListener('input', () => { page = 1; update(); });
  buttons.forEach(button => button.addEventListener('click', () => { status = button.dataset.statusFilter; page = 1; update(); }));
  previous.addEventListener('click', () => { if (page > 1) { page--; update(); pagination.scrollIntoView({block:'nearest'}); } });
  next.addEventListener('click', () => { page++; update(); pagination.scrollIntoView({block:'nearest'}); });
  document.querySelector('[data-clear-search]').addEventListener('click', () => { search.value = ''; status = 'ALL'; page = 1; update(); search.focus(); });
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
        page = 1;
        update();
        panel.scrollIntoView({block:'start'});
        search.focus({preventScroll:true});
      }
    }
    revealTarget();
  });
  revealTarget();
})();

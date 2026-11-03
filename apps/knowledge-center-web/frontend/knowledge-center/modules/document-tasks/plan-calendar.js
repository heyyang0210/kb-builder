import { escapeHtml, icon } from '../../common/utils/dom.js';
const e = value => escapeHtml(String(value ?? ''));
export const planLabels = { plannedStartTime: '开始时间', plannedEndTime: '结束时间' };
// 编辑和显示统一北京时间；持久化使用UTC，独立于浏览器所在时区。
export function planLocal(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}
export function planCell(task, key) {
  const value = planLocal(task[key]);
  return task.canEditPlan ? `<button type="button" class="task-plan-date" data-task-action="plan" data-plan-key="${key}" data-number="${e(task.number)}" aria-label="${e(task.number)}${planLabels[key]}">${e(value || '选择时间')}${icon('calendar-days')}</button>` : e(value || '—');
}
export function openPlanCalendar(host, task, key, save, refresh, reload) {
  const initial = planLocal(task[key]) || planLocal(new Date().toISOString());
  let date = initial.slice(0, 10), time = task[key] ? initial.slice(11, 16) : '09:00';
  let month = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
  host.innerHTML = `<dialog class="document-task-dialog task-plan-calendar" aria-label="${planLabels[key]}"><form><header><h2>${planLabels[key]}</h2><button type="button" class="icon-button" data-calendar-close aria-label="关闭">${icon('x')}</button></header><div class="task-modal-body"><div class="task-calendar-month"><button type="button" data-prev aria-label="上个月">${icon('chevron-left')}</button><strong data-month aria-live="polite"></strong><button type="button" data-next aria-label="下个月">${icon('chevron-right')}</button></div><div class="task-calendar-grid" role="group" aria-label="选择日期"></div><label class="task-calendar-clock">时间<input type="time" name="clock" required value="${time}"></label></div><p role="alert" data-calendar-error hidden></p><footer><button type="button" class="button secondary" data-clear>清空</button><span></span><button type="button" class="button secondary" data-calendar-reload hidden>重新读取</button><button type="button" class="button secondary" data-calendar-close>取消</button><button type="submit" class="button">确定</button></footer></form></dialog>`;
  const dialog = host.querySelector('dialog'), grid = dialog.querySelector('.task-calendar-grid'), clock = dialog.querySelector('[name=clock]'), error = dialog.querySelector('[data-calendar-error]');
  let busy = false;
  const reread = dialog.querySelector('[data-calendar-reload]');
  const draw = () => {
    const year = month.getUTCFullYear(), m = month.getUTCMonth(), prefix = `${year}-${String(m + 1).padStart(2, '0')}`;
    const count = new Date(Date.UTC(year, m + 1, 0)).getUTCDate(), first = (month.getUTCDay() + 6) % 7;
    dialog.querySelector('[data-month]').textContent = `${year}年${m + 1}月`;
    grid.innerHTML = ['一','二','三','四','五','六','日'].map(d => `<span>${d}</span>`).join('') + '<span></span>'.repeat(first) + Array.from({ length: count }, (_, i) => {
      const day = `${prefix}-${String(i + 1).padStart(2, '0')}`;
      return `<button type="button" data-day="${day}" aria-label="${day}" aria-pressed="${date === day}">${i + 1}</button>`;
    }).join('');
  };
  draw(); dialog.showModal(); window.lucide?.createIcons();
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.onclick = event => {
    if (busy) return;
    if (event.target.closest('[data-calendar-close]')) dialog.close();
    const day = event.target.closest('[data-day]');
    if (day) { date = day.dataset.day; draw(); grid.querySelector(`[data-day="${date}"]`)?.focus(); error.hidden = true; }
    if (event.target.closest('[data-prev],[data-next]')) { month.setUTCMonth(month.getUTCMonth() + (event.target.closest('[data-next]') ? 1 : -1)); draw(); }
  };
  const submit = async value => {
    if (busy) return;
    const other = task[key === 'plannedStartTime' ? 'plannedEndTime' : 'plannedStartTime'];
    if (value && other && (key === 'plannedStartTime' ? value > other : value < other)) { error.hidden = false; error.textContent = '结束时间不能早于开始时间'; return; }
    error.hidden = true; busy = true;
    const controls = [...dialog.querySelectorAll('button,input')]; controls.forEach(c => c.disabled = true);
    try { await save({ expectedRevision: task.revision, [key]: value }); }
    catch (err) { error.hidden = false; error.textContent = err.code === 'REVISION_CONFLICT' ? '任务已更新。请选择重新读取，核对最新时间后再保存；当前选择会保留。' : err.message; reread.hidden = err.code !== 'REVISION_CONFLICT'; return; }
    finally { busy = false; controls.forEach(c => c.disabled = false); }
    dialog.close(); await refresh();
  };
  reread.onclick = async () => {
    if (busy) return;
    busy = true;
    const controls = [...dialog.querySelectorAll('button,input')]; controls.forEach(c => c.disabled = true);
    try {
      task = await reload();
      if (!task.canEditPlan) throw new Error('当前账号已无权设置此任务时间，请关闭后刷新');
      reread.hidden = true;
      error.hidden = false;
      error.textContent = `已读取最新时间：开始 ${planLocal(task.plannedStartTime) || '未设置'}，结束 ${planLocal(task.plannedEndTime) || '未设置'}。当前选择已保留，请核对后点击确定。`;
    } catch (err) { error.hidden = false; error.textContent = err.message; }
    finally { busy = false; controls.forEach(c => c.disabled = false); }
  };
  dialog.querySelector('[data-clear]').onclick = () => submit(null);
  dialog.querySelector('form').onsubmit = event => { event.preventDefault(); time = clock.value; if (time) submit(new Date(`${date}T${time}:00+08:00`).toISOString()); };
}

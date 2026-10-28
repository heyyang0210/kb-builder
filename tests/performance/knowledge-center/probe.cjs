// Browser-side timing starts at the actual interaction, excluding automation waits.
function installProbe({ target, event, feedback, ready, failure, resume = false }) {
  const key = '__knowledgeCenterJourneyProbe';
  const visible = element => {
    if (!element || !element.getClientRects().length || getComputedStyle(element).visibility === 'hidden' || element.closest('[hidden]')) return false;
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.matches('details:not([open])') && !ancestor.querySelector(':scope > summary')?.contains(element)) return false;
    }
    return true;
  };
  const matches = condition => {
    if (condition.all) return condition.all.every(matches);
    if (condition.any) return condition.any.some(matches);
    const nodes = [...document.querySelectorAll(condition.selector)];
    if (condition.absent) return !nodes.some(visible);
    return nodes.some(node => visible(node)
      && (!condition.enabled || !node.disabled)
      && (!condition.text || new RegExp(condition.text).test(node.textContent))
      && (!condition.notText || !new RegExp(condition.notText).test(node.textContent))
      && (!condition.value || new RegExp(condition.value).test(node.value || ''))
      && (!condition.attribute || node.getAttribute(condition.attribute[0]) === condition.attribute[1]));
  };
  window.__journeyProbe?.stop?.();
  window.__journeyProbe = null;
  if (!resume && matches(ready)) throw Error('终态在交互前已成立，拒绝记录虚假快速样本');
  const previous = resume ? JSON.parse(sessionStorage.getItem(key) || 'null') : null;
  if (resume && !previous?.startEpoch) return;
  const state = { start: previous?.start ?? null, startEpoch: previous?.startEpoch ?? null,
    feedbackMs: previous?.feedbackMs ?? null, readyMs: previous?.readyMs ?? null, failureMs: previous?.failureMs ?? null, stopped: false };
  const persist = () => sessionStorage.setItem(key, JSON.stringify({ target, event, feedback, ready, failure,
    start: state.start, startEpoch: state.startEpoch, feedbackMs: state.feedbackMs, readyMs: state.readyMs, failureMs: state.failureMs }));
  let frame;
  const pending = new Set();
  const poll = () => {
    if (state.stopped) return;
    if (state.startEpoch !== null) {
      for (const [key, condition] of [['feedbackMs', feedback], ['readyMs', ready], ['failureMs', failure]]) {
        if (condition && state[key] === null && !pending.has(key) && matches(condition)) {
          pending.add(key);
          // Two frames provide a paint opportunity; they do not prove display scanout.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!state.stopped && matches(condition)) { state[key] = performance.timeOrigin + performance.now() - state.startEpoch; persist(); }
            pending.delete(key);
          }));
        }
      }
    }
    frame = requestAnimationFrame(poll);
  };
  const listener = e => {
    if (state.startEpoch === null && e.target.closest(target)) {
      state.start = performance.now(); state.startEpoch = performance.timeOrigin + state.start; persist();
    }
  };
  document.addEventListener(event, listener, true);
  state.stop = () => { state.stopped = true; cancelAnimationFrame(frame); document.removeEventListener(event, listener, true); sessionStorage.removeItem(key); };
  window.__journeyProbe = state;
  poll();
}
function resumeProbe() {
  const raw = sessionStorage.getItem('__knowledgeCenterJourneyProbe');
  if (!raw) return;
  try { installProbe({ ...JSON.parse(raw), resume: true }); } catch (_) { sessionStorage.removeItem('__knowledgeCenterJourneyProbe'); }
}
function percentile(values, fraction) {
  if (!values.length) return null;
  return [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
}
function finalizeEvidence(report) {
  for (const sample of report.samples) {
    if (!sample.actionAt) {
      sample.feedbackMs = null; sample.readyMs = null; sample.failureMs = null;
    }
    const errors = (sample.requests || []).filter(request => request.error || (request.status >= 400
      && !(request.status === 404 && request.path === `/knowledge-center/api/gitlab/mappings/${report.fixtures.handbook?.handbookId}`)));
    if (errors.length && sample.status === '完成') {
      sample.status = '失败';
      sample.error = '界面状态出现后收到接口异常，最终证据复核未通过';
    }
  }
  for (const journey of report.journeys) {
    if (report.samples.some(sample => sample.module === journey.name && sample.round === journey.round && sample.status === '失败')) {
      journey.status = '失败';
      journey.error ||= '步骤最终证据复核未通过';
    }
  }
}
function aggregate(samples, config) {
  const groups = new Map();
  for (const sample of samples) {
    const key = `${sample.module} / ${sample.step}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(sample);
  }
  return [...groups].map(([step, rows]) => {
    const feedback = rows.map(r => r.feedbackMs).filter(Number.isFinite);
    const ready = rows.map(r => r.readyMs).filter(Number.isFinite);
    const feedbackP95Ms = percentile(feedback, .95), readyP95Ms = percentile(ready, .95);
    const failures = rows.filter(r => r.status !== '完成').length;
    const readyBudget = rows[0].ai ? config.aiCompleteP95Ms : config.readyP95Ms;
    return { step, samples: rows.length, failures, feedbackP50Ms: percentile(feedback, .5), feedbackP95Ms,
      readyP50Ms: percentile(ready, .5), readyP95Ms, maxMs: ready.length ? Math.max(...ready) : null,
      readyBudgetMs: readyBudget,
      passed: !failures && feedback.length === rows.length && ready.length === rows.length && feedbackP95Ms <= config.feedbackP95Ms && readyP95Ms <= readyBudget };
  });
}
module.exports = { installProbe, resumeProbe, percentile, aggregate, finalizeEvidence };

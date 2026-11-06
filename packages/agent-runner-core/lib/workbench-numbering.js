function reviewRoot(task, byId) {
  const seen = new Set();
  let current = task;
  while (current?.revisionOf && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.revisionOf) || current;
    if (current.id === task.id || seen.has(current.id)) break;
  }
  return current?.id || task.id;
}

function linkedTicket(state, root, byId, visibleHandbookIds) {
  const chain = new Set();
  for (const task of byId.values()) if (reviewRoot(task, byId) === root) chain.add(task.id);
  const matches = [];
  const handbookId = byId.get(root)?.handbookId;
  for (const ticket of state.tasks || []) for (const book of ticket.decomposition?.handbooks || []) {
    if (visibleHandbookIds && (ticket.decomposition?.handbooks || []).some(item => !visibleHandbookIds.has(String(item.id)))) continue;
    if (handbookId && book.id !== handbookId) continue;
    for (const doc of book.documents || []) if (chain.has(doc.reviewTaskId)) {
      matches.push({ number: ticket.number, subtaskNumber: doc.subtaskNumber || null,
        documentId: String(doc.createdDocumentId || doc.id), plannedStartTime: ticket.plannedStartTime || null,
        plannedEndTime: ticket.plannedEndTime || null });
    }
  }
  return matches;
}

function backfillHistoricalNumbers(state, reviews) {
  const byId = new Map((reviews.tasks || []).map(task => [task.id, task]));
  const registry = state.workbenchNumbers ||= { nextHistoricalNumber: 1, entries: {} };
  const used = new Set(Object.values(registry.entries).map(entry => entry.number));
  let next = Math.max(1, Number(registry.nextHistoricalNumber) || 1);
  for (const task of reviews.tasks || []) {
    const root = reviewRoot(task, byId);
    if (registry.entries[root]) continue;
    const matches = linkedTicket(state, root, byId);
    const ticketNumbers = new Set(matches.map(match => match.number));
    if (ticketNumbers.size > 1) {
      registry.entries[root] = { status: 'needs_review', number: null, documents: {} };
      continue;
    }
    if (!ticketNumbers.size) {
      let number;
      do { number = `HIST-${String(next++).padStart(6, '0')}`; } while (used.has(number));
      used.add(number);
      const ids = [...new Set((reviews.tasks || []).filter(candidate => reviewRoot(candidate, byId) === root)
        .flatMap(candidate => candidate.handbookSource?.documents?.map(doc => String(doc.documentId)) || candidate.target?.documentIds?.map(String) || []))].sort();
      registry.entries[root] = { status: 'historical', number, documents: Object.fromEntries(ids.map((id, index) => [id, index + 1])) };
    } else {
      const documents = {};
      for (const match of matches) if (match.subtaskNumber) documents[match.documentId] = match.subtaskNumber;
      registry.entries[root] = { status: 'linked', number: matches[0].number, documents };
    }
  }
  registry.nextHistoricalNumber = next;
  return registry;
}

function backfillDocumentNumbers(state) {
  for (const ticket of state.tasks || []) {
    const scopes = [...(ticket.scopeHistory || []), ticket.decomposition];
    const used = new Set();
    let next = Math.max(1, Number(ticket.nextSubtaskNumber) || 1);
    const byIdentity = new Map();
    const ownerByNumber = new Map();
    for (const scope of scopes) for (const book of scope?.handbooks || (scope?.documents ? [scope] : [])) for (const doc of book.documents || []) {
      const key = `${book.id}\u0000${doc.id}`;
      if (doc.subtaskNumber && ownerByNumber.has(doc.subtaskNumber) && ownerByNumber.get(doc.subtaskNumber) !== key) throw Object.assign(new Error(`工单 ${ticket.number} 的子任务编号冲突`), { code: 'SUBTASK_NUMBER_CONFLICT' });
      if (doc.subtaskNumber) ownerByNumber.set(doc.subtaskNumber, key);
      if (!byIdentity.has(key) && Number.isSafeInteger(doc.subtaskNumber) && doc.subtaskNumber > 0) byIdentity.set(key, doc.subtaskNumber);
      if (Number.isSafeInteger(doc.subtaskNumber) && doc.subtaskNumber > 0) used.add(doc.subtaskNumber);
    }
    for (const scope of scopes) for (const book of scope?.handbooks || (scope?.documents ? [scope] : [])) for (const doc of book.documents || []) {
      const key = `${book.id}\u0000${doc.id}`;
      if (!byIdentity.has(key)) {
        while (used.has(next)) next++;
        byIdentity.set(key, next++);
        used.add(byIdentity.get(key));
      }
      if (doc.subtaskNumber && doc.subtaskNumber !== byIdentity.get(key)) throw Object.assign(new Error(`工单 ${ticket.number} 的文档编号冲突`), { code: 'SUBTASK_NUMBER_CONFLICT' });
      doc.subtaskNumber = byIdentity.get(key);
    }
    const active = (ticket.decomposition?.handbooks || []).flatMap(book => book.documents || []);
    if (new Set(active.map(doc => doc.subtaskNumber)).size !== active.length) throw Object.assign(new Error(`工单 ${ticket.number} 的子任务编号冲突`), { code: 'SUBTASK_NUMBER_CONFLICT' });
    ticket.nextSubtaskNumber = Math.max(next, ...[...used].map(value => value + 1), 1);
  }
  return state;
}

function numberForReview(state, reviews, taskId, documentId, visibleHandbookIds) {
  const byId = new Map((reviews.tasks || []).map(task => [task.id, task]));
  const task = byId.get(taskId);
  if (!task) return { number: null, subtaskNumber: null, numberingStatus: 'needs_review', plannedStartTime: null, plannedEndTime: null };
  const root = reviewRoot(task, byId);
  const entry = state.workbenchNumbers?.entries?.[root];
  const matches = linkedTicket(state, root, byId, visibleHandbookIds);
  const distinct = new Set(matches.map(match => match.number));
  if (distinct.size > 1 || entry?.status === 'needs_review') return { number: null, subtaskNumber: null, numberingStatus: 'needs_review', plannedStartTime: null, plannedEndTime: null };
  if (!matches.length && entry?.status === 'linked') return { number: null, subtaskNumber: null, numberingStatus: 'needs_review', plannedStartTime: null, plannedEndTime: null };
  const match = matches.find(item => item.documentId === String(documentId));
  return { number: match?.number || entry?.number || null,
    subtaskNumber: match?.documentId === String(documentId) ? match.subtaskNumber : entry?.documents?.[String(documentId)] || null,
    numberingStatus: match ? 'linked' : entry?.status || 'unregistered',
    plannedStartTime: match?.plannedStartTime || null, plannedEndTime: match?.plannedEndTime || null };
}

module.exports = { reviewRoot, backfillHistoricalNumbers, backfillDocumentNumbers, numberForReview };

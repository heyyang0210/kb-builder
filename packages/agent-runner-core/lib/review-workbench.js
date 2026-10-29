// Read projections only. Decisions remain owned by IncrementalBuildService.
function reviewDocuments(tasks, userId, canReview) {
  const currentUserIds = (Array.isArray(userId) ? userId : [userId]).map(String);
  const records = new Map();
  for (const task of tasks) {
    if (!task.candidate || task.state === 'cancelled') continue;
    const reviews = (task.reviews || []).filter(review => review.candidateDigest === task.candidate.digest);
    const fallbackReview = reviews.at(-1);
    if (!fallbackReview) continue;
    const sources = task.handbookSource?.documents;
    let documents = sources?.length ? sources : [...new Set([
      ...(task.target?.documentIds || []), ...(task.candidate.operations || []).map(item => item.documentId),
    ])].map(documentId => ({ documentId, filePath: (task.candidate.operations || []).find(item => item.documentId === documentId)?.path || documentId }));
    if (!documents.length && task.target?.scope === 'handbook') {
      documents = [{ documentId: null, filePath: '', title: '整本手册在线评审（聚合事项）', scope: 'handbook' }];
    }
    for (const document of documents) {
      const review = reviews.find(item => String(item.documentId || '') === String(document.documentId || '')) || fallbackReview;
      const reviewerIds = (document.reviewerIds || review.reviewerIds || []).map(String);
      const id = `${task.id}:${task.candidate.digest}:${document.documentId}`;
      records.set(id, {
        id, taskId: task.id, reviewId: review.id, handbookId: task.handbookId,
        documentId: document.documentId, path: document.filePath || document.documentId || '', scope: document.scope || 'document',
        title: document.title || document.filePath || document.documentId,
        businessVersion: task.businessVersion, branch: task.handbookSource?.branch || null, candidateDigest: task.candidate.digest,
        state: task.state, submittedBy: review.submittedBy || task.createdBy,
        // Handbook reviewer selection is part of this submission. Legacy
        // reviews may have reviewer IDs without a recorded assignment actor.
        assignedBy: task.handbookSource && reviewerIds.length ? review.assignment?.updatedBy || review.submittedBy || null : null,
        canReassign: Boolean(task.handbookSource && task.state === 'under_review' && review.status === 'pending' && task.capabilities?.canReassign),
        canCancelReview: Boolean(task.state === 'under_review' && review.status === 'pending' && task.capabilities?.canCancelReview),
        reviewerIds, decidedBy: review.decision?.decidedBy || null,
        submittedAt: review.submittedAt, decidedAt: review.decision?.decidedAt || null,
        updatedAt: task.updatedAt, opinionCount: (review.comments || []).filter(comment => document.scope === 'handbook' || !comment.anchor || comment.anchor.documentId === document.documentId || comment.anchor.path === document.filePath).length,
        assignedToMe: Boolean(canReview && task.state === 'under_review' && review.status === 'pending' && reviewerIds.some(id => currentUserIds.includes(id))),
      });
    }
  }
  return [...records.values()].sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));
}

module.exports = { reviewDocuments };

/** Project only real directory IDs and business versions; never manufacture choices. */
function documentOwner(assignment) {
  const ownerships = Array.isArray(assignment?.ownerships) ? assignment.ownerships : [];
  const bound = ownerships.filter(item => item?.assigneeId && ['bound', 'assigned'].includes(String(item.status || '').toLowerCase()));
  const primary = bound.filter(item => String(item.domainRole || '').toUpperCase() === 'PRIMARY');
  if (primary.length === 1) return { ownerId: String(primary[0].assigneeId), ownerMatch: 'primary' };
  if (primary.length > 1) {
    const ids = new Set(primary.map(item => String(item.assigneeId)));
    return ids.size === 1 ? { ownerId: [...ids][0], ownerMatch: 'primary' } : { ownerId: null, ownerMatch: 'unassigned' };
  }
  const firstDomain = !ownerships.some(item => item.domainRole) && assignment?.techDomainIds?.[0];
  if (firstDomain) {
    const first = bound.filter(item => String(item.techDomainId) === String(firstDomain));
    if (first.length === 1) return { ownerId: String(first[0].assigneeId), ownerMatch: 'primary' };
  }
  if (bound.length === 1 && !ownerships.some(item => item.domainRole)) return { ownerId: String(bound[0].assigneeId), ownerMatch: 'single' };
  return { ownerId: null, ownerMatch: 'unassigned' };
}
function projectCatalog(payload = {}) {
  const directory = payload.directory || {};
  const items = payload.items || [];
  const published = !directory.state || String(directory.state).toLowerCase() === 'published';
  const nodes = published ? directory.nodes || directory.governance?.nodes || [] : [];
  const assignments = directory.governance?.effectiveDocumentAssignments || [];
  const byDocument = new Map();
  for (const assignment of assignments) {
    for (const id of [assignment.nodeId, assignment.documentId].filter(Boolean)) {
      const key = String(id);
      if (byDocument.has(key) && byDocument.get(key) !== assignment) byDocument.set(key, null);
      else if (!byDocument.has(key)) byDocument.set(key, assignment);
    }
  }
  const versions = [...new Set(items.flatMap(item => (item.businessVersionTags || item.businessVersions || []).map(v => typeof v === 'string' ? v : v.name || v.version)).filter(Boolean))];
  return {
    outlineId: payload.selectedId || directory.id || null,
    outlineVersionId: published ? directory.currentOutlineVersionId || directory.outlineStructureVersion || payload.selectedId || directory.id || null : null,
    versions,
    documents: nodes.filter(n => ['document', 'knowledge_point'].includes(n.kind)).map(n => {
      const id = String(n.id);
      const assignment = byDocument.has(id) ? byDocument.get(id) : byDocument.get(String(n.sourceId));
      return { id, name: n.title || n.name || n.id, parentId: n.parentId, ...documentOwner(assignment) };
    }),
    chapters: nodes.filter(n => ['directory', 'part', 'chapter', 'section'].includes(n.kind)).map(n => ({ id: String(n.id), name: n.title || n.name || n.id })),
    directory,
  };
}
module.exports = { projectCatalog, documentOwner };

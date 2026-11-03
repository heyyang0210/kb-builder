/** Project only real directory IDs and business versions; never manufacture choices. */
function projectCatalog(payload = {}) {
  const directory = payload.directory || {};
  const items = payload.items || [];
  const nodes = directory.nodes || directory.governance?.nodes || [];
  const versions = [...new Set(items.flatMap(item => (item.businessVersionTags || item.businessVersions || []).map(v => typeof v === 'string' ? v : v.name || v.version)).filter(Boolean))];
  return { outlineId: payload.selectedId || directory.id || null, outlineVersionId: directory.currentOutlineVersionId || directory.outlineStructureVersion || null, versions, documents: nodes.filter(n => ['document', 'knowledge_point'].includes(n.kind)).map(n => ({ id: String(n.id), name: n.title || n.name || n.id, parentId: n.parentId })), chapters: nodes.filter(n => ['directory', 'part', 'chapter', 'section'].includes(n.kind)).map(n => ({ id: String(n.id), name: n.title || n.name || n.id })), directory };
}
module.exports = { projectCatalog };

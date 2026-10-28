import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Disposable read index. Database revision is checked on every lookup by Main. */
final class DraftReadProjection {
    record Snapshot(long revision, Map<String, Object> drafts) {}
    private volatile Snapshot current;

    Snapshot snapshot() { return current; }

    synchronized void publish(long revision, Map<String, Object> aggregate) {
        if (current != null && current.revision() > revision) return;
        Map<String, Object> drafts = new LinkedHashMap<>();
        Object rawDrafts = aggregate.get("drafts");
        if (rawDrafts instanceof Map<?, ?> values) {
            for (Map.Entry<?, ?> entry : values.entrySet()) {
                if (!(entry.getValue() instanceof Map<?, ?> draft)) continue;
                Map<String, Object> projected = new LinkedHashMap<>();
                for (String field : List.of("draftId", "context", "currentRevisionId", "editVersion",
                        "reviewRevisionIds", "reviewState", "updatedBy", "updatedAt")) {
                    if (draft.containsKey(field)) projected.put(field, draft.get(field));
                }
                Object currentRevision = draft.get("currentRevisionId");
                Object selected = null;
                if (draft.get("revisions") instanceof List<?> revisions) {
                    for (Object item : revisions) {
                        if (item instanceof Map<?, ?> candidate && java.util.Objects.equals(candidate.get("revisionId"), currentRevision)) {
                            selected = item;
                            break;
                        }
                    }
                }
                projected.put("revisions", selected == null ? List.of() : List.of(selected));
                drafts.put(String.valueOf(entry.getKey()), projected);
            }
        }
        current = new Snapshot(revision, Map.copyOf(drafts));
    }
}

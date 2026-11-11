import java.util.List;
import java.util.Map;

public class DraftReadProjectionCheck {
    public static void main(String[] args) {
        DraftReadProjection projection = new DraftReadProjection();
        Map<String, Object> latest = Map.of("revisionId", "r2", "markdown", "current");
        projection.publish(3, Map.of("drafts", Map.of("context-A", Map.of(
            "draftId", "d1", "currentRevisionId", "r2", "editVersion", 2,
            "revisions", List.of(Map.of("revisionId", "r1", "markdown", "old"), latest),
            "unrelated", "secret")), "aiJobs", Map.of("job", "large")));
        var snapshot = projection.snapshot();
        var draft = (Map<?, ?>) snapshot.drafts().get("context-A");
        if (!List.of(latest).equals(draft.get("revisions"))) throw new AssertionError("history leaked");
        if (draft.containsKey("unrelated") || snapshot.drafts().containsKey("aiJobs")) throw new AssertionError("aggregate leaked");
        if (snapshot.drafts().get("absent") != null) throw new AssertionError("absent draft");
        projection.publish(2, Map.of());
        if (projection.snapshot().revision() != 3) throw new AssertionError("late snapshot overwrite");
        projection.publish(4, Map.of());
        if (!projection.snapshot().drafts().isEmpty()) throw new AssertionError("deleted state retained");
        projection.publish(5, Map.of("drafts", Map.of(
            "invalid", "damaged aggregate entry",
            "missing-history", Map.of("draftId", "missing"),
            "non-list-history", Map.of("revisions", "damaged history"),
            "empty-history", Map.of("revisions", List.of()),
            "missing-current", Map.of("currentRevisionId", "absent", "revisions",
                List.of("invalid revision", Map.of("revisionId", "old", "markdown", "private history"))))));
        if (projection.snapshot().drafts().size() != 4 || projection.snapshot().drafts().containsKey("invalid"))
            throw new AssertionError("malformed draft was projected or valid draft lost");
        for (Object value : projection.snapshot().drafts().values()) {
            if (!List.of().equals(((Map<?, ?>) value).get("revisions")))
                throw new AssertionError("unselected or malformed history leaked");
        }
        projection.publish(5, Map.of("drafts", Map.of("replacement", Map.of("draftId", "new"))));
        if (!projection.snapshot().drafts().keySet().equals(java.util.Set.of("replacement")))
            throw new AssertionError("same revision refresh retained stale draft data");
        System.out.println("PASS: current revision, no global data, monotonic publish, deletion");
    }
}

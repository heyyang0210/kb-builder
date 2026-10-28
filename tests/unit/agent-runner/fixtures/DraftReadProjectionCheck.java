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
        System.out.println("PASS: current revision, no global data, monotonic publish, deletion");
    }
}

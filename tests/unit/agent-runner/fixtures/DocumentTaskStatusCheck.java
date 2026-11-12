import java.util.Map;

public final class DocumentTaskStatusCheck {
    private static void check(Map<String, Object> task, String expected) {
        String actual = DocumentTaskIndex.status(task);
        if (!expected.equals(actual)) throw new AssertionError(expected + " != " + actual);
    }

    public static void main(String[] args) {
        check(Map.of("decomposition", Map.of("confirmed", false)), "PENDING_SCOPE");
        check(Map.of("decomposition", Map.of("confirmed", true)), "IN_PROGRESS");
        check(Map.of("status", "in_progress"), "IN_PROGRESS");
        check(Map.of("status", "completed"), "COMPLETED");
    }
}

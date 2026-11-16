import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DocumentTaskHistoricalReviewCheck {
    public static void main(String[] args) {
        Map<String, Object> task = Map.of(
            "decomposition", Map.of("handbooks", List.of(Map.of("documents", List.of(
                Map.of("reviewTaskId", "current-review"))))),
            "scopeHistory", List.of(
                Map.of("handbooks", List.of(Map.of("documents", List.of(
                    Map.of("reviewTaskId", "withdrawn-review"),
                    Map.of("reviewTaskId", "duplicate-review"))))),
                Map.of("handbooks", List.of(Map.of("documents", List.of(
                    Map.of("reviewTaskId", "duplicate-review")))))),
            "scopeChanges", List.of(
                Map.of("sourceOpinion", Map.of("taskId", "opinion-review")),
                Map.of("sourceOpinion", Map.of("taskId", "withdrawn-review"))));
        Set<String> historical = DocumentTaskIndex.historicalReviewIds(task);
        Set<String> expected = Set.of("withdrawn-review", "duplicate-review", "opinion-review");
        if (!expected.equals(historical)) throw new AssertionError("Historical review index mismatch: " + historical);
        if (historical.contains("current-review")) throw new AssertionError("Current review must come from the active scope");

        if (!DocumentTaskIndex.historicalReviewIds(Map.of()).isEmpty()) {
            throw new AssertionError("Missing history fields must produce no review IDs");
        }
        List<Object> malformedDocuments = List.of("not-a-document", Map.of("reviewTaskId", " "),
            Map.of("reviewTaskId", "kept-review"));
        List<Object> malformedHandbooks = List.of("not-a-handbook", Map.of("documents", "not-a-list"),
            Map.of("documents", malformedDocuments));
        Map<String, Object> malformedHistory = Map.of(
            "scopeHistory", List.of("not-a-scope", Map.of("handbooks", "not-a-list"),
                Map.of("handbooks", malformedHandbooks)),
            "scopeChanges", List.of("not-a-change", Map.of("sourceOpinion", "not-an-object"),
                Map.of("sourceOpinion", Map.of("taskId", "")),
                Map.of("sourceOpinion", Map.of("taskId", "kept-review"))));
        if (!Set.of("kept-review").equals(DocumentTaskIndex.historicalReviewIds(malformedHistory))) {
            throw new AssertionError("Malformed history values must be ignored and IDs deduplicated");
        }

        Set<String> indexed = new LinkedHashSet<>();
        Connection connection = (Connection) Proxy.newProxyInstance(Connection.class.getClassLoader(),
            new Class<?>[] { Connection.class }, (proxy, method, arguments) -> {
                if (!"prepareStatement".equals(method.getName())) return null;
                String sql = (String) arguments[0];
                String[] values = new String[4];
                return Proxy.newProxyInstance(PreparedStatement.class.getClassLoader(),
                    new Class<?>[] { PreparedStatement.class }, (statement, operation, parameters) -> {
                        switch (operation.getName()) {
                            case "setString" -> values[(Integer) parameters[0]] = (String) parameters[1];
                            case "addBatch" -> {
                                if (sql.startsWith("INSERT INTO KC_DOCUMENT_TASK_REVIEW")) indexed.add(values[1]);
                            }
                            case "executeUpdate" -> { return 0; }
                            case "executeBatch" -> { return new int[0]; }
                            default -> { }
                        }
                        return null;
                    });
            });
        try {
            DocumentTaskIndex.replace(connection, "P-1", task);
        } catch (Exception error) {
            throw new AssertionError("Review index write failed", error);
        }
        Set<String> expectedIndex = Set.of("current-review", "withdrawn-review", "duplicate-review", "opinion-review");
        if (!expectedIndex.equals(indexed)) throw new AssertionError("Review index rows mismatch: " + indexed);
    }
}

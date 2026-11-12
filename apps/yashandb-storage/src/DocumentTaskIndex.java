import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Transactional lookup rows for task assignments and review links. */
final class DocumentTaskIndex {
    private DocumentTaskIndex() {}

    static String status(Map<?, ?> task) {
        Object current = task.get("status");
        if ("completed".equals(current)) return "COMPLETED";
        if ("in_progress".equals(current)) return "IN_PROGRESS";
        if ("pending_scope".equals(current)) return "PENDING_SCOPE";
        if (task.get("decomposition") instanceof Map<?, ?> scope
            && Boolean.TRUE.equals(scope.get("confirmed"))) return "IN_PROGRESS";
        return "PENDING_SCOPE";
    }

    static void replace(Connection connection, String number, Map<?, ?> task) throws SQLException {
        TaskNumber identity = TaskNumber.parse(number);
        try (PreparedStatement delete = connection.prepareStatement(
            "DELETE FROM KC_DOCUMENT_TASK_ACTOR WHERE TASK_PREFIX=? AND TASK_NUMBER=?")) {
            delete.setString(1, identity.prefix); delete.setLong(2, identity.value); delete.executeUpdate();
        }
        try (PreparedStatement delete = connection.prepareStatement(
            "DELETE FROM KC_DOCUMENT_TASK_REVIEW WHERE TASK_PREFIX=? AND TASK_NUMBER=?")) {
            delete.setString(1, identity.prefix); delete.setLong(2, identity.value); delete.executeUpdate();
        }
        try (PreparedStatement delete = connection.prepareStatement(
            "DELETE FROM KC_DOCUMENT_TASK_HANDBOOK WHERE TASK_PREFIX=? AND TASK_NUMBER=?")) {
            delete.setString(1, identity.prefix); delete.setLong(2, identity.value); delete.executeUpdate();
        }
        Set<String> actors = new LinkedHashSet<>();
        Set<String> reviews = new LinkedHashSet<>();
        Set<String> handbookIds = new LinkedHashSet<>();
        addActor(actors, task.get("ownerId"), "OWNER");
        if (task.get("decomposition") instanceof Map<?, ?> scope
            && scope.get("handbooks") instanceof List<?> handbooks) {
            for (Object value : handbooks) {
                if (!(value instanceof Map<?, ?> book)) continue;
                if (book.get("id") != null) handbookIds.add(String.valueOf(book.get("id")));
                addActor(actors, book.get("ownerId"), "HANDBOOK");
                if (!(book.get("documents") instanceof List<?> documents)) continue;
                for (Object entry : documents) {
                    if (!(entry instanceof Map<?, ?> document)) continue;
                    addActor(actors, document.get("ownerId"), "DOCUMENT");
                    Object reviewId = document.get("reviewTaskId");
                    if (reviewId != null && !String.valueOf(reviewId).isBlank()) reviews.add(String.valueOf(reviewId));
                }
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_DOCUMENT_TASK_ACTOR (TASK_PREFIX,TASK_NUMBER,PRINCIPAL_ID,ACTOR_ROLE) VALUES (?,?,?,?)")) {
            for (String actor : actors) {
                String[] parts = actor.split(":", 2);
                insert.setString(1, identity.prefix); insert.setLong(2, identity.value);
                insert.setString(3, parts[1]); insert.setString(4, parts[0]);
                insert.addBatch();
            }
            insert.executeBatch();
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_DOCUMENT_TASK_REVIEW (REVIEW_TASK_ID,TASK_PREFIX,TASK_NUMBER) VALUES (?,?,?)")) {
            for (String reviewId : reviews) {
                if (reviewId.length() > 128) throw new SQLException("DOCUMENT_TASK_REVIEW_ID_INVALID");
                insert.setString(1, reviewId); insert.setString(2, identity.prefix);
                insert.setLong(3, identity.value); insert.addBatch();
            }
            insert.executeBatch();
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_DOCUMENT_TASK_HANDBOOK (TASK_PREFIX,TASK_NUMBER,HANDBOOK_ID) VALUES (?,?,?)")) {
            for (String id : handbookIds) {
                if (id.isBlank() || id.length() > 128) throw new SQLException("DOCUMENT_TASK_HANDBOOK_INVALID");
                insert.setString(1, identity.prefix); insert.setLong(2, identity.value);
                insert.setString(3, id); insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static void addActor(Set<String> actors, Object value, String role) throws SQLException {
        if (value == null || String.valueOf(value).isBlank()) return;
        String id = String.valueOf(value);
        if (id.length() > 128) throw new SQLException("DOCUMENT_TASK_ACTOR_INVALID");
        actors.add(role + ":" + id);
    }
}

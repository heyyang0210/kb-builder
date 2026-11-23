import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;

/** One task, its lookup rows and its idempotency result share one transaction. */
final class DocumentTaskWriteRepository {
    private final DocumentTaskReadRepository reads = new DocumentTaskReadRepository();

    Map<String, Object> put(Connection connection, String number, Map<String, Object> input) throws SQLException {
        if (!reads.active(connection)) throw new SQLException("DOCUMENT_TASK_MIGRATION_REQUIRED");
        TaskNumber identity = TaskNumber.parseTask(number);
        String key = string(input.get("idempotencyKey"));
        String digest = string(input.get("requestSha256"));
        if (key == null || key.isBlank()
            || key.length() > 320 || digest == null || !digest.matches("[a-f0-9]{64}")
            || !(input.get("task") instanceof Map<?, ?> raw)
            || !number.equals(string(raw.get("number")))
            || !(input.get("expectedRowVersion") instanceof Number expected))
            throw new SQLException("DOCUMENT_TASK_WRITE_INVALID");
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT REQUEST_SHA256,RESULT_PAYLOAD,WRITE_KIND,TASK_PREFIX,TASK_NUMBER " +
            "FROM KC_DOCUMENT_TASK_WRITE WHERE IDEMPOTENCY_KEY=?")) {
            query.setString(1, key);
            try (ResultSet rows = query.executeQuery()) {
                if (rows.next()) {
                    if (!digest.equals(rows.getString(1)) || !"TASK".equals(rows.getString(3))
                        || !identity.prefix.equals(rows.getString(4)) || identity.value != rows.getLong(5))
                        throw new SQLException("DOCUMENT_TASK_IDEMPOTENCY_CONFLICT");
                    Object stored = parseResult(rows.getString(2));
                    if (stored instanceof Map<?, ?> envelope && envelope.get("task") instanceof Map<?, ?> saved)
                        return copy(saved);
                    return reads.find(connection, number);
                }
            }
        }
        long currentVersion = 0;
        String sourceType = null, primarySourceId = null;
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT ROW_VERSION,SOURCE_TYPE,PRIMARY_SOURCE_ID FROM KC_DOCUMENT_TASK " +
            "WHERE TASK_PREFIX=? AND TASK_NUMBER=? FOR UPDATE")) {
            query.setString(1, identity.prefix); query.setLong(2, identity.value);
            try (ResultSet rows = query.executeQuery()) {
                if (rows.next()) {
                    currentVersion = rows.getLong(1);
                    sourceType = rows.getString(2);
                    primarySourceId = rows.getString(3);
                }
            }
        }
        if (currentVersion != expected.longValue()) throw new SQLException("DOCUMENT_TASK_VERSION_CONFLICT");
        Map<String, Object> task = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : raw.entrySet()) task.put(String.valueOf(entry.getKey()), entry.getValue());
        task.remove("rowVersion");
        task.remove("attention");
        if (sourceType != null) task.put("sourceType", sourceType);
        if (primarySourceId != null) task.put("primarySourceId", primarySourceId);
        String payload = Main.Json.stringify(task);
        String status = DocumentTaskIndex.status(task);
        if (currentVersion == 0) {
            try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO KC_DOCUMENT_TASK (TASK_PREFIX,TASK_NUMBER,PAYLOAD,OWNER_ID,PRODUCT_CODE," +
                "BUSINESS_VERSION,TASK_STATUS,DESCRIPTION) VALUES (?,?,?,?,?,?,?,?)")) {
                insert.setString(1, identity.prefix); insert.setLong(2, identity.value);
                insert.setString(3, payload); insert.setString(4, string(task.get("ownerId")));
                insert.setString(5, string(task.get("product")));
                insert.setString(6, string(task.get("version")));
                insert.setString(7, status); insert.setString(8, string(task.get("description")));
                insert.executeUpdate();
            }
        } else {
            try (PreparedStatement update = connection.prepareStatement(
                "UPDATE KC_DOCUMENT_TASK SET PAYLOAD=?,OWNER_ID=?,PRODUCT_CODE=?,BUSINESS_VERSION=?," +
                "TASK_STATUS=?,DESCRIPTION=?,ROW_VERSION=ROW_VERSION+1,UPDATED_AT=CURRENT_TIMESTAMP " +
                "WHERE TASK_PREFIX=? AND TASK_NUMBER=? AND ROW_VERSION=?")) {
                update.setString(1, payload); update.setString(2, string(task.get("ownerId")));
                update.setString(3, string(task.get("product")));
                update.setString(4, string(task.get("version")));
                update.setString(5, status); update.setString(6, string(task.get("description")));
                update.setString(7, identity.prefix); update.setLong(8, identity.value);
                update.setLong(9, currentVersion);
                if (update.executeUpdate() != 1) throw new SQLException("DOCUMENT_TASK_VERSION_CONFLICT");
            }
        }
        DocumentTaskIndex.replace(connection, number, task);
        Map<String, Object> result = reads.find(connection, number);
        String resultPayload = Main.Json.stringify(Map.of("response",
            input.containsKey("response") ? input.get("response") : result, "task", result));
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_DOCUMENT_TASK_WRITE (IDEMPOTENCY_KEY,REQUEST_SHA256,RESULT_PAYLOAD," +
            "WRITE_KIND,TASK_PREFIX,TASK_NUMBER) VALUES (?,?,?,'TASK',?,?)")) {
            insert.setString(1, key); insert.setString(2, digest);
            insert.setString(3, resultPayload); insert.setString(4, identity.prefix);
            insert.setLong(5, identity.value); insert.executeUpdate();
        }
        return result;
    }

    Map<String, Object> putConfig(Connection connection, Map<?, ?> config, long expectedStorageRevision,
                                  Map<String, Object> input, String key) throws SQLException {
        if (!reads.active(connection)) throw new SQLException("DOCUMENT_TASK_MIGRATION_REQUIRED");
        String digest = string(input.get("requestSha256"));
        if (key == null || key.isBlank() || key.length() > 320 || !key.equals(input.get("idempotencyKey"))
            || digest == null || !digest.matches("[a-f0-9]{64}"))
            throw new SQLException("DOCUMENT_TASK_CONFIG_WRITE_INVALID");
        Map<String, Object> previous = replay(connection, key);
        if (previous != null) {
            if (!digest.equals(previous.get("digest"))) throw new SQLException("DOCUMENT_TASK_IDEMPOTENCY_CONFLICT");
            Object result = previous.get("result");
            if (result instanceof Map<?, ?> raw) {
                Map<String, Object> saved = new LinkedHashMap<>();
                for (Map.Entry<?, ?> field : raw.entrySet()) saved.put(String.valueOf(field.getKey()), field.getValue());
                return saved;
            }
            throw new SQLException("DOCUMENT_TASK_CONFIG_INVALID");
        }
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_DOCUMENT_TASK_CONFIG SET PAYLOAD=?,ROW_VERSION=ROW_VERSION+1 " +
            "WHERE CONFIG_KEY='state' AND ROW_VERSION=?")) {
            update.setString(1, Main.Json.stringify(config)); update.setLong(2, expectedStorageRevision);
            if (update.executeUpdate() != 1) throw new SQLException("DOCUMENT_TASK_CONFIG_VERSION_CONFLICT");
        }
        Map<String, Object> saved = reads.config(connection);
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_DOCUMENT_TASK_WRITE (IDEMPOTENCY_KEY,REQUEST_SHA256,RESULT_PAYLOAD,WRITE_KIND) " +
            "VALUES (?,?,?,'CONFIG')")) {
            insert.setString(1, key); insert.setString(2, digest);
            insert.setString(3, Main.Json.stringify(saved)); insert.executeUpdate();
        }
        return saved;
    }

    Map<String, Object> replay(Connection connection, String key) throws SQLException {
        if (!reads.active(connection)) throw new SQLException("DOCUMENT_TASK_MIGRATION_REQUIRED");
        if (key == null || key.isBlank() || key.length() > 320)
            throw new SQLException("DOCUMENT_TASK_WRITE_INVALID");
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT REQUEST_SHA256,RESULT_PAYLOAD FROM KC_DOCUMENT_TASK_WRITE WHERE IDEMPOTENCY_KEY=?")) {
            query.setString(1, key);
            try (ResultSet rows = query.executeQuery()) {
                if (!rows.next()) return null;
                Object stored = parseResult(rows.getString(2));
                Object response = stored instanceof Map<?, ?> envelope && envelope.containsKey("task")
                    && envelope.containsKey("response") ? envelope.get("response") : stored;
                return Map.of("digest", rows.getString(1), "result", response);
            }
        }
    }

    private static Object parseResult(String payload) throws SQLException {
        try {
            return Main.Json.parse(payload);
        } catch (Exception error) { throw new SQLException("DOCUMENT_TASK_RESULT_INVALID", error); }
    }

    private static Map<String, Object> copy(Map<?, ?> raw) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (Map.Entry<?, ?> field : raw.entrySet()) result.put(String.valueOf(field.getKey()), field.getValue());
        return result;
    }

    private static String string(Object value) { return value == null ? null : String.valueOf(value); }
}

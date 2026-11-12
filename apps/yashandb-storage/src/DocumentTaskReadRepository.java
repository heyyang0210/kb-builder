import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Paged task reads after the verified relational cutover. */
final class DocumentTaskReadRepository {
    Map<String, Object> config(Connection connection) throws SQLException {
        requireActive(connection);
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT PAYLOAD,ROW_VERSION FROM KC_DOCUMENT_TASK_CONFIG WHERE CONFIG_KEY='state'")) {
            try (ResultSet rows = query.executeQuery()) {
                if (!rows.next()) throw new SQLException("DOCUMENT_TASK_CONFIG_NOT_FOUND");
                try {
                    Object parsed = Main.Json.parse(rows.getString(1));
                    if (!(parsed instanceof Map<?, ?> raw)) throw new SQLException("DOCUMENT_TASK_CONFIG_INVALID");
                    Map<String, Object> result = new LinkedHashMap<>();
                    for (Map.Entry<?, ?> field : raw.entrySet()) result.put(String.valueOf(field.getKey()), field.getValue());
                    result.put("storageRevision", rows.getLong(2));
                    return result;
                } catch (Exception error) { throw new SQLException("DOCUMENT_TASK_CONFIG_INVALID", error); }
            }
        }
    }

    boolean active(Connection connection) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT MIGRATION_STATUS FROM KC_TASK_MIGRATION WHERE MIGRATION_ID='document_tasks_v2'")) {
            try (ResultSet rows = query.executeQuery()) {
                return rows.next() && "ACTIVE".equals(rows.getString(1));
            }
        }
    }

    Map<String, Object> find(Connection connection, String number) throws SQLException {
        requireActive(connection);
        TaskNumber identity = TaskNumber.parse(number);
        List<Map<String, Object>> tasks = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT TASK_NUMBER,PAYLOAD,ROW_VERSION,ATTENTION,SOURCE_TYPE,PRIMARY_SOURCE_ID " +
            "FROM KC_DOCUMENT_TASK WHERE TASK_PREFIX=? AND TASK_NUMBER=?")) {
            query.setString(1, identity.prefix); query.setLong(2, identity.value);
            try (ResultSet rows = query.executeQuery()) {
                if (rows.next()) tasks.add(task(rows));
            }
        }
        attachIr(connection, tasks);
        return tasks.isEmpty() ? null : tasks.get(0);
    }

    Map<String, Object> list(Connection connection, Map<String, String> filters) throws SQLException {
        requireActive(connection);
        int page = bounded(filters.get("page"), 1, 1_000_000, 1);
        int pageSize = bounded(filters.get("pageSize"), 1, 100, 20);
        String attention = "secondary".equalsIgnoreCase(filters.get("attention")) ? "SECONDARY" : "NORMAL";
        List<Object> parameters = new ArrayList<>();
        StringBuilder where = new StringBuilder(" WHERE T.ATTENTION=?");
        parameters.add(attention);
        appendVisibility(where, parameters, filters.get("visibleHandbooks"));
        for (String[] field : new String[][] { { "ownerId", "T.OWNER_ID" }, { "product", "T.PRODUCT_CODE" },
            { "version", "T.BUSINESS_VERSION" }, { "type", "T.SOURCE_TYPE" }, { "status", "T.TASK_STATUS" } }) {
            String value = filters.get(field[0]);
            if (value != null && !value.isBlank()) {
                where.append(" AND ").append(field[1]).append("=?");
                parameters.add("status".equals(field[0]) || "type".equals(field[0]) ? value.toUpperCase() : value);
            }
        }
        String q = filters.get("q");
        if (q != null && !q.isBlank()) {
            where.append(" AND (LOWER(T.TASK_PREFIX || '-' || TO_CHAR(T.TASK_NUMBER)) LIKE ? OR LOWER(T.DESCRIPTION) LIKE ?)");
            String pattern = "%" + q.toLowerCase() + "%";
            parameters.add(pattern); parameters.add(pattern);
        }
        String ir = filters.get("ir");
        if (ir != null && !ir.isBlank()) {
            where.append(" AND EXISTS (SELECT 1 FROM KC_PINGCODE_IR_RELATION R " +
                "JOIN KC_PINGCODE_TASK_SOURCE S ON S.SR_NUMBER=R.SR_NUMBER AND S.LAST_RUN_ID=R.RUN_ID " +
                "WHERE T.TASK_PREFIX='YDBRD' AND R.SR_NUMBER=T.TASK_NUMBER AND S.PRESENT='Y' AND R.IR_NUMBER=?)");
            parameters.add(TaskNumber.ir(ir));
        }
        long total;
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT COUNT(*) FROM KC_DOCUMENT_TASK T" + where)) {
            bind(query, parameters);
            try (ResultSet rows = query.executeQuery()) { rows.next(); total = rows.getLong(1); }
        }
        List<Map<String, Object>> tasks = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT T.TASK_NUMBER,T.PAYLOAD,T.ROW_VERSION,T.ATTENTION,T.SOURCE_TYPE,T.PRIMARY_SOURCE_ID " +
            "FROM KC_DOCUMENT_TASK T" + where + " ORDER BY T.UPDATED_AT DESC,T.TASK_PREFIX,T.TASK_NUMBER DESC " +
            "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY")) {
            bind(query, parameters);
            query.setLong(parameters.size() + 1, (long) (page - 1) * pageSize);
            query.setInt(parameters.size() + 2, pageSize);
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) tasks.add(task(rows));
            }
        }
        attachIr(connection, tasks);
        return Map.of("items", tasks, "total", total, "page", page, "pageSize", pageSize);
    }

    Map<String, Object> mine(Connection connection, String principalId, int page, int pageSize,
                              String visibleHandbooks) throws SQLException {
        requireActive(connection);
        if (principalId == null || principalId.isBlank() || principalId.length() > 128)
            throw new SQLException("DOCUMENT_TASK_ACTOR_INVALID");
        int safePage = Math.max(1, page), safeSize = Math.max(1, Math.min(100, pageSize));
        List<Object> visibilityParameters = new ArrayList<>();
        StringBuilder visibility = new StringBuilder();
        appendVisibility(visibility, visibilityParameters, visibleHandbooks);
        long total;
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT COUNT(*) FROM (SELECT DISTINCT A.TASK_PREFIX,A.TASK_NUMBER FROM KC_DOCUMENT_TASK_ACTOR A " +
            "JOIN KC_DOCUMENT_TASK T ON T.TASK_PREFIX=A.TASK_PREFIX AND T.TASK_NUMBER=A.TASK_NUMBER " +
            "WHERE A.PRINCIPAL_ID=? AND T.ATTENTION='NORMAL' AND T.TASK_STATUS<>'COMPLETED'" + visibility + ")")) {
            query.setString(1, principalId); bind(query, visibilityParameters, 2);
            try (ResultSet rows = query.executeQuery()) { rows.next(); total = rows.getLong(1); }
        }
        List<Map<String, Object>> tasks = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT T.TASK_NUMBER,T.PAYLOAD,T.ROW_VERSION,T.ATTENTION,T.SOURCE_TYPE,T.PRIMARY_SOURCE_ID " +
            "FROM KC_DOCUMENT_TASK T WHERE T.ATTENTION='NORMAL' AND T.TASK_STATUS<>'COMPLETED' " +
            "AND EXISTS (SELECT 1 FROM KC_DOCUMENT_TASK_ACTOR A WHERE A.TASK_PREFIX=T.TASK_PREFIX " +
            "AND A.TASK_NUMBER=T.TASK_NUMBER AND A.PRINCIPAL_ID=?)" + visibility +
            " ORDER BY T.UPDATED_AT DESC,T.TASK_PREFIX,T.TASK_NUMBER DESC " +
            "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY")) {
            query.setString(1, principalId); bind(query, visibilityParameters, 2);
            query.setLong(visibilityParameters.size() + 2, (long) (safePage - 1) * safeSize);
            query.setInt(visibilityParameters.size() + 3, safeSize);
            try (ResultSet rows = query.executeQuery()) { while (rows.next()) tasks.add(task(rows)); }
        }
        attachIr(connection, tasks);
        return Map.of("items", tasks, "total", total, "page", safePage, "pageSize", safeSize);
    }

    List<Map<String, Object>> byReview(Connection connection, String reviewId) throws SQLException {
        requireActive(connection);
        List<Map<String, Object>> tasks = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT T.TASK_NUMBER,T.PAYLOAD,T.ROW_VERSION,T.ATTENTION,T.SOURCE_TYPE,T.PRIMARY_SOURCE_ID " +
            "FROM KC_DOCUMENT_TASK_REVIEW R JOIN KC_DOCUMENT_TASK T " +
            "ON T.TASK_PREFIX=R.TASK_PREFIX AND T.TASK_NUMBER=R.TASK_NUMBER " +
            "WHERE R.REVIEW_TASK_ID=?")) {
            query.setString(1, reviewId);
            try (ResultSet rows = query.executeQuery()) { while (rows.next()) tasks.add(task(rows)); }
        }
        return tasks;
    }

    private void requireActive(Connection connection) throws SQLException {
        if (!active(connection)) throw new SQLException("DOCUMENT_TASK_MIGRATION_REQUIRED");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> task(ResultSet rows) throws SQLException {
        try {
            Object parsed = Main.Json.parse(rows.getString(2));
            if (!(parsed instanceof Map<?, ?> raw)) throw new SQLException("DOCUMENT_TASK_PAYLOAD_INVALID");
            Map<String, Object> item = new LinkedHashMap<>();
            for (Map.Entry<?, ?> field : raw.entrySet()) item.put(String.valueOf(field.getKey()), field.getValue());
            item.put("rowVersion", rows.getLong(3));
            item.put("attention", rows.getString(4));
            item.put("sourceType", rows.getString(5));
            item.put("primarySourceId", rows.getString(6));
            return item;
        } catch (Exception error) { throw new SQLException("DOCUMENT_TASK_PAYLOAD_INVALID", error); }
    }

    private static void attachIr(Connection connection, List<Map<String, Object>> tasks) throws SQLException {
        if (tasks.isEmpty()) return;
        Map<String, Set<String>> relations = new LinkedHashMap<>();
        for (Map<String, Object> task : tasks) relations.put(String.valueOf(task.get("number")), new LinkedHashSet<>());
        List<Long> srNumbers = new ArrayList<>();
        for (String number : relations.keySet()) {
            TaskNumber identity = TaskNumber.parse(number);
            if ("YDBRD".equals(identity.prefix)) srNumbers.add(identity.value);
        }
        if (srNumbers.isEmpty()) {
            for (Map<String, Object> task : tasks) task.put("ir", List.of());
            return;
        }
        String placeholders = String.join(",", Collections.nCopies(srNumbers.size(), "?"));
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT DISTINCT R.SR_NUMBER,R.IR_NUMBER FROM KC_PINGCODE_IR_RELATION R " +
            "JOIN KC_PINGCODE_TASK_SOURCE S ON S.SR_NUMBER=R.SR_NUMBER AND S.LAST_RUN_ID=R.RUN_ID " +
            "WHERE S.PRESENT='Y' AND R.SR_NUMBER IN (" + placeholders + ") ORDER BY R.SR_NUMBER,R.IR_NUMBER")) {
            int index = 1;
            for (long number : srNumbers) query.setLong(index++, number);
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) relations.get(TaskNumber.sr(rows.getLong(1))).add(TaskNumber.ir(rows.getLong(2)));
            }
        }
        for (Map<String, Object> task : tasks) task.put("ir", List.copyOf(relations.get(String.valueOf(task.get("number")))));
    }

    private static int bounded(String value, int minimum, int maximum, int fallback) throws SQLException {
        if (value == null || value.isBlank()) return fallback;
        try {
            int parsed = Integer.parseInt(value);
            if (parsed < minimum || parsed > maximum) throw new NumberFormatException();
            return parsed;
        } catch (NumberFormatException error) { throw new SQLException("DOCUMENT_TASK_PAGE_INVALID"); }
    }

    private static void bind(PreparedStatement query, List<Object> values) throws SQLException {
        bind(query, values, 1);
    }

    private static void bind(PreparedStatement query, List<Object> values, int start) throws SQLException {
        for (int index = 0; index < values.size(); index++) query.setObject(start + index, values.get(index));
    }

    private static void appendVisibility(StringBuilder sql, List<Object> parameters, String raw) throws SQLException {
        if (raw == null) return;
        String[] ids = raw.isEmpty() ? new String[0] : raw.split(",", -1);
        if (ids.length > 1000) throw new SQLException("DOCUMENT_TASK_VISIBILITY_INVALID");
        sql.append(" AND NOT EXISTS (SELECT 1 FROM KC_DOCUMENT_TASK_HANDBOOK H " +
            "WHERE H.TASK_PREFIX=T.TASK_PREFIX AND H.TASK_NUMBER=T.TASK_NUMBER");
        if (ids.length > 0) {
            sql.append(" AND H.HANDBOOK_ID NOT IN (")
                .append(String.join(",", Collections.nCopies(ids.length, "?"))).append(")");
            for (String id : ids) {
                if (id.isBlank() || id.length() > 128) throw new SQLException("DOCUMENT_TASK_VISIBILITY_INVALID");
                parameters.add(id);
            }
        }
        sql.append(")");
    }
}

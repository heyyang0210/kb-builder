import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** GitLab 连接与手册映射当前业务配置 Repository。 */
final class PlatformGitLabRepository {
    Map<String, Object> listConnections(Connection connection) throws SQLException {
        List<Map<String, Object>> items = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT C.GITLAB_CONNECTION_ID,C.CONNECTION_KEY,C.CONNECTION_NAME,C.BASE_URL,C.PROJECT_PATH," +
                "C.PATH_PREFIX,C.DEFAULT_BRANCH,C.RUN_MODE,C.AUTH_MODE,C.CREDENTIAL_REF,C.PURPOSE,C.STATE," +
                "C.ROW_VERSION,C.CREATED_AT,C.UPDATED_AT," +
                "(SELECT COUNT(*) FROM KC_GITLAB_MANUAL_MAPPING M WHERE M.GITLAB_CONNECTION_ID=C.GITLAB_CONNECTION_ID AND M.STATE='ACTIVE') " +
                "FROM KC_GITLAB_CONNECTION C ORDER BY C.CONNECTION_NAME,C.GITLAB_CONNECTION_ID");
             ResultSet result = query.executeQuery()) {
            while (result.next()) items.add(projectConnection(result));
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", items); data.put("total", items.size()); data.put("generatedAt", Instant.now().toString());
        return data;
    }

    Map<String, Object> findConnection(Connection connection, String keyOrName) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT C.GITLAB_CONNECTION_ID,C.CONNECTION_KEY,C.CONNECTION_NAME,C.BASE_URL,C.PROJECT_PATH," +
                "C.PATH_PREFIX,C.DEFAULT_BRANCH,C.RUN_MODE,C.AUTH_MODE,C.CREDENTIAL_REF,C.PURPOSE,C.STATE," +
                "C.ROW_VERSION,C.CREATED_AT,C.UPDATED_AT," +
                "(SELECT COUNT(*) FROM KC_GITLAB_MANUAL_MAPPING M WHERE M.GITLAB_CONNECTION_ID=C.GITLAB_CONNECTION_ID AND M.STATE='ACTIVE') " +
                "FROM KC_GITLAB_CONNECTION C WHERE C.CONNECTION_KEY=? OR C.CONNECTION_NAME=?")) {
            query.setString(1, keyOrName); query.setString(2, keyOrName);
            try (ResultSet result = query.executeQuery()) { return result.next() ? projectConnection(result) : null; }
        }
    }

    Map<String, Object> upsertConnection(Connection connection, Map<String, Object> input,
                                         Long expectedVersion, String actor) throws SQLException {
        String key = text(input.get("id"));
        String name = required(input.get("name"), "GITLAB_CONNECTION_NAME_REQUIRED");
        String baseUrl = required(first(input, "baseUrl", "host"), "GITLAB_BASE_URL_REQUIRED");
        String project = required(first(input, "projectPath", "project"), "GITLAB_PROJECT_REQUIRED");
        String prefix = text(input.get("pathPrefix"));
        String branch = required(input.get("defaultBranch"), "GITLAB_DEFAULT_BRANCH_REQUIRED");
        String runMode = enumValue(input.get("mode"), Set.of("DISABLED", "SANDBOX", "PRODUCTION"), "GITLAB_RUN_MODE_INVALID");
        String authMode = enumValue(input.get("authMode"), Set.of("USER_OAUTH", "SERVICE_ACCOUNT"), "GITLAB_AUTH_MODE_INVALID");
        String purpose = enumValue(input.get("purpose"), Set.of("READ", "READ_WRITE"), "GITLAB_PURPOSE_INVALID");
        String credentialRef = text(input.get("credentialRef"));
        String state = enumValue(input.get("status"), Set.of("ACTIVE", "INACTIVE"), "GITLAB_STATE_INVALID");
        String fingerprint = sha256(String.join("\n", name, baseUrl, project, prefix, branch, runMode, authMode,
            credentialRef, purpose, state));
        Map<String, Object> existing = key.isEmpty() ? findConnection(connection, name) : findConnection(connection, key);
        if (existing == null) {
            if (expectedVersion != null) throw new SQLException("ROW_VERSION_CONFLICT");
            key = key.isEmpty() ? "gitlab-" + UUID.randomUUID() : key;
            try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO KC_GITLAB_CONNECTION(CONNECTION_KEY,CONNECTION_NAME,BASE_URL,PROJECT_PATH,PATH_PREFIX," +
                    "DEFAULT_BRANCH,RUN_MODE,AUTH_MODE,CREDENTIAL_REF,PURPOSE,CONFIG_FINGERPRINT,STATE,CREATED_BY,UPDATED_BY) " +
                    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")) {
                bindConnection(insert, key, name, baseUrl, project, prefix, branch, runMode, authMode,
                    credentialRef, purpose, fingerprint, state, actor);
                insert.executeUpdate();
            }
        } else {
            long current = ((Number) existing.get("rowVersion")).longValue();
            if (expectedVersion == null || expectedVersion != current) throw new SQLException("ROW_VERSION_CONFLICT");
            key = String.valueOf(existing.get("id"));
            try (PreparedStatement update = connection.prepareStatement(
                "UPDATE KC_GITLAB_CONNECTION SET CONNECTION_NAME=?,BASE_URL=?,PROJECT_PATH=?,PATH_PREFIX=?," +
                    "DEFAULT_BRANCH=?,RUN_MODE=?,AUTH_MODE=?,CREDENTIAL_REF=?,PURPOSE=?,CONFIG_FINGERPRINT=?,STATE=?," +
                    "ROW_VERSION=ROW_VERSION+1,UPDATED_BY=?,UPDATED_AT=CURRENT_TIMESTAMP " +
                    "WHERE CONNECTION_KEY=? AND ROW_VERSION=?")) {
                int i = 1;
                update.setString(i++, name); update.setString(i++, baseUrl); update.setString(i++, project);
                update.setString(i++, prefix.isEmpty() ? null : prefix); update.setString(i++, branch);
                update.setString(i++, runMode); update.setString(i++, authMode);
                update.setString(i++, credentialRef.isEmpty() ? null : credentialRef); update.setString(i++, purpose);
                update.setString(i++, fingerprint); update.setString(i++, state); update.setString(i++, actor);
                update.setString(i++, key); update.setLong(i, current);
                if (update.executeUpdate() != 1) throw new SQLException("ROW_VERSION_CONFLICT");
            }
        }
        return findConnection(connection, key);
    }

    Map<String, Object> setConnectionState(Connection connection, String key, String state,
                                           long expectedVersion, String actor) throws SQLException {
        String normalized = enumValue(state, Set.of("ACTIVE", "INACTIVE"), "GITLAB_STATE_INVALID");
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_GITLAB_CONNECTION SET STATE=?,ROW_VERSION=ROW_VERSION+1,UPDATED_BY=?,UPDATED_AT=CURRENT_TIMESTAMP " +
                "WHERE CONNECTION_KEY=? AND ROW_VERSION=?")) {
            update.setString(1, normalized); update.setString(2, actor); update.setString(3, key);
            update.setLong(4, expectedVersion);
            if (update.executeUpdate() != 1) {
                if (findConnection(connection, key) == null) throw new SQLException("GITLAB_CONNECTION_NOT_FOUND");
                throw new SQLException("ROW_VERSION_CONFLICT");
            }
        }
        return findConnection(connection, key);
    }

    Map<String, Object> findMapping(Connection connection, String manualCode) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT GM.GITLAB_MAPPING_ID,M.MANUAL_CODE,C.CONNECTION_KEY,GM.MAPPING_FINGERPRINT,GM.STATE," +
                "GM.ROW_VERSION,GM.CREATED_AT,GM.UPDATED_AT " +
                "FROM KC_GITLAB_MANUAL_MAPPING GM JOIN KC_MANUAL M ON M.MANUAL_ID=GM.MANUAL_ID " +
                "JOIN KC_GITLAB_CONNECTION C ON C.GITLAB_CONNECTION_ID=GM.GITLAB_CONNECTION_ID " +
                "WHERE M.MANUAL_CODE=? AND GM.STATE='ACTIVE'")) {
            query.setString(1, manualCode);
            try (ResultSet result = query.executeQuery()) {
                if (!result.next()) return null;
                long mappingId = result.getLong(1);
                Map<String, Object> mapping = new LinkedHashMap<>();
                mapping.put("handbookId", result.getString(2)); mapping.put("connectionId", result.getString(3));
                mapping.put("fingerprint", result.getString(4)); mapping.put("rowVersion", result.getLong(6));
                mapping.put("createdAt", result.getTimestamp(7).toInstant().toString());
                mapping.put("updatedAt", result.getTimestamp(8).toInstant().toString());
                List<String> branches = new ArrayList<>(); String defaultBranch = null;
                try (PreparedStatement children = connection.prepareStatement(
                    "SELECT BRANCH_NAME,IS_DEFAULT FROM KC_GITLAB_MAPPING_BRANCH WHERE GITLAB_MAPPING_ID=? ORDER BY BRANCH_NAME")) {
                    children.setLong(1, mappingId);
                    try (ResultSet child = children.executeQuery()) {
                        while (child.next()) { branches.add(child.getString(1)); if ("Y".equals(child.getString(2))) defaultBranch = child.getString(1); }
                    }
                }
                List<String> zh = new ArrayList<>(); List<String> en = new ArrayList<>();
                try (PreparedStatement children = connection.prepareStatement(
                    "SELECT LANGUAGE_CODE,REPOSITORY_PATH FROM KC_GITLAB_MAPPING_PATH WHERE GITLAB_MAPPING_ID=? ORDER BY LANGUAGE_CODE,REPOSITORY_PATH")) {
                    children.setLong(1, mappingId);
                    try (ResultSet child = children.executeQuery()) {
                        while (child.next()) ("ZH".equals(child.getString(1)) ? zh : en).add(child.getString(2));
                    }
                }
                mapping.put("defaultBranch", defaultBranch); mapping.put("enabledBranches", branches);
                mapping.put("zhPaths", zh); mapping.put("enPaths", en); return mapping;
            }
        }
    }

    Map<String, Object> replaceMapping(Connection connection, String manualCode, Map<String, Object> input,
                                       Long expectedVersion, String actor) throws SQLException {
        long manualId = manualId(connection, manualCode);
        String connectionKey = required(input.get("connectionId"), "GITLAB_CONNECTION_REQUIRED");
        long connectionId = connectionId(connection, connectionKey);
        String defaultBranch = required(first(input, "defaultBranch", "selectedBranch"), "GITLAB_DEFAULT_BRANCH_REQUIRED");
        LinkedHashSet<String> branches = stringSet(input.get("enabledBranches")); branches.add(defaultBranch);
        LinkedHashSet<String> zhPaths = stringSet(input.get("zhPaths"));
        LinkedHashSet<String> enPaths = stringSet(input.get("enPaths"));
        if (zhPaths.isEmpty() && enPaths.isEmpty()) throw new SQLException("MAPPING_VALIDATION_FAILED");
        String fingerprint = sha256(manualCode + "\n" + connectionKey + "\n" + defaultBranch + "\n" +
            String.join("\n", branches) + "\nZH\n" + String.join("\n", zhPaths) + "\nEN\n" + String.join("\n", enPaths));

        Long mappingId = null; long currentVersion = 0;
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT GITLAB_MAPPING_ID,ROW_VERSION FROM KC_GITLAB_MANUAL_MAPPING WHERE MANUAL_ID=? FOR UPDATE")) {
            query.setLong(1, manualId);
            try (ResultSet result = query.executeQuery()) { if (result.next()) { mappingId = result.getLong(1); currentVersion = result.getLong(2); } }
        }
        if (mappingId == null) {
            if (expectedVersion != null) throw new SQLException("ROW_VERSION_CONFLICT");
            try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO KC_GITLAB_MANUAL_MAPPING(MANUAL_ID,GITLAB_CONNECTION_ID,MAPPING_FINGERPRINT,STATE,CREATED_BY,UPDATED_BY) " +
                    "VALUES (?,?,?,'ACTIVE',?,?)")) {
                insert.setLong(1, manualId); insert.setLong(2, connectionId); insert.setString(3, fingerprint);
                insert.setString(4, actor); insert.setString(5, actor); insert.executeUpdate();
            }
            try (PreparedStatement query = connection.prepareStatement(
                "SELECT GITLAB_MAPPING_ID FROM KC_GITLAB_MANUAL_MAPPING WHERE MANUAL_ID=?")) {
                query.setLong(1, manualId); try (ResultSet result = query.executeQuery()) { result.next(); mappingId = result.getLong(1); }
            }
        } else {
            if (expectedVersion == null || expectedVersion != currentVersion) throw new SQLException("ROW_VERSION_CONFLICT");
            try (PreparedStatement update = connection.prepareStatement(
                "UPDATE KC_GITLAB_MANUAL_MAPPING SET GITLAB_CONNECTION_ID=?,MAPPING_FINGERPRINT=?,STATE='ACTIVE'," +
                    "ROW_VERSION=ROW_VERSION+1,UPDATED_BY=?,UPDATED_AT=CURRENT_TIMESTAMP " +
                    "WHERE GITLAB_MAPPING_ID=? AND ROW_VERSION=?")) {
                update.setLong(1, connectionId); update.setString(2, fingerprint); update.setString(3, actor);
                update.setLong(4, mappingId); update.setLong(5, currentVersion);
                if (update.executeUpdate() != 1) throw new SQLException("ROW_VERSION_CONFLICT");
            }
            try (PreparedStatement deleteBranches = connection.prepareStatement("DELETE FROM KC_GITLAB_MAPPING_BRANCH WHERE GITLAB_MAPPING_ID=?");
                 PreparedStatement deletePaths = connection.prepareStatement("DELETE FROM KC_GITLAB_MAPPING_PATH WHERE GITLAB_MAPPING_ID=?")) {
                deleteBranches.setLong(1, mappingId); deleteBranches.executeUpdate();
                deletePaths.setLong(1, mappingId); deletePaths.executeUpdate();
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_GITLAB_MAPPING_BRANCH(GITLAB_MAPPING_ID,BRANCH_NAME,IS_DEFAULT) VALUES (?,?,?)")) {
            for (String branch : branches) {
                insert.setLong(1, mappingId); insert.setString(2, branch); insert.setString(3, branch.equals(defaultBranch) ? "Y" : "N"); insert.addBatch();
            }
            insert.executeBatch();
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_GITLAB_MAPPING_PATH(GITLAB_MAPPING_ID,LANGUAGE_CODE,REPOSITORY_PATH) VALUES (?,?,?)")) {
            for (String value : zhPaths) { insert.setLong(1, mappingId); insert.setString(2, "ZH"); insert.setString(3, value); insert.addBatch(); }
            for (String value : enPaths) { insert.setLong(1, mappingId); insert.setString(2, "EN"); insert.setString(3, value); insert.addBatch(); }
            insert.executeBatch();
        }
        return findMapping(connection, manualCode);
    }

    private static Map<String, Object> projectConnection(ResultSet result) throws SQLException {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", result.getString(2)); item.put("name", result.getString(3));
        item.put("host", result.getString(4)); item.put("baseUrl", result.getString(4));
        item.put("project", result.getString(5)); item.put("projectPath", result.getString(5));
        item.put("pathPrefix", result.getString(6) == null ? "" : result.getString(6));
        item.put("defaultBranch", result.getString(7)); item.put("mode", result.getString(8).toLowerCase());
        item.put("authMode", result.getString(9).toLowerCase()); item.put("credentialRef", result.getString(10));
        item.put("purpose", result.getString(11).toLowerCase()); item.put("status", result.getString(12).toLowerCase());
        item.put("rowVersion", result.getLong(13)); item.put("createdAt", result.getTimestamp(14).toInstant().toString());
        item.put("updatedAt", result.getTimestamp(15).toInstant().toString()); item.put("linkedHandbookCount", result.getLong(16));
        return item;
    }

    private static void bindConnection(PreparedStatement insert, String key, String name, String baseUrl,
                                       String project, String prefix, String branch, String runMode,
                                       String authMode, String credentialRef, String purpose,
                                       String fingerprint, String state, String actor) throws SQLException {
        int i = 1;
        insert.setString(i++, key); insert.setString(i++, name); insert.setString(i++, baseUrl); insert.setString(i++, project);
        insert.setString(i++, prefix.isEmpty() ? null : prefix); insert.setString(i++, branch); insert.setString(i++, runMode);
        insert.setString(i++, authMode); insert.setString(i++, credentialRef.isEmpty() ? null : credentialRef);
        insert.setString(i++, purpose); insert.setString(i++, fingerprint); insert.setString(i++, state);
        insert.setString(i++, actor); insert.setString(i, actor);
    }

    private static long manualId(Connection connection, String code) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT MANUAL_ID FROM KC_MANUAL WHERE MANUAL_CODE=? AND STATE='ACTIVE'")) {
            query.setString(1, code); try (ResultSet result = query.executeQuery()) {
                if (!result.next()) throw new SQLException("ASSET_NOT_FOUND"); return result.getLong(1);
            }
        }
    }

    private static long connectionId(Connection connection, String key) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT GITLAB_CONNECTION_ID FROM KC_GITLAB_CONNECTION WHERE CONNECTION_KEY=?")) {
            query.setString(1, key); try (ResultSet result = query.executeQuery()) {
                if (!result.next()) throw new SQLException("GITLAB_CONNECTION_NOT_FOUND"); return result.getLong(1);
            }
        }
    }

    private static LinkedHashSet<String> stringSet(Object value) throws SQLException {
        LinkedHashSet<String> values = new LinkedHashSet<>();
        if (!(value instanceof List<?> list)) return values;
        for (Object item : list) {
            String text = String.valueOf(item == null ? "" : item).trim().replaceAll("^/+|/+$", "");
            if (text.isEmpty() || text.contains("/../") || text.startsWith("../") || text.endsWith("/..")) throw new SQLException("MAPPING_VALIDATION_FAILED");
            values.add(text);
        }
        return values;
    }

    private static Object first(Map<String, Object> input, String first, String second) {
        Object value = input.get(first); return value == null || String.valueOf(value).isBlank() ? input.get(second) : value;
    }

    private static String required(Object value, String code) throws SQLException {
        String normalized = text(value); if (normalized.isEmpty()) throw new SQLException(code); return normalized;
    }

    private static String enumValue(Object value, Set<String> allowed, String code) throws SQLException {
        String normalized = text(value).toUpperCase();
        if ("USER_OAUTH".equals(normalized) || "SERVICE_ACCOUNT".equals(normalized) || allowed.contains(normalized)) return normalized;
        throw new SQLException(code);
    }

    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }

    private static String sha256(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception error) { throw new IllegalStateException(error); }
    }
}

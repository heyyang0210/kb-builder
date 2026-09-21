import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** 知识中心本地人员目录；CAS 登录名是外部唯一身份，数字 ID 是业务关联键。 */
final class PrincipalRepository {
    private static final String PROJECTION =
        "P.PRINCIPAL_ID, P.DISPLAY_NAME, P.CAS_LOGIN_NAME, P.STATE, P.FIRST_LOGIN_AT, P.LAST_LOGIN_AT, P.ROW_VERSION, "
            + "(SELECT COUNT(*) FROM KC_MANUAL_OWNER O WHERE O.PRINCIPAL_ID=P.PRINCIPAL_ID)";

    Map<String, Object> list(Connection connection, String query, String state, String bindingStatus) throws SQLException {
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String normalizedState = state == null ? "" : state.trim().toUpperCase(Locale.ROOT);
        String normalizedBinding = bindingStatus == null ? "" : bindingStatus.trim().toUpperCase(Locale.ROOT);
        StringBuilder sql = new StringBuilder(
            "SELECT " + PROJECTION + " FROM KC_PLATFORM_PRINCIPAL P WHERE 1=1");
        List<String> parameters = new ArrayList<>();
        if (!normalizedQuery.isEmpty()) {
            sql.append(" AND (LOWER(DISPLAY_NAME) LIKE ? OR LOWER(COALESCE(CAS_LOGIN_NAME, '')) LIKE ?)");
            parameters.add("%" + normalizedQuery + "%");
            parameters.add("%" + normalizedQuery + "%");
        }
        if (!normalizedState.isEmpty()) {
            sql.append(" AND P.STATE = ?");
            parameters.add(normalizedState);
        }
        if ("BOUND".equals(normalizedBinding)) sql.append(" AND P.CAS_LOGIN_NAME IS NOT NULL");
        else if ("PENDING".equals(normalizedBinding)) sql.append(" AND P.CAS_LOGIN_NAME IS NULL");
        else if (!normalizedBinding.isEmpty()) throw new SQLException("PERSONNEL_BINDING_STATUS_INVALID");
        sql.append(" ORDER BY P.DISPLAY_NAME, P.PRINCIPAL_ID");
        List<Map<String, Object>> items = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(sql.toString())) {
            for (int index = 0; index < parameters.size(); index++) statement.setString(index + 1, parameters.get(index));
            try (ResultSet result = statement.executeQuery()) {
                while (result.next()) items.add(project(result));
            }
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("generatedAt", Instant.now().toString());
        response.put("total", items.size());
        response.put("items", items);
        response.put("summary", summary(connection));
        return response;
    }

    Map<String, Object> create(Connection connection, String displayName, String casLoginName, String state, String actor) throws SQLException {
        String name = required(displayName, "PERSONNEL_NAME_REQUIRED");
        String login = optional(casLoginName);
        String normalizedState = normalizeState(state);
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_PLATFORM_PRINCIPAL(DISPLAY_NAME, CAS_LOGIN_NAME, STATE, FIRST_LOGIN_AT, LAST_LOGIN_AT, CREATED_BY, UPDATED_BY) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?)")) {
            insert.setString(1, name);
            if (login == null) insert.setNull(2, java.sql.Types.VARCHAR); else insert.setString(2, login);
            insert.setString(3, normalizedState);
            Timestamp loginAt = login == null ? null : Timestamp.from(Instant.now());
            insert.setTimestamp(4, loginAt);
            insert.setTimestamp(5, loginAt);
            insert.setString(6, actor);
            insert.setString(7, actor);
            insert.executeUpdate();
        } catch (SQLException error) {
            if (login != null && findByLogin(connection, login, false) != null) throw new SQLException("CAS_LOGIN_NAME_CONFLICT");
            throw error;
        }
        if (login != null) return findByLogin(connection, login, false);
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT " + PROJECTION + " FROM KC_PLATFORM_PRINCIPAL P WHERE P.DISPLAY_NAME=? AND P.CAS_LOGIN_NAME IS NULL ORDER BY P.PRINCIPAL_ID DESC FETCH FIRST 1 ROW ONLY")) {
            query.setString(1, name);
            try (ResultSet result = query.executeQuery()) {
                if (!result.next()) throw new SQLException("PERSONNEL_INSERT_FAILED");
                return project(result);
            }
        }
    }

    Map<String, Object> syncCasLogin(Connection connection, String loginName, String displayName, String actor) throws SQLException {
        return syncCasLogin(connection, loginName, displayName, actor, false);
    }

    private Map<String, Object> syncCasLogin(Connection connection, String loginName, String displayName,
                                             String actor, boolean allowCreate) throws SQLException {
        String login = required(loginName, "CAS_LOGIN_NAME_REQUIRED");
        String name = required(displayName, "PERSONNEL_NAME_REQUIRED");
        Long existingId = findIdByLogin(connection, login, true);
        if (existingId != null) {
            try (PreparedStatement update = connection.prepareStatement(
                "UPDATE KC_PLATFORM_PRINCIPAL SET LAST_LOGIN_AT=CURRENT_TIMESTAMP, STATE='ACTIVE', ROW_VERSION=ROW_VERSION+1, "
                    + "UPDATED_BY=?, UPDATED_AT=CURRENT_TIMESTAMP WHERE PRINCIPAL_ID=?")) {
                update.setString(1, actor); update.setLong(2, existingId); update.executeUpdate();
            }
            return findById(connection, existingId);
        }
        List<Long> candidates = pendingCandidates(connection, name);
        if (candidates.size() == 1) {
            long id = candidates.get(0);
            try (PreparedStatement update = connection.prepareStatement(
                "UPDATE KC_PLATFORM_PRINCIPAL SET CAS_LOGIN_NAME=?, FIRST_LOGIN_AT=CURRENT_TIMESTAMP, "
                    + "LAST_LOGIN_AT=CURRENT_TIMESTAMP, STATE='ACTIVE', ROW_VERSION=ROW_VERSION+1, UPDATED_BY=?, UPDATED_AT=CURRENT_TIMESTAMP "
                    + "WHERE PRINCIPAL_ID=? AND CAS_LOGIN_NAME IS NULL")) {
                update.setString(1, login); update.setString(2, actor); update.setLong(3, id);
                if (update.executeUpdate() != 1) throw new SQLException("CAS_LOGIN_BIND_CONFLICT");
            }
            return findById(connection, id);
        }
        if (candidates.size() > 1) throw new SQLException("CAS_PRINCIPAL_AMBIGUOUS");
        if (allowCreate) return create(connection, name, login, "ACTIVE", actor);
        throw new SQLException("CAS_PRINCIPAL_NOT_FOUND");
    }

    Map<String, Object> importPerson(Connection connection, String displayName, String casLoginName, String state, String actor) throws SQLException {
        String name = required(displayName, "PERSONNEL_NAME_REQUIRED");
        String login = optional(casLoginName);
        if (login != null) {
            Map<String, Object> existing = findByLogin(connection, login, false);
            if (existing != null) {
                if (!name.equals(existing.get("displayName"))) throw new SQLException("CAS_LOGIN_NAME_CONFLICT");
                return update(connection, ((Number) existing.get("principalId")).longValue(), name, login,
                    state, ((Number) existing.get("rowVersion")).longValue(), actor);
            }
            return syncCasLogin(connection, login, name, actor, true);
        }
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT " + PROJECTION + " FROM KC_PLATFORM_PRINCIPAL P WHERE P.DISPLAY_NAME=? AND P.CAS_LOGIN_NAME IS NULL ORDER BY P.PRINCIPAL_ID")) {
            query.setString(1, name);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) {
                    Map<String, Object> existing = project(result);
                    return update(connection, ((Number) existing.get("principalId")).longValue(), name, null,
                        state, ((Number) existing.get("rowVersion")).longValue(), actor);
                }
            }
        }
        return create(connection, name, null, state, actor);
    }

    Map<String, Object> update(Connection connection, long id, String displayName, String casLoginName,
                               String state, long expectedRowVersion, String actor) throws SQLException {
        String name = required(displayName, "PERSONNEL_NAME_REQUIRED");
        String login = optional(casLoginName);
        String normalizedState = normalizeState(state);
        Map<String, Object> existing = findById(connection, id, true);
        if (existing == null) throw new SQLException("PERSONNEL_NOT_FOUND");
        long currentVersion = ((Number) existing.get("rowVersion")).longValue();
        if (expectedRowVersion != currentVersion) throw new SQLException("PERSONNEL_VERSION_CONFLICT");
        String currentLogin = optional(String.valueOf(existing.get("casLoginName") == null ? "" : existing.get("casLoginName")));
        if (currentLogin != null && !currentLogin.equals(login)) throw new SQLException("CAS_LOGIN_NAME_IMMUTABLE");
        if (currentLogin == null && login != null) {
            Map<String, Object> conflict = findByLogin(connection, login, false);
            if (conflict != null && ((Number) conflict.get("principalId")).longValue() != id) throw new SQLException("CAS_LOGIN_NAME_CONFLICT");
        }
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_PLATFORM_PRINCIPAL SET DISPLAY_NAME=?, CAS_LOGIN_NAME=?, STATE=?, ROW_VERSION=ROW_VERSION+1, "
                + "UPDATED_BY=?, UPDATED_AT=CURRENT_TIMESTAMP WHERE PRINCIPAL_ID=? AND ROW_VERSION=?")) {
            update.setString(1, name);
            if (login == null) update.setNull(2, java.sql.Types.VARCHAR); else update.setString(2, login);
            update.setString(3, normalizedState); update.setString(4, actor); update.setLong(5, id); update.setLong(6, expectedRowVersion);
            if (update.executeUpdate() != 1) throw new SQLException("PERSONNEL_VERSION_CONFLICT");
        }
        return findById(connection, id);
    }

    Map<String, Object> findById(Connection connection, long id) throws SQLException {
        return findById(connection, id, false);
    }

    private Map<String, Object> findById(Connection connection, long id, boolean lock) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT " + PROJECTION + " FROM KC_PLATFORM_PRINCIPAL P WHERE P.PRINCIPAL_ID=?" + (lock ? " FOR UPDATE" : ""))) {
            query.setLong(1, id);
            try (ResultSet result = query.executeQuery()) { return result.next() ? project(result) : null; }
        }
    }

    private Map<String, Object> findByLogin(Connection connection, String login, boolean lock) throws SQLException {
        String sql = "SELECT " + PROJECTION + " FROM KC_PLATFORM_PRINCIPAL P WHERE P.CAS_LOGIN_NAME=?" + (lock ? " FOR UPDATE" : "");
        try (PreparedStatement query = connection.prepareStatement(sql)) {
            query.setString(1, login);
            try (ResultSet result = query.executeQuery()) { return result.next() ? project(result) : null; }
        }
    }

    private Long findIdByLogin(Connection connection, String login, boolean lock) throws SQLException {
        String sql = "SELECT PRINCIPAL_ID FROM KC_PLATFORM_PRINCIPAL WHERE CAS_LOGIN_NAME=?" + (lock ? " FOR UPDATE" : "");
        try (PreparedStatement query = connection.prepareStatement(sql)) {
            query.setString(1, login);
            try (ResultSet result = query.executeQuery()) { return result.next() ? result.getLong(1) : null; }
        }
    }

    private List<Long> pendingCandidates(Connection connection, String displayName) throws SQLException {
        String matchName = matchName(displayName);
        List<Long> ids = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT PRINCIPAL_ID, DISPLAY_NAME FROM KC_PLATFORM_PRINCIPAL WHERE CAS_LOGIN_NAME IS NULL AND STATE='ACTIVE' FOR UPDATE");
             ResultSet result = query.executeQuery()) {
            while (result.next()) if (matchName(result.getString(2)).equals(matchName)) ids.add(result.getLong(1));
        }
        return ids;
    }

    static String matchName(String value) {
        return String.valueOf(value == null ? "" : value).trim()
            .replaceAll("\\s*[\\(\uff08][^\\)\uff09]*[\\)\uff09]\\s*$", "").trim();
    }

    private static Map<String, Object> project(ResultSet result) throws SQLException {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("principalId", result.getLong(1));
        item.put("displayName", result.getString(2));
        item.put("casLoginName", result.getString(3));
        item.put("state", result.getString(4));
        item.put("firstLoginAt", timestamp(result.getTimestamp(5)));
        item.put("lastLoginAt", timestamp(result.getTimestamp(6)));
        item.put("rowVersion", result.getLong(7));
        item.put("manualReferenceCount", result.getLong(8));
        item.put("loginStatus", result.getString(3) == null ? "PENDING" : "BOUND");
        return item;
    }

    private static Map<String, Object> summary(Connection connection) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT COUNT(*), SUM(CASE WHEN CAS_LOGIN_NAME IS NOT NULL THEN 1 ELSE 0 END), "
                + "SUM(CASE WHEN CAS_LOGIN_NAME IS NULL THEN 1 ELSE 0 END), SUM(CASE WHEN STATE='INACTIVE' THEN 1 ELSE 0 END) "
                + "FROM KC_PLATFORM_PRINCIPAL"); ResultSet result = query.executeQuery()) {
            result.next();
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("total", result.getLong(1)); summary.put("bound", result.getLong(2));
            summary.put("pending", result.getLong(3)); summary.put("inactive", result.getLong(4));
            return summary;
        }
    }

    private static String normalizeState(String value) throws SQLException {
        String state = value == null || value.isBlank() ? "ACTIVE" : value.trim().toUpperCase(Locale.ROOT);
        if (!"ACTIVE".equals(state) && !"INACTIVE".equals(state)) throw new SQLException("PERSONNEL_STATE_INVALID");
        return state;
    }

    private static String required(String value, String code) throws SQLException {
        String normalized = optional(value);
        if (normalized == null) throw new SQLException(code);
        return normalized;
    }

    private static String optional(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static String timestamp(Timestamp value) { return value == null ? null : value.toInstant().toString(); }
}

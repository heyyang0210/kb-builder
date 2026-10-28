import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** 认证权限业务事实 Repository；不管理会话、Ticket 或审计文件。 */
final class PlatformAuthRepository {
    Map<String, Object> listUsers(Connection connection) throws SQLException {
        Map<Long, UserGrants> grantsByUser = listUserGrants(connection);
        List<Map<String, Object>> users = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT U.AUTH_USER_ID,U.USER_KEY,U.PRINCIPAL_ID,U.CAS_LOGIN_NAME,U.STATE,U.ROW_VERSION," +
                "U.CREATED_AT,U.UPDATED_AT,P.DISPLAY_NAME " +
                "FROM KC_AUTH_USER U JOIN KC_PLATFORM_PRINCIPAL P ON P.PRINCIPAL_ID=U.PRINCIPAL_ID " +
                "ORDER BY P.DISPLAY_NAME,U.AUTH_USER_ID");
             ResultSet result = query.executeQuery()) {
            while (result.next()) users.add(projectUser(result, grantsByUser.getOrDefault(result.getLong(1), new UserGrants())));
        }
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("items", users);
        data.put("total", users.size());
        data.put("assignableRoles", roleCodes(connection));
        data.put("generatedAt", Instant.now().toString());
        return data;
    }

    Map<String, Object> findUser(Connection connection, String keyOrLogin) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT U.AUTH_USER_ID,U.USER_KEY,U.PRINCIPAL_ID,U.CAS_LOGIN_NAME,U.STATE,U.ROW_VERSION," +
                "U.CREATED_AT,U.UPDATED_AT,P.DISPLAY_NAME " +
                "FROM KC_AUTH_USER U JOIN KC_PLATFORM_PRINCIPAL P ON P.PRINCIPAL_ID=U.PRINCIPAL_ID " +
                "WHERE U.USER_KEY=? OR U.CAS_LOGIN_NAME=?")) {
            query.setString(1, keyOrLogin); query.setString(2, keyOrLogin);
            try (ResultSet result = query.executeQuery()) {
                return result.next() ? projectUser(connection, result) : null;
            }
        }
    }

    Map<String, Object> upsertCasUser(Connection connection, long principalId, String loginName,
                                      String actor) throws SQLException {
        String login = required(loginName, "CAS_LOGIN_NAME_REQUIRED");
        Map<String, Object> principal = principal(connection, principalId);
        if (principal == null) throw new SQLException("CAS_PRINCIPAL_NOT_FOUND");
        if (!"ACTIVE".equals(principal.get("state"))) throw new SQLException("CAS_PRINCIPAL_INACTIVE");
        String principalLogin = String.valueOf(principal.get("casLoginName") == null ? "" : principal.get("casLoginName"));
        if (!login.equals(principalLogin)) throw new SQLException("CAS_LOGIN_BIND_CONFLICT");

        Map<String, Object> existing = findUser(connection, login);
        if (existing != null) {
            if (((Number) existing.get("principalId")).longValue() != principalId) throw new SQLException("CAS_LOGIN_BIND_CONFLICT");
            return existing;
        }
        try (PreparedStatement conflict = connection.prepareStatement(
            "SELECT USER_KEY FROM KC_AUTH_USER WHERE PRINCIPAL_ID=? FOR UPDATE")) {
            conflict.setLong(1, principalId);
            try (ResultSet result = conflict.executeQuery()) {
                if (result.next()) throw new SQLException("CAS_LOGIN_BIND_CONFLICT");
            }
        }
        String userKey = "usr_" + UUID.randomUUID().toString().replace("-", "");
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_AUTH_USER(USER_KEY,PRINCIPAL_ID,CAS_LOGIN_NAME,STATE,CREATED_BY,UPDATED_BY) " +
                "VALUES (?,?,?,'ACTIVE',?,?)")) {
            insert.setString(1, userKey); insert.setLong(2, principalId); insert.setString(3, login);
            insert.setString(4, actor); insert.setString(5, actor); insert.executeUpdate();
        }
        try (PreparedStatement role = connection.prepareStatement(
            "INSERT INTO KC_AUTH_USER_ROLE(AUTH_USER_ID,AUTH_ROLE_ID,ASSIGNED_BY) " +
                "SELECT U.AUTH_USER_ID,R.AUTH_ROLE_ID,? FROM KC_AUTH_USER U,KC_AUTH_ROLE R " +
                "WHERE U.USER_KEY=? AND R.ROLE_CODE='KNOWLEDGE_EDITOR' AND R.STATE='ACTIVE'")) {
            role.setString(1, actor); role.setString(2, userKey);
            if (role.executeUpdate() != 1) throw new SQLException("AUTH_DEFAULT_ROLE_NOT_FOUND");
        }
        return findUser(connection, userKey);
    }

    Map<String, Object> replaceRoles(Connection connection, String userKey, List<String> requestedRoles,
                                     long expectedRowVersion, String actor) throws SQLException {
        LinkedHashSet<String> roles = new LinkedHashSet<>();
        for (String value : requestedRoles) if (value != null && !value.trim().isEmpty()) roles.add(value.trim());
        if (roles.isEmpty()) throw new SQLException("ROLE_REQUIRED");

        long authUserId;
        long currentVersion;
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT AUTH_USER_ID,ROW_VERSION FROM KC_AUTH_USER WHERE USER_KEY=? FOR UPDATE")) {
            query.setString(1, userKey);
            try (ResultSet result = query.executeQuery()) {
                if (!result.next()) throw new SQLException("AUTH_USER_NOT_FOUND");
                authUserId = result.getLong(1); currentVersion = result.getLong(2);
            }
        }
        if (currentVersion != expectedRowVersion) throw new SQLException("ROW_VERSION_CONFLICT");

        Map<String, Long> roleIds = new LinkedHashMap<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT AUTH_ROLE_ID,ROLE_CODE FROM KC_AUTH_ROLE WHERE STATE='ACTIVE'")) {
            try (ResultSet result = query.executeQuery()) {
                while (result.next()) roleIds.put(result.getString(2), result.getLong(1));
            }
        }
        for (String role : roles) if (!roleIds.containsKey(role)) throw new SQLException("ROLE_INVALID");
        try (PreparedStatement delete = connection.prepareStatement("DELETE FROM KC_AUTH_USER_ROLE WHERE AUTH_USER_ID=?")) {
            delete.setLong(1, authUserId); delete.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_AUTH_USER_ROLE(AUTH_USER_ID,AUTH_ROLE_ID,ASSIGNED_BY) VALUES (?,?,?)")) {
            for (String role : roles) {
                insert.setLong(1, authUserId); insert.setLong(2, roleIds.get(role)); insert.setString(3, actor);
                insert.addBatch();
            }
            insert.executeBatch();
        }
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_AUTH_USER SET ROW_VERSION=ROW_VERSION+1,UPDATED_BY=?,UPDATED_AT=CURRENT_TIMESTAMP " +
                "WHERE AUTH_USER_ID=? AND ROW_VERSION=?")) {
            update.setString(1, actor); update.setLong(2, authUserId); update.setLong(3, expectedRowVersion);
            if (update.executeUpdate() != 1) throw new SQLException("ROW_VERSION_CONFLICT");
        }
        return findUser(connection, userKey);
    }

    private Map<String, Object> projectUser(Connection connection, ResultSet result) throws SQLException {
        long authUserId = result.getLong(1);
        UserGrants profile = new UserGrants();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT R.ROLE_CODE,G.GRANT_TYPE,G.GRANT_CODE FROM KC_AUTH_USER_ROLE UR " +
                "JOIN KC_AUTH_ROLE R ON R.AUTH_ROLE_ID=UR.AUTH_ROLE_ID " +
                "LEFT JOIN KC_AUTH_ROLE_GRANT G ON G.AUTH_ROLE_ID=R.AUTH_ROLE_ID " +
                "WHERE UR.AUTH_USER_ID=? AND R.STATE='ACTIVE' ORDER BY R.ROLE_CODE,G.GRANT_TYPE,G.GRANT_CODE")) {
            query.setLong(1, authUserId);
            try (ResultSet grants = query.executeQuery()) {
                String lastRole = null;
                while (grants.next()) {
                    String role = grants.getString(1);
                    if (!role.equals(lastRole)) { profile.roles.add(role); lastRole = role; }
                    String type = grants.getString(2); String code = grants.getString(3);
                    if ("MODULE".equals(type) && code != null) profile.modules.add(code);
                    if ("ACTION".equals(type) && code != null) profile.actions.add(code);
                }
            }
        }
        return projectUser(result, profile);
    }

    private Map<String, Object> projectUser(ResultSet result, UserGrants profile) throws SQLException {
        Map<String, Object> user = new LinkedHashMap<>();
        user.put("id", result.getString(2));
        user.put("userKey", result.getString(2));
        user.put("principalId", result.getLong(3));
        user.put("loginName", result.getString(4));
        // The projection selects nine columns; using index 10 caused every CAS
        // login to fail after the principal was successfully synchronized.
        user.put("displayName", result.getString(9));
        user.put("identitySource", "cas");
        user.put("enabled", "ACTIVE".equals(result.getString(5)));
        user.put("state", result.getString(5));
        user.put("rowVersion", result.getLong(6));
        user.put("roles", new ArrayList<>(profile.roles));
        user.put("visibleModules", new ArrayList<>(profile.modules));
        user.put("allowedActions", new ArrayList<>(profile.actions));
        user.put("managementSource", "database");
        user.put("rolesEditable", true);
        user.put("createdAt", result.getTimestamp(7).toInstant().toString());
        user.put("updatedAt", result.getTimestamp(8).toInstant().toString());
        return user;
    }

    private static final class UserGrants {
        final Set<String> roles = new LinkedHashSet<>();
        final Set<String> modules = new LinkedHashSet<>();
        final Set<String> actions = new LinkedHashSet<>();
    }

    private Map<Long, UserGrants> listUserGrants(Connection connection) throws SQLException {
        Map<Long, UserGrants> profiles = new LinkedHashMap<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT UR.AUTH_USER_ID,R.ROLE_CODE,G.GRANT_TYPE,G.GRANT_CODE FROM KC_AUTH_USER_ROLE UR " +
                "JOIN KC_AUTH_ROLE R ON R.AUTH_ROLE_ID=UR.AUTH_ROLE_ID " +
                "LEFT JOIN KC_AUTH_ROLE_GRANT G ON G.AUTH_ROLE_ID=R.AUTH_ROLE_ID " +
                "WHERE R.STATE='ACTIVE' ORDER BY UR.AUTH_USER_ID,R.ROLE_CODE,G.GRANT_TYPE,G.GRANT_CODE");
             ResultSet grants = query.executeQuery()) {
            while (grants.next()) {
                UserGrants profile = profiles.computeIfAbsent(grants.getLong(1), id -> new UserGrants());
                profile.roles.add(grants.getString(2));
                String type = grants.getString(3); String code = grants.getString(4);
                if ("MODULE".equals(type) && code != null) profile.modules.add(code);
                if ("ACTION".equals(type) && code != null) profile.actions.add(code);
            }
        }
        return profiles;
    }

    private List<String> roleCodes(Connection connection) throws SQLException {
        List<String> roles = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT ROLE_CODE FROM KC_AUTH_ROLE WHERE STATE='ACTIVE' ORDER BY ROLE_CODE");
             ResultSet result = query.executeQuery()) {
            while (result.next()) roles.add(result.getString(1));
        }
        return roles;
    }

    private Map<String, Object> principal(Connection connection, long id) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT PRINCIPAL_ID,CAS_LOGIN_NAME,STATE FROM KC_PLATFORM_PRINCIPAL WHERE PRINCIPAL_ID=? FOR UPDATE")) {
            query.setLong(1, id);
            try (ResultSet result = query.executeQuery()) {
                if (!result.next()) return null;
                Map<String, Object> value = new LinkedHashMap<>();
                value.put("principalId", result.getLong(1)); value.put("casLoginName", result.getString(2));
                value.put("state", result.getString(3)); return value;
            }
        }
    }

    private static String required(String value, String code) throws SQLException {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) throw new SQLException(code);
        return normalized;
    }
}

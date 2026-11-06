import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

public final class PlatformAuthRepositoryCheck {
    static final class Principal {
        final long id;
        final String name;
        String login;
        String state;
        Principal(long id, String name, String login, String state) {
            this.id = id; this.name = name; this.login = login; this.state = state;
        }
    }

    static final class User {
        final long id;
        final String key;
        final long principalId;
        final String login;
        long version = 1;
        String state = "ACTIVE";
        final Timestamp createdAt = Timestamp.from(Instant.now());
        Timestamp updatedAt = createdAt;
        User(long id, String key, long principalId, String login) {
            this.id = id; this.key = key; this.principalId = principalId; this.login = login;
        }
    }

    static final class Database {
        final Map<Long, Principal> principals = new LinkedHashMap<>();
        final List<User> users = new ArrayList<>();
        final Map<Long, LinkedHashSet<String>> userRoles = new HashMap<>();
        final Map<String, Long> roles = Map.of("KNOWLEDGE_EDITOR", 1L, "REVIEWER", 2L);
        long nextUserId = 1;
        boolean defaultRoleAvailable = true;
        boolean failVersionUpdate;

        @SuppressWarnings("unchecked")
        <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
            return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler);
        }

        ResultSet rows(List<Object[]> values) {
            int[] position = {-1};
            return proxy(ResultSet.class, (object, method, args) -> {
                if (method.getName().equals("next")) return ++position[0] < values.size();
                if (method.getName().startsWith("get")) {
                    Object value = values.get(position[0])[(Integer) args[0] - 1];
                    if (method.getName().equals("getLong")) return value == null ? 0L : ((Number) value).longValue();
                    if (method.getName().equals("getString")) return value == null ? null : value.toString();
                    return value;
                }
                return null;
            });
        }

        List<Object[]> grantRows(long userId, boolean includeUserId) {
            List<Object[]> values = new ArrayList<>();
            for (String role : userRoles.getOrDefault(userId, new LinkedHashSet<>())) {
                if ("KNOWLEDGE_EDITOR".equals(role)) {
                    values.add(includeUserId ? new Object[]{userId, role, "MODULE", "production"} :
                        new Object[]{role, "MODULE", "production"});
                    values.add(includeUserId ? new Object[]{userId, role, "ACTION", "knowledge:read"} :
                        new Object[]{role, "ACTION", "knowledge:read"});
                    values.add(includeUserId ? new Object[]{userId, role, "MODULE", null} :
                        new Object[]{role, "MODULE", null});
                    values.add(includeUserId ? new Object[]{userId, role, "ACTION", null} :
                        new Object[]{role, "ACTION", null});
                } else {
                    values.add(includeUserId ? new Object[]{userId, role, "ACTION", "review:manage"} :
                        new Object[]{role, "ACTION", "review:manage"});
                }
            }
            return values;
        }

        Object[] userRow(User user) {
            Principal principal = principals.get(user.principalId);
            return new Object[]{user.id, user.key, user.principalId, user.login, user.state, user.version,
                user.createdAt, user.updatedAt, principal.name};
        }

        List<Object[]> select(String sql, Map<Integer, Object> binds) {
            if (sql.startsWith("SELECT PRINCIPAL_ID,CAS_LOGIN_NAME,STATE")) {
                Principal principal = principals.get(binds.get(1));
                return principal == null ? List.of() : List.<Object[]>of(new Object[]{principal.id, principal.login, principal.state});
            }
            if (sql.startsWith("SELECT USER_KEY FROM KC_AUTH_USER")) return users.stream()
                .filter(user -> user.principalId == ((Number) binds.get(1)).longValue())
                .map(user -> new Object[]{user.key}).toList();
            if (sql.startsWith("SELECT AUTH_USER_ID,ROW_VERSION")) return users.stream()
                .filter(user -> user.key.equals(binds.get(1)))
                .map(user -> new Object[]{user.id, user.version}).toList();
            if (sql.startsWith("SELECT AUTH_ROLE_ID,ROLE_CODE")) return roles.entrySet().stream()
                .map(entry -> new Object[]{entry.getValue(), entry.getKey()}).toList();
            if (sql.startsWith("SELECT ROLE_CODE FROM KC_AUTH_ROLE")) return roles.keySet().stream()
                .map(role -> new Object[]{role}).toList();
            if (sql.startsWith("SELECT UR.AUTH_USER_ID,R.ROLE_CODE")) {
                List<Object[]> values = new ArrayList<>();
                for (User user : users) values.addAll(grantRows(user.id, true));
                return values;
            }
            if (sql.startsWith("SELECT R.ROLE_CODE,G.GRANT_TYPE"))
                return grantRows(((Number) binds.get(1)).longValue(), false);
            if (sql.startsWith("SELECT U.AUTH_USER_ID")) return users.stream()
                .filter(user -> !sql.contains("WHERE U.USER_KEY") ||
                    user.key.equals(binds.get(1)) || user.login.equals(binds.get(2)))
                .map(this::userRow).toList();
            throw new AssertionError("unexpected query: " + sql);
        }

        int mutate(String sql, Map<Integer, Object> binds) {
            if (sql.startsWith("INSERT INTO KC_AUTH_USER(")) {
                User user = new User(nextUserId++, String.valueOf(binds.get(1)),
                    ((Number) binds.get(2)).longValue(), String.valueOf(binds.get(3)));
                users.add(user);
                userRoles.put(user.id, new LinkedHashSet<>());
                return 1;
            }
            if (sql.startsWith("INSERT INTO KC_AUTH_USER_ROLE") && sql.contains("SELECT U.AUTH_USER_ID")) {
                if (!defaultRoleAvailable) return 0;
                User user = users.stream().filter(item -> item.key.equals(binds.get(2))).findFirst().orElseThrow();
                userRoles.get(user.id).add("KNOWLEDGE_EDITOR");
                return 1;
            }
            if (sql.startsWith("DELETE FROM KC_AUTH_USER_ROLE")) {
                userRoles.get(((Number) binds.get(1)).longValue()).clear();
                return 1;
            }
            if (sql.startsWith("UPDATE KC_AUTH_USER")) {
                if (failVersionUpdate) { failVersionUpdate = false; return 0; }
                User user = users.stream().filter(item -> item.id == ((Number) binds.get(2)).longValue()).findFirst().orElseThrow();
                if (user.version != ((Number) binds.get(3)).longValue()) return 0;
                user.version++;
                user.updatedAt = Timestamp.from(Instant.now());
                return 1;
            }
            throw new AssertionError("unexpected mutation: " + sql);
        }

        Connection connection() {
            return proxy(Connection.class, (object, method, args) -> {
                if (method.getName().equals("isClosed")) return false;
                if (method.getName().equals("createStatement")) return proxy(java.sql.Statement.class, (statement, call, values) -> {
                    if (call.getName().equals("executeQuery")) return rows(List.<Object[]>of(new Object[]{1L}));
                    return null;
                });
                if (!method.getName().equals("prepareStatement")) return null;
                String sql = String.valueOf(args[0]);
                Map<Integer, Object> binds = new HashMap<>();
                List<Map<Integer, Object>> batches = new ArrayList<>();
                return proxy(PreparedStatement.class, (statement, call, values) -> {
                    if (call.getName().startsWith("set")) { binds.put((Integer) values[0], values[1]); return null; }
                    if (call.getName().equals("executeQuery")) return rows(select(sql, binds));
                    if (call.getName().equals("executeUpdate")) return mutate(sql, binds);
                    if (call.getName().equals("addBatch")) { batches.add(new HashMap<>(binds)); return null; }
                    if (call.getName().equals("executeBatch")) {
                        if (!sql.startsWith("INSERT INTO KC_AUTH_USER_ROLE")) throw new AssertionError(sql);
                        for (Map<Integer, Object> batch : batches) {
                            String role = roles.entrySet().stream()
                                .filter(entry -> entry.getValue().equals(batch.get(2)))
                                .map(Map.Entry::getKey).findFirst().orElseThrow();
                            userRoles.get(((Number) batch.get(1)).longValue()).add(role);
                        }
                        return new int[batches.size()];
                    }
                    return null;
                });
            });
        }
    }

    private interface SqlCall { void run() throws Exception; }

    private static void rejected(String code, SqlCall call) throws Exception {
        try { call.run(); throw new AssertionError("accepted: " + code); }
        catch (SQLException expected) { if (!code.equals(expected.getMessage())) throw expected; }
    }

    public static void main(String[] args) throws Exception {
        Database database = new Database();
        database.principals.put(1L, new Principal(1L, "何阳", "heyang", "ACTIVE"));
        database.principals.put(2L, new Principal(2L, "其他", "other", "INACTIVE"));
        database.principals.put(3L, new Principal(3L, "未绑定", null, "ACTIVE"));
        Connection connection = database.connection();
        PlatformAuthRepository repository = new PlatformAuthRepository();
        if (!Integer.valueOf(0).equals(repository.listUsers(connection).get("total")))
            throw new AssertionError("empty user list failed");
        rejected("CAS_LOGIN_NAME_REQUIRED", () -> repository.upsertCasUser(connection, 1, " ", "tester"));
        rejected("CAS_LOGIN_NAME_REQUIRED", () -> repository.upsertCasUser(connection, 1, null, "tester"));
        rejected("CAS_PRINCIPAL_NOT_FOUND", () -> repository.upsertCasUser(connection, 999, "missing", "tester"));
        rejected("CAS_PRINCIPAL_INACTIVE", () -> repository.upsertCasUser(connection, 2, "other", "tester"));
        rejected("CAS_LOGIN_BIND_CONFLICT", () -> repository.upsertCasUser(connection, 3, "unbound", "tester"));
        database.principals.get(2L).state = "ACTIVE";
        rejected("CAS_LOGIN_BIND_CONFLICT", () -> repository.upsertCasUser(connection, 2, "wrong", "tester"));

        Map<String, Object> created = repository.upsertCasUser(connection, 1, "heyang", "tester");
        String key = String.valueOf(created.get("id"));
        if (!((List<?>) created.get("roles")).contains("KNOWLEDGE_EDITOR") ||
            !((List<?>) created.get("visibleModules")).contains("production") ||
            !((List<?>) created.get("allowedActions")).contains("knowledge:read"))
            throw new AssertionError("default grants were not projected: " + created);
        if (!key.equals(repository.upsertCasUser(connection, 1, "heyang", "tester").get("id")))
            throw new AssertionError("CAS sync duplicated existing user");
        if (!Integer.valueOf(1).equals(repository.listUsers(connection).get("total")) ||
            repository.findUser(connection, "missing") != null) throw new AssertionError("user lookup failed");

        rejected("ROLE_REQUIRED", () -> repository.replaceRoles(connection, key, List.of(" "), 1, "tester"));
        if (!List.of("KNOWLEDGE_EDITOR").equals(repository.replaceRoles(connection, key,
            java.util.Arrays.asList(null, "KNOWLEDGE_EDITOR"), 1, "tester").get("roles")))
            throw new AssertionError("null role entry changed grants");
        rejected("AUTH_USER_NOT_FOUND", () -> repository.replaceRoles(connection, "missing", List.of("REVIEWER"), 1, "tester"));
        rejected("ROW_VERSION_CONFLICT", () -> repository.replaceRoles(connection, key, List.of("REVIEWER"), 0, "tester"));
        rejected("ROLE_INVALID", () -> repository.replaceRoles(connection, key, List.of("UNKNOWN"), 2, "tester"));
        Map<String, Object> changed = repository.replaceRoles(connection, key,
            List.of("REVIEWER", "REVIEWER", " "), 2, "tester");
        if (!List.of("REVIEWER").equals(changed.get("roles")) ||
            !List.of("review:manage").equals(changed.get("allowedActions")) ||
            ((Number) changed.get("rowVersion")).longValue() != 3)
            throw new AssertionError("role replacement or grant projection failed: " + changed);
        database.failVersionUpdate = true;
        rejected("ROW_VERSION_CONFLICT", () -> repository.replaceRoles(connection, key, List.of("KNOWLEDGE_EDITOR"), 3, "tester"));

        database.principals.get(2L).login = "heyang";
        rejected("CAS_LOGIN_BIND_CONFLICT", () -> repository.upsertCasUser(connection, 2, "heyang", "tester"));
        database.principals.get(2L).login = "other";
        database.defaultRoleAvailable = false;
        rejected("AUTH_DEFAULT_ROLE_NOT_FOUND", () -> repository.upsertCasUser(connection, 2, "other", "tester"));
        database.principals.get(1L).login = "changed";
        rejected("CAS_LOGIN_BIND_CONFLICT", () -> repository.upsertCasUser(connection, 1, "changed", "tester"));
        System.out.println("PASS: CAS user sync, grants, role replacement and conflict boundaries");
    }
}

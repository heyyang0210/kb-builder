import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class PrincipalRepositoryCheck {
    private static final class Person {
        long id;
        String name;
        String login;
        String state;
        long version = 1;
        Timestamp firstLogin;
        Timestamp lastLogin;

        Object[] projection() {
            return new Object[]{id, name, login, state, firstLogin, lastLogin, version, 0L};
        }
    }

    static final class Database {
        final List<Person> people = new ArrayList<>();
        long nextId = 1;
        boolean failNextInsert;
        boolean omitNextInsert;
        boolean failNextBind;
        boolean failNextUpdate;
        final Map<String, String> batches = new HashMap<>();

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
                    return value;
                }
                return null;
            });
        }

        List<Object[]> select(String sql, Map<Integer, Object> binds) {
            if (sql.startsWith("SELECT STATUS FROM KC_MIGRATION_BATCH")) {
                String status = batches.get(String.valueOf(binds.get(1)));
                return status == null ? List.of() : List.<Object[]>of(new Object[]{status});
            }
            if (sql.startsWith("SELECT COUNT(*)")) {
                long bound = people.stream().filter(person -> person.login != null).count();
                long inactive = people.stream().filter(person -> "INACTIVE".equals(person.state)).count();
                return List.<Object[]>of(new Object[]{(long) people.size(), bound, people.size() - bound, inactive});
            }
            if (sql.startsWith("SELECT PRINCIPAL_ID, DISPLAY_NAME")) return people.stream()
                .filter(person -> person.login == null && "ACTIVE".equals(person.state))
                .map(person -> new Object[]{person.id, person.name}).toList();
            if (sql.startsWith("SELECT PRINCIPAL_ID FROM")) return people.stream()
                .filter(person -> String.valueOf(binds.get(1)).equals(person.login))
                .map(person -> new Object[]{person.id}).toList();
            if (!sql.contains("FROM KC_PLATFORM_PRINCIPAL P")) throw new AssertionError("unexpected SQL: " + sql);
            int stateParameter = sql.contains("LIKE ?") ? 3 : 1;
            return people.stream().filter(person -> {
                if (sql.contains("P.PRINCIPAL_ID=?") && person.id != ((Number) binds.get(1)).longValue()) return false;
                if (sql.contains("P.CAS_LOGIN_NAME=?") && !String.valueOf(binds.get(1)).equals(person.login)) return false;
                if (sql.contains("P.DISPLAY_NAME=?") && (!String.valueOf(binds.get(1)).equals(person.name) || person.login != null)) return false;
                if (sql.contains("LIKE ?") && !person.name.toLowerCase().contains(String.valueOf(binds.get(1)).replace("%", "")) &&
                    (person.login == null || !person.login.toLowerCase().contains(String.valueOf(binds.get(1)).replace("%", "")))) return false;
                if (sql.contains("P.STATE = ?") && !String.valueOf(binds.get(stateParameter)).equals(person.state)) return false;
                if (sql.contains("P.CAS_LOGIN_NAME IS NOT NULL") && person.login == null) return false;
                if (sql.contains("P.CAS_LOGIN_NAME IS NULL") && person.login != null) return false;
                return true;
            }).map(Person::projection).toList();
        }

        int mutate(String sql, Map<Integer, Object> binds) throws SQLException {
            if (sql.startsWith("INSERT INTO KC_MIGRATION_BATCH")) {
                batches.put(String.valueOf(binds.get(1)), "COMPLETED");
                return 1;
            }
            if (sql.startsWith("INSERT INTO KC_PLATFORM_PRINCIPAL")) {
                if (failNextInsert) { failNextInsert = false; throw new SQLException("insert failed"); }
                if (omitNextInsert) { omitNextInsert = false; return 1; }
                Person person = new Person();
                person.id = nextId++;
                person.name = String.valueOf(binds.get(1));
                person.login = (String) binds.get(2);
                person.state = String.valueOf(binds.get(3));
                person.firstLogin = (Timestamp) binds.get(4);
                person.lastLogin = (Timestamp) binds.get(5);
                people.add(person);
                return 1;
            }
            if (sql.startsWith("UPDATE KC_PLATFORM_PRINCIPAL SET LAST_LOGIN_AT")) {
                Person person = byId((long) binds.get(2));
                person.lastLogin = Timestamp.from(Instant.now());
                person.state = "ACTIVE";
                person.version++;
                return 1;
            }
            if (sql.startsWith("UPDATE KC_PLATFORM_PRINCIPAL SET CAS_LOGIN_NAME")) {
                if (failNextBind) { failNextBind = false; return 0; }
                Person person = byId((long) binds.get(3));
                if (person.login != null) return 0;
                person.login = (String) binds.get(1);
                person.firstLogin = Timestamp.from(Instant.now());
                person.lastLogin = person.firstLogin;
                person.state = "ACTIVE";
                person.version++;
                return 1;
            }
            if (sql.startsWith("UPDATE KC_PLATFORM_PRINCIPAL SET DISPLAY_NAME")) {
                if (failNextUpdate) { failNextUpdate = false; return 0; }
                Person person = byId((long) binds.get(5));
                if (person.version != (long) binds.get(6)) return 0;
                person.name = String.valueOf(binds.get(1));
                person.login = (String) binds.get(2);
                person.state = String.valueOf(binds.get(3));
                person.version++;
                return 1;
            }
            throw new AssertionError("unexpected mutation: " + sql);
        }

        Person byId(long id) {
            return people.stream().filter(person -> person.id == id).findFirst().orElseThrow();
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
                return proxy(PreparedStatement.class, (statement, call, values) -> {
                    if (call.getName().startsWith("set")) {
                        binds.put((Integer) values[0], call.getName().equals("setNull") ? null : values[1]);
                        return null;
                    }
                    if (call.getName().equals("executeQuery")) return rows(select(sql, binds));
                    if (call.getName().equals("executeUpdate")) return mutate(sql, binds);
                    return null;
                });
            });
        }
    }

    private static void rejected(String code, SqlCall call) throws Exception {
        try { call.run(); throw new AssertionError("accepted: " + code); }
        catch (SQLException expected) { if (!code.equals(expected.getMessage())) throw expected; }
    }

    private interface SqlCall { void run() throws Exception; }

    public static void main(String[] args) throws Exception {
        Database database = new Database();
        Connection connection = database.connection();
        PrincipalRepository repository = new PrincipalRepository();
        if (!((List<?>) repository.list(connection, null, null, null).get("items")).isEmpty())
            throw new AssertionError("empty directory returned people");
        rejected("PERSONNEL_BINDING_STATUS_INVALID", () -> repository.list(connection, "", "", "UNKNOWN"));
        rejected("PERSONNEL_NAME_REQUIRED", () -> repository.create(connection, " ", null, "ACTIVE", "tester"));

        Map<String, Object> pending = repository.create(connection, "何阳（旧）", null, null, "tester");
        long id = ((Number) pending.get("principalId")).longValue();
        if (!"PENDING".equals(pending.get("loginStatus"))) throw new AssertionError(pending);
        Map<String, Object> filtered = repository.list(connection, " 何阳 ", "active", "pending");
        if (!Integer.valueOf(1).equals(filtered.get("total")) ||
            !Long.valueOf(1).equals(((Map<?, ?>) filtered.get("summary")).get("pending")))
            throw new AssertionError("personnel filters or summary failed: " + filtered);
        if (!"何阳".equals(PrincipalRepository.matchName(" 何阳（旧） "))) throw new AssertionError("name matching failed");

        Map<String, Object> bound = repository.syncCasLogin(connection, "heyang", "何阳", "tester");
        if (!"BOUND".equals(bound.get("loginStatus")) || !Long.valueOf(id).equals(bound.get("principalId")))
            throw new AssertionError("CAS binding failed: " + bound);
        Map<String, Object> refreshed = repository.syncCasLogin(connection, "heyang", "何阳", "tester");
        if (((Number) refreshed.get("rowVersion")).longValue() <= ((Number) bound.get("rowVersion")).longValue())
            throw new AssertionError("repeat CAS synchronization did not update version");
        rejected("CAS_PRINCIPAL_NOT_FOUND", () -> repository.syncCasLogin(connection, "unknown", "无人", "tester"));
        rejected("PERSONNEL_VERSION_CONFLICT", () -> repository.update(connection, id, "何阳", "heyang", "ACTIVE", 0, "tester"));
        rejected("CAS_LOGIN_REBIND_REQUIRES_GOVERNANCE", () -> repository.update(connection, id, "何阳", "other", "ACTIVE",
            ((Number) refreshed.get("rowVersion")).longValue(), "tester"));
        Map<String, Object> updated = repository.update(connection, id, "何阳", "heyang", "inactive",
            ((Number) refreshed.get("rowVersion")).longValue(), "tester");
        if (!"INACTIVE".equals(updated.get("state"))) throw new AssertionError("state update failed");
        Map<String, Object> other = repository.create(connection, "另一人", "other", "ACTIVE", "tester");
        if (!"BOUND".equals(other.get("loginStatus"))) throw new AssertionError("bound create failed");
        rejected("CAS_LOGIN_NAME_CONFLICT", () -> repository.importPerson(connection, "错名", "other", "ACTIVE", "tester"));
        if (!"INACTIVE".equals(repository.importPerson(connection, "另一人", "other", "INACTIVE", "tester").get("state")))
            throw new AssertionError("existing import did not update state");
        Map<String, Object> imported = repository.importPerson(connection, "新无账号", null, "ACTIVE", "tester");
        long importedId = ((Number) imported.get("principalId")).longValue();
        if (!"INACTIVE".equals(repository.importPerson(connection, "新无账号", null, "INACTIVE", "tester").get("state")))
            throw new AssertionError("pending import did not update state");
        if (!"BOUND".equals(repository.importPerson(connection, "新CAS", "new-login", "ACTIVE", "tester").get("loginStatus")))
            throw new AssertionError("new CAS import did not create principal");
        rejected("PERSONNEL_NOT_FOUND", () -> repository.update(connection, 999, "无", null, "ACTIVE", 1, "tester"));
        rejected("CAS_LOGIN_NAME_REQUIRED", () -> repository.update(connection, id, "何阳", null, "ACTIVE",
            ((Number) updated.get("rowVersion")).longValue(), "tester"));
        rejected("CAS_LOGIN_NAME_CONFLICT", () -> repository.update(connection, importedId, "新无账号", "other", "ACTIVE",
            ((Number) repository.findById(connection, importedId).get("rowVersion")).longValue(), "tester"));
        database.failNextUpdate = true;
        rejected("PERSONNEL_VERSION_CONFLICT", () -> repository.update(connection, importedId, "新无账号", null, "ACTIVE",
            ((Number) repository.findById(connection, importedId).get("rowVersion")).longValue(), "tester"));
        repository.create(connection, "重名（甲）", null, "ACTIVE", "tester");
        repository.create(connection, "重名（乙）", null, "ACTIVE", "tester");
        rejected("CAS_PRINCIPAL_AMBIGUOUS", () -> repository.syncCasLogin(connection, "ambiguous", "重名", "tester"));
        repository.create(connection, "绑定失败（候选）", null, "ACTIVE", "tester");
        database.failNextBind = true;
        rejected("CAS_LOGIN_BIND_CONFLICT", () -> repository.syncCasLogin(connection, "failed-bind", "绑定失败", "tester"));
        database.omitNextInsert = true;
        rejected("PERSONNEL_INSERT_FAILED", () -> repository.create(connection, "未落库", null, "ACTIVE", "tester"));
        database.failNextInsert = true;
        rejected("CAS_LOGIN_NAME_CONFLICT", () -> repository.create(connection, "另一人", "other", "ACTIVE", "tester"));
        database.failNextInsert = true;
        rejected("insert failed", () -> repository.create(connection, "故障", "fresh-login", "ACTIVE", "tester"));
        database.failNextInsert = true;
        rejected("insert failed", () -> repository.create(connection, "无登录名故障", null, "ACTIVE", "tester"));
        rejected("PERSONNEL_STATE_INVALID", () -> repository.create(connection, "无效", null, "BROKEN", "tester"));
        if (!"ACTIVE".equals(repository.create(connection, "空白状态", null, " ", "tester").get("state")))
            throw new AssertionError("blank state did not default to active");
        if (((Number) repository.list(connection, null, null, "BOUND").get("total")).intValue() < 2)
            throw new AssertionError("bound directory filter excluded CAS identities");
        Map<String, Object> oldLogin = repository.create(connection, "可更正", "old-login", "ACTIVE", "tester");
        long correctionId = ((Number) oldLogin.get("principalId")).longValue();
        database.byId(correctionId).firstLogin = null;
        database.byId(correctionId).lastLogin = null;
        Map<String, Object> corrected = repository.update(connection, correctionId, "可更正", "corrected-login", "ACTIVE",
            ((Number) oldLogin.get("rowVersion")).longValue(), "tester");
        if (!"corrected-login".equals(corrected.get("casLoginName"))) throw new AssertionError("pre-login correction failed");
        if (!PrincipalRepository.matchName(null).isEmpty()) throw new AssertionError("null name did not normalize");
        if (repository.findById(connection, 999) != null) throw new AssertionError("missing person resolved");
        System.out.println("PASS: directory filters, CAS binding, versions and state changes");
    }
}

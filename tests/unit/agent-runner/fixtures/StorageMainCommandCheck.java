import java.lang.reflect.Proxy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Logger;

/** Calls real public startup commands in a disposable JVM and fixture JDBC database. */
public final class StorageMainCommandCheck {
    private static final String SQL = "CREATE TABLE KC_SCHEMA_MIGRATION (VERSION_ID VARCHAR(128));";
    private static final Map<String, String> applied = new HashMap<>();
    private static final Set<String> domains = new HashSet<>();
    private static boolean migrationTable;
    private static int commits, closed, migrationStatements, groups, inserts;
    private static String scenario;
    private static volatile SQLException queryFailure;
    private static volatile boolean runtimeFailure;

    private static void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
    }
    private static Object zero(Class<?> type) {
        if (type == boolean.class) return false;
        if (type == int.class) return 0;
        if (type == long.class) return 0L;
        return null;
    }
    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler));
    }
    private static ResultSet rows(Object[]... values) {
        int[] cursor = {-1};
        return proxy(ResultSet.class, (self, method, args) -> {
            switch (method.getName()) {
                case "next": return ++cursor[0] < values.length;
                case "getString": return String.valueOf(values[cursor[0]][(Integer) args[0] - 1]);
                case "getLong": return ((Number) values[cursor[0]][(Integer) args[0] - 1]).longValue();
                case "getInt": return ((Number) values[cursor[0]][(Integer) args[0] - 1]).intValue();
                default: return zero(method.getReturnType());
            }
        });
    }
    private static PreparedStatement query(String sql) {
        Map<Integer, Object> binds = new HashMap<>();
        return proxy(PreparedStatement.class, (self, method, args) -> {
            if (method.getName().equals("setString") || method.getName().equals("setLong")) {
                binds.put((Integer) args[0], args[1]); return null;
            }
            if (method.getName().equals("executeQuery")) {
                if (runtimeFailure) throw new IllegalStateException("fixture runtime failure");
                if (queryFailure != null) throw queryFailure;
                if (sql.contains("USER_TABLES")) return rows(new Object[]{migrationTable ? 1L : 0L});
                if (sql.contains("USER_IND_COLUMNS")) {
                    check("KC_EXAMPLE".equals(binds.get(1)), "equivalent index table binding");
                    if (scenario.equals("migrate-index-conflict"))
                        return rows(new Object[]{"KC_EXISTING_IDX", "COL_A"});
                    return rows(new Object[]{"KC_EXISTING_IDX", "COL_A"},
                        new Object[]{"KC_EXISTING_IDX", "COL_B"});
                }
                if (sql.contains("SELECT CHECKSUM")) {
                    String checksum = applied.get(binds.get(1));
                    return checksum == null ? rows() : rows(new Object[]{checksum});
                }
                if (sql.startsWith("SELECT TECH_DOMAIN_ID")) return domains.contains(binds.get(1)) ? rows(new Object[]{1L}) : rows();
                if (sql.contains("KC_RESPONSIBILITY_SEQ.NEXTVAL")) return rows(new Object[]{42L});
                if (sql.startsWith("SELECT PAYLOAD, REVISION, DELETED")) return rows();
                throw new AssertionError("unexpected query: " + sql);
            }
            if (method.getName().equals("executeUpdate")) {
                if (sql.startsWith("INSERT INTO KC_SCHEMA_MIGRATION")) applied.put((String) binds.get(1), (String) binds.get(2));
                else if (sql.startsWith("INSERT INTO KC_TEAM_GROUP")) {
                    groups++; check(binds.get(1).equals(42L), "seed sequence bind");
                    check(binds.get(2).equals("TECH_DOMAIN:NEW") || binds.get(2).equals("TECH_DOMAIN:fallback"), "seed group code");
                    check(binds.get(3).equals("新领域") || binds.get(3).equals("fallback"), "seed group name");
                } else if (sql.startsWith("INSERT INTO KC_TECH_DOMAIN")) {
                    inserts++; domains.add((String) binds.get(1));
                    check(binds.get(3).equals(42L), "seed domain references group");
                } else throw new AssertionError("unexpected update: " + sql);
                return 1;
            }
            return zero(method.getReturnType());
        });
    }
    private static Statement statement() {
        return proxy(Statement.class, (self, method, args) -> {
            if (method.getName().equals("execute")) {
                String sql = String.valueOf(args[0]);
                if (sql.startsWith("CREATE TABLE KC_SCHEMA_MIGRATION")) {
                    migrationTable = true; migrationStatements++; return true;
                }
                if ((scenario.equals("migrate-index-equivalent") || scenario.equals("migrate-index-conflict"))
                    && sql.equals("CREATE INDEX KC_NEW_IDX ON KC_EXAMPLE (COL_A,COL_B)")) {
                    migrationStatements++;
                    throw new SQLException("YAS-02043: equivalent index already exists");
                }
                throw new AssertionError("unexpected migration SQL: " + sql);
            }
            if (method.getName().equals("executeQuery")) return rows(new Object[]{1});
            return zero(method.getReturnType());
        });
    }
    private static Connection connection() {
        return proxy(Connection.class, (self, method, args) -> {
            switch (method.getName()) {
                case "prepareStatement": return query((String) args[0]);
                case "createStatement": return statement();
                case "commit": commits++; return null;
                case "close": closed++; return null;
                case "getMetaData": return proxy(DatabaseMetaData.class, (db, getter, params) ->
                    getter.getReturnType() == String.class ? "fixture" : zero(getter.getReturnType()));
                default: return zero(method.getReturnType());
            }
        });
    }
    private static void assertFinished(boolean failed) {
        check(closed > 0, "command must close physical JDBC resources");
        if (scenario.startsWith("migrate")) {
            int expectedStatements = scenario.equals("migrate-index-equivalent") ? 2 : 1;
            check(migrationStatements == expectedStatements && applied.size() == 1,
                "migration must execute and record exactly once");
            check(commits == (failed ? 1 : 2), "migration/seed commit boundary: " + commits);
            int expected = scenario.equals("migrate-seed") ? 2 : 0;
            check(groups == expected && inserts == expected, "seed insert counts: " + groups + "/" + inserts);
        } else {
            check(migrationStatements == 0 && groups == 0 && inserts == 0, "verify/serve must not mutate schema");
        }
    }
    public static void main(String[] args) throws Exception {
        scenario = args[0];
        Path sqlDirectory = Path.of(System.getenv("YASDB_STORAGE_SQL_DIR"));
        Files.createDirectories(sqlDirectory);
        Files.writeString(sqlDirectory.resolve("001_init.sql"), scenario.startsWith("migrate-index-")
            ? SQL + "CREATE INDEX KC_NEW_IDX ON KC_EXAMPLE (COL_A,COL_B);" : SQL);
        Path seed = Path.of(System.getenv("YASDB_TECH_DOMAINS_SEED_FILE"));
        Files.deleteIfExists(seed);
        if (scenario.equals("migrate-seed")) {
            domains.add("EXISTS");
            Files.writeString(seed, "{\"techDomains\":[{\"name\":\"缺标识应跳过\"},{\"id\":\"exists\",\"code\":\"EXISTS\"},{\"id\":\"new\",\"code\":\"NEW\",\"name\":\"新领域\"},{\"id\":\"fallback\"}]}");
        }
        if (scenario.equals("migrate-invalid-json")) Files.writeString(seed, "{invalid");
        if (scenario.equals("migrate-invalid-utf8")) Files.write(seed, new byte[]{(byte) 0xc3, (byte) 0x28});
        if (scenario.equals("migrate-empty-seed")) Files.writeString(seed, "[]");
        if (scenario.startsWith("verify") || scenario.equals("serve")) {
            migrationTable = true;
            if (!scenario.equals("verify-pending")) applied.put("001_init", HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(SQL.getBytes(StandardCharsets.UTF_8))));
        }
        DriverManager.registerDriver(new Driver() {
            public boolean acceptsURL(String url) { return url.startsWith("jdbc:fixture:business"); }
            public Connection connect(String url, Properties props) { return acceptsURL(url) ? connection() : null; }
            public DriverPropertyInfo[] getPropertyInfo(String u, Properties p) { return new DriverPropertyInfo[0]; }
            public int getMajorVersion() { return 1; }
            public int getMinorVersion() { return 0; }
            public boolean jdbcCompliant() { return false; }
            public Logger getParentLogger() { return Logger.getGlobal(); }
        });
        if (scenario.equals("migrate-index-conflict")) {
            try {
                Main.main(new String[]{"migrate"});
                throw new AssertionError("non-equivalent index was accepted");
            } catch (SQLException error) {
                check(error.getMessage().contains("YAS-02043") && error.getMessage().contains("执行数据库迁移失败"),
                    "non-equivalent index error must retain the database reason");
                check(migrationStatements == 2 && applied.isEmpty() && commits == 0 && closed > 0,
                    "non-equivalent index changed migration state");
                System.out.println("PASS: public startup command " + scenario);
                return;
            }
        }
        boolean expectsFailure = scenario.contains("invalid") || scenario.equals("verify-pending");
        AtomicBoolean failureChecked = new AtomicBoolean(!expectsFailure);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                check(failureChecked.get(), "expected failure was not observed");
                // For serve the application's shutdown hook runs concurrently; closure is verified by one-shot commands.
                if (!scenario.equals("serve")) assertFinished(expectsFailure);
                System.out.println("PASS: public startup command " + scenario);
            } catch (Throwable error) { error.printStackTrace(); Runtime.getRuntime().halt(1); }
        }));
        try {
            String command = scenario.startsWith("migrate") ? "migrate" : scenario.startsWith("verify") ? "verify" : "serve";
            Main.main(scenario.equals("serve") ? new String[0] : new String[]{command});
            check(scenario.equals("serve"), "one-shot command must exit");
            URI health = URI.create("http://127.0.0.1:" + System.getenv("YASDB_STORAGE_PORT") + "/health");
            HttpResponse<String> response = HttpClient.newHttpClient().send(HttpRequest.newBuilder(health).GET().build(), HttpResponse.BodyHandlers.ofString());
            check(response.statusCode() == 200 && response.body().contains("\"success\":true"), "real serve health: " + response.body());
            check(commits >= 2 && migrationStatements == 0, "serve verifies migrations and warms read projection");
            URI base = URI.create("http://127.0.0.1:" + System.getenv("YASDB_STORAGE_PORT"));
            HttpClient client = HttpClient.newHttpClient();
            int beforeFailures = commits;
            queryFailure = new SQLException("fixture database unavailable", "08006", 900);
            try {
                for (String route : new String[]{"/v1/domain/tech-domains", "/v1/platform/team-groups", "/v1/domain/outlines", "/v1/domain/build-tasks"}) {
                    HttpResponse<String> failed = client.send(HttpRequest.newBuilder(base.resolve(route)).GET().build(), HttpResponse.BodyHandlers.ofString());
                    check(failed.statusCode() == 503, "database failure status for " + route + ": " + failed.body());
                    check(!failed.body().contains("fixture database unavailable"), "database detail must not leak");
                }
            } finally { queryFailure = null; }
            check(commits == beforeFailures, "failed reads must not commit");
            runtimeFailure = true;
            try {
                HttpResponse<String> failed = client.send(HttpRequest.newBuilder(base.resolve("/v1/domain/tech-domains")).GET().build(), HttpResponse.BodyHandlers.ofString());
                check(failed.statusCode() == 503 && failed.body().contains("INTERNAL_ERROR"), "uniform handler catches unexpected failure");
                check(!failed.body().contains("fixture runtime failure"), "runtime detail must not leak");
            } finally { runtimeFailure = false; }
            for (String route : new String[]{"/v1/domain/outlines/fixture/governance", "/v1/domain/outlines/fixture/publish", "/v1/platform/team-groups"}) {
                HttpResponse<String> unsupported = client.send(HttpRequest.newBuilder(base.resolve(route)).method("DELETE", HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
                check(unsupported.statusCode() == 405, "unsupported method for " + route + ": " + unsupported.body());
            }
            response = client.send(HttpRequest.newBuilder(health).GET().build(), HttpResponse.BodyHandlers.ofString());
            check(response.statusCode() == 200, "server must recover after request failures");
            System.exit(0);
        } catch (AssertionError error) {
            error.printStackTrace();
            Runtime.getRuntime().halt(1);
        } catch (SQLException error) {
            String expected = scenario.equals("verify-pending") ? "待执行的数据库迁移" : "技术领域种子配置读取失败";
            if (!expectsFailure || !error.getMessage().contains(expected)) throw error;
            check(scenario.equals("verify-pending") || error.getCause() != null, "preserve seed read failure cause");
            failureChecked.set(true);
        }
    }
}

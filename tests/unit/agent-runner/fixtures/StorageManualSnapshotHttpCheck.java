import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.Reader;
import java.io.StringWriter;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Connection;
import java.sql.Driver;
import java.sql.DriverManager;
import java.sql.DriverPropertyInfo;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.logging.Logger;
import javax.sql.rowset.serial.SerialClob;

/** Runs manual snapshot writes through the production HTTP handler and an isolated JDBC state machine. */
public final class StorageManualSnapshotHttpCheck {
    private static final Timestamp NOW = Timestamp.valueOf("2026-11-05 00:00:00");
    private static final class State {
        boolean exists;
        boolean outlineExists;
        boolean batchExists;
        long rowVersion;
        String title;
        String summary;
        String state;
        String kind;
        String visible;
        Long ownerA;
        Long ownerB;
        int outlineInserts;
        int outlineUpdates;
        int batchInserts;
        State copy() {
            State result = new State();
            result.exists = exists; result.outlineExists = outlineExists; result.batchExists = batchExists;
            result.rowVersion = rowVersion; result.title = title; result.summary = summary;
            result.state = state; result.kind = kind; result.visible = visible;
            result.ownerA = ownerA; result.ownerB = ownerB;
            result.outlineInserts = outlineInserts; result.outlineUpdates = outlineUpdates; result.batchInserts = batchInserts;
            return result;
        }
    }
    private static State state = new State();
    private static State committed = state.copy();
    private static int commits;
    private static int rollbacks;

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler);
    }

    private static ResultSet rows(String sql, Map<Integer, Object> binds) throws Exception {
        List<Object[]> data;
        if (HandbookProjectionRepository.LIST_SQL.equals(sql)) {
            data = state.exists ? List.<Object[]>of(new Object[]{101L, "HB-1", state.title, 7L, "YashanDB", "5",
                null, state.state, null, "ARCHIVED".equals(state.state) ? NOW : null, state.rowVersion,
                new SerialClob(state.summary.toCharArray()), state.kind, state.visible, NOW, NOW,
                state.ownerA == null ? null : String.valueOf(state.ownerA), state.ownerA == null ? null : "甲",
                state.ownerB == null ? null : String.valueOf(state.ownerB), state.ownerB == null ? null : "乙"}) : List.of();
        } else if (sql.startsWith("SELECT MANUAL_ID, ROW_VERSION FROM KC_MANUAL")) {
            data = state.exists ? List.<Object[]>of(new Object[]{101L, state.rowVersion}) : List.of();
        } else if (sql.startsWith("SELECT MANUAL_ID FROM KC_MANUAL")) {
            data = state.exists ? List.<Object[]>of(new Object[]{101L}) : List.of();
        } else if (sql.startsWith("SELECT OUTLINE_ID FROM KC_MANUAL_OUTLINE")) {
            data = state.outlineExists ? List.<Object[]>of(new Object[]{201L}) : List.of();
        } else if (sql.startsWith("SELECT BATCH_ID FROM KC_MIGRATION_BATCH")) {
            data = state.batchExists ? List.<Object[]>of(new Object[]{binds.get(1)}) : List.of();
        } else if (sql.startsWith("SELECT P.PRINCIPAL_ID, P.DISPLAY_NAME")) {
            long id = ((Number) binds.get(1)).longValue();
            data = id == 11L || id == 12L ? List.<Object[]>of(new Object[]{id, id == 11L ? "甲" : "乙", null,
                "ACTIVE", null, null, 1L, 0L}) : List.of();
        } else throw new AssertionError("unexpected query: " + sql);
        int[] position = {-1};
        return proxy(ResultSet.class, (self, method, args) -> {
            if (method.getName().equals("next")) return ++position[0] < data.size();
            if (method.getName().equals("close")) return null;
            if (method.getName().startsWith("get")) {
                Object value = data.get(position[0])[(Integer) args[0] - 1];
                if (method.getName().equals("getLong")) return ((Number) value).longValue();
                if (method.getName().equals("getString")) return value == null ? null : String.valueOf(value);
                return value;
            }
            throw new UnsupportedOperationException("ResultSet." + method.getName());
        });
    }

    private static PreparedStatement statement(String sql) {
        Map<Integer, Object> binds = new HashMap<>();
        return proxy(PreparedStatement.class, (self, method, args) -> {
            String operation = method.getName();
            if (operation.startsWith("set")) {
                if (operation.equals("setCharacterStream")) {
                    StringWriter writer = new StringWriter();
                    ((Reader) args[1]).transferTo(writer);
                    binds.put((Integer) args[0], writer.toString());
                } else binds.put((Integer) args[0], operation.equals("setNull") ? null : args[1]);
                return null;
            }
            if (operation.equals("executeQuery")) return rows(sql, binds);
            if (operation.equals("executeUpdate")) {
                if (sql.startsWith("INSERT INTO KC_MANUAL(")) {
                    state.exists = true; state.rowVersion = 1; state.title = (String) binds.get(2);
                    state.summary = (String) binds.get(9); state.state = (String) binds.get(8);
                    state.kind = (String) binds.get(6); state.visible = (String) binds.get(7);
                } else if (sql.startsWith("UPDATE KC_MANUAL SET")) {
                    state.title = (String) binds.get(2); state.summary = (String) binds.get(11);
                    state.state = (String) binds.get(8); state.kind = (String) binds.get(6);
                    state.visible = (String) binds.get(7); state.rowVersion = (Long) binds.get(10);
                } else if (sql.startsWith("DELETE FROM KC_MANUAL_OWNER")) {
                    state.ownerA = null; state.ownerB = null;
                } else if (sql.startsWith("INSERT INTO KC_MANUAL_OWNER")) {
                    long owner = (Long) binds.get(3);
                    if ("PRIMARY".equals(binds.get(2))) state.ownerA = owner; else state.ownerB = owner;
                } else if (sql.startsWith("INSERT INTO KC_MANUAL_OUTLINE(")) {
                    state.outlineExists = true; state.outlineInserts++;
                } else if (sql.startsWith("UPDATE KC_MANUAL_OUTLINE SET UPDATED_BY")) {
                    state.outlineUpdates++;
                } else if (sql.startsWith("INSERT INTO KC_MIGRATION_BATCH")) {
                    state.batchExists = true; state.batchInserts++;
                } else throw new AssertionError("unexpected update: " + sql);
                return 1;
            }
            if (operation.equals("close")) return null;
            throw new UnsupportedOperationException("PreparedStatement." + operation);
        });
    }

    private static void registerDriver() throws Exception {
        DriverManager.registerDriver(new Driver() {
            public boolean acceptsURL(String url) { return url.startsWith("jdbc:fixture:business"); }
            public Connection connect(String url, Properties properties) {
                if (!acceptsURL(url)) return null;
                return proxy(Connection.class, (self, method, args) -> switch (method.getName()) {
                    case "prepareStatement" -> statement((String) args[0]);
                    case "createStatement" -> proxy(java.sql.Statement.class, (query, call, values) ->
                        call.getName().equals("executeQuery") ? singleRow() : null);
                    case "commit" -> { committed = state.copy(); commits++; yield null; }
                    case "rollback" -> { state = committed.copy(); rollbacks++; yield null; }
                    case "setAutoCommit", "close" -> null;
                    case "isClosed" -> false;
                    default -> throw new UnsupportedOperationException("Connection." + method.getName());
                });
            }
            public DriverPropertyInfo[] getPropertyInfo(String url, Properties properties) { return new DriverPropertyInfo[0]; }
            public int getMajorVersion() { return 1; }
            public int getMinorVersion() { return 0; }
            public boolean jdbcCompliant() { return false; }
            public Logger getParentLogger() { return Logger.getGlobal(); }
        });
    }

    private static ResultSet singleRow() {
        int[] cursor = {0};
        return proxy(ResultSet.class, (self, method, args) -> method.getName().equals("next") ? ++cursor[0] == 1 : null);
    }

    private static HttpResponse<String> request(HttpClient client, URI base, String method, String body) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(base.resolve(method.equals("GET") ? "/v1/domain/handbooks" : "/v1/domain/handbooks/snapshot"));
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static void expect(HttpResponse<String> response, int status, String fragment) {
        if (response.statusCode() != status || !response.body().contains(fragment))
            throw new AssertionError(status + "/" + fragment + " expected, got " + response.statusCode() + "/" + response.body());
    }

    public static void main(String[] args) throws Exception {
        registerDriver();
        Constructor<Main> constructor = Main.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        Main application = constructor.newInstance();
        Method handler = Main.class.getDeclaredMethod("domainHandbooks", HttpExchange.class);
        handler.setAccessible(true);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/domain/handbooks", exchange -> {
            try { handler.invoke(application, exchange); }
            catch (ReflectiveOperationException error) { throw new java.io.IOException(error); }
        });
        server.start();
        URI base = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        HttpClient client = HttpClient.newHttpClient();
        String first = "{\"source\":{\"type\":\"knowledge-assets-json\",\"sha256\":\"abcdef0123456789\"},"
            + "\"principalId\":\"fixture-admin\",\"handbooks\":[{\"handbookId\":\"HB-1\",\"title\":\"手册一\","
            + "\"productId\":7,\"productName\":\"YashanDB\",\"ownerA\":{\"userId\":11},\"ownerB\":{\"userId\":12},"
            + "\"orgUnitId\":5,\"status\":\"active\",\"summary\":\"初版\",\"isAtomic\":true,\"externalVisible\":true}]}";
        String second = "{\"source\":{\"type\":\"knowledge-assets-json\",\"sha256\":\"abcdef0123456789\"},"
            + "\"updatedBy\":\"fixture-editor\",\"handbooks\":[{\"code\":\"HB-1\",\"name\":\"手册二\","
            + "\"productId\":7,\"productName\":\"YashanDB\",\"ownerA\":{\"id\":12},\"ownerB\":{\"id\":12},"
            + "\"departmentId\":5,\"status\":\"archived\",\"archivedAt\":\"2026-11-05T00:00:00Z\",\"summary\":\"修订\"}]}";
        try {
            expect(request(client, base, "GET", null), 200, "\"handbooks\":[]");
            expect(request(client, base, "PUT", first), 200, "\"handbookId\":\"HB-1\"");
            if (state.rowVersion != 1 || state.ownerA != 11L || state.ownerB != 12L ||
                    state.outlineInserts != 1 || state.batchInserts != 1 || !"Y".equals(state.visible))
                throw new AssertionError("initial manual snapshot not persisted");
            expect(request(client, base, "GET", null), 200, "\"summary\":\"初版\"");
            expect(request(client, base, "PUT", second), 200, "\"assetVersion\":2");
            if (state.rowVersion != 2 || state.ownerA != 12L || state.ownerB != null ||
                    state.outlineUpdates != 1 || state.batchInserts != 1 || !"ARCHIVED".equals(state.state))
                throw new AssertionError("manual update, owner replacement or batch deduplication failed");
            expect(request(client, base, "GET", null), 200, "\"summary\":\"修订\"");
            int beforeFailure = commits;
            expect(request(client, base, "PUT", "{\"handbooks\":[{\"handbookId\":\"HB-2\",\"productId\":7}]}") , 503, "DATABASE_UNAVAILABLE");
            expect(request(client, base, "PUT", "{\"handbooks\":[{\"handbookId\":\"HB-1\",\"productId\":7,\"productName\":\"YashanDB\",\"ownerA\":{\"id\":99}}]}") , 503, "DATABASE_UNAVAILABLE");
            expect(request(client, base, "PUT", "{broken"), 400, "INVALID_JSON");
            if (commits != beforeFailure || rollbacks < 3 || state.rowVersion != 2 || state.ownerA != 12L)
                throw new AssertionError("failed manual snapshot did not roll back");
        } finally {
            server.stop(0);
            Field poolField = Main.class.getDeclaredField("connectionPool");
            poolField.setAccessible(true);
            Object pool = poolField.get(application);
            Method close = pool.getClass().getDeclaredMethod("closeAll");
            close.setAccessible(true);
            close.invoke(pool);
        }
        System.out.println("PASS: manual snapshot HTTP write, readback, batch deduplication and rollback");
    }
}

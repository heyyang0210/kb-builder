import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.Reader;
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
import java.sql.DatabaseMetaData;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.logging.Logger;
import javax.sql.rowset.serial.SerialClob;

/** Exercises the real storage HTTP record lifecycle against an isolated JDBC state machine. */
public final class StorageRecordHttpCheck {
    private static String payload;
    private static String digest;
    private static long revision;
    private static boolean deleted;
    private static int commits;
    private static int rollbacks;
    private static boolean handbookPresent;
    private static final Timestamp NOW = Timestamp.valueOf("2026-11-05 00:00:00");

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] { type }, handler);
    }

    private static ResultSet rows(String sql) throws SQLException {
        if (HandbookProjectionRepository.LIST_SQL.equals(sql)) {
            int[] cursor = { 0 };
            Object[] handbook = { 101L, "HB-1", "手册一", 7L, "产品", "org-1", "outline-1", "ACTIVE", "PUBLISHED", null,
                2L, new SerialClob("摘要".toCharArray()), "ATOMIC", "Y", NOW, NOW, "owner-1", "甲", "owner-2", "乙" };
            return proxy(ResultSet.class, (self, method, args) -> switch (method.getName()) {
                case "next" -> ++cursor[0] == 1 && handbookPresent;
                case "getLong" -> ((Number) handbook[(Integer) args[0] - 1]).longValue();
                case "getString", "getTimestamp", "getClob" -> handbook[(Integer) args[0] - 1];
                case "close" -> null;
                default -> throw new UnsupportedOperationException("HandbookResultSet." + method.getName());
            });
        }
        int[] cursor = { 0 };
        return proxy(ResultSet.class, (self, method, args) -> switch (method.getName()) {
            case "next" -> ++cursor[0] == 1 && payload != null;
            case "getLong" -> revision;
            case "getString" -> {
                int column = (Integer) args[0];
                if (sql.startsWith("SELECT NAMESPACE,")) yield switch (column) {
                    case 1 -> "fixture";
                    case 2 -> "item";
                    case 4 -> digest;
                    case 6 -> deleted ? "Y" : "N";
                    default -> null;
                };
                if (sql.startsWith("SELECT PAYLOAD,")) yield column == 2 ? digest : column == 4 ? (deleted ? "Y" : "N") : null;
                yield column == 2 ? digest : deleted ? "Y" : "N";
            }
            case "getClob" -> new SerialClob(payload.toCharArray());
            case "getTimestamp" -> NOW;
            case "close" -> null;
            default -> throw new UnsupportedOperationException("ResultSet." + method.getName());
        });
    }

    private static PreparedStatement statement(String sql) {
        Map<Integer, Object> values = new HashMap<>();
        return proxy(PreparedStatement.class, (self, method, args) -> switch (method.getName()) {
            case "setString", "setLong" -> { values.put((Integer) args[0], args[1]); yield null; }
            case "setCharacterStream" -> {
                StringBuilder text = new StringBuilder();
                Reader input = (Reader) args[1];
                char[] buffer = new char[4096];
                for (int count; (count = input.read(buffer)) != -1;) text.append(buffer, 0, count);
                values.put((Integer) args[0], text.toString());
                yield null;
            }
            case "executeQuery" -> rows(sql);
            case "executeUpdate" -> {
                if (sql.startsWith("INSERT INTO KC_RECORD")) {
                    payload = (String) values.get(3); digest = (String) values.get(4); revision = 1; deleted = false;
                    yield 1;
                }
                if (sql.startsWith("UPDATE KC_RECORD SET PAYLOAD=")) {
                    payload = (String) values.get(1); digest = (String) values.get(2); revision = (Long) values.get(3); deleted = false;
                    yield 1;
                }
                if (sql.startsWith("UPDATE KC_RECORD SET DELETED=")) {
                    if (payload == null || revision != (Long) values.get(3)) yield 0;
                    deleted = true; revision++; yield 1;
                }
                throw new UnsupportedOperationException(sql);
            }
            case "close" -> null;
            default -> throw new UnsupportedOperationException("PreparedStatement." + method.getName());
        });
    }

    private static void registerDriver() throws SQLException {
        DriverManager.registerDriver(new Driver() {
            public boolean acceptsURL(String url) { return url.startsWith("jdbc:fixture:business"); }
            public Connection connect(String url, Properties properties) {
                if (!acceptsURL(url)) return null;
                return proxy(Connection.class, (self, method, args) -> switch (method.getName()) {
                    case "prepareStatement" -> statement((String) args[0]);
                    case "setAutoCommit", "close" -> null;
                    case "commit" -> { commits++; yield null; }
                    case "rollback" -> { rollbacks++; yield null; }
                    case "isClosed" -> false;
                    case "getMetaData" -> proxy(DatabaseMetaData.class, (metadata, called, values) ->
                        called.getName().equals("getDatabaseProductName") ? "fixture-db" : null);
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

    private static HttpResponse<String> request(HttpClient client, URI base, String method, String body, String revisionHeader) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(base.resolve("/v1/records/fixture/item"));
        if (revisionHeader != null) builder.header(method.equals("GET") ? "If-None-Match" : "If-Match", revisionHeader);
        builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
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
        Method records = Main.class.getDeclaredMethod("records", HttpExchange.class);
        records.setAccessible(true);
        Method export = Main.class.getDeclaredMethod("exportAll", HttpExchange.class);
        export.setAccessible(true);
        Method handbooks = Main.class.getDeclaredMethod("domainHandbooks", HttpExchange.class);
        handbooks.setAccessible(true);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/records", exchange -> {
            try { records.invoke(application, exchange); }
            catch (ReflectiveOperationException error) { throw new java.io.IOException(error); }
        });
        server.createContext("/v1/export", exchange -> {
            try { export.invoke(application, exchange); }
            catch (ReflectiveOperationException error) { throw new java.io.IOException(error); }
        });
        server.createContext("/v1/domain/handbooks", exchange -> {
            try { handbooks.invoke(application, exchange); }
            catch (ReflectiveOperationException error) { throw new java.io.IOException(error); }
        });
        server.start();
        URI base = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        HttpClient client = HttpClient.newHttpClient();
        try {
            HttpResponse<String> emptyHandbooks = client.send(HttpRequest.newBuilder(base.resolve("/v1/domain/handbooks")).GET().build(), HttpResponse.BodyHandlers.ofString());
            expect(emptyHandbooks, 200, "\"handbooks\":[]");
            if (!emptyHandbooks.headers().firstValue("Server-Timing").orElse("").contains("row-mapping"))
                throw new AssertionError("handbook timing missing");
            handbookPresent = true;
            HttpResponse<String> populatedHandbooks = client.send(HttpRequest.newBuilder(base.resolve("/v1/domain/handbooks")).GET().build(), HttpResponse.BodyHandlers.ofString());
            expect(populatedHandbooks, 200, "\"handbookId\":\"HB-1\"");
            for (String fragment : new String[] { "\"summary\":\"摘要\"", "\"externalVisible\":true", "\"displayName\":\"甲\"", "\"isAtomic\":true" })
                if (!populatedHandbooks.body().contains(fragment)) throw new AssertionError("handbook projection missing " + fragment + ": " + populatedHandbooks.body());
            HttpResponse<String> unsupportedHandbooks = client.send(HttpRequest.newBuilder(base.resolve("/v1/domain/handbooks")).POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
            expect(unsupportedHandbooks, 405, "METHOD_NOT_ALLOWED");
            HttpResponse<String> emptyExport = client.send(HttpRequest.newBuilder(base.resolve("/v1/export")).GET().build(), HttpResponse.BodyHandlers.ofString());
            expect(emptyExport, 200, "\"records\":[]");
            expect(request(client, base, "GET", null, null), 404, "RECORD_NOT_FOUND");
            expect(request(client, base, "PUT", "{\"value\":1}", "0"), 200, "\"revision\":1");
            HttpResponse<String> exported = client.send(HttpRequest.newBuilder(base.resolve("/v1/export")).GET().build(), HttpResponse.BodyHandlers.ofString());
            expect(exported, 200, "\"databaseProduct\":\"fixture-db\"");
            if (!exported.body().contains("\"namespace\":\"fixture\"") || !exported.body().contains("\"payload\":{\"value\":1}"))
                throw new AssertionError("created record missing from export: " + exported.body());
            expect(request(client, base, "GET", null, null), 200, "\"value\":1");
            HttpResponse<String> unchanged = request(client, base, "GET", null, "\"1\"");
            if (unchanged.statusCode() != 304) throw new AssertionError("conditional read: " + unchanged.statusCode());
            expect(request(client, base, "PUT", "{\"value\":1}", "1"), 200, "\"revision\":1");
            expect(request(client, base, "PUT", "{\"value\":2}", "0"), 409, "REVISION_CONFLICT");
            expect(request(client, base, "PUT", "{\"value\":2}", "1"), 200, "\"revision\":2");
            expect(request(client, base, "DELETE", null, "1"), 409, "REVISION_CONFLICT");
            expect(request(client, base, "DELETE", null, "2"), 200, "\"revision\":3");
            expect(request(client, base, "GET", null, null), 200, "\"deleted\":true");
            HttpResponse<String> deletedExport = client.send(HttpRequest.newBuilder(base.resolve("/v1/export")).GET().build(), HttpResponse.BodyHandlers.ofString());
            expect(deletedExport, 200, "\"deleted\":true");
            if (commits < 6 || rollbacks < 2) throw new AssertionError("transaction boundaries not exercised");
        } finally {
            server.stop(0);
            Field poolField = Main.class.getDeclaredField("connectionPool");
            poolField.setAccessible(true);
            Object pool = poolField.get(application);
            Method close = pool.getClass().getDeclaredMethod("closeAll");
            close.setAccessible(true);
            close.invoke(pool);
        }
        System.out.println("PASS: storage record lifecycle and empty, populated, deleted HTTP export");
    }
}

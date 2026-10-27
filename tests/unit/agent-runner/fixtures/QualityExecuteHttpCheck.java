import com.sun.net.httpserver.HttpServer;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.Driver;
import java.sql.DriverManager;
import java.sql.DriverPropertyInfo;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.Properties;
import java.util.logging.Logger;

/** Exercises the real quality HTTP handler with a JDBC proxy; no database is contacted. */
public final class QualityExecuteHttpCheck {
    private static int connections;
    private static boolean readOnly;

    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return type.cast(Proxy.newProxyInstance(QualityExecuteHttpCheck.class.getClassLoader(), new Class<?>[] { type }, handler));
    }

    private static ResultSet rows(int count) {
        ResultSetMetaData meta = proxy(ResultSetMetaData.class, (self, method, args) -> switch (method.getName()) {
            case "getColumnCount" -> 1;
            case "getColumnLabel" -> "C1";
            default -> throw new UnsupportedOperationException(method.getName());
        });
        int[] cursor = { 0 };
        return proxy(ResultSet.class, (self, method, args) -> switch (method.getName()) {
            case "getMetaData" -> meta;
            case "next" -> ++cursor[0] <= count;
            case "getObject" -> cursor[0];
            case "close" -> null;
            default -> throw new UnsupportedOperationException(method.getName());
        });
    }

    private static void registerDriver() throws SQLException {
        DriverManager.registerDriver(new Driver() {
            public boolean acceptsURL(String url) { return "jdbc:fixture:quality".equals(url); }
            public Connection connect(String url, Properties props) throws SQLException {
                if (!acceptsURL(url)) return null;
                if (!"reader".equals(props.getProperty("user")) || !"secret".equals(props.getProperty("password"))) throw new SQLException("wrong credentials");
                connections++;
                return proxy(Connection.class, (self, method, args) -> switch (method.getName()) {
                    case "setReadOnly" -> { readOnly = Boolean.TRUE.equals(args[0]); yield null; }
                    case "getMetaData" -> proxy(DatabaseMetaData.class, (db, called, values) -> {
                        if ("getDatabaseProductVersion".equals(called.getName())) return "quality-fixture-v1";
                        throw new UnsupportedOperationException(called.getName());
                    });
                    case "prepareStatement" -> {
                        String sql = (String) args[0];
                        yield proxy(PreparedStatement.class, (stmt, called, values) -> switch (called.getName()) {
                            case "setQueryTimeout", "close" -> null;
                            case "executeQuery" -> {
                                if (sql.contains("FAIL_NULL")) throw new SQLException();
                                if (sql.contains("FAIL")) throw new SQLException("fixture SQL failure");
                                yield rows(sql.contains("THREE") ? 3 : sql.contains("TWO") ? 2 : 0);
                            }
                            default -> throw new UnsupportedOperationException(called.getName());
                        });
                    }
                    case "close" -> null;
                    default -> throw new UnsupportedOperationException(method.getName());
                });
            }
            public DriverPropertyInfo[] getPropertyInfo(String url, Properties props) { return new DriverPropertyInfo[0]; }
            public int getMajorVersion() { return 1; }
            public int getMinorVersion() { return 0; }
            public boolean jdbcCompliant() { return false; }
            public Logger getParentLogger() { return Logger.getGlobal(); }
        });
    }

    private static void check(HttpClient client, URI url, String method, String body, int status, String expected) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(url).method(method,
            "POST".equals(method) ? HttpRequest.BodyPublishers.ofString(body) : HttpRequest.BodyPublishers.noBody()).build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != status || !response.body().contains(expected)) {
            throw new AssertionError(method + " " + body + " expected " + status + "/" + expected + ", got " + response.statusCode() + "/" + response.body());
        }
    }

    public static void main(String[] args) throws Exception {
        registerDriver();
        Constructor<Main> constructor = Main.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        Main application = constructor.newInstance();
        Method execute = Main.class.getDeclaredMethod("qualityExecute", com.sun.net.httpserver.HttpExchange.class);
        execute.setAccessible(true);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/quality/execute", exchange -> {
            try { execute.invoke(application, exchange); }
            catch (Exception error) { throw new RuntimeException(error); }
        });
        server.start();
        try {
            URI url = URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/v1/quality/execute");
            HttpClient client = HttpClient.newHttpClient();
            check(client, url, "GET", "", 405, "METHOD_NOT_ALLOWED");
            if (!"configured".equals(args[0])) {
                check(client, url, "POST", "{\"sql\":\"SELECT TWO\"}", 503, "QUALITY_DATABASE_NOT_CONFIGURED");
                if (connections != 0) throw new AssertionError("missing isolation must not connect");
            } else {
                check(client, url, "POST", "{}", 400, "QUALITY_SQL_READ_ONLY");
                check(client, url, "POST", "{\"sql\":\"  \"}", 400, "QUALITY_SQL_READ_ONLY");
                check(client, url, "POST", "{\"sql\":\"DELETE FROM T\"}", 400, "QUALITY_SQL_READ_ONLY");
                check(client, url, "POST", "{\"sql\":\"SELECT TWO\"}", 200, "\"truncated\":false");
                check(client, url, "POST", "{\"sql\":\"WITH THREE\"}", 200, "\"truncated\":true");
                check(client, url, "POST", "{\"sql\":\"EXPLAIN EMPTY\"}", 200, "\"databaseVersion\":\"quality-fixture-v1\"");
                check(client, url, "POST", "{\"sql\":\"SELECT FAIL\"}", 400, "YASHANDB_QUALITY_EXECUTION_FAILED");
                check(client, url, "POST", "{\"sql\":\"SELECT FAIL_NULL\"}", 400, "YashanDB 用例执行失败");
                if (!readOnly || connections != 5) throw new AssertionError("quality connection must be separate and read-only");
            }
        } finally { server.stop(0); }
        System.out.println("PASS: quality HTTP " + args[0]);
    }
}

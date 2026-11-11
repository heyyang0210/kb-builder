import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
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
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.SQLException;
import java.util.Map;
import java.util.Properties;
import java.util.logging.Logger;

/** Drives production Main HTTP registration and pre-database request validation. */
public final class StorageHttpInputCheck {
    private static <T> T proxy(Class<T> type, InvocationHandler handler) {
        return type.cast(Proxy.newProxyInstance(StorageHttpInputCheck.class.getClassLoader(), new Class<?>[] { type }, handler));
    }

    private static void registerDriver() throws SQLException {
        DriverManager.registerDriver(new Driver() {
            public boolean acceptsURL(String url) { return url.startsWith("jdbc:fixture:business"); }
            public Connection connect(String url, Properties properties) {
                if (!acceptsURL(url)) return null;
                return proxy(Connection.class, (self, method, args) -> switch (method.getName()) {
                    case "setAutoCommit", "rollback", "commit", "close" -> null;
                    case "isClosed" -> false;
                    case "createStatement" -> proxy(Statement.class, (statement, called, values) -> switch (called.getName()) {
                        case "setQueryTimeout", "close" -> null;
                        case "executeQuery" -> {
                            int[] cursor = { 0 };
                            yield proxy(ResultSet.class, (rows, rowMethod, rowArgs) -> switch (rowMethod.getName()) {
                                case "next" -> ++cursor[0] == 1;
                                case "getInt" -> 1;
                                case "close" -> null;
                                default -> throw new UnsupportedOperationException(rowMethod.getName());
                            });
                        }
                        default -> throw new UnsupportedOperationException(called.getName());
                    });
                    case "getMetaData" -> proxy(DatabaseMetaData.class, (metadata, called, values) -> switch (called.getName()) {
                        case "getDatabaseProductName" -> "fixture-db";
                        case "getDatabaseProductVersion" -> "fixture-1";
                        case "getDriverName" -> "fixture-driver";
                        case "getDriverVersion" -> "1.0";
                        default -> throw new UnsupportedOperationException(called.getName());
                    });
                    default -> throw new UnsupportedOperationException(method.getName());
                });
            }
            public DriverPropertyInfo[] getPropertyInfo(String url, Properties properties) { return new DriverPropertyInfo[0]; }
            public int getMajorVersion() { return 1; }
            public int getMinorVersion() { return 0; }
            public boolean jdbcCompliant() { return false; }
            public Logger getParentLogger() { return Logger.getGlobal(); }
        });
    }

    private static HttpResponse<String> send(HttpClient client, URI base, String method, String path, String body, Map<String, String> headers) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(base.resolve(path));
        headers.forEach(request::header);
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static void expect(HttpClient client, URI base, String method, String path, String body, int status, String code) throws Exception {
        expect(client, base, method, path, body, Map.of(), status, code);
    }

    private static void expect(HttpClient client, URI base, String method, String path, String body, Map<String, String> extra, int status, String code) throws Exception {
        java.util.Map<String, String> headers = new java.util.HashMap<>(Map.of("X-Request-ID", "request-123", "X-Correlation-ID", "invalid correlation"));
        headers.putAll(extra);
        HttpResponse<String> response = send(client, base, method, path, body, headers);
        if (response.statusCode() != status || !response.body().contains(code)) {
            throw new AssertionError(method + " " + path + " expected " + status + "/" + code + ", got " + response.statusCode() + "/" + response.body());
        }
        if (!"request-123".equals(response.headers().firstValue("X-Request-ID").orElse(null))
            || !"request-123".equals(response.headers().firstValue("X-Correlation-ID").orElse(null))) {
            throw new AssertionError("request identifiers must be validated and propagated");
        }
    }

    public static void main(String[] args) throws Exception {
        registerDriver();
        Constructor<Main> constructor = Main.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        Main application = constructor.newInstance();
        Field bodyLimit = Main.class.getDeclaredField("maxBodyBytes");
        bodyLimit.setAccessible(true);
        bodyLimit.setInt(application, 8);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        Method register = Main.class.getDeclaredMethod("register", HttpServer.class, String.class, HttpHandler.class);
        register.setAccessible(true);
        for (String route : new String[] { "/health", "/v1/records", "/v1/domain/handbooks", "/v1/domain/principals",
                "/v1/domain/outlines", "/v1/domain/tech-domains", "/v1/domain/build-tasks", "/v1/platform/team-groups",
                "/v1/platform/auth", "/v1/platform/gitlab", "/v1/export" }) {
            String methodName = switch (route) {
                case "/health" -> "health";
                case "/v1/records" -> "records";
                case "/v1/domain/handbooks" -> "domainHandbooks";
                case "/v1/domain/principals" -> "domainPrincipals";
                case "/v1/domain/outlines" -> "domainOutlines";
                case "/v1/domain/tech-domains" -> "techDomains";
                case "/v1/domain/build-tasks" -> "buildTasks";
                case "/v1/platform/team-groups" -> "teamGroups";
                case "/v1/platform/auth" -> "platformAuth";
                case "/v1/platform/gitlab" -> "platformGitLab";
                default -> "exportAll";
            };
            Method handlerMethod = Main.class.getDeclaredMethod(methodName, HttpExchange.class);
            handlerMethod.setAccessible(true);
            HttpHandler handler = exchange -> {
                try { handlerMethod.invoke(application, exchange); }
                catch (ReflectiveOperationException error) {
                    Throwable cause = error instanceof java.lang.reflect.InvocationTargetException invocation ? invocation.getCause() : error;
                    if (cause instanceof java.io.IOException exception) throw exception;
                    throw new java.io.IOException(cause);
                }
            };
            register.invoke(null, server, route, handler);
        }
        server.start();
        URI base = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        HttpClient client = HttpClient.newHttpClient();
        try {
            HttpResponse<String> healthy = send(client, base, "GET", "/health", null, Map.of("X-Request-ID", "health-1", "X-Correlation-ID", "corr:valid"));
            if (healthy.statusCode() != 200 || !healthy.body().contains("fixture-db") || !"corr:valid".equals(healthy.headers().firstValue("X-Correlation-ID").orElse(null))) throw new AssertionError("health route metadata and request correlation");
            expect(client, base, "POST", "/health", null, 405, "METHOD_NOT_ALLOWED");
            expect(client, base, "GET", "/v1/records", null, 400, "INVALID_RECORD_PATH");
            expect(client, base, "GET", "/v1/records/namespace/", null, 400, "INVALID_RECORD_PATH");
            expect(client, base, "GET", "/v1/records/bad%20namespace/key", null, 400, "INVALID_RECORD_ID");
            expect(client, base, "GET", "/v1/records/" + "n".repeat(65) + "/key", null, 400, "INVALID_RECORD_ID");
            expect(client, base, "GET", "/v1/records/namespace/" + "k".repeat(257), null, 400, "INVALID_RECORD_ID");
            expect(client, base, "POST", "/v1/records/namespace/key", "{}", 405, "METHOD_NOT_ALLOWED");
            expect(client, base, "DELETE", "/v1/records/namespace/key", null, 428, "REVISION_REQUIRED");
            expect(client, base, "PUT", "/v1/records/namespace/key", "not json", 400, "INVALID_JSON");
            expect(client, base, "PUT", "/v1/records/namespace/key", "{\"x\":12345}", 413, "PAYLOAD_TOO_LARGE");
            expect(client, base, "PUT", "/v1/records/namespace/key", "{}", Map.of("If-Match", "abc"), 400, "INVALID_REVISION");
            expect(client, base, "POST", "/v1/domain/handbooks", "{}", 405, "METHOD_NOT_ALLOWED");
            expect(client, base, "PUT", "/v1/domain/handbooks/snapshot", "[]", 400, "INVALID_JSON");
            for (String malformed : new String[]{"[", "{\"x\":@}", "\"" + "\\", "\"\\u0\"", "\"\\q\"", "{\"x\":1e}", "{\"x\":true false}"}) {
                expect(client, base, "PUT", "/v1/domain/handbooks/snapshot", malformed, 400, "INVALID_JSON");
            }
            expect(client, base, "POST", "/v1/domain/principals/unsupported", "{}", 405, "METHOD_NOT_ALLOWED");
            expect(client, base, "POST", "/v1/domain/principals", "[]", 400, "INVALID_JSON");
            expect(client, base, "POST", "/v1/domain/principals", "  ", 422, "PERSONNEL_NAME_REQUIRED");
            expect(client, base, "POST", "/v1/domain/principals", " ".repeat(16 * 1024 * 1024 + 1), 503, "INTERNAL_ERROR");
            expect(client, base, "POST", "/v1/domain/principals", "[]", 400, "INVALID_JSON");
            expect(client, base, "PATCH", "/v1/domain/principals/not-a-number", "{}", 404, "PERSONNEL_NOT_FOUND");
            expect(client, base, "GET", "/v1/domain/outlines/unsupported", null, 405, "METHOD_NOT_ALLOWED");
            expect(client, base, "POST", "/v1/domain/tech-domains", "{}", 405, "METHOD_NOT_ALLOWED");
            expect(client, base, "GET", "/v1/domain/build-tasks/task/items/", null, 400, "INVALID_TASK_ITEM_PATH");
            expect(client, base, "GET", "/v1/domain/build-tasks/task/items/item", null, 405, "METHOD_NOT_ALLOWED");
            expect(client, base, "PATCH", "/v1/domain/build-tasks/task/items/item", "[", 400, "INVALID_JSON");
            expect(client, base, "PATCH", "/v1/domain/build-tasks/task/items/item", "[]", 400, "INVALID_JSON");
            expect(client, base, "PATCH", "/v1/domain/build-tasks//items/item", "{}", 400, "INVALID_TASK_ITEM_PATH");
            expect(client, base, "PATCH", "/v1/domain/build-tasks/task/items/item/items/extra", "{}", 400, "INVALID_TASK_ITEM_PATH");
            expect(client, base, "POST", "/v1/domain/build-tasks/unknown", "{}", 405, "METHOD_NOT_ALLOWED");
            expect(client, base, "GET", "/v1/platform/team-groups/unknown", null, 400, "TEAM_GROUP_ID_INVALID");
            expect(client, base, "POST", "/v1/platform/team-groups", "{}", 400, "IDEMPOTENCY_KEY_REQUIRED");
            expect(client, base, "POST", "/v1/platform/auth/unknown", "{}", 405, "METHOD_NOT_ALLOWED");
            expect(client, base, "PATCH", "/v1/platform/auth/users/alice/roles", "{}", 428, "ROW_VERSION_REQUIRED");
            expect(client, base, "PATCH", "/v1/platform/auth/users/alice/roles", "{}", Map.of("If-Match", "1"), 400, "IDEMPOTENCY_KEY_REQUIRED");
            expect(client, base, "POST", "/v1/platform/gitlab/unknown", "{}", 405, "METHOD_NOT_ALLOWED");
            expect(client, base, "POST", "/v1/platform/gitlab/connections", "{}", 400, "IDEMPOTENCY_KEY_REQUIRED");
            expect(client, base, "PATCH", "/v1/platform/gitlab/connections/fixture", "{}", 428, "ROW_VERSION_REQUIRED");
            expect(client, base, "PATCH", "/v1/platform/gitlab/connections/fixture", "{}", Map.of("If-Match", "1"), 400, "IDEMPOTENCY_KEY_REQUIRED");
            expect(client, base, "PUT", "/v1/platform/gitlab/mappings/HB-1", "{}", 400, "IDEMPOTENCY_KEY_REQUIRED");
            expect(client, base, "POST", "/v1/export", "{}", 405, "METHOD_NOT_ALLOWED");
        } finally {
            server.stop(0);
            Field poolField = Main.class.getDeclaredField("connectionPool");
            poolField.setAccessible(true);
            Object pool = poolField.get(application);
            Method closeAll = pool.getClass().getDeclaredMethod("closeAll");
            closeAll.setAccessible(true);
            closeAll.invoke(pool);
        }
        System.out.println("PASS: production storage HTTP input and routing requests");
    }
}

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Connection;
import java.sql.Driver;
import java.sql.DriverManager;
import java.sql.DriverPropertyInfo;
import java.util.Properties;
import java.util.logging.Logger;

/** Exercises the platform auth handler through HTTP and an isolated JDBC state machine. */
public final class StorageAuthHttpCheck {
    private static HttpResponse<String> request(HttpClient client, URI base, String method, String path, String body, String version, boolean idempotent) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(base.resolve(path));
        if (version != null) builder.header("If-Match", version);
        if (idempotent) builder.header("Idempotency-Key", "auth-fixture");
        builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static void expect(HttpResponse<String> response, int status, String fragment) {
        if (response.statusCode() != status || !response.body().contains(fragment))
            throw new AssertionError(status + "/" + fragment + " expected, got " + response.statusCode() + "/" + response.body());
    }

    public static void main(String[] args) throws Exception {
        PlatformAuthRepositoryCheck.Database database = new PlatformAuthRepositoryCheck.Database();
        database.principals.put(1L, new PlatformAuthRepositoryCheck.Principal(1L, "何阳", "heyang", "ACTIVE"));
        database.principals.put(2L, new PlatformAuthRepositoryCheck.Principal(2L, "停用人员", "inactive", "INACTIVE"));
        database.principals.put(3L, new PlatformAuthRepositoryCheck.Principal(3L, "待绑定人员", "pending", "ACTIVE"));
        DriverManager.registerDriver(new Driver() {
            public boolean acceptsURL(String url) { return url.startsWith("jdbc:fixture:business"); }
            public Connection connect(String url, Properties properties) { return acceptsURL(url) ? database.connection() : null; }
            public DriverPropertyInfo[] getPropertyInfo(String url, Properties properties) { return new DriverPropertyInfo[0]; }
            public int getMajorVersion() { return 1; }
            public int getMinorVersion() { return 0; }
            public boolean jdbcCompliant() { return false; }
            public Logger getParentLogger() { return Logger.getGlobal(); }
        });
        Constructor<Main> constructor = Main.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        Main application = constructor.newInstance();
        Method auth = Main.class.getDeclaredMethod("platformAuth", HttpExchange.class);
        auth.setAccessible(true);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/platform/auth", exchange -> {
            try { auth.invoke(application, exchange); }
            catch (ReflectiveOperationException error) { throw new IOException(error); }
        });
        server.start();
        URI base = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        HttpClient client = HttpClient.newHttpClient();
        try {
            expect(request(client, base, "GET", "/v1/platform/auth/users", null, null, false), 200, "\"total\":0");
            expect(request(client, base, "GET", "/v1/platform/auth/users/missing", null, null, false), 404, "AUTH_USER_NOT_FOUND");
            expect(request(client, base, "POST", "/v1/platform/auth/users/cas", "{\"principalId\":\"invalid\",\"loginName\":\"heyang\"}", null, false), 400, "INVALID_JSON");
            expect(request(client, base, "POST", "/v1/platform/auth/users/cas", "{\"principalId\":999,\"loginName\":\"missing\"}", null, false), 503, "CAS_PRINCIPAL_NOT_FOUND");
            expect(request(client, base, "POST", "/v1/platform/auth/users/cas", "{\"principalId\":2,\"loginName\":\"inactive\"}", null, false), 409, "CAS_PRINCIPAL_INACTIVE");
            expect(request(client, base, "POST", "/v1/platform/auth/users/cas", "{\"principalId\":1,\"loginName\":\"wrong\"}", null, false), 409, "CAS_LOGIN_BIND_CONFLICT");
            expect(request(client, base, "POST", "/v1/platform/auth/users/cas", "{\"principalId\":1,\"loginName\":\"heyang\"}", null, false), 200, "KNOWLEDGE_EDITOR");
            String key = database.users.get(0).key;
            expect(request(client, base, "GET", "/v1/platform/auth/users", null, null, false), 200, "\"total\":1");
            expect(request(client, base, "GET", "/v1/platform/auth/users/" + key, null, null, false), 200, "\"loginName\":\"heyang\"");
            String rolesPath = "/v1/platform/auth/users/" + key + "/roles";
            String roles = "{\"roles\":[\"REVIEWER\"]}";
            expect(request(client, base, "PATCH", rolesPath, roles, null, true), 428, "ROW_VERSION_REQUIRED");
            expect(request(client, base, "PATCH", rolesPath, roles, "bad", true), 400, "INVALID_ROW_VERSION");
            expect(request(client, base, "PATCH", rolesPath, roles, "1", false), 400, "IDEMPOTENCY_KEY_REQUIRED");
            expect(request(client, base, "PATCH", rolesPath, roles, "0", true), 409, "ROW_VERSION_CONFLICT");
            expect(request(client, base, "PATCH", rolesPath, "{\"roles\":[]}", "1", true), 422, "ROLE_REQUIRED");
            expect(request(client, base, "PATCH", rolesPath, "{\"roles\":[\"UNKNOWN\"]}", "1", true), 422, "ROLE_INVALID");
            expect(request(client, base, "PATCH", "/v1/platform/auth/users/missing/roles", roles, "1", true), 404, "AUTH_USER_NOT_FOUND");
            expect(request(client, base, "PATCH", rolesPath, roles, "1", true), 200, "REVIEWER");
            expect(request(client, base, "PATCH", rolesPath, roles, "1", true), 409, "ROW_VERSION_CONFLICT");
            database.defaultRoleAvailable = false;
            expect(request(client, base, "POST", "/v1/platform/auth/users/cas", "{\"principalId\":3,\"loginName\":\"pending\"}", null, false), 503, "AUTH_DEFAULT_ROLE_NOT_FOUND");
            expect(request(client, base, "POST", "/v1/platform/auth/users/cas", "{", null, false), 400, "INVALID_JSON");
            expect(request(client, base, "DELETE", "/v1/platform/auth/users", null, null, false), 405, "METHOD_NOT_ALLOWED");
        } finally {
            server.stop(0);
            Field poolField = Main.class.getDeclaredField("connectionPool");
            poolField.setAccessible(true);
            Object pool = poolField.get(application);
            Method close = pool.getClass().getDeclaredMethod("closeAll");
            close.setAccessible(true);
            close.invoke(pool);
        }
        System.out.println("PASS: platform auth HTTP user and role lifecycle");
    }
}

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

/** Exercises the GitLab configuration route against in-memory JDBC state. */
public final class StorageGitLabHttpCheck {
    private static HttpResponse<String> request(HttpClient client, URI base, String method, String path, String body, String version, boolean idempotent) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(base.resolve(path));
        if (version != null) builder.header("If-Match", version);
        if (idempotent) builder.header("Idempotency-Key", "gitlab-fixture");
        builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static void expect(HttpResponse<String> response, int status, String fragment) {
        if (response.statusCode() != status || !response.body().contains(fragment))
            throw new AssertionError(status + "/" + fragment + " expected, got " + response.statusCode() + "/" + response.body());
    }

    public static void main(String[] args) throws Exception {
        PlatformGitLabRepositoryCheck.Database database = new PlatformGitLabRepositoryCheck.Database();
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
        Method gitlab = Main.class.getDeclaredMethod("platformGitLab", HttpExchange.class);
        gitlab.setAccessible(true);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/platform/gitlab", exchange -> {
            try { gitlab.invoke(application, exchange); }
            catch (ReflectiveOperationException error) { throw new IOException(error); }
        });
        server.start();
        URI base = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        HttpClient client = HttpClient.newHttpClient();
        try {
            String connections = "/v1/platform/gitlab/connections";
            String mappings = "/v1/platform/gitlab/mappings/HB-1";
            String input = "{\"id\":\"conn-1\",\"name\":\"手册仓库\",\"baseUrl\":\"https://gitlab.example\",\"projectPath\":\"team/docs\",\"defaultBranch\":\"main\",\"mode\":\"sandbox\",\"authMode\":\"service_account\",\"purpose\":\"read_write\",\"credentialRef\":\"fixture\",\"status\":\"active\"}";
            expect(request(client, base, "GET", connections, null, null, false), 200, "\"total\":0");
            expect(request(client, base, "GET", connections + "/missing", null, null, false), 404, "GITLAB_CONNECTION_NOT_FOUND");
            expect(request(client, base, "GET", mappings, null, null, false), 404, "GITLAB_MAPPING_NOT_FOUND");
            expect(request(client, base, "PUT", connections, input, null, false), 400, "IDEMPOTENCY_KEY_REQUIRED");
            expect(request(client, base, "PUT", connections, input, null, true), 200, "\"id\":\"conn-1\"");
            expect(request(client, base, "GET", connections, null, null, false), 200, "\"total\":1");
            expect(request(client, base, "GET", connections + "/conn-1", null, null, false), 200, "\"name\":\"手册仓库\"");
            expect(request(client, base, "PATCH", connections + "/conn-1/state", "{\"status\":\"inactive\"}", null, true), 428, "ROW_VERSION_REQUIRED");
            expect(request(client, base, "PATCH", connections + "/conn-1/state", "{\"status\":\"inactive\"}", "1", true), 200, "\"status\":\"inactive\"");
            String mapping = "{\"connectionId\":\"conn-1\",\"defaultBranch\":\"main\",\"enabledBranches\":[\"dev\"],\"zhPaths\":[\"docs/zh\"]}";
            expect(request(client, base, "PUT", mappings, mapping, null, true), 200, "\"connectionId\":\"conn-1\"");
            expect(request(client, base, "GET", mappings, null, null, false), 200, "\"zhPaths\":[\"docs/zh\"]");
            expect(request(client, base, "DELETE", connections, null, null, false), 405, "METHOD_NOT_ALLOWED");
        } finally {
            server.stop(0);
            Field poolField = Main.class.getDeclaredField("connectionPool");
            poolField.setAccessible(true);
            Object pool = poolField.get(application);
            Method close = pool.getClass().getDeclaredMethod("closeAll");
            close.setAccessible(true);
            close.invoke(pool);
        }
        System.out.println("PASS: GitLab connection and mapping HTTP lifecycle");
    }
}

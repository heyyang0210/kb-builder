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

/** Exercises personnel route behavior through the production handler and JDBC pool. */
public final class StoragePrincipalHttpCheck {
    private static HttpResponse<String> request(HttpClient client, URI base, String method, String path, String body) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(base.resolve(path));
        builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static void expect(HttpResponse<String> response, int status, String fragment) {
        if (response.statusCode() != status || !response.body().contains(fragment))
            throw new AssertionError(status + "/" + fragment + " expected, got " + response.statusCode() + "/" + response.body());
    }

    public static void main(String[] args) throws Exception {
        PrincipalRepositoryCheck.Database database = new PrincipalRepositoryCheck.Database();
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
        Method principals = Main.class.getDeclaredMethod("domainPrincipals", HttpExchange.class);
        principals.setAccessible(true);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/domain/principals", exchange -> {
            try { principals.invoke(application, exchange); }
            catch (ReflectiveOperationException error) { throw new IOException(error); }
        });
        server.start();
        URI base = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        HttpClient client = HttpClient.newHttpClient();
        try {
            expect(request(client, base, "GET", "/v1/domain/principals", null), 200, "\"total\":0");
            expect(request(client, base, "POST", "/v1/domain/principals", "{\"displayName\":\" \"}"), 422, "PERSONNEL_NAME_REQUIRED");
            expect(request(client, base, "POST", "/v1/domain/principals", "{\"displayName\":\"何阳\"}"), 201, "\"loginStatus\":\"PENDING\"");
            expect(request(client, base, "GET", "/v1/domain/principals?q=%E4%BD%95%E9%98%B3&bindingStatus=PENDING", null), 200, "\"total\":1");
            expect(request(client, base, "GET", "/v1/domain/principals?bindingStatus=UNKNOWN", null), 422, "PERSONNEL_BINDING_STATUS_INVALID");
            expect(request(client, base, "POST", "/v1/domain/principals", "{"), 400, "INVALID_JSON");
            expect(request(client, base, "POST", "/v1/domain/principals/cas-login", "{\"casLoginName\":\"missing\",\"displayName\":\"无人\"}"), 409, "CAS_PRINCIPAL_NOT_FOUND");
            expect(request(client, base, "POST", "/v1/domain/principals/cas-login", "{\"casLoginName\":\"heyang\",\"displayName\":\"何阳\"}"), 200, "\"loginStatus\":\"BOUND\"");
            expect(request(client, base, "PATCH", "/v1/domain/principals/bad", "{}"), 404, "PERSONNEL_NOT_FOUND");
            expect(request(client, base, "PATCH", "/v1/domain/principals/1", "{\"displayName\":\"何阳\"}"), 422, "PERSONNEL_VERSION_REQUIRED");
            expect(request(client, base, "PATCH", "/v1/domain/principals/1", "{\"displayName\":\"何阳\",\"rowVersion\":0}"), 409, "PERSONNEL_VERSION_CONFLICT");
            expect(request(client, base, "PATCH", "/v1/domain/principals/1", "{\"displayName\":\"何阳新\",\"casLoginName\":\"heyang\",\"rowVersion\":2}"), 200, "\"displayName\":\"何阳新\"");
            expect(request(client, base, "POST", "/v1/domain/principals/import", "{\"sourceSha256\":\"bad\"}"), 422, "PERSONNEL_SOURCE_SHA_REQUIRED");
            String sourceSha = "a".repeat(64);
            expect(request(client, base, "POST", "/v1/domain/principals/import", "{\"sourceSha256\":\"" + sourceSha + "\",\"items\":[]}"), 422, "PERSONNEL_IMPORT_EMPTY");
            String incompleteSha = "b".repeat(64);
            database.batches.put("PERSONNEL-" + incompleteSha.substring(0, 32), "STARTED");
            expect(request(client, base, "POST", "/v1/domain/principals/import", "{\"sourceSha256\":\"" + incompleteSha + "\",\"items\":[{\"displayName\":\"不应导入\"}]}"), 503, "PERSONNEL_IMPORT_INCOMPLETE");
            String importBody = "{\"sourceSha256\":\"" + sourceSha + "\",\"items\":[{\"displayName\":\"导入人员\"}]}";
            expect(request(client, base, "POST", "/v1/domain/principals/import", importBody), 200, "\"idempotent\":false");
            expect(request(client, base, "POST", "/v1/domain/principals/import", importBody), 200, "\"idempotent\":true");
            expect(request(client, base, "GET", "/v1/domain/principals?q=%E5%AF%BC%E5%85%A5%E4%BA%BA%E5%91%98", null), 200, "\"displayName\":\"导入人员\"");
            expect(request(client, base, "DELETE", "/v1/domain/principals", null), 405, "METHOD_NOT_ALLOWED");
        } finally {
            server.stop(0);
            Field poolField = Main.class.getDeclaredField("connectionPool");
            poolField.setAccessible(true);
            Object pool = poolField.get(application);
            Method close = pool.getClass().getDeclaredMethod("closeAll");
            close.setAccessible(true);
            close.invoke(pool);
        }
        System.out.println("PASS: personnel list, create, CAS bind, update and HTTP errors");
    }
}

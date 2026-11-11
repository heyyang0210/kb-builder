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
    private static boolean failSqlWithoutMessage;
    private static java.sql.SQLException sqlFailure;
    private static int commits;

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

    private static void versionMappings(HttpClient client, URI base, PlatformGitLabRepositoryCheck.Database database) throws Exception {
        String path = "/v1/platform/gitlab/version-mappings";
        String all = "{\"connectionId\":\"conn-1\",\"productCode\":\"DB\",\"matchKind\":\"ALL\",\"branch\":\"main\",\"actor\":\"version-tester\"}";
        String exact = all.replace("\"ALL\"", "\"EXACT\"").replace("\"branch\":\"main\"", "\"version\":\"23.4\",\"branch\":\"release\"");
        expect(request(client, base, "GET", path, null, null, false), 200, "\"total\":0");
        expect(request(client, base, "GET", path + "/999", null, null, false), 404, "VERSION_MAPPING_NOT_FOUND");
        expect(request(client, base, "GET", path + "/resolve?connectionId=conn-1&productCode=DB&version=23.4", null, null, false), 200, "\"data\":null");
        expect(request(client, base, "POST", path, all, null, false), 400, "IDEMPOTENCY_KEY_REQUIRED");
        expect(request(client, base, "POST", path, "{broken", null, true), 400, "INVALID_JSON");
        String[] invalid = { "{}", all.replace("conn-1", "missing"), all.replace("\"DB\"", "\"\""),
            all.replace("\"ALL\"", "\"OTHER\""), all.replace("\"main\"", "\"\""),
            exact.replace("\"23.4\"", "\"\""), all.replace("\"DB\"", "\"" + "x".repeat(65) + "\""),
            exact.replace("23.4", "x".repeat(129)), all.replace("\"main\"", "\"" + "x".repeat(256) + "\"") };
        for (int i = 0; i < invalid.length; i++) {
            expect(request(client, base, "POST", path, invalid[i], null, true), i == 1 ? 404 : 422,
                i == 0 ? "GITLAB_CONNECTION_REQUIRED" : i == 1 ? "GITLAB_CONNECTION_NOT_FOUND" : "VERSION_MAPPING_INVALID");
        }
        expect(request(client, base, "POST", path, all, null, true), 200, "\"id\":1000");
        expect(request(client, base, "GET", path + "/1000", null, null, false), 200, "\"version\":null");
        expect(request(client, base, "PUT", path + "/999", all, "1", true), 404, "VERSION_MAPPING_NOT_FOUND");
        expect(request(client, base, "POST", path + "/999/activate", "{}", "1", true), 404, "VERSION_MAPPING_NOT_FOUND");
        expect(request(client, base, "PUT", path + "/1000", all, null, true), 428, "ROW_VERSION_REQUIRED");
        expect(request(client, base, "PUT", path + "/1000", all, "bad", true), 400, "INVALID_ROW_VERSION");
        expect(request(client, base, "PUT", path + "/1000", all, "1", false), 400, "IDEMPOTENCY_KEY_REQUIRED");
        expect(request(client, base, "PUT", path + "/1000", "{broken", "1", true), 400, "INVALID_JSON");
        expect(request(client, base, "PUT", path + "/1000", all, "0", true), 409, "ROW_VERSION_CONFLICT");
        database.failUpdate = true;
        expect(request(client, base, "PUT", path + "/1000", all, "1", true), 409, "ROW_VERSION_CONFLICT");
        expect(request(client, base, "POST", path + "/1000/disable", "{}", "1", true), 409, "VERSION_MAPPING_CONFLICT");
        expect(request(client, base, "POST", path + "/1000/activate", "{}", "0", true), 409, "ROW_VERSION_CONFLICT");
        database.failUpdate = true;
        expect(request(client, base, "POST", path + "/1000/activate", "{}", "1", true), 409, "ROW_VERSION_CONFLICT");
        expect(request(client, base, "POST", path + "/1000/activate", "{}", "1", true), 200, "\"state\":\"active\"");
        expect(request(client, base, "POST", path + "/1000/activate", "{}", "2", true), 409, "VERSION_MAPPING_CONFLICT");
        expect(request(client, base, "POST", path + "/1000/disable", "{}", "2", true), 200, "\"state\":\"disabled\"");
        expect(request(client, base, "POST", path + "/1000/activate", "{}", "3", true), 200, "\"rowVersion\":4");
        expect(request(client, base, "GET", path + "/resolve?connectionId=conn-1&productCode=DB&version=23.4", null, null, false), 200, "\"id\":1000");
        expect(request(client, base, "POST", path, exact, null, true), 200, "\"id\":1001");
        expect(request(client, base, "PUT", path + "/1001", exact.replace("release", "release-edited"), "1", true), 200, "\"rowVersion\":2");
        expect(request(client, base, "POST", path + "/1001/activate", "{}", "2", true), 200, "\"state\":\"active\"");
        expect(request(client, base, "GET", path + "/resolve?connectionId=conn-1&productCode=DB&version=23.4", null, null, false), 200, "\"branch\":\"release-edited\"");
        expect(request(client, base, "GET", path + "/resolve?connectionId=conn-1&productCode=DB&version=other", null, null, false), 200, "\"id\":1000");
        expect(request(client, base, "GET", path + "/resolve?connectionId=conn-1&productCode=OTHER", null, null, false), 200, "\"data\":null");
        expect(request(client, base, "GET", path + "/resolve", null, null, false), 404, "GITLAB_CONNECTION_NOT_FOUND");
        expect(request(client, base, "PUT", path + "/1001", exact, "3", true), 200, "\"revisionOfId\":1001");
        expect(request(client, base, "PUT", path + "/1001", exact, "3", true), 200, "\"id\":1003");
        database.failUpdate = true;
        expect(request(client, base, "POST", path + "/1002/activate", "{}", "1", true), 409, "VERSION_MAPPING_CONFLICT");
        expect(request(client, base, "POST", path + "/1002/activate", "{}", "1", true), 200, "\"state\":\"active\"");
        expect(request(client, base, "GET", path + "/1001", null, null, false), 200, "\"state\":\"superseded\"");
        expect(request(client, base, "POST", path + "/1003/activate", "{}", "1", true), 409, "VERSION_MAPPING_CONFLICT");
        expect(request(client, base, "PUT", path + "/1001", exact, "4", true), 409, "VERSION_MAPPING_CONFLICT");
        expect(request(client, base, "POST", path + "/1002/disable", "{}", "2", true), 200, "\"state\":\"disabled\"");
        expect(request(client, base, "PUT", path + "/1002", exact, "3", true), 200, "\"id\":1004");
        expect(request(client, base, "POST", path + "/1004/activate", "{}", "1", true), 200, "\"state\":\"active\"");
        expect(request(client, base, "GET", path + "/1002", null, null, false), 200, "\"state\":\"disabled\"");
        expect(request(client, base, "GET", path, null, null, false), 200, "\"total\":5");
        expect(request(client, base, "DELETE", path + "/1004", null, null, false), 405, "METHOD_NOT_ALLOWED");
        expect(request(client, base, "POST", path + "/1004/unknown", "{}", "2", true), 405, "METHOD_NOT_ALLOWED");
        if (database.versionEvents.size() != 14 || !database.versionEvents.get(0).equals(java.util.Arrays.asList(1000L, "CREATE", null, "DRAFT", "version-tester")))
            throw new AssertionError("version mapping audit events missing or invalid: " + database.versionEvents);
        if (!"SUPERSEDED".equals(database.versionMappings.get(1001L)[7]) || !Long.valueOf(4).equals(database.versionMappings.get(1001L)[8]))
            throw new AssertionError("activated revision did not supersede original version exactly once");
        String deleteBody = "{\"actor\":\"version-tester\"}";
        expect(request(client, base, "POST", path + "/999/delete", deleteBody, "1", true), 404, "VERSION_MAPPING_NOT_FOUND");
        expect(request(client, base, "POST", path + "/1004/delete", deleteBody, "2", true), 409, "VERSION_MAPPING_CONFLICT");
        expect(request(client, base, "POST", path, all, null, true), 200, "\"id\":1005");
        int eventsBeforeDelete = database.versionEvents.size();
        expect(request(client, base, "POST", path + "/1005/delete", deleteBody, null, true), 428, "ROW_VERSION_REQUIRED");
        expect(request(client, base, "POST", path + "/1005/delete", deleteBody, "1", false), 400, "IDEMPOTENCY_KEY_REQUIRED");
        expect(request(client, base, "POST", path + "/1005/delete", deleteBody, "0", true), 409, "ROW_VERSION_CONFLICT");
        Object[] dependent = database.versionMappings.get(1003L).clone();
        dependent[0] = 9999L; dependent[1] = 1005L;
        database.versionMappings.put(9999L, dependent);
        try {
            expect(request(client, base, "POST", path + "/1005/delete", deleteBody, "1", true), 409, "VERSION_MAPPING_CONFLICT");
        } finally { database.versionMappings.remove(9999L); }
        database.failUpdate = true;
        expect(request(client, base, "POST", path + "/1005/delete", deleteBody, "1", true), 409, "VERSION_MAPPING_CONFLICT");
        if (!"DRAFT".equals(database.versionMappings.get(1005L)[7]) || database.versionEvents.size() != eventsBeforeDelete)
            throw new AssertionError("rejected draft delete changed state or audit history");
        expect(request(client, base, "POST", path + "/1005/delete", deleteBody, "1", true), 200, "\"state\":\"deleted\"");
        expect(request(client, base, "GET", path + "/1005", null, null, false), 404, "VERSION_MAPPING_NOT_FOUND");
        expect(request(client, base, "GET", path, null, null, false), 200, "\"total\":5");
        if (!"DELETED".equals(database.versionMappings.get(1005L)[7]) || !Long.valueOf(2L).equals(database.versionMappings.get(1005L)[8]) ||
            !database.versionEvents.get(database.versionEvents.size() - 1).equals(java.util.Arrays.asList(1005L, "DELETE", "DRAFT", "DELETED", "version-tester")))
            throw new AssertionError("draft delete did not retain version and audit history");

        int eventsBeforeArchive = database.versionEvents.size();
        int commitsBeforeArchive = commits;
        expect(request(client, base, "POST", path + "/999/archive", deleteBody, "1", true), 404, "VERSION_MAPPING_NOT_FOUND");
        expect(request(client, base, "POST", path + "/1002/archive", deleteBody, null, true), 428, "ROW_VERSION_REQUIRED");
        expect(request(client, base, "POST", path + "/1002/archive", deleteBody, "3", false), 400, "IDEMPOTENCY_KEY_REQUIRED");
        expect(request(client, base, "POST", path + "/1002/archive", deleteBody, "2", true), 409, "ROW_VERSION_CONFLICT");
        expect(request(client, base, "POST", path + "/1000/archive", deleteBody, "4", true), 409, "VERSION_MAPPING_CONFLICT");
        expect(request(client, base, "POST", path + "/1003/archive", deleteBody, "1", true), 409, "VERSION_MAPPING_CONFLICT");
        expect(request(client, base, "POST", path + "/1002/restore", deleteBody, "3", true), 409, "VERSION_MAPPING_CONFLICT");
        database.failUpdate = true;
        expect(request(client, base, "POST", path + "/1002/archive", deleteBody, "3", true), 409, "ROW_VERSION_CONFLICT");
        if (database.versionEvents.size() != eventsBeforeArchive || commits != commitsBeforeArchive ||
            !"DISABLED".equals(database.versionMappings.get(1002L)[7]))
            throw new AssertionError("rejected archive changed state, commits or audit history");

        expect(request(client, base, "POST", path + "/1002/archive", deleteBody, "3", true), 200, "\"state\":\"archived\"");
        expect(request(client, base, "GET", path + "/1002", null, null, false), 200, "\"rowVersion\":4");
        expect(request(client, base, "GET", path, null, null, false), 200, "\"archivedItems\":[{\"id\":1002");
        expect(request(client, base, "GET", path, null, null, false), 200, "\"total\":4");
        expect(request(client, base, "PUT", path + "/1002", exact, "4", true), 409, "VERSION_MAPPING_CONFLICT");
        expect(request(client, base, "POST", path + "/1002/archive", deleteBody, "4", true), 409, "VERSION_MAPPING_CONFLICT");
        expect(request(client, base, "POST", path + "/1002/restore", deleteBody, "3", true), 409, "ROW_VERSION_CONFLICT");
        expect(request(client, base, "POST", path + "/1002/restore", deleteBody, "4", true), 200, "\"state\":\"disabled\"");
        expect(request(client, base, "GET", path, null, null, false), 200, "\"archivedItems\":[]");
        expect(request(client, base, "GET", path, null, null, false), 200, "\"total\":5");
        if (!Long.valueOf(5L).equals(database.versionMappings.get(1002L)[8]) ||
            !database.versionEvents.get(eventsBeforeArchive).equals(java.util.Arrays.asList(1002L, "ARCHIVE", "DISABLED", "ARCHIVED", "version-tester")) ||
            !database.versionEvents.get(eventsBeforeArchive + 1).equals(java.util.Arrays.asList(1002L, "RESTORE", "ARCHIVED", "DISABLED", "version-tester")))
            throw new AssertionError("archive/restore version or audit history mismatch: " + database.versionEvents);
    }

    public static void main(String[] args) throws Exception {
        PlatformGitLabRepositoryCheck.Database database = new PlatformGitLabRepositoryCheck.Database();
        DriverManager.registerDriver(new Driver() {
            public boolean acceptsURL(String url) { return url.startsWith("jdbc:fixture:business"); }
            public Connection connect(String url, Properties properties) {
                if (!acceptsURL(url)) return null;
                Connection delegate = database.connection();
                return (Connection) java.lang.reflect.Proxy.newProxyInstance(Connection.class.getClassLoader(), new Class<?>[]{Connection.class},
                    (proxy, method, values) -> {
                        if (method.getName().equals("prepareStatement") && failSqlWithoutMessage) throw new java.sql.SQLException();
                        if (method.getName().equals("prepareStatement") && sqlFailure != null) throw sqlFailure;
                        if (method.getName().equals("commit")) commits++;
                        try { return method.invoke(delegate, values); }
                        catch (java.lang.reflect.InvocationTargetException error) { throw error.getCause(); }
                    });
            }
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
            expect(request(client, base, "PATCH", connections + "/conn-1", input, "0", false), 400, "IDEMPOTENCY_KEY_REQUIRED");
            expect(request(client, base, "PATCH", connections + "/conn-1", "{broken", "1", true), 400, "INVALID_JSON");
            String edited = input.replace("手册仓库", "修订仓库");
            expect(request(client, base, "PATCH", connections + "/conn-1", edited, "0", true), 409, "ROW_VERSION_CONFLICT");
            expect(request(client, base, "PATCH", connections + "/conn-1", edited, "1", true), 200, "\"name\":\"修订仓库\"");
            expect(request(client, base, "PATCH", connections + "/conn-1/state", "{\"status\":\"inactive\"}", null, true), 428, "ROW_VERSION_REQUIRED");
            expect(request(client, base, "PATCH", connections + "/conn-1/state", "{\"status\":\"unknown\"}", "2", true), 422, "GITLAB_STATE_INVALID");
            expect(request(client, base, "PATCH", connections + "/conn-1/state", "{\"status\":\"inactive\"}", "2", true), 200, "\"status\":\"inactive\"");
            String mapping = "{\"connectionId\":\"conn-1\",\"defaultBranch\":\"main\",\"enabledBranches\":[\"dev\"],\"zhPaths\":[\"docs/zh\"]}";
            expect(request(client, base, "PUT", mappings, mapping, null, false), 400, "IDEMPOTENCY_KEY_REQUIRED");
            expect(request(client, base, "PUT", mappings, mapping, null, true), 200, "\"connectionId\":\"conn-1\"");
            expect(request(client, base, "PUT", mappings, mapping, "0", true), 409, "ROW_VERSION_CONFLICT");
            expect(request(client, base, "GET", mappings, null, null, false), 200, "\"zhPaths\":[\"docs/zh\"]");
            expect(request(client, base, "DELETE", connections, null, null, false), 405, "METHOD_NOT_ALLOWED");
            String[][] invalidConnections = {
                {"name", "手册仓库", "", "GITLAB_CONNECTION_NAME_REQUIRED"},
                {"baseUrl", "https://gitlab.example", "", "GITLAB_BASE_URL_REQUIRED"},
                {"projectPath", "team/docs", "", "GITLAB_PROJECT_REQUIRED"},
                {"defaultBranch", "main", "", "GITLAB_DEFAULT_BRANCH_REQUIRED"},
                {"mode", "sandbox", "unknown", "GITLAB_RUN_MODE_INVALID"},
                {"authMode", "service_account", "unknown", "GITLAB_AUTH_MODE_INVALID"},
                {"purpose", "read_write", "unknown", "GITLAB_PURPOSE_INVALID"},
                {"status", "active", "unknown", "GITLAB_STATE_INVALID"}
            };
            for (String[] invalid : invalidConnections) {
                String originalField = "\"" + invalid[0] + "\":\"" + invalid[1] + "\"";
                String invalidField = "\"" + invalid[0] + "\":\"" + invalid[2] + "\"";
                expect(request(client, base, "PUT", connections, input.replace(originalField, invalidField), "3", true), 422, invalid[3]);
            }
            expect(request(client, base, "PUT", connections, input, "invalid", true), 400, "INVALID_ROW_VERSION");
            expect(request(client, base, "PATCH", connections + "/conn-1/state", "{}", "invalid", true), 400, "INVALID_ROW_VERSION");
            expect(request(client, base, "PATCH", connections + "/conn-1/state", "{}", "3", false), 400, "IDEMPOTENCY_KEY_REQUIRED");
            expect(request(client, base, "PUT", mappings, mapping, "invalid", true), 400, "INVALID_ROW_VERSION");
            expect(request(client, base, "PUT", mappings, "{}", "1", true), 422, "GITLAB_CONNECTION_REQUIRED");
            expect(request(client, base, "PUT", mappings, mapping.replace("conn-1", "missing"), "1", true), 404, "GITLAB_CONNECTION_NOT_FOUND");
            expect(request(client, base, "PUT", mappings, mapping.replace("[\"docs/zh\"]", "[]"), "1", true), 422, "映射必须包含合法的分支和中英文路径");
            expect(request(client, base, "PUT", mappings, mapping.replace("docs/zh", "../private"), "1", true), 422, "MAPPING_VALIDATION_FAILED");
            versionMappings(client, base, database);
            for (String sqlState : new String[]{"23505", "08006"}) {
                int commitsBeforeFailure = commits;
                sqlFailure = new java.sql.SQLException("fixture SQL failure", sqlState);
                try {
                    HttpResponse<String> failed = request(client, base, "PATCH", connections + "/conn-1", edited.replace("修订仓库", "不应保存"), "3", true);
                    expect(failed, sqlState.equals("23505") ? 409 : 503,
                        sqlState.equals("23505") ? "CONFIG_CONFLICT" : "STORAGE_UNAVAILABLE");
                    if (sqlState.equals("23505")) expect(failed, 409, "配置与现有记录冲突，请刷新后重试");
                    if (commits != commitsBeforeFailure) throw new AssertionError("SQLState failure committed configuration");
                } finally { sqlFailure = null; }
                HttpResponse<String> recovered = request(client, base, "GET", connections + "/conn-1", null, null, false);
                expect(recovered, 200, "\"name\":\"修订仓库\"");
                expect(recovered, 200, "\"rowVersion\":3");
            }
            int commitsBeforeFailure = commits;
            failSqlWithoutMessage = true;
            try {
                HttpResponse<String> readFailure = request(client, base, "GET", connections, null, null, false);
                expect(readFailure, 503, "STORAGE_UNAVAILABLE");
                expect(readFailure, 503, "平台数据库暂时不可用");
                HttpResponse<String> writeFailure = request(client, base, "PATCH", connections + "/conn-1", edited, "3", true);
                expect(writeFailure, 503, "STORAGE_UNAVAILABLE");
                expect(writeFailure, 503, "平台数据库暂时不可用");
                if (commits != commitsBeforeFailure) throw new AssertionError("failed GitLab SQL committed data");
            } finally { failSqlWithoutMessage = false; }
            HttpResponse<String> unchanged = request(client, base, "GET", connections + "/conn-1", null, null, false);
            expect(unchanged, 200, "\"name\":\"修订仓库\"");
            expect(unchanged, 200, "\"rowVersion\":3");
            expect(request(client, base, "GET", mappings, null, null, false), 200, "\"zhPaths\":[\"docs/zh\"]");
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

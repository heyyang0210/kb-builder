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
    private static SQLException databaseFailure;
    private static int exportRows = 1;
    private static boolean outlinePresent;
    private static boolean outlineDeleted;
    private static int outlineReferenceQueries;
    private static long revision;
    private static boolean deleted;
    private static boolean taskMigrationActive;
    private static int commits;
    private static int rollbacks;
    private static boolean handbookPresent;
    private static volatile String draftPayload;
    private static volatile long draftRevision;
    private static volatile boolean draftDeleted;
    private static boolean concurrentProductionRevision;
    private static volatile boolean failDraftWarmRead;
    private static final java.util.concurrent.CountDownLatch failedWarmRead = new java.util.concurrent.CountDownLatch(1);
    private static final Timestamp NOW = Timestamp.valueOf("2026-11-05 00:00:00");

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] { type }, handler);
    }

    private static ResultSet rows(String sql) throws SQLException {
        if (sql.startsWith("SELECT MIGRATION_STATUS FROM KC_TASK_MIGRATION")) {
            int[] cursor = { 0 };
            return proxy(ResultSet.class, (self, method, args) -> switch (method.getName()) {
                case "next" -> ++cursor[0] == 1;
                case "getString" -> taskMigrationActive ? "ACTIVE" : "VERIFIED";
                case "close" -> null;
                default -> throw new UnsupportedOperationException("TaskMigration." + method.getName());
            });
        }
        if (sql.startsWith("SELECT REVISION, PAYLOAD, DELETED FROM KC_RECORD WHERE NAMESPACE=?")) {
            int[] cursor = { 0 };
            return proxy(ResultSet.class, (self, method, args) -> switch (method.getName()) {
                case "next" -> ++cursor[0] == 1 && payload != null;
                case "getLong" -> concurrentProductionRevision ? revision - 1 : revision;
                case "getString" -> deleted ? "Y" : "N";
                case "getClob" -> new SerialClob(payload.toCharArray());
                case "close" -> null;
                default -> throw new UnsupportedOperationException("ProductionBaseline." + method.getName());
            });
        }
        if (sql.startsWith("SELECT DELETED_AT FROM KC_MANUAL_OUTLINE_VERSION")) {
            int[] cursor = { 0 };
            return proxy(ResultSet.class, (self, method, args) -> switch (method.getName()) {
                case "next" -> ++cursor[0] == 1 && outlinePresent;
                case "getTimestamp" -> outlineDeleted ? NOW : null;
                case "close" -> null;
                default -> throw new UnsupportedOperationException("OutlineReference." + method.getName());
            });
        }
        if (sql.startsWith("SELECT REVISION, DELETED FROM KC_RECORD WHERE NAMESPACE='handbook-production'")
                || sql.startsWith("SELECT PAYLOAD, REVISION, DELETED FROM KC_RECORD WHERE NAMESPACE='handbook-production'")) {
            int[] cursor = { 0 };
            return proxy(ResultSet.class, (self, method, args) -> switch (method.getName()) {
                case "next" -> ++cursor[0] == 1 && draftPayload != null;
                case "getLong" -> draftRevision;
                case "getString" -> draftDeleted ? "Y" : "N";
                case "getClob" -> new SerialClob(draftPayload.toCharArray());
                case "close" -> null;
                default -> throw new UnsupportedOperationException("DraftResultSet." + method.getName());
            });
        }
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
            case "next" -> ++cursor[0] <= (sql.startsWith("SELECT NAMESPACE,") ? exportRows : 1) && payload != null;
            case "getLong" -> revision;
            case "getString" -> {
                int column = (Integer) args[0];
                if (sql.startsWith("SELECT NAMESPACE,")) yield switch (column) {
                    case 1 -> "fixture";
                    case 2 -> cursor[0] == 1 ? "item" : "second";
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
            case "executeQuery" -> {
                if (databaseFailure != null) throw databaseFailure;
                if (failDraftWarmRead && sql.startsWith("SELECT PAYLOAD, REVISION, DELETED FROM KC_RECORD WHERE NAMESPACE='handbook-production'")) {
                    failedWarmRead.countDown();
                    throw new SQLException("fixture draft warm read unavailable");
                }
                if (sql.startsWith("SELECT DELETED_AT FROM KC_MANUAL_OUTLINE_VERSION")) outlineReferenceQueries++;
                yield rows(sql);
            }
            case "executeUpdate" -> {
                if (databaseFailure != null) throw databaseFailure;
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

    private static HttpResponse<String> taskAggregateRequest(HttpClient client, URI base, String method,
                                                             String body, String revisionHeader) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(base.resolve("/v1/records/document_tasks/state"));
        if (revisionHeader != null) builder.header("If-Match", revisionHeader);
        builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(body));
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static void expect(HttpResponse<String> response, int status, String fragment) {
        if (response.statusCode() != status || !response.body().contains(fragment))
            throw new AssertionError(status + "/" + fragment + " expected, got " + response.statusCode() + "/" + response.body());
    }

    private static HttpResponse<String> draftRequest(HttpClient client, URI base) throws Exception {
        return client.send(HttpRequest.newBuilder(base.resolve("/v1/records/handbook-production/state?draftKey=manual%3AHB-1"))
            .GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private static HttpResponse<String> awaitDraft(HttpClient client, URI base, long revision, String content) throws Exception {
        long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(3);
        HttpResponse<String> response;
        do {
            response = draftRequest(client, base);
            if (response.statusCode() == 200) {
                expect(response, 200, "\"revision\":" + revision);
                expect(response, 200, "\"content\":\"" + content + "\"");
                return response;
            }
            expect(response, 503, "DRAFT_PROJECTION_REBUILDING");
            Thread.sleep(20);
        } while (System.nanoTime() < deadline);
        throw new AssertionError("draft projection did not rebuild: " + response.body());
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
            exportRows = 2;
            HttpResponse<String> multipleExport = client.send(HttpRequest.newBuilder(base.resolve("/v1/export")).GET().build(), HttpResponse.BodyHandlers.ofString());
            expect(multipleExport, 200, "\"key\":\"second\"");
            if (!multipleExport.body().contains("},{\"namespace\":\"fixture\""))
                throw new AssertionError("exported records must be separated by a JSON comma: " + multipleExport.body());
            exportRows = 1;
            expect(request(client, base, "GET", null, null), 200, "\"value\":1");
            HttpResponse<String> unchanged = request(client, base, "GET", null, "\"1\"");
            if (unchanged.statusCode() != 304) throw new AssertionError("conditional read: " + unchanged.statusCode());
            expect(request(client, base, "PUT", "{\"value\":1}", "1"), 200, "\"revision\":1");
            expect(request(client, base, "PUT", "{\"value\":1}", null), 200, "\"revision\":1");
            if (revision != 1) throw new AssertionError("idempotent write without If-Match changed revision");
            expect(request(client, base, "PUT", "{\"value\":2}", "0"), 409, "REVISION_CONFLICT");
            expect(request(client, base, "PUT", "{\"value\":2}", "1"), 200, "\"revision\":2");
            expect(request(client, base, "DELETE", null, "1"), 409, "REVISION_CONFLICT");
            expect(request(client, base, "DELETE", null, "2"), 200, "\"revision\":3");
            expect(request(client, base, "GET", null, null), 200, "\"deleted\":true");
            HttpResponse<String> deletedExport = client.send(HttpRequest.newBuilder(base.resolve("/v1/export")).GET().build(), HttpResponse.BodyHandlers.ofString());
            expect(deletedExport, 200, "\"deleted\":true");
            if (commits < 6 || rollbacks < 2) throw new AssertionError("transaction boundaries not exercised");
            // Public JSON round trip covers escapes and control characters in persisted record content.
            String escaped = "{\"text\":\"\\\"\\\\\\/\\b\\f\\n\\r\\t\\u0001\\u4e2d\"}";
            expect(request(client, base, "PUT", escaped, "3"), 200, "\"revision\":4");
            HttpResponse<String> escapedRead = request(client, base, "GET", null, null);
            expect(escapedRead, 200, "\\b\\f\\n\\r\\t\\u0001中");
            if (!escapedRead.body().contains("\\\"\\\\/")) throw new AssertionError("quote, slash and backslash JSON round trip: " + escapedRead.body());
            String large = "{\"text\":\"" + "内容".repeat(900) + "\"}";
            expect(request(client, base, "PUT", large, "4"), 200, "\"revision\":5");
            HttpResponse<byte[]> compressed = client.send(HttpRequest.newBuilder(base.resolve("/v1/records/fixture/item"))
                .header("Accept-Encoding", "GZIP").GET().build(), HttpResponse.BodyHandlers.ofByteArray());
            if (compressed.statusCode() != 200 || !compressed.headers().firstValue("Content-Encoding").orElse("").equals("gzip")
                    || !compressed.headers().firstValue("Vary").orElse("").equals("Accept-Encoding"))
                throw new AssertionError("gzip response negotiation");
            try (java.util.zip.GZIPInputStream gzip = new java.util.zip.GZIPInputStream(new java.io.ByteArrayInputStream(compressed.body()))) {
                String decoded = new String(gzip.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
                if (!decoded.contains("\"payload\":" + large)) throw new AssertionError("gzip body does not preserve payload");
            }
            HttpResponse<String> plain = client.send(HttpRequest.newBuilder(base.resolve("/v1/records/fixture/item"))
                .header("Accept-Encoding", "identity").GET().build(), HttpResponse.BodyHandlers.ofString());
            expect(plain, 200, large);
            if (plain.headers().firstValue("Content-Encoding").isPresent()) throw new AssertionError("identity response compressed");
            String validPayload = payload;
            try {
                payload = "{broken";
                expect(request(client, base, "GET", null, null), 503, "DATABASE_UNAVAILABLE");
            } finally { payload = validPayload; }
            int beforeFailure = commits;
            try {
                databaseFailure = new SQLException("fixture unavailable", "08006", 900);
                expect(request(client, base, "GET", null, null), 503, "DATABASE_UNAVAILABLE");
                expect(request(client, base, "PUT", "{\"value\":3}", "5"), 503, "DATABASE_UNAVAILABLE");
                expect(request(client, base, "DELETE", null, "5"), 503, "DATABASE_UNAVAILABLE");
                expect(draftRequest(client, base), 503, "DATABASE_UNAVAILABLE");
                HttpResponse<String> failedExport = client.send(HttpRequest.newBuilder(base.resolve("/v1/export")).GET().build(), HttpResponse.BodyHandlers.ofString());
                expect(failedExport, 503, "DATABASE_UNAVAILABLE");
            } finally { databaseFailure = null; }
            if (commits != beforeFailure || revision != 5 || !payload.equals(validPayload) || deleted)
                throw new AssertionError("failed database operations changed record state");
            expect(request(client, base, "GET", null, null), 200, "\"revision\":5");
            expect(request(client, base, "PUT", "", "5"), 400, "INVALID_JSON");
            // JDBC may report a lifecycle rejection independently of the explicit reference precheck.
            for (String failureCode : new String[]{"OUTLINE_DELETED", "OUTLINE_NOT_FOUND", "fixture SQL detail"}) {
                String savedPayload = payload;
                String savedDigest = digest;
                long savedRevision = revision;
                boolean savedDeleted = deleted;
                int savedCommits = commits;
                int savedRollbacks = rollbacks;
                try {
                    databaseFailure = new SQLException(failureCode, "45000");
                    HttpResponse<String> rejected = client.send(HttpRequest.newBuilder(base.resolve("/v1/records/fixture/item"))
                        .header("If-Match", "5").header("X-Request-ID", "sql-rejection-1")
                        .PUT(HttpRequest.BodyPublishers.ofString("{\"value\":3}")).build(), HttpResponse.BodyHandlers.ofString());
                    boolean lifecycle = failureCode.startsWith("OUTLINE_");
                    expect(rejected, lifecycle ? 409 : 503, lifecycle ? failureCode : "DATABASE_UNAVAILABLE");
                    if (!"sql-rejection-1".equals(rejected.headers().firstValue("X-Request-ID").orElse(null)))
                        throw new AssertionError("SQL rejection lost request correlation");
                    if (!lifecycle && rejected.body().contains(failureCode))
                        throw new AssertionError("SQL rejection exposed database detail");
                    if (commits != savedCommits || rollbacks <= savedRollbacks || revision != savedRevision
                            || deleted != savedDeleted || !java.util.Objects.equals(payload, savedPayload)
                            || !java.util.Objects.equals(digest, savedDigest))
                        throw new AssertionError("SQL rejection changed committed record or skipped rollback: " + failureCode);
                } finally {
                    databaseFailure = null;
                }
                expect(request(client, base, "GET", null, null), 200, savedPayload);
            }
            int beforeReferenceRejection = commits;
            String withOutline = "{\"outlineVersionId\":\"outline-missing\"}";
            HttpResponse<String> missingOutline = request(client, base, "PUT", withOutline, "5");
            expect(missingOutline, 409, "OUTLINE_NOT_FOUND");
            expect(missingOutline, 409, "\"details\":{\"namespace\":\"fixture\",\"key\":\"item\",\"outlineVersionId\":\"outline-missing\"}");
            outlinePresent = true; outlineDeleted = true;
            expect(request(client, base, "PUT", withOutline, "5"), 409, "OUTLINE_DELETED");
            outlinePresent = false; outlineDeleted = false;
            if (commits != beforeReferenceRejection || revision != 5 || !payload.equals(validPayload) || deleted)
                throw new AssertionError("rejected outline references changed persisted record");
            outlinePresent = true;
            int beforeValidReferences = outlineReferenceQueries;
            String twoOutlines = "{\"outlineVersionId\":\"outline-one\",\"baseOutlineVersionId\":\"outline-two\"}";
            expect(request(client, base, "PUT", twoOutlines, "5"), 200, "\"revision\":6");
            if (outlineReferenceQueries != beforeValidReferences + 2 || revision != 6 || !twoOutlines.equals(payload))
                throw new AssertionError("both valid outline references must be locked and persisted");
            expect(request(client, base, "GET", null, null), 200, twoOutlines);
            outlinePresent = false;
            payload = null; digest = null; revision = 0; deleted = false;
            draftPayload = null; draftRevision = 0; draftDeleted = false;
            URI production = base.resolve("/v1/records/handbook-production/state");
            String productionState = "{\"drafts\":{\"manual:HB-1\":{\"draftId\":\"d1\",\"currentRevisionId\":\"r1\","
                + "\"revisions\":[{\"revisionId\":\"r1\",\"content\":\"HTTP production body\"}]}}}";
            int beforeProductionCommits = commits;
            for (int expectedRevision = 0; expectedRevision < 3; expectedRevision++) {
                if (expectedRevision == 2) deleted = true;
                String content = productionState.replace("HTTP production body", "HTTP production body " + expectedRevision);
                expect(client.send(HttpRequest.newBuilder(production).header("If-Match", String.valueOf(expectedRevision))
                    .PUT(HttpRequest.BodyPublishers.ofString(content)).build(), HttpResponse.BodyHandlers.ofString()),
                    200, "\"revision\":" + (expectedRevision + 1));
                if (commits != beforeProductionCommits + expectedRevision + 1 || deleted || !content.equals(payload))
                    throw new AssertionError("production state write did not preserve committed payload/revision");
                draftPayload = payload; draftRevision = revision;
                expect(draftRequest(client, base), 200, "\"content\":\"HTTP production body " + expectedRevision + "\"");
                beforeProductionCommits++; // Draft read commits its read-only transaction.
            }
            int beforeConcurrentCommit = commits;
            String beforeConcurrentPayload = payload;
            concurrentProductionRevision = true;
            try {
                expect(client.send(HttpRequest.newBuilder(production).header("If-Match", "3")
                    .PUT(HttpRequest.BodyPublishers.ofString(productionState)).build(), HttpResponse.BodyHandlers.ofString()),
                    409, "REVISION_CONFLICT");
                if (commits != beforeConcurrentCommit || revision != 3 || !payload.equals(beforeConcurrentPayload))
                    throw new AssertionError("concurrent production revision changed committed state");
            } finally { concurrentProductionRevision = false; }
            expect(client.send(HttpRequest.newBuilder(production).GET().build(), HttpResponse.BodyHandlers.ofString()),
                200, "HTTP production body 2");
            draftPayload = null; draftRevision = 0; draftDeleted = false;
            expect(draftRequest(client, base), 200, "\"payload\":null");
            draftPayload = "{\"drafts\":{\"manual:HB-1\":{\"draftId\":\"d1\",\"currentRevisionId\":\"r1\","
                + "\"revisions\":[{\"revisionId\":\"old\",\"content\":\"old body\"},{\"revisionId\":\"r1\",\"content\":\"current body\"}]},"
                + "\"other\":{\"draftId\":\"d2\",\"currentRevisionId\":\"r2\",\"revisions\":[{\"revisionId\":\"r2\",\"content\":\"other body\"}]}}}";
            draftRevision = 7;
            failDraftWarmRead = true;
            HttpResponse<String> rebuilding = draftRequest(client, base);
            expect(rebuilding, 503, "DRAFT_PROJECTION_REBUILDING");
            if (!rebuilding.headers().firstValue("Retry-After").orElse("").equals("1"))
                throw new AssertionError("draft rebuild retry hint missing");
            if (!failedWarmRead.await(3, java.util.concurrent.TimeUnit.SECONDS))
                throw new AssertionError("background draft rebuild did not query failed JDBC fixture");
            failDraftWarmRead = false;
            HttpResponse<String> currentDraft = awaitDraft(client, base, 7, "current body");
            if (currentDraft.body().contains("old body") || currentDraft.body().contains("other body")
                    || !currentDraft.headers().firstValue("Server-Timing").orElse("").contains("draft_projection"))
                throw new AssertionError("draft projection leaked history or another context: " + currentDraft.body());
            draftPayload = draftPayload.replace("current body", "updated body");
            draftRevision = 8;
            expect(draftRequest(client, base), 503, "DRAFT_PROJECTION_REBUILDING");
            awaitDraft(client, base, 8, "updated body");
            draftDeleted = true;
            expect(draftRequest(client, base), 200, "\"payload\":null");
            String legacy = Main.Json.stringify(Map.of("schemaVersion", 2,
                "tasks", java.util.List.of(Map.of("number", "YDBRD-42")),
                "config", Map.of("defaultOwnerId", "177")));
            payload = legacy;
            digest = java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(legacy.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            revision = 1; deleted = false; taskMigrationActive = true;
            String configOnly = Main.Json.stringify(Map.of("schemaVersion", 2,
                "tasks", java.util.List.of(Map.of("number", "YDBRD-42")),
                "config", Map.of("defaultOwnerId", "178")));
            expect(taskAggregateRequest(client, base, "PUT", configOnly, "1"), 200, "\"revision\":2");
            if (!configOnly.equals(payload)) throw new AssertionError("Compatible legacy config was not saved");
            int beforeLegacyRejections = commits;
            String changedTasks = Main.Json.stringify(Map.of("schemaVersion", 2,
                "tasks", java.util.List.of(Map.of("number", "YDBRD-99")),
                "config", Map.of("defaultOwnerId", "178")));
            expect(taskAggregateRequest(client, base, "PUT", changedTasks, "2"), 409,
                "DOCUMENT_TASK_LEGACY_WRITE_DISABLED");
            expect(taskAggregateRequest(client, base, "PUT", "[]", "2"), 409,
                "DOCUMENT_TASK_LEGACY_WRITE_DISABLED");
            deleted = true;
            expect(taskAggregateRequest(client, base, "PUT", configOnly, "2"), 409,
                "DOCUMENT_TASK_LEGACY_WRITE_DISABLED");
            deleted = false;
            expect(taskAggregateRequest(client, base, "DELETE", null, null), 409,
                "DOCUMENT_TASK_DELETE_FORBIDDEN");
            if (commits != beforeLegacyRejections || revision != 2 || !configOnly.equals(payload))
                throw new AssertionError("Legacy task aggregate rejection changed committed record");
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

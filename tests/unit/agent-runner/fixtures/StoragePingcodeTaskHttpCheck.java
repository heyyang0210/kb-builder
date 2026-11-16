import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
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
import java.sql.SQLException;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.logging.Logger;

/** Exercises the production PingCode HTTP handler against an isolated JDBC state machine. */
public final class StoragePingcodeTaskHttpCheck {
    private static final String SOURCE_URL = "https://pingcode.yasdb.com/pjm/projects/YDBRD/defect/test-42";
    private static final String REQUIREMENT_URL = "https://pingcode.yasdb.com/ship/products/yashan/baselines/v1/ideas";
    private static String sourceId;
    private static String currentSourceType = "TICKET";
    private static String currentSourceName = "隔离来源";
    private static String currentSourceUrl = SOURCE_URL;
    private static String currentProductType = "DB";
    private static String currentSourceState = "ACTIVE";
    private static String runId;
    private static String runStatus;
    private static String runError;
    private static String sourceVersion;
    private static String criteriaSha256;
    private static String previewDigest;
    private static Integer pageCount;
    private static Integer rowCount;
    private static long pagesRead;
    private static long rowsRead;
    private static long srCount;
    private static long newCount;
    private static long changedCount;
    private static long unchangedCount;
    private static long removedCount;
    private static long irSnapshotCount;
    private static long irRelationNumber;
    private static int relatedSrCount;
    private static String snapshotTitle;
    private static String snapshotBody;
    private static String snapshotHash;
    private static String previousRunId;
    private static String previousSnapshotTitle;
    private static String previousSnapshotBody;
    private static String previousSnapshotHash;
    private static long runSourceRevision = 1;
    private static long taskRowVersion;
    private static final List<Object[]> changes = new ArrayList<>();
    private static String migrationStatus = "VERIFIED";
    private static String lastConfirmedRun;
    private static String taskRevisionDigest;
    private static String configOwnerId = "177";
    private static String taskPayload;
    private static String taskAttention = "NORMAL";
    private static String primarySource;
    private static String resourcePath;
    private static String resourceState;
    private static String snapshotResourceState = "COMPLETE";
    private static long resourceVersion;
    private static boolean taskSourcePresent;
    private static String previousTaskSourceId;
    private static long sourceRevision = 1;
    private static int taskWrites;
    private static int resourceWrites;
    private static final String RESOURCE_ID = "a".repeat(64);
    private static final String RESOURCE_URL = "https://pingcode.yasdb.com/image/test.png";
    private static int sourceWrites;
    private static int runWrites;
    private static int commits;
    private static boolean duplicateSourceConstraint;

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] { type }, handler);
    }

    private static ResultSet rows(List<Object[]> values) {
        int[] index = { -1 };
        return proxy(ResultSet.class, (self, method, args) -> {
            if ("next".equals(method.getName())) return ++index[0] < values.size();
            if ("close".equals(method.getName())) return null;
            if (method.getName().startsWith("get")) {
                Object value = values.get(index[0])[(Integer) args[0] - 1];
                if ("getLong".equals(method.getName())) return value == null ? 0L : ((Number) value).longValue();
                if ("getInt".equals(method.getName())) return value == null ? 0 : ((Number) value).intValue();
                if ("getString".equals(method.getName())) return value == null ? null : String.valueOf(value);
                return value;
            }
            throw new UnsupportedOperationException("ResultSet." + method.getName());
        });
    }

    private static ResultSet query(String sql, Map<Integer, Object> binds) {
        if (sql.startsWith("SELECT SOURCE_ID FROM KC_PINGCODE_SOURCE WHERE CONNECTION_ID=?"))
            return rows(sourceId != null && currentSourceUrl.equals(binds.get(3))
                ? List.<Object[]>of(new Object[] { sourceId }) : List.of());
        if (sql.startsWith("SELECT COUNT(DISTINCT T.SR_NUMBER) FROM KC_PINGCODE_TASK_SOURCE"))
            return rows(List.<Object[]>of(new Object[] { taskSourcePresent ? 1L : 0L }));
        if (sql.startsWith("SELECT T.SR_NUMBER,S.TITLE,T.LAST_RUN_ID,R.CONFIRMED_AT FROM KC_PINGCODE_TASK_SOURCE"))
            return rows(taskSourcePresent ? List.<Object[]>of(new Object[] {
                42L, snapshotTitle, lastConfirmedRun, null }) : List.of());
        if (sql.startsWith("SELECT P.SOURCE_ID,P.SOURCE_NAME,P.SOURCE_TYPE,P.SOURCE_URL,P.CONNECTION_ID,P.SOURCE_STATE,")
            || sql.startsWith("SELECT P.SOURCE_ID,P.SOURCE_NAME,P.SOURCE_TYPE,P.SOURCE_URL,CONNECTION_ID")
            || sql.startsWith("SELECT SOURCE_ID,SOURCE_NAME,SOURCE_TYPE,SOURCE_URL,CONNECTION_ID")) {
            if (sourceId == null || sql.contains("WHERE SOURCE_ID=?") && !sourceId.equals(binds.get(1)))
                return rows(List.of());
            return rows(List.<Object[]>of(new Object[] { sourceId, currentSourceName, currentSourceType, currentSourceUrl,
                "isolated-connection", currentSourceState, sourceRevision, lastConfirmedRun, "177", null, null, currentProductType, 0L }));
        }
        if (sql.startsWith("SELECT 1 FROM KC_PINGCODE_RUN WHERE SOURCE_ID=? AND RUN_STATUS='COLLECTING'"))
            return rows(runId != null && "COLLECTING".equals(runStatus) ? List.<Object[]>of(new Object[] { 1 }) : List.of());
        if (sql.startsWith("SELECT 1 FROM KC_PINGCODE_RUN WHERE SOURCE_ID=?"))
            return rows(runId == null ? List.of() : List.<Object[]>of(new Object[] { 1 }));
        if (sql.startsWith("SELECT 1 FROM KC_PINGCODE_TASK_SOURCE WHERE SOURCE_ID=?"))
            return rows(taskSourcePresent ? List.<Object[]>of(new Object[] { 1 }) : List.of());
        if (sql.startsWith("SELECT RUN_ID FROM KC_PINGCODE_RUN WHERE SOURCE_ID=?"))
            return rows(runId == null ? List.of() : List.<Object[]>of(new Object[] { runId }));
        if (sql.startsWith("SELECT RUN_ID,SOURCE_ID,SOURCE_REVISION,RUN_STATUS")) {
            if (runId == null || !runId.equals(binds.get(1))) return rows(List.of());
            return rows(List.<Object[]>of(new Object[] { runId, sourceId, runSourceRevision, runStatus,
                sourceVersion, criteriaSha256, previewDigest, taskRevisionDigest, pageCount, rowCount,
                srCount, newCount, changedCount, unchangedCount, removedCount, irSnapshotCount, 0L, pagesRead, rowsRead,
                runError, "177", null, null, null }));
        }
        if (sql.startsWith("SELECT UPSTREAM_ID,BODY_SHA256 FROM KC_PINGCODE_SNAPSHOT"))
            return rows(snapshotTitle == null ? List.of() : List.<Object[]>of(new Object[] { "upstream-42", snapshotHash }));
        if (sql.startsWith("SELECT COUNT(*) FROM KC_PINGCODE_SNAPSHOT S WHERE S.RUN_ID=? AND NOT EXISTS"))
            return rows(List.<Object[]>of(new Object[] { snapshotTitle != null && previousRunId == null ? 1L : 0L }));
        if (sql.startsWith("SELECT COUNT(*) FROM KC_PINGCODE_SNAPSHOT S JOIN KC_PINGCODE_SNAPSHOT O"))
            return rows(List.<Object[]>of(new Object[] { snapshotTitle != null && previousRunId != null ? 1L : 0L }));
        if (sql.startsWith("SELECT COUNT(*) FROM KC_PINGCODE_SNAPSHOT O WHERE O.RUN_ID=? AND NOT EXISTS"))
            return rows(List.<Object[]>of(new Object[] { snapshotTitle == null && previousRunId != null ? 1L : 0L }));
        if (sql.startsWith("SELECT COUNT(*) FROM KC_PINGCODE_SNAPSHOT"))
            return rows(List.<Object[]>of(new Object[] { snapshotTitle == null ? 0L : 1L }));
        if (sql.startsWith("SELECT COUNT(*) FROM KC_PINGCODE_IR_SNAPSHOT"))
            return rows(List.<Object[]>of(new Object[] {
                sql.contains("RELATED_SR_COUNT=0") ? 0L : irSnapshotCount }));
        if (sql.startsWith("SELECT N.SR_NUMBER,T.ROW_VERSION FROM"))
            return rows(snapshotTitle == null && previousRunId == null ? List.of() : List.<Object[]>of(new Object[] {
                42L, taskRowVersion == 0 ? null : taskRowVersion }));
        if (sql.startsWith("SELECT PAYLOAD,ROW_VERSION FROM KC_DOCUMENT_TASK_CONFIG"))
            return rows(List.<Object[]>of(new Object[] {
                Main.Json.stringify(Map.of("defaultOwnerId", configOwnerId)), 1L }));
        if (sql.startsWith("SELECT SR_NUMBER,TITLE FROM KC_PINGCODE_SNAPSHOT WHERE RUN_ID"))
            return rows(snapshotTitle == null ? List.of() : List.<Object[]>of(new Object[] { 42L, snapshotTitle }));
        if (sql.startsWith("SELECT SR_NUMBER FROM KC_PINGCODE_SNAPSHOT WHERE RUN_ID=? AND NOT EXISTS"))
            return rows(snapshotTitle == null && previousRunId != null
                ? List.<Object[]>of(new Object[] { 42L }) : List.of());
        if (sql.startsWith("SELECT PRESENT FROM KC_PINGCODE_TASK_SOURCE"))
            return rows(taskSourcePresent ? List.<Object[]>of(new Object[] { "Y" }) : List.of());
        if (sql.startsWith("SELECT T.SOURCE_ID,T.IS_PRIMARY FROM KC_PINGCODE_TASK_SOURCE")) {
            if (!taskSourcePresent) return rows(List.of());
            if (previousTaskSourceId != null) return rows(List.<Object[]>of(
                new Object[] { previousTaskSourceId, "N" }, new Object[] { sourceId, "N" }));
            return rows(List.<Object[]>of(new Object[] {
                sourceId, sourceId.equals(primarySource) ? "Y" : "N" }));
        }
        if (sql.startsWith("SELECT S.TITLE,P.SOURCE_TYPE,P.SOURCE_URL FROM KC_PINGCODE_SOURCE"))
            return rows(List.<Object[]>of(new Object[] { snapshotTitle, "TICKET", SOURCE_URL }));
        if (sql.startsWith("SELECT PAYLOAD FROM KC_DOCUMENT_TASK WHERE TASK_PREFIX='YDBRD'"))
            return rows(taskPayload == null ? List.of() : List.<Object[]>of(new Object[] { taskPayload }));
        if (sql.startsWith("SELECT N.SR_NUMBER,N.TITLE,O.TITLE,N.BODY_SHA256"))
            return rows(previousRunId == null ? List.of() : List.<Object[]>of(new Object[] {
                42L, snapshotTitle, previousSnapshotTitle, snapshotHash, previousSnapshotHash,
                snapshotBody, previousSnapshotBody }));
        if (sql.startsWith("SELECT DISTINCT N.SR_NUMBER FROM KC_PINGCODE_IR_RELATION"))
            return rows(List.of());
        if (sql.startsWith("SELECT S.RUN_ID,S.TITLE,S.BODY_MARKDOWN,S.BODY_SHA256"))
            return rows(!"CONFIRMED".equals(runStatus) && !"CONFIRMED_MISSING_IMAGES".equals(runStatus)
                ? List.of() : List.<Object[]>of(new Object[] {
                runId, snapshotTitle, snapshotBody, snapshotHash, null, resourceVersion, snapshotResourceState, sourceId,
                "隔离来源", currentSourceType, currentSourceUrl, null }));
        if (sql.startsWith("SELECT RESOURCE_ID,RESOURCE_VERSION,RESOURCE_PATH,CONTENT_TYPE"))
            return rows(resourceVersion == 0 ? List.of() : List.<Object[]>of(new Object[] {
                RESOURCE_ID, resourceVersion, resourcePath, "image/png", 10L, resourceState, null }));
        if (sql.startsWith("SELECT COUNT(*) FROM KC_PINGCODE_CHANGE"))
            return rows(List.<Object[]>of(new Object[] { (long) changes.size() }));
        if (sql.startsWith("SELECT C.RUN_ID,C.FIELD_NAME,C.BEFORE_VALUE")) {
            List<Object[]> values = new ArrayList<>();
            for (Object[] change : changes) values.add(new Object[] {
                runId, change[0], change[1], change[2], null, sourceId,
                "隔离来源", currentSourceType, currentSourceUrl });
            return rows(values);
        }
        if (sql.startsWith("SELECT COUNT(*) FROM KC_PINGCODE_RESOURCE R"))
            return rows(List.<Object[]>of(new Object[] { "FAILED".equals(resourceState) ? 1L : 0L }));
        if (sql.startsWith("SELECT R.SR_NUMBER,R.RESOURCE_ID,R.RESOURCE_VERSION"))
            return rows(!"FAILED".equals(resourceState) ? List.of() : List.<Object[]>of(new Object[] {
                42L, RESOURCE_ID, resourceVersion, resourcePath, "UPSTREAM_503" }));
        if (sql.startsWith("SELECT RESOURCE_VERSION,RESOURCE_STATE,RESOURCE_PATH FROM KC_PINGCODE_RESOURCE"))
            return rows(resourceVersion == 0 || !RESOURCE_ID.equals(binds.get(3))
                ? List.of() : List.<Object[]>of(new Object[] {
                resourceVersion, resourceState, resourcePath }));
        if (sql.startsWith("SELECT S.SR_NUMBER,S.TITLE,S.BODY_SHA256,O.TITLE,O.BODY_SHA256"))
            return rows(snapshotTitle == null ? List.of() : List.<Object[]>of(new Object[] {
                42L, snapshotTitle, snapshotHash, previousSnapshotTitle, previousSnapshotHash }));
        if (sql.startsWith("SELECT O.SR_NUMBER,O.TITLE,O.BODY_SHA256,NULL,NULL"))
            return rows(snapshotTitle == null && previousRunId != null
                ? List.<Object[]>of(new Object[] { 42L, previousSnapshotTitle, previousSnapshotHash, null, null })
                : List.of());
        if (sql.startsWith("SELECT T.SOURCE_ID,S.SOURCE_NAME,S.SOURCE_TYPE,T.IS_PRIMARY"))
            return rows(taskSourcePresent ? List.<Object[]>of(new Object[] {
                sourceId, "隔离来源", currentSourceType, sourceId.equals(primarySource) ? "Y" : "N" }) : List.of());
        if (sql.startsWith("SELECT IR_NUMBER FROM KC_PINGCODE_IR_RELATION"))
            return rows(irRelationNumber == 0 ? List.of() : List.<Object[]>of(new Object[] { irRelationNumber }));
        if (sql.startsWith("SELECT IR_NUMBER FROM KC_PINGCODE_IR_SNAPSHOT")) return rows(List.of());
        if (sql.startsWith("SELECT MIGRATION_STATUS FROM KC_TASK_MIGRATION"))
            return rows(List.<Object[]>of(new Object[] { migrationStatus }));
        if (sql.startsWith("SELECT S.TITLE,S.BODY_MARKDOWN,S.BODY_SHA256,S.SOURCE_UPDATED_AT"))
            return rows(snapshotTitle == null ? List.of() : List.<Object[]>of(new Object[] {
                snapshotTitle, snapshotBody, snapshotHash, null, resourceVersion, snapshotResourceState,
                sourceId, "隔离来源", currentSourceType, currentSourceUrl }));
        throw new AssertionError("Unexpected PingCode query: " + sql);
    }

    private static PreparedStatement statement(String sql) {
        Map<Integer, Object> binds = new HashMap<>();
        int[] batchCount = { 0 };
        return proxy(PreparedStatement.class, (self, method, args) -> switch (method.getName()) {
            case "setString", "setLong", "setInt", "setObject" -> { binds.put((Integer) args[0], args[1]); yield null; }
            case "setNull" -> { binds.put((Integer) args[0], null); yield null; }
            case "addBatch" -> { batchCount[0]++; yield null; }
            case "executeBatch" -> { yield new int[batchCount[0]]; }
            case "executeQuery" -> query(sql, binds);
            case "executeUpdate" -> {
                if (sql.startsWith("INSERT INTO KC_PINGCODE_SOURCE")) {
                    sourceId = String.valueOf(binds.get(1)); currentSourceType = String.valueOf(binds.get(3));
                    currentSourceName = String.valueOf(binds.get(2)); currentSourceState = "ACTIVE";
                    currentProductType = String.valueOf(binds.get(4));
                    sourceRevision = 1; currentSourceUrl = String.valueOf(binds.get(5)); sourceWrites++; yield 1;
                }
                if (sql.startsWith("UPDATE KC_PINGCODE_SOURCE SET SOURCE_NAME=")) {
                    if (duplicateSourceConstraint) throw new SQLException("duplicate source URL", "23505");
                    currentSourceName = String.valueOf(binds.get(1)); currentSourceType = String.valueOf(binds.get(2));
                    currentSourceUrl = String.valueOf(binds.get(3)); currentProductType = String.valueOf(binds.get(4)); sourceRevision++; yield 1;
                }
                if (sql.startsWith("UPDATE KC_PINGCODE_SOURCE SET SOURCE_STATE=")) {
                    currentSourceState = String.valueOf(binds.get(1)); sourceRevision++; yield 1;
                }
                if (sql.startsWith("DELETE FROM KC_PINGCODE_SOURCE")) { sourceId = null; yield 1; }
                if (sql.startsWith("INSERT INTO KC_PINGCODE_RUN")) {
                    if ("CONFIRMED".equals(runStatus) && runId != null && runId.equals(lastConfirmedRun)) {
                        previousRunId = runId;
                        previousSnapshotTitle = snapshotTitle;
                        previousSnapshotBody = snapshotBody;
                        previousSnapshotHash = snapshotHash;
                    }
                    runId = String.valueOf(binds.get(1)); runStatus = "COLLECTING"; runError = null;
                    runSourceRevision = ((Number) binds.get(3)).longValue();
                    sourceVersion = null; criteriaSha256 = null; previewDigest = null;
                    taskRevisionDigest = null;
                    pageCount = null; rowCount = null; pagesRead = 0; rowsRead = 0; srCount = 0;
                    newCount = 0; changedCount = 0; unchangedCount = 0;
                    removedCount = 0;
                    snapshotTitle = null; snapshotBody = null; snapshotHash = null;
                    resourcePath = null; resourceState = null; resourceVersion = 0;
                    snapshotResourceState = "COMPLETE";
                    irSnapshotCount = 0; irRelationNumber = 0; relatedSrCount = 0;
                    runWrites++; yield 1;
                }
                if (sql.startsWith("INSERT INTO KC_PINGCODE_SNAPSHOT")) {
                    snapshotTitle = String.valueOf(binds.get(5));
                    snapshotBody = String.valueOf(binds.get(6));
                    snapshotHash = String.valueOf(binds.get(7));
                    yield 1;
                }
                if (sql.startsWith("INSERT INTO KC_PINGCODE_IR_SNAPSHOT")) {
                    irSnapshotCount++; relatedSrCount = ((Number) binds.get(4)).intValue(); yield 1;
                }
                if (sql.startsWith("INSERT INTO KC_PINGCODE_IR_RELATION")) {
                    irRelationNumber = ((Number) binds.get(3)).longValue(); yield 1;
                }
                if (sql.startsWith("INSERT INTO KC_PINGCODE_RESOURCE")) {
                    boolean retry = sql.contains("RESOURCE_VERSION,");
                    resourceVersion = retry ? ((Number) binds.get(4)).longValue() : 1;
                    resourcePath = String.valueOf(binds.get(retry ? 5 : 4));
                    resourceState = String.valueOf(binds.get(retry ? 8 : 7));
                    resourceWrites++; yield 1;
                }
                if (sql.startsWith("UPDATE KC_PINGCODE_SNAPSHOT SET RESOURCE_STATE='MISSING'")) {
                    snapshotResourceState = "MISSING"; yield 1;
                }
                if (sql.startsWith("UPDATE KC_PINGCODE_SNAPSHOT SET RESOURCE_VERSION=")) {
                    snapshotResourceState = "FAILED".equals(resourceState) ? "MISSING" : "COMPLETE";
                    yield 1;
                }
                if (sql.startsWith("UPDATE KC_PINGCODE_RUN SET SOURCE_VERSION=")) {
                    sourceVersion = String.valueOf(binds.get(1)); criteriaSha256 = String.valueOf(binds.get(2));
                    pageCount = ((Number) binds.get(3)).intValue(); rowCount = ((Number) binds.get(4)).intValue();
                    pagesRead++; rowsRead += ((Number) binds.get(5)).longValue(); yield 1;
                }
                if (sql.startsWith("UPDATE KC_PINGCODE_RUN SET RUN_STATUS='AWAITING_CONFIRM'")) {
                    runStatus = "AWAITING_CONFIRM"; previewDigest = String.valueOf(binds.get(1));
                    taskRevisionDigest = String.valueOf(binds.get(2));
                    srCount = ((Number) binds.get(3)).longValue();
                    newCount = ((Number) binds.get(4)).longValue();
                    changedCount = ((Number) binds.get(5)).longValue();
                    unchangedCount = ((Number) binds.get(6)).longValue();
                    removedCount = ((Number) binds.get(7)).longValue(); yield 1;
                }
                if (sql.startsWith("UPDATE KC_PINGCODE_TASK_SOURCE SET LAST_RUN_ID=")) {
                    if (!taskSourcePresent) yield 0;
                    taskSourcePresent = "Y".equals(binds.get(2)); yield 1;
                }
                if (sql.startsWith("INSERT INTO KC_PINGCODE_TASK_SOURCE")) {
                    taskSourcePresent = true; yield 1;
                }
                if (sql.startsWith("INSERT INTO KC_DOCUMENT_TASK (")) {
                    taskPayload = String.valueOf(binds.get(2)); taskRowVersion = 1; taskWrites++; yield 1;
                }
                if (sql.startsWith("UPDATE KC_DOCUMENT_TASK SET PAYLOAD=")) {
                    taskPayload = String.valueOf(binds.get(1)); taskRowVersion++; taskWrites++; yield 1;
                }
                if (sql.startsWith("UPDATE KC_DOCUMENT_TASK SET ATTENTION=")) {
                    taskAttention = "SECONDARY"; taskRowVersion++; yield 1;
                }
                if (sql.startsWith("INSERT INTO KC_PINGCODE_CHANGE")) {
                    changes.add(new Object[] { binds.get(3), binds.get(4), binds.get(5) }); yield 1;
                }
                if (sql.startsWith("UPDATE KC_PINGCODE_TASK_SOURCE SET IS_PRIMARY=")) {
                    primarySource = (String) binds.get(1); yield 1;
                }
                if (sql.startsWith("UPDATE KC_PINGCODE_SOURCE SET LAST_CONFIRMED_RUN=")) {
                    lastConfirmedRun = String.valueOf(binds.get(1)); sourceRevision++; yield 1;
                }
                if (sql.startsWith("UPDATE KC_PINGCODE_RUN SET RUN_STATUS=CASE WHEN EXISTS")) {
                    runStatus = "MISSING".equals(snapshotResourceState) ? "CONFIRMED_MISSING_IMAGES" : "CONFIRMED";
                    yield 1;
                }
                if (sql.startsWith("UPDATE KC_PINGCODE_RUN SET RUN_STATUS='CONFIRMED' WHERE")) {
                    if ("COMPLETE".equals(snapshotResourceState)) runStatus = "CONFIRMED";
                    yield 1;
                }
                if (sql.startsWith("DELETE FROM KC_DOCUMENT_TASK_")) yield 0;
                if (sql.startsWith("UPDATE KC_PINGCODE_RUN SET RUN_STATUS=?")) {
                    if (!"COLLECTING".equals(runStatus)) yield 0;
                    runStatus = String.valueOf(binds.get(1)); runError = (String) binds.get(2);
                    yield 1;
                }
                throw new AssertionError("Unexpected PingCode update: " + sql);
            }
            case "close" -> null;
            default -> throw new UnsupportedOperationException("PreparedStatement." + method.getName());
        });
    }

    private static Connection connection() {
        return proxy(Connection.class, (self, method, args) -> switch (method.getName()) {
            case "prepareStatement" -> statement((String) args[0]);
            case "setAutoCommit", "close", "rollback" -> null;
            case "commit" -> { commits++; yield null; }
            case "isClosed" -> false;
            default -> throw new UnsupportedOperationException("Connection." + method.getName());
        });
    }

    private static void registerDriver() throws Exception {
        DriverManager.registerDriver(new Driver() {
            public boolean acceptsURL(String url) { return url.startsWith("jdbc:fixture:business"); }
            public Connection connect(String url, Properties properties) { return acceptsURL(url) ? connection() : null; }
            public DriverPropertyInfo[] getPropertyInfo(String url, Properties properties) { return new DriverPropertyInfo[0]; }
            public int getMajorVersion() { return 1; }
            public int getMinorVersion() { return 0; }
            public boolean jdbcCompliant() { return false; }
            public Logger getParentLogger() { return Logger.getGlobal(); }
        });
    }

    private static HttpResponse<String> request(HttpClient client, URI base, String method, String path,
                                                String body) throws Exception {
        return request(client, base, method, path, body, Map.of());
    }

    private static HttpResponse<String> request(HttpClient client, URI base, String method, String path,
                                                String body, Map<String, String> headers) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(base.resolve(path));
        if (body == null) builder.GET();
        else builder.header("Content-Type", "application/json").header("Idempotency-Key", "fixture-key")
            .method(method, HttpRequest.BodyPublishers.ofString(body));
        headers.forEach(builder::header);
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static HttpResponse<String> expect(HttpClient client, URI base, String method, String path,
                                               String body, Map<String, String> headers, int status, String fragment)
        throws Exception {
        HttpResponse<String> response = request(client, base, method, path, body, headers);
        if (response.statusCode() != status || !response.body().contains(fragment))
            throw new AssertionError(method + " " + path + ": " + response.statusCode() + " " + response.body());
        return response;
    }

    private static HttpResponse<String> expect(HttpClient client, URI base, String method, String path,
                                               String body, int status, String fragment) throws Exception {
        HttpResponse<String> response = request(client, base, method, path, body);
        if (response.statusCode() != status || !response.body().contains(fragment))
            throw new AssertionError(method + " " + path + ": " + response.statusCode() + " " + response.body());
        return response;
    }

    private static Map<String, Object> sourceInput() {
        Map<String, Object> input = new java.util.LinkedHashMap<>();
        input.put("name", "隔离来源");
        input.put("type", "TICKET");
        input.put("productType", "DB");
        input.put("url", SOURCE_URL);
        input.put("connectionId", "isolated-connection");
        input.put("actor", "177");
        return input;
    }

    private static void rejectInvalidSourceWrites(HttpClient client, URI base, String path) throws Exception {
        Object[][] invalid = {
            { "name", null }, { "name", " " }, { "name", "x".repeat(256) },
            { "type", null }, { "type", "EPIC" }, { "productType", null }, { "productType", "UNKNOWN" },
            { "url", null }, { "url", "x".repeat(2001) }, { "url", "http://pingcode.yasdb.com/x" },
            { "connectionId", null }, { "connectionId", " " }, { "actor", null }, { "actor", " " }
        };
        int writes = sourceWrites;
        for (Object[] field : invalid) {
            Map<String, Object> input = sourceInput();
            input.put((String) field[0], field[1]);
            expect(client, base, "POST", path, Main.Json.stringify(input), 422, "PINGCODE_SOURCE_INVALID");
            if (sourceWrites != writes) throw new AssertionError("Rejected source creation wrote a row");
        }
    }

    private static void rejectInvalidSourceUpdates(HttpClient client, URI base, String item) throws Exception {
        Object[][] invalid = {
            { "name", null }, { "name", " " }, { "name", "x".repeat(256) },
            { "type", null }, { "type", "EPIC" }, { "productType", null }, { "productType", "UNKNOWN" },
            { "url", null }, { "url", "x".repeat(2001) }, { "url", "http://pingcode.yasdb.com/x" }
        };
        int writes = sourceWrites;
        for (Object[] field : invalid) {
            Map<String, Object> input = sourceInput();
            input.put((String) field[0], field[1]);
            input.put("revision", 1);
            expect(client, base, "PATCH", item, Main.Json.stringify(input), 422, "PINGCODE_SOURCE_INVALID");
            if (sourceWrites != writes || sourceRevision != 1)
                throw new AssertionError("Rejected source update changed persisted state");
        }
    }

    @SuppressWarnings("unchecked")
    private static String id(HttpResponse<String> response) throws Exception {
        Map<String, Object> envelope = (Map<String, Object>) Main.Json.parse(response.body());
        return String.valueOf(((Map<String, Object>) envelope.get("data")).get("id"));
    }

    private static void requirementScenario(HttpClient client, URI base) throws Exception {
        String sourcePath = "/v1/pingcode-task-sync/sources";
        String source = id(expect(client, base, "POST", sourcePath,
            Main.Json.stringify(Map.of("name", "隔离来源", "type", "REQUIREMENT", "productType", "DB", "url", REQUIREMENT_URL,
                "connectionId", "isolated-connection", "actor", "177")), 201, "REQUIREMENT"));
        String run = id(expect(client, base, "POST", sourcePath + "/" + source + "/runs",
            "{\"revision\":1,\"actor\":\"177\"}", 201, "COLLECTING"));
        String path = "/v1/pingcode-task-sync/runs/" + run;
        Map<String, Object> ir = Map.of("ir", "YASHAN-7", "irId", "upstream-ir-7",
            "workItems", List.of(Map.of("number", "YDBRD-42", "id", "upstream-42",
                "shortId", "short-42", "title", "需求工单", "description", "需求正文")));
        Map<String, Object> page = new java.util.LinkedHashMap<>(Map.of("pageIndex", 0, "pageCount", 1,
            "count", 1, "sourceVersion", "requirement-v1", "criteriaSha256", "a".repeat(64),
            "sourceType", "requirement", "items", List.of(ir)));
        page.put("items", List.of(Map.of("ir", "YASHAN-7", "irId", "upstream-ir-7",
            "workItems", "invalid")));
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(page),
            422, "PINGCODE_RELATION_INVALID");
        if (pagesRead != 0 || irSnapshotCount != 0)
            throw new AssertionError("Invalid relationship was staged");
        page.put("items", List.of(ir));
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(page), 200,
            "\"pagesRead\":1");
        expect(client, base, "POST", path + "/finish",
            "{\"digest\":\"" + "b".repeat(64) + "\"}", 200, "\"irCount\":1");
        expect(client, base, "GET", path + "/preview", null, 200, "YASHAN-7");
        if (irSnapshotCount != 1 || irRelationNumber != 7 || relatedSrCount != 1
            || srCount != 1 || !"REQUIREMENT".equals(currentSourceType)
            || !REQUIREMENT_URL.equals(currentSourceUrl))
            throw new AssertionError("Requirement snapshot lost the IR/SR relationship");
    }

    private static void boundaryScenario(HttpClient client, URI base) throws Exception {
        String sources = "/v1/pingcode-task-sync/sources";
        String source = id(expect(client, base, "POST", sources,
            Main.Json.stringify(Map.of("name", "隔离来源", "type", "TICKET", "productType", "DB", "url", SOURCE_URL,
                "connectionId", "isolated-connection", "actor", "177")), 201, "TICKET"));
        String runs = sources + "/" + source + "/runs";
        currentSourceState = "DISABLED";
        expect(client, base, "POST", runs, "{\"revision\":1,\"actor\":\"177\"}",
            422, "PINGCODE_SOURCE_DISABLED");
        currentSourceState = "ACTIVE";
        String run = id(expect(client, base, "POST", runs,
            "{\"revision\":1,\"actor\":\"177\"}", 201, "COLLECTING"));
        String path = "/v1/pingcode-task-sync/runs/" + run;
        expect(client, base, "POST", path + "/unknown", "{}", 405, "METHOD_NOT_ALLOWED");
        expect(client, base, "GET", "/v1/pingcode-task-sync/unknown", null, 405, "METHOD_NOT_ALLOWED");
        expect(client, base, "POST", path + "/pages", "[", 400, "INVALID_JSON");
        expect(client, base, "GET", path + "/preview?page=bad", null, 400, "INVALID_JSON");
        expect(client, base, "POST", path + "/confirm", "{}", 422,
            "PREVIEW_CONFIRM_INPUT_INVALID");
        expect(client, base, "GET", path + "/resources", null, 409, "PINGCODE_RUN_NOT_CONFIRMABLE");
        expect(client, base, "POST", path + "/resources/retry", "{}", 409,
            "PINGCODE_RUN_NOT_CONFIRMABLE");
        expect(client, base, "POST", path + "/confirm",
            "{\"digest\":\"" + "a".repeat(64) + "\",\"expectedRevision\":1}",
            409, "PINGCODE_RUN_NOT_CONFIRMABLE");
        Map<String, Object> item = Map.of("number", "YDBRD-42", "id", "upstream-42",
            "shortId", "short-42", "title", "边界工单", "description", "边界正文");
        Map<String, Object> page = new java.util.LinkedHashMap<>(Map.of("pageIndex", 0,
            "pageCount", 2, "count", 2, "sourceVersion", "boundary-v1",
            "criteriaSha256", "a".repeat(64), "sourceType", "ticket", "items", List.of(item)));
        page.put("pageCount", 0); page.put("count", 1); page.put("items", List.of());
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(page), 422,
            "PINGCODE_PAGE_INVALID");
        page.put("count", 0); page.put("items", List.of(item));
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(page), 422,
            "PINGCODE_PAGE_INVALID");
        page.put("pageCount", 2); page.put("count", 2);
        page.put("sourceType", "requirement");
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(page), 422,
            "PINGCODE_PAGE_INVALID");
        page.put("sourceType", "ticket");
        int beforeInvalidItems = commits;
        Map<String, Object> invalidItem = new java.util.LinkedHashMap<>(item);
        invalidItem.put("number", "INVALID-42");
        page.put("items", List.of(invalidItem));
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(page), 422,
            "PINGCODE_ITEM_INVALID");
        invalidItem.put("number", "YDBRD-42");
        invalidItem.put("imageResources", "invalid");
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(page), 422,
            "PINGCODE_RESOURCE_INVALID");
        invalidItem.put("imageResources", List.of("invalid"));
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(page), 422,
            "PINGCODE_RESOURCE_INVALID");
        snapshotTitle = null; snapshotBody = null; snapshotHash = null;
        Map<String, Object> ready = new java.util.LinkedHashMap<>(Map.of("id", RESOURCE_ID,
            "state", "READY", "path", "invalid-path", "byteCount", 10,
            "contentType", "image/png"));
        invalidItem.put("imageResources", List.of(ready));
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(page), 422,
            "PINGCODE_RESOURCE_INVALID");
        snapshotTitle = null; snapshotBody = null; snapshotHash = null;
        ready.put("path", "assets/" + RESOURCE_ID + ".png");
        ready.put("byteCount", 0);
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(page), 422,
            "PINGCODE_RESOURCE_INVALID");
        snapshotTitle = null; snapshotBody = null; snapshotHash = null;
        if (pagesRead != 0 || rowsRead != 0 || resourceWrites != 0 || commits != beforeInvalidItems)
            throw new AssertionError("Invalid staged item changed page or resource state");
        page.put("items", List.of(item));
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(page), 200,
            "\"pagesRead\":1");
        Map<String, Object> next = new java.util.LinkedHashMap<>(page);
        next.put("pageIndex", 1);
        next.put("pageCount", 3);
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(next), 409,
            "PINGCODE_SOURCE_CHANGED");
        next.put("pageCount", 2); next.put("count", 3);
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(next), 409,
            "PINGCODE_SOURCE_CHANGED");
        next.put("count", 2); next.put("sourceVersion", "boundary-v2");
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(next), 409,
            "PINGCODE_SOURCE_CHANGED");
        next.put("sourceVersion", "boundary-v1"); next.put("criteriaSha256", "b".repeat(64));
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(next), 409,
            "PINGCODE_SOURCE_CHANGED");
        next.put("criteriaSha256", "a".repeat(64)); next.put("items", List.of(item, item));
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(next), 422,
            "PINGCODE_PAGE_INVALID");
        if (pagesRead != 1 || rowsRead != 1)
            throw new AssertionError("Rejected page changed persisted counters");
        next.put("items", List.of(item));
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(next), 200,
            "\"pagesRead\":2");
        expect(client, base, "POST", path + "/finish",
            "{\"digest\":\"" + "b".repeat(64) + "\"}", 200, "AWAITING_CONFIRM");
        String secondRun = id(expect(client, base, "POST", runs,
            "{\"revision\":1,\"actor\":\"177\"}", 201, "COLLECTING"));
        String secondPath = "/v1/pingcode-task-sync/runs/" + secondRun;
        page.put("pageCount", 1); page.put("count", 1);
        expect(client, base, "POST", secondPath + "/pages", Main.Json.stringify(page), 200,
            "\"pagesRead\":1");
        page.put("pageIndex", 1);
        expect(client, base, "POST", secondPath + "/pages", Main.Json.stringify(page), 422,
            "PINGCODE_PAGE_INVALID");
        if (pagesRead != 1 || rowsRead != 1 || runWrites != 2)
            throw new AssertionError("Out-of-range page changed second run");
    }

    private static void primaryDecisionScenario(HttpClient client, URI base) throws Exception {
        String sources = "/v1/pingcode-task-sync/sources";
        String source = id(expect(client, base, "POST", sources,
            Main.Json.stringify(sourceInput()), 201, "TICKET"));
        String run = id(expect(client, base, "POST", sources + "/" + source + "/runs",
            "{\"revision\":1,\"actor\":\"177\"}", 201, "COLLECTING"));
        String path = "/v1/pingcode-task-sync/runs/" + run;
        Map<String, Object> page = Map.of("pageIndex", 0, "pageCount", 1, "count", 1,
            "sourceVersion", "primary-v1", "criteriaSha256", "a".repeat(64), "sourceType", "ticket",
            "items", List.of(Map.of("number", "YDBRD-42", "id", "upstream-42", "shortId", "short-42",
                "title", "多来源工单", "description", "正文内容")));
        expect(client, base, "POST", path + "/pages", Main.Json.stringify(page), 200, "\"pagesRead\":1");
        previousTaskSourceId = "existing-source";
        taskSourcePresent = true;
        primarySource = null;
        taskPayload = Main.Json.stringify(Map.of("number", "YDBRD-42", "revision", 3));
        taskRowVersion = 3;
        migrationStatus = "ACTIVE";
        expect(client, base, "POST", path + "/finish",
            "{\"digest\":\"" + "b".repeat(64) + "\"}", 200, "AWAITING_CONFIRM");
        int beforeCommit = commits;
        int beforeTaskWrites = taskWrites;
        expect(client, base, "POST", path + "/confirm",
            Main.Json.stringify(Map.of("digest", "b".repeat(64), "expectedRevision", 1,
                "primarySources", Map.of())), 409, "PRIMARY_SOURCE_DECISION_REQUIRED");
        if (commits != beforeCommit || taskWrites != beforeTaskWrites || taskRowVersion != 3
            || !"AWAITING_CONFIRM".equals(runStatus))
            throw new AssertionError("Missing primary-source decision changed persisted state");
    }

    public static void main(String[] args) throws Exception {
        registerDriver();
        Constructor<Main> constructor = Main.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        Main application = constructor.newInstance();
        Method handler = Main.class.getDeclaredMethod("pingcodeTaskSync", HttpExchange.class);
        handler.setAccessible(true);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/pingcode-task-sync", exchange -> {
            try { handler.invoke(application, exchange); }
            catch (ReflectiveOperationException error) {
                Throwable cause = error.getCause() == null ? error : error.getCause();
                cause.printStackTrace();
                throw new IOException(cause);
            }
        });
        server.start();
        URI base = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        HttpClient client = HttpClient.newHttpClient();
        try {
            if (args.length > 0 && "requirement".equals(args[0])) {
                requirementScenario(client, base);
                System.out.println("PASS: PingCode requirement IR/SR real HTTP lifecycle");
                return;
            }
            if (args.length > 0 && "boundary".equals(args[0])) {
                boundaryScenario(client, base);
                System.out.println("PASS: PingCode source and page boundary real HTTP lifecycle");
                return;
            }
            if (args.length > 0 && "primary-decision".equals(args[0])) {
                primaryDecisionScenario(client, base);
                System.out.println("PASS: PingCode multiple-source decision real HTTP boundary");
                return;
            }
            if (args.length > 0 && "crud".equals(args[0])) {
                String path = "/v1/pingcode-task-sync/sources";
                rejectInvalidSourceWrites(client, base, path);
                String source = id(expect(client, base, "POST", path,
                    Main.Json.stringify(Map.of("name", "隔离来源", "type", "TICKET", "productType", "DB", "url", SOURCE_URL,
                        "connectionId", "isolated-connection", "actor", "177")), 201, "\"revision\":1"));
                String item = path + "/" + source;
                rejectInvalidSourceUpdates(client, base, item);
                expect(client, base, "GET", item, null, 200, "\"deletable\":true");
                expect(client, base, "GET", item + "/items?page=1&pageSize=50", null, 200, "\"total\":0");
                expect(client, base, "PATCH", item,
                    "{\"name\":\"已编辑来源\",\"type\":\"TICKET\",\"productType\":\"YCM\",\"url\":\"" + SOURCE_URL + "\",\"revision\":1}",
                    200, "\"productType\":\"YCM\"");
                expect(client, base, "GET", item, null, 200, "\"revision\":2");
                duplicateSourceConstraint = true;
                expect(client, base, "PATCH", item,
                    "{\"name\":\"重复来源\",\"type\":\"TICKET\",\"productType\":\"YCM\",\"url\":\"https://pingcode.yasdb.com/pjm/projects/YDBRD/defect/duplicate\",\"revision\":2}",
                    409, "PINGCODE_SOURCE_CONFLICT");
                duplicateSourceConstraint = false;
                expect(client, base, "PATCH", item,
                    "{\"name\":\"过期写入\",\"type\":\"TICKET\",\"productType\":\"YCM\",\"url\":\"" + SOURCE_URL + "\",\"revision\":1}",
                    409, "ROW_VERSION_CONFLICT");
                expect(client, base, "PATCH", item + "/state", "{\"state\":\"DISABLED\",\"revision\":2}",
                    200, "DISABLED");
                expect(client, base, "PATCH", item + "/state", "{\"state\":\"ACTIVE\",\"revision\":3}",
                    200, "ACTIVE");
                expect(client, base, "DELETE", item, "{}", Map.of("If-Match", "4"), 200, "\"deleted\":true");
                expect(client, base, "GET", item, null, 404, "PINGCODE_SOURCE_NOT_FOUND");
                String referenced = id(expect(client, base, "POST", path,
                    Main.Json.stringify(Map.of("name", "保留历史来源", "type", "TICKET", "productType", "DB", "url", SOURCE_URL,
                        "connectionId", "isolated-connection", "actor", "177")), 201, "\"revision\":1"));
                String referencedPath = path + "/" + referenced;
                String activeRun = id(expect(client, base, "POST", referencedPath + "/runs",
                    "{\"revision\":1,\"actor\":\"177\"}", 201, "COLLECTING"));
                expect(client, base, "GET", referencedPath, null, 200, "\"deletable\":false");
                expect(client, base, "PATCH", referencedPath,
                    "{\"name\":\"改名\",\"type\":\"TICKET\",\"productType\":\"DB\",\"url\":\"https://pingcode.yasdb.com/pjm/projects/YDBRD/defect/other\",\"revision\":1}",
                    409, "PINGCODE_SOURCE_HISTORY_LOCKED");
                expect(client, base, "PATCH", referencedPath + "/state",
                    "{\"state\":\"DISABLED\",\"revision\":1}", 409, "PINGCODE_SOURCE_RUNNING");
                expect(client, base, "DELETE", referencedPath, "{}", Map.of("If-Match", "1"), 409,
                    "PINGCODE_SOURCE_RUNNING");
                expect(client, base, "POST", "/v1/pingcode-task-sync/runs/" + activeRun + "/cancel", "{}", 200,
                    "CANCELLED");
                expect(client, base, "DELETE", referencedPath, "{}", Map.of("If-Match", "1"), 409,
                    "PINGCODE_SOURCE_REFERENCED");
                expect(client, base, "PATCH", referencedPath + "/state",
                    "{\"state\":\"DISABLED\",\"revision\":1}", 200, "DISABLED");
                System.out.println("PASS: PingCode source CRUD real HTTP lifecycle");
                return;
            }
            expect(client, base, "GET", "/v1/pingcode-task-sync/sources", null, 200, "\"data\":[]");
            String path = "/v1/pingcode-task-sync/sources";
            String create = Main.Json.stringify(Map.of("name", "隔离来源", "type", "TICKET", "productType", "DB", "url", SOURCE_URL,
                "connectionId", "isolated-connection", "actor", "177"));
            expect(client, base, "POST", path, create.replace(SOURCE_URL, "http://pingcode.yasdb.com/x"),
                422, "PINGCODE_SOURCE_INVALID");
            String createdId = id(expect(client, base, "POST", path, create, 201, "\"revision\":1"));
            if (!createdId.equals(sourceId)) throw new AssertionError("Source ID was not persisted");
            expect(client, base, "GET", path, null, 200, createdId);
            expect(client, base, "GET", path + "/" + createdId, null, 200, SOURCE_URL);
            expect(client, base, "POST", path, create, 409, "PINGCODE_SOURCE_CONFLICT");
            expect(client, base, "GET", path + "/missing", null, 404, "PINGCODE_SOURCE_NOT_FOUND");
            expect(client, base, "GET", path + "/" + createdId + "/runs", null, 200, "\"data\":[]");
            String runPath = path + "/" + createdId + "/runs";
            expect(client, base, "POST", runPath, "{\"revision\":0,\"actor\":\"177\"}", 409, "ROW_VERSION_CONFLICT");
            String createdRun = id(expect(client, base, "POST", runPath,
                "{\"revision\":1,\"actor\":\"177\"}", 201, "\"COLLECTING\""));
            if (!createdRun.equals(runId)) throw new AssertionError("Run ID was not persisted");
            expect(client, base, "GET", runPath, null, 200, createdRun);
            expect(client, base, "GET", "/v1/pingcode-task-sync/runs/" + createdRun, null, 200, "COLLECTING");
            expect(client, base, "GET", "/v1/pingcode-task-sync/runs/" + createdRun + "/items?page=1&pageSize=50",
                null, 200, "\"total\":0");
            expect(client, base, "POST", "/v1/pingcode-task-sync/runs/" + createdRun + "/cancel", "{}", 200,
                "CANCELLED");
            expect(client, base, "POST", "/v1/pingcode-task-sync/runs/" + createdRun + "/cancel", "{}", 409,
                "PINGCODE_RUN_CONFLICT");
            expect(client, base, "GET", "/v1/pingcode-task-sync/runs/" + createdRun, null, 200, "CANCELLED");
            String failedRun = id(expect(client, base, "POST", runPath,
                "{\"revision\":1,\"actor\":\"177\"}", 201, "COLLECTING"));
            expect(client, base, "POST", "/v1/pingcode-task-sync/runs/" + failedRun + "/fail",
                "{\"errorCode\":\"UPSTREAM_503\"}", 200, "UPSTREAM_503");
            expect(client, base, "GET", "/v1/pingcode-task-sync/runs/" + failedRun, null, 200, "FAILED");
            String stagedRun = id(expect(client, base, "POST", runPath,
                "{\"revision\":1,\"actor\":\"177\"}", 201, "COLLECTING"));
            String stagePath = "/v1/pingcode-task-sync/runs/" + stagedRun;
            Map<String, Object> pageData = new java.util.LinkedHashMap<>(Map.of("pageIndex", 0, "pageCount", 1, "count", 1,
                "sourceVersion", "fixture-v1", "criteriaSha256", "a".repeat(64), "sourceType", "ticket",
                "items", List.of(Map.of("number", "YDBRD-42", "id", "upstream-42",
                    "shortId", "short-42", "title", "隔离工单", "description", "正文内容",
                    "imageResources", List.of(Map.of("id", RESOURCE_ID, "state", "FAILED",
                        "path", RESOURCE_URL, "errorCode", "UPSTREAM_503"))))));
            pageData.put("pageIndex", 1);
            expect(client, base, "POST", stagePath + "/pages", Main.Json.stringify(pageData),
                422, "PINGCODE_PAGE_INVALID");
            if (pagesRead != 0 || snapshotTitle != null) throw new AssertionError("Invalid page was persisted");
            pageData.put("pageIndex", 0);
            expect(client, base, "POST", stagePath + "/pages", Main.Json.stringify(pageData), 200, "\"pagesRead\":1");
            expect(client, base, "POST", stagePath + "/finish", "{\"digest\":\"bad\"}", 409,
                "PINGCODE_RUN_INCOMPLETE");
            expect(client, base, "POST", stagePath + "/finish", "{\"digest\":\"" + "b".repeat(64) + "\"}",
                200, "AWAITING_CONFIRM");
            expect(client, base, "GET", stagePath + "/preview?page=1&pageSize=10", null, 200,
                "\"action\":\"created\"");
            expect(client, base, "GET", stagePath + "/preview?view=created", null, 200,
                "\"total\":1");
            expect(client, base, "GET", stagePath + "/preview?view=updated", null, 200,
                "\"total\":0");
            expect(client, base, "GET", stagePath + "/preview?view=removed", null, 200,
                "\"total\":0");
            expect(client, base, "GET", stagePath + "/preview?view=unknown", null, 422,
                "PINGCODE_PREVIEW_VIEW_INVALID");
            expect(client, base, "GET", stagePath + "/preview?page=0", null, 422,
                "PINGCODE_PREVIEW_PAGE_INVALID");
            String confirm = Main.Json.stringify(Map.of("digest", "b".repeat(64),
                "expectedRevision", 1, "primarySources", Map.of()));
            expect(client, base, "POST", stagePath + "/confirm",
                Main.Json.stringify(Map.of("digest", "c".repeat(64), "expectedRevision", 1,
                    "primarySources", Map.of())), 409, "PREVIEW_STALE");
            expect(client, base, "POST", stagePath + "/confirm", confirm, 409,
                "PINGCODE_TASK_MIGRATION_REQUIRED");
            expect(client, base, "GET", stagePath, null, 200, "AWAITING_CONFIRM");
            if (pagesRead != 1 || rowsRead != 1 || srCount != 1 || !"隔离工单".equals(snapshotTitle)
                || sourceWrites != 1 || runWrites != 3 || commits < 13)
                throw new AssertionError("Rejected requests changed source or run state");
            migrationStatus = "ACTIVE";
            configOwnerId = "";
            expect(client, base, "POST", stagePath + "/confirm", confirm, 409,
                "DOCUMENT_TASK_OWNER_REQUIRED");
            configOwnerId = "177";
            currentSourceState = "DISABLED";
            expect(client, base, "POST", stagePath + "/confirm", confirm, 409, "PREVIEW_STALE");
            currentSourceState = "ACTIVE";
            sourceRevision = 2;
            expect(client, base, "POST", stagePath + "/confirm", confirm, 409, "PREVIEW_STALE");
            sourceRevision = 1;
            taskRowVersion = 1;
            expect(client, base, "POST", stagePath + "/confirm", confirm, 409, "PREVIEW_STALE");
            taskRowVersion = 0;
            if (taskWrites != 0 || !"AWAITING_CONFIRM".equals(runStatus) || lastConfirmedRun != null)
                throw new AssertionError("Rejected confirmations modified task or source");
            expect(client, base, "POST", stagePath + "/confirm", confirm, 200, "CONFIRMED_MISSING_IMAGES");
            if (!"CONFIRMED_MISSING_IMAGES".equals(runStatus) || !stagedRun.equals(lastConfirmedRun)
                || sourceRevision != 2 || !sourceId.equals(primarySource) || !taskSourcePresent
                || taskWrites != 1 || resourceWrites != 1 || !"MISSING".equals(snapshotResourceState)
                || taskPayload == null || !taskPayload.contains("\"ownerId\":\"177\""))
                throw new AssertionError("Confirmed run did not persist task and source projection");
            expect(client, base, "POST", stagePath + "/confirm", confirm, 200, "CONFIRMED_MISSING_IMAGES");
            expect(client, base, "POST", stagePath + "/confirm",
                Main.Json.stringify(Map.of("digest", "c".repeat(64), "expectedRevision", 1,
                    "primarySources", Map.of())), 409, "PREVIEW_STALE");
            if (taskWrites != 1 || sourceRevision != 2)
                throw new AssertionError("Idempotent confirmation wrote task or source again");
            expect(client, base, "GET", "/v1/pingcode-task-sync/tasks/YDBRD-42/source", null, 200,
                "\"markdown\":\"正文内容\"");
            expect(client, base, "GET", "/v1/pingcode-task-sync/tasks/YDBRD-42/changes", null, 200,
                "\"total\":0");
            expect(client, base, "GET", "/v1/pingcode-task-sync/tasks/YDBRD-42/changes?page=0", null, 422,
                "PINGCODE_CHANGE_PAGE_INVALID");
            expect(client, base, "GET", stagePath + "/resources", null, 200, "\"total\":1");
            expect(client, base, "GET", stagePath + "/resources?page=0", null, 422,
                "PINGCODE_RESOURCE_PAGE_INVALID");
            expect(client, base, "POST", stagePath + "/resources/retry", "{}", 422,
                "PINGCODE_RESOURCE_INVALID");
            Map<String, Object> retry = Map.of("number", "YDBRD-42", "id", RESOURCE_ID,
                "state", "READY", "path", "assets/" + RESOURCE_ID + ".png", "contentType", "image/png",
                "byteCount", 10, "expectedVersion", 1, "sourceUrl", RESOURCE_URL);
            Map<String, Object> missingRetry = new java.util.LinkedHashMap<>(retry);
            missingRetry.put("id", "b".repeat(64));
            expect(client, base, "POST", stagePath + "/resources/retry",
                Main.Json.stringify(missingRetry), 404, "PINGCODE_RESOURCE_NOT_FOUND");
            Map<String, Object> staleRetry = new java.util.LinkedHashMap<>(retry);
            staleRetry.put("expectedVersion", 0);
            expect(client, base, "POST", stagePath + "/resources/retry",
                Main.Json.stringify(staleRetry), 409, "PINGCODE_RESOURCE_CONFLICT");
            if (resourceWrites != 1) throw new AssertionError("Rejected retry created resource version");
            Map<String, Object> failedRetry = new java.util.LinkedHashMap<>(retry);
            failedRetry.put("state", "FAILED");
            failedRetry.remove("path"); failedRetry.remove("contentType"); failedRetry.remove("byteCount");
            expect(client, base, "POST", stagePath + "/resources/retry", Main.Json.stringify(failedRetry),
                200, "CONFIRMED_MISSING_IMAGES");
            if (resourceWrites != 2 || resourceVersion != 2 || !"MISSING".equals(snapshotResourceState))
                throw new AssertionError("Failed retry must retain the missing-image state");
            Map<String, Object> recoveredRetry = new java.util.LinkedHashMap<>(retry);
            recoveredRetry.put("expectedVersion", 2);
            expect(client, base, "POST", stagePath + "/resources/retry", Main.Json.stringify(recoveredRetry),
                200, "CONFIRMED");
            expect(client, base, "GET", stagePath + "/resources", null, 200, "\"total\":0");
            expect(client, base, "GET", "/v1/pingcode-task-sync/tasks/YDBRD-42/source", null, 200,
                "\"resourceState\":\"COMPLETE\"");
            if (resourceWrites != 3 || resourceVersion != 3 || !"COMPLETE".equals(snapshotResourceState)
                || !"CONFIRMED".equals(runStatus))
                throw new AssertionError("Image retry did not advance resource version and state");
            if (taskWrites != 1 || sourceRevision != 2)
                throw new AssertionError("Read APIs changed confirmed task or source");
            expect(client, base, "GET", path + "/" + createdId + "/items?page=1&pageSize=1",
                null, 200, "\"total\":1");
            expect(client, base, "GET", path + "/" + createdId + "/items/YDBRD-42",
                null, 200, "\"markdown\":\"正文内容\"");
            expect(client, base, "GET", stagePath + "/items?page=1&pageSize=1",
                null, 200, "\"total\":1");
            expect(client, base, "GET", stagePath + "/items/YDBRD-42",
                null, 200, "\"markdown\":\"正文内容\"");
            expect(client, base, "GET", stagePath + "/unlinked-irs?page=1&pageSize=50",
                null, 200, "\"total\":0");
            String historyRun = id(expect(client, base, "POST", runPath,
                "{\"revision\":2,\"actor\":\"177\"}", 201, "COLLECTING"));
            String historyPath = "/v1/pingcode-task-sync/runs/" + historyRun;
            Map<String, Object> historyPage = Map.of("pageIndex", 0, "pageCount", 1, "count", 1,
                "sourceVersion", "fixture-v2", "criteriaSha256", "c".repeat(64), "sourceType", "ticket",
                "items", List.of(Map.of("number", "YDBRD-42", "id", "upstream-42",
                    "shortId", "short-42", "title", "修订工单", "description", "修订正文")));
            expect(client, base, "POST", historyPath + "/pages", Main.Json.stringify(historyPage),
                200, "\"pagesRead\":1");
            expect(client, base, "POST", historyPath + "/finish",
                "{\"digest\":\"" + "d".repeat(64) + "\"}", 200, "AWAITING_CONFIRM");
            expect(client, base, "GET", historyPath + "/preview", null, 200, "\"action\":\"updated\"");
            expect(client, base, "GET", historyPath + "/preview?view=updated", null, 200,
                "\"total\":1");
            String historyConfirm = Main.Json.stringify(Map.of("digest", "d".repeat(64),
                "expectedRevision", 2, "primarySources", Map.of()));
            expect(client, base, "POST", historyPath + "/confirm", historyConfirm, 200, "CONFIRMED");
            expect(client, base, "GET", "/v1/pingcode-task-sync/tasks/YDBRD-42/source", null, 200,
                "\"markdown\":\"修订正文\"");
            HttpResponse<String> history = expect(client, base, "GET",
                "/v1/pingcode-task-sync/tasks/YDBRD-42/changes", null, 200, "\"total\":2");
            if (!history.body().contains("\"before\":\"隔离工单\"")
                || !history.body().contains("\"after\":\"修订工单\"")
                || !history.body().contains("\"before\":\"正文内容\"")
                || !history.body().contains("\"after\":\"修订正文\"")
                || !historyRun.equals(lastConfirmedRun) || sourceRevision != 3
                || taskWrites != 2 || taskRowVersion != 2 || changes.size() != 2)
                throw new AssertionError("Second confirmation did not record task and field changes");
            String payloadBeforeRemoval = taskPayload;
            String removalRun = id(expect(client, base, "POST", runPath,
                "{\"revision\":3,\"actor\":\"177\"}", 201, "COLLECTING"));
            String removalPath = "/v1/pingcode-task-sync/runs/" + removalRun;
            Map<String, Object> emptyPage = Map.of("pageIndex", 0, "pageCount", 0, "count", 0,
                "sourceVersion", "fixture-v3", "criteriaSha256", "e".repeat(64),
                "sourceType", "ticket", "items", List.of());
            expect(client, base, "POST", removalPath + "/pages", Main.Json.stringify(emptyPage),
                200, "\"pagesRead\":1");
            expect(client, base, "POST", removalPath + "/finish",
                "{\"digest\":\"" + "f".repeat(64) + "\"}", 200, "\"removedCount\":1");
            expect(client, base, "GET", removalPath + "/preview?view=removed", null, 200,
                "\"action\":\"removed\"");
            expect(client, base, "POST", removalPath + "/confirm",
                Main.Json.stringify(Map.of("digest", "f".repeat(64), "expectedRevision", 3,
                    "primarySources", Map.of())), 200, "CONFIRMED");
            if (!removalRun.equals(lastConfirmedRun) || sourceRevision != 4
                || taskSourcePresent || primarySource != null || !"SECONDARY".equals(taskAttention)
                || taskRowVersion != 3 || taskWrites != 2 || !payloadBeforeRemoval.equals(taskPayload))
                throw new AssertionError("Removed source did not downgrade task attention without rewriting body");
        } finally {
            server.stop(0);
            Field field = Main.class.getDeclaredField("connectionPool");
            field.setAccessible(true);
            Object pool = field.get(application);
            Method close = pool.getClass().getDeclaredMethod("closeAll");
            close.setAccessible(true);
            close.invoke(pool);
        }
        System.out.println("PASS: PingCode source and run real HTTP lifecycle");
    }
}

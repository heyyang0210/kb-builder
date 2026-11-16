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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.logging.Logger;

/** Exercises production document-task HTTP reads with isolated synthetic JDBC rows. */
public final class StorageDocumentTaskHttpCheck {
    private static boolean active;
    private static int commits;
    private static long irFilter;
    private static int irRelationQueries;
    private static String attentionFilter;
    private static String visibilitySql;
    private static Map<Integer, Object> visibilityBinds = Map.of();
    private static Map<Integer, Object> mineVisibilityBinds = Map.of();
    private static String combinedFilterSql;
    private static Map<Integer, Object> combinedFilterBinds = Map.of();
    private static String configPayload = "{\"defaultOwnerId\":\"177\"}";
    private static boolean configMissing;
    private static long configRevision = 3;
    private static String taskPayload = "{\"number\":\"YDBRD-42\",\"description\":\"隔离任务\",\"ownerId\":\"177\"}";
    private static long taskRevision = 2;
    private static String newTaskPayload;
    private static int newTaskWrites;
    private static final Map<String, Object[]> writes = new HashMap<>();
    private static final Map<String, List<Map<Integer, Object>>> indexBatches = new HashMap<>();

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
        if (sql.startsWith("SELECT MIGRATION_STATUS FROM KC_TASK_MIGRATION"))
            return rows(List.<Object[]>of(new Object[] { active ? "ACTIVE" : "VERIFIED" }));
        if (sql.startsWith("SELECT PAYLOAD,ROW_VERSION FROM KC_DOCUMENT_TASK_CONFIG"))
            return rows(configMissing ? List.of() : List.<Object[]>of(new Object[] { configPayload, configRevision }));
        if (sql.startsWith("SELECT REQUEST_SHA256,RESULT_PAYLOAD,WRITE_KIND,TASK_PREFIX,TASK_NUMBER")) {
            Object[] write = writes.get(binds.get(1));
            return rows(write == null ? List.of() : List.<Object[]>of(write));
        }
        if (sql.startsWith("SELECT REQUEST_SHA256,RESULT_PAYLOAD FROM KC_DOCUMENT_TASK_WRITE")) {
            Object[] write = writes.get(binds.get(1));
            return rows(write == null ? List.of() : List.<Object[]>of(new Object[] { write[0], write[1] }));
        }
        if (sql.startsWith("SELECT ROW_VERSION,SOURCE_TYPE,PRIMARY_SOURCE_ID FROM KC_DOCUMENT_TASK")) {
            if (Long.valueOf(99).equals(binds.get(2)))
                return rows(newTaskPayload == null ? List.of() : List.<Object[]>of(new Object[] { 1L, null, null }));
            return rows(List.<Object[]>of(new Object[] { taskRevision, "TICKET", "source-1" }));
        }
        if (sql.startsWith("SELECT COUNT(*) FROM KC_DOCUMENT_TASK T")) {
            attentionFilter = String.valueOf(binds.get(1));
            if (sql.contains("R.IR_NUMBER=?")) irFilter = ((Number) binds.get(binds.size())).longValue();
            if (sql.contains("LOWER(T.DESCRIPTION) LIKE ?")) {
                combinedFilterSql = sql; combinedFilterBinds = new HashMap<>(binds);
            }
            if (sql.contains("KC_DOCUMENT_TASK_HANDBOOK")) {
                visibilitySql = sql; visibilityBinds = new HashMap<>(binds);
            }
            return rows(List.<Object[]>of(new Object[] { 1L }));
        }
        if (sql.startsWith("SELECT COUNT(*) FROM (SELECT DISTINCT A.TASK_PREFIX")) {
            if (sql.contains("KC_DOCUMENT_TASK_HANDBOOK")) mineVisibilityBinds = new HashMap<>(binds);
            return rows(List.<Object[]>of(new Object[] { 1L }));
        }
        if (sql.startsWith("SELECT DISTINCT T.PRODUCT_CODE"))
            return rows(List.<Object[]>of(new Object[] { "YashanDB" }));
        if (sql.startsWith("SELECT DISTINCT T.BUSINESS_VERSION"))
            return rows(List.<Object[]>of(new Object[] { "v1" }));
        if (sql.startsWith("SELECT DISTINCT R.SR_NUMBER,R.IR_NUMBER")) {
            irRelationQueries++;
            return rows(List.of());
        }
        if (sql.startsWith("SELECT T.TASK_NUMBER,T.PAYLOAD,T.ROW_VERSION,T.ATTENTION,T.SOURCE_TYPE,T.PRIMARY_SOURCE_ID")
            || sql.startsWith("SELECT TASK_NUMBER,PAYLOAD,ROW_VERSION,ATTENTION,SOURCE_TYPE,PRIMARY_SOURCE_ID")) {
            if (sql.contains("WHERE TASK_PREFIX=?") && Long.valueOf(99).equals(binds.get(2)))
                return rows(newTaskPayload == null ? List.of() : List.<Object[]>of(new Object[] {
                    99L, newTaskPayload, 1L, "NORMAL", null, null }));
            if (sql.contains("WHERE TASK_PREFIX=?") && "YASHAN".equals(binds.get(1))
                && Long.valueOf(7).equals(binds.get(2)))
                return rows(List.<Object[]>of(new Object[] { 7L,
                    "{\"number\":\"YASHAN-7\",\"description\":\"独立需求\"}", 1L, "NORMAL", null, null }));
            if (sql.contains("WHERE TASK_PREFIX=?") && !Long.valueOf(42).equals(binds.get(2))) return rows(List.of());
            return rows(List.<Object[]>of(new Object[] { 42L, taskPayload,
                taskRevision, "NORMAL", "TICKET", "source-1" }));
        }
        throw new AssertionError("Unexpected document-task query: " + sql);
    }

    private static PreparedStatement statement(String sql) {
        Map<Integer, Object> binds = new HashMap<>();
        return proxy(PreparedStatement.class, (self, method, args) -> switch (method.getName()) {
            case "setString", "setLong", "setInt", "setObject" -> { binds.put((Integer) args[0], args[1]); yield null; }
            case "executeQuery" -> query(sql, binds);
            case "executeUpdate" -> {
                if (sql.startsWith("UPDATE KC_DOCUMENT_TASK_CONFIG")) {
                    if (!Long.valueOf(configRevision).equals(binds.get(2))) yield 0;
                    configPayload = String.valueOf(binds.get(1)); configRevision++; yield 1;
                }
                if (sql.startsWith("UPDATE KC_DOCUMENT_TASK SET PAYLOAD=")) {
                    if (!Long.valueOf(taskRevision).equals(binds.get(9))) yield 0;
                    taskPayload = String.valueOf(binds.get(1)); taskRevision++; yield 1;
                }
                if (sql.startsWith("INSERT INTO KC_DOCUMENT_TASK (TASK_PREFIX,TASK_NUMBER,PAYLOAD")) {
                    if (!Long.valueOf(99).equals(binds.get(2)) || newTaskPayload != null)
                        throw new AssertionError("Unexpected new task insert");
                    newTaskPayload = String.valueOf(binds.get(3)); newTaskWrites++; yield 1;
                }
                if (sql.startsWith("INSERT INTO KC_DOCUMENT_TASK_WRITE") && sql.contains("'CONFIG'")) {
                    writes.put(String.valueOf(binds.get(1)), new Object[] { binds.get(2), binds.get(3), "CONFIG", null, 0L });
                    yield 1;
                }
                if (sql.startsWith("INSERT INTO KC_DOCUMENT_TASK_WRITE") && sql.contains("'TASK'")) {
                    writes.put(String.valueOf(binds.get(1)), new Object[] { binds.get(2), binds.get(3), "TASK", binds.get(4), binds.get(5) });
                    yield 1;
                }
                if (sql.startsWith("DELETE FROM KC_DOCUMENT_TASK_")) yield 0;
                throw new AssertionError("Unexpected document-task update: " + sql);
            }
            case "addBatch" -> {
                if (sql.startsWith("INSERT INTO KC_DOCUMENT_TASK_ACTOR ")
                    || sql.startsWith("INSERT INTO KC_DOCUMENT_TASK_REVIEW ")
                    || sql.startsWith("INSERT INTO KC_DOCUMENT_TASK_HANDBOOK "))
                    indexBatches.computeIfAbsent(sql.split(" ")[2], ignored -> new ArrayList<>())
                        .add(new HashMap<>(binds));
                yield null;
            }
            case "executeBatch" -> new int[0];
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

    private static void registerDriver() throws SQLException {
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

    private static void expect(HttpClient client, URI base, String path, int status, String fragment) throws Exception {
        HttpResponse<String> response = client.send(HttpRequest.newBuilder(base.resolve(path)).GET().build(),
            HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != status || !response.body().contains(fragment))
            throw new AssertionError(path + ": " + response.statusCode() + " " + response.body());
    }

    private static void put(HttpClient client, URI base, String path, String key, String body,
                            int status, String fragment) throws Exception {
        HttpResponse<String> response = client.send(HttpRequest.newBuilder(base.resolve(path))
            .header("Content-Type", "application/json").header("Idempotency-Key", key)
            .PUT(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != status || !response.body().contains(fragment))
            throw new AssertionError(path + ": " + response.statusCode() + " " + response.body());
    }

    public static void main(String[] args) throws Exception {
        registerDriver();
        Constructor<Main> constructor = Main.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        Main application = constructor.newInstance();
        Method handler = Main.class.getDeclaredMethod("documentTasks", HttpExchange.class);
        handler.setAccessible(true);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/document-tasks", exchange -> {
            try { handler.invoke(application, exchange); }
            catch (ReflectiveOperationException error) { throw new IOException(error.getCause() == null ? error : error.getCause()); }
        });
        server.start();
        URI base = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        HttpClient client = HttpClient.newHttpClient();
        try {
            expect(client, base, "/v1/document-tasks/status", 200, "\"active\":false");
            expect(client, base, "/v1/document-tasks/config", 409, "DOCUMENT_TASK_MIGRATION_REQUIRED");
            active = true;
            expect(client, base, "/v1/document-tasks/status", 200, "\"active\":true");
            expect(client, base, "/v1/document-tasks/config", 200, "\"defaultOwnerId\":\"177\"");
            expect(client, base, "/v1/document-tasks?attention=secondary&ir=YASHAN-7", 200, "\"total\":1");
            if (!"SECONDARY".equals(attentionFilter) || irFilter != 7)
                throw new AssertionError("Task filters were not bound to SQL");
            expect(client, base, "/v1/document-tasks?ownerId=177&product=YashanDB&version=v1"
                + "&type=ticket&status=in_progress&q=隔离&page=1&pageSize=20", 200, "\"total\":1");
            if (combinedFilterSql == null || !combinedFilterSql.contains("T.OWNER_ID=?")
                || !combinedFilterSql.contains("T.PRODUCT_CODE=?")
                || !combinedFilterSql.contains("T.BUSINESS_VERSION=?")
                || !combinedFilterSql.contains("T.SOURCE_TYPE=?")
                || !combinedFilterSql.contains("T.TASK_STATUS=?")
                || !"177".equals(combinedFilterBinds.get(2))
                || !"YashanDB".equals(combinedFilterBinds.get(3))
                || !"v1".equals(combinedFilterBinds.get(4))
                || !"TICKET".equals(combinedFilterBinds.get(5))
                || !"IN_PROGRESS".equals(combinedFilterBinds.get(6))
                || !"%隔离%".equals(combinedFilterBinds.get(7))
                || !"%隔离%".equals(combinedFilterBinds.get(8)))
                throw new AssertionError("Combined task filters were not bound to SQL");
            expect(client, base, "/v1/document-tasks/mine?principalId=177", 200, "\"YDBRD-42\"");
            expect(client, base, "/v1/document-tasks/mine?principalId=177&page=2&pageSize=1",
                200, "\"YDBRD-42\"");
            expect(client, base, "/v1/document-tasks/by-review/review-1", 200, "\"YDBRD-42\"");
            expect(client, base, "/v1/document-tasks/YDBRD-42", 200, "\"primarySourceId\":\"source-1\"");
            int beforeNonSr = irRelationQueries;
            expect(client, base, "/v1/document-tasks/YASHAN-7", 200, "\"ir\":[]");
            if (irRelationQueries != beforeNonSr)
                throw new AssertionError("Non-SR task queried SR requirement relations");
            expect(client, base, "/v1/document-tasks/YDBRD-99", 404, "DOCUMENT_TASK_NOT_FOUND");
            expect(client, base, "/v1/document-tasks/mine", 422, "DOCUMENT_TASK_ACTOR_INVALID");
            expect(client, base, "/v1/document-tasks?page=bad", 422, "DOCUMENT_TASK_PAGE_INVALID");
            expect(client, base, "/v1/document-tasks?page=0", 422, "DOCUMENT_TASK_PAGE_INVALID");
            expect(client, base, "/v1/document-tasks?pageSize=101", 422, "DOCUMENT_TASK_PAGE_INVALID");
            if (commits != 10) throw new AssertionError("Only successful reads may commit: " + commits);
            String configKey = "config-write-1";
            String configWrite = Main.Json.stringify(Map.of("config", Map.of("defaultOwnerId", "178"),
                "expectedStorageRevision", 3, "idempotencyKey", configKey, "requestSha256", "a".repeat(64)));
            put(client, base, "/v1/document-tasks/config", configKey, configWrite, 200, "\"storageRevision\":4");
            expect(client, base, "/v1/document-tasks/config", 200, "\"defaultOwnerId\":\"178\"");
            put(client, base, "/v1/document-tasks/config", configKey, configWrite, 200, "\"storageRevision\":4");
            expect(client, base, "/v1/document-tasks/writes/" + configKey, 200, "\"defaultOwnerId\":\"178\"");
            String savedConfigResult = String.valueOf(writes.get(configKey)[1]);
            int beforeCorruptReplay = commits;
            writes.get(configKey)[1] = "[]";
            put(client, base, "/v1/document-tasks/config", configKey, configWrite, 422,
                "DOCUMENT_TASK_CONFIG_INVALID");
            writes.get(configKey)[1] = savedConfigResult;
            if (configRevision != 4 || commits != beforeCorruptReplay)
                throw new AssertionError("Corrupt config replay changed state");
            String staleConfig = Main.Json.stringify(Map.of("config", Map.of("defaultOwnerId", "179"),
                "expectedStorageRevision", 3, "idempotencyKey", "config-stale", "requestSha256", "b".repeat(64)));
            put(client, base, "/v1/document-tasks/config", "config-stale", staleConfig, 409,
                "DOCUMENT_TASK_CONFIG_VERSION_CONFLICT");
            String taskKey = "task-write-1";
            String taskWrite = Main.Json.stringify(Map.of("task", Map.of("number", "YDBRD-42",
                "description", "更新任务", "ownerId", "177"), "expectedRowVersion", 2,
                "idempotencyKey", taskKey, "requestSha256", "c".repeat(64)));
            put(client, base, "/v1/document-tasks/YDBRD-42", taskKey, taskWrite, 200, "\"rowVersion\":3");
            expect(client, base, "/v1/document-tasks/YDBRD-42", 200, "更新任务");
            put(client, base, "/v1/document-tasks/YDBRD-42", taskKey, taskWrite, 200, "\"rowVersion\":3");
            expect(client, base, "/v1/document-tasks/writes/" + taskKey, 200, "更新任务");
            String savedTaskResult = String.valueOf(writes.get(taskKey)[1]);
            beforeCorruptReplay = commits;
            writes.get(taskKey)[1] = "[";
            expect(client, base, "/v1/document-tasks/writes/" + taskKey, 422,
                "DOCUMENT_TASK_RESULT_INVALID");
            writes.get(taskKey)[1] = savedTaskResult;
            if (taskRevision != 3 || commits != beforeCorruptReplay)
                throw new AssertionError("Corrupt task replay changed state");
            String staleTask = Main.Json.stringify(Map.of("task", Map.of("number", "YDBRD-42",
                "description", "过期写入", "ownerId", "177"), "expectedRowVersion", 2,
                "idempotencyKey", "task-stale", "requestSha256", "d".repeat(64)));
            put(client, base, "/v1/document-tasks/YDBRD-42", "task-stale", staleTask, 409,
                "DOCUMENT_TASK_VERSION_CONFLICT");
            if (configRevision != 4 || taskRevision != 3 || commits != 18)
                throw new AssertionError("Failed or replayed writes changed state: " + commits);
            int beforeVisibility = commits;
            expect(client, base, "/v1/document-tasks?visibleHandbooks=", 200, "\"total\":1");
            if (visibilitySql == null || !visibilitySql.contains("KC_DOCUMENT_TASK_HANDBOOK")
                || visibilitySql.contains("HANDBOOK_ID NOT IN") || visibilityBinds.size() != 1)
                throw new AssertionError("Empty visibility set did not restrict handbook tasks");
            expect(client, base, "/v1/document-tasks?visibleHandbooks=handbook-1,handbook-2",
                200, "\"total\":1");
            if (!"handbook-1".equals(visibilityBinds.get(2))
                || !"handbook-2".equals(visibilityBinds.get(3))
                || !visibilitySql.contains("HANDBOOK_ID NOT IN (?,?)"))
                throw new AssertionError("Visible handbook IDs were not bound in order");
            expect(client, base, "/v1/document-tasks/mine?principalId=177&visibleHandbooks=handbook-1,handbook-2",
                200, "\"total\":1");
            if (!"177".equals(mineVisibilityBinds.get(1))
                || !"handbook-1".equals(mineVisibilityBinds.get(2))
                || !"handbook-2".equals(mineVisibilityBinds.get(3)))
                throw new AssertionError("Mine visibility bindings lost principal order");
            expect(client, base, "/v1/document-tasks?visibleHandbooks=handbook-1,,handbook-2",
                422, "DOCUMENT_TASK_VISIBILITY_INVALID");
            String excessive = String.join(",", java.util.Collections.nCopies(1001, "h"));
            expect(client, base, "/v1/document-tasks?visibleHandbooks=" + excessive,
                422, "DOCUMENT_TASK_VISIBILITY_INVALID");
            if (commits != beforeVisibility + 3)
                throw new AssertionError("Invalid visibility filters changed commit count");
            int beforeCreation = commits;
            String newKey = "task-create-99";
            Map<String, Object> document = Map.of("ownerId", "180", "reviewTaskId", "review-current");
            Map<String, Object> handbook = Map.of("id", "handbook-99", "ownerId", "179",
                "documents", List.of(document));
            Map<String, Object> nestedTask = Map.of("number", "YDBRD-99", "description", "新建任务",
                "ownerId", "177", "decomposition", Map.of("confirmed", true, "handbooks", List.of(handbook)),
                "scopeHistory", List.of(Map.of("handbooks", List.of(Map.of("documents",
                    List.of(Map.of("reviewTaskId", "review-history")))))),
                "scopeChanges", List.of(Map.of("sourceOpinion", Map.of("taskId", "review-current"))));
            String createTask = Main.Json.stringify(Map.of("task", nestedTask, "expectedRowVersion", 0,
                "idempotencyKey", newKey, "requestSha256", "e".repeat(64)));
            put(client, base, "/v1/document-tasks/YDBRD-99", newKey, createTask,
                200, "\"rowVersion\":1");
            expect(client, base, "/v1/document-tasks/YDBRD-99", 200, "新建任务");
            expect(client, base, "/v1/document-tasks/writes/" + newKey, 200, "新建任务");
            put(client, base, "/v1/document-tasks/YDBRD-99", newKey, createTask,
                200, "\"rowVersion\":1");
            put(client, base, "/v1/document-tasks/YDBRD-99", newKey,
                createTask.replace("e".repeat(64), "f".repeat(64)), 409,
                "DOCUMENT_TASK_IDEMPOTENCY_CONFLICT");
            List<Map<Integer, Object>> actors = indexBatches.getOrDefault("KC_DOCUMENT_TASK_ACTOR", List.of());
            List<Map<Integer, Object>> reviews = indexBatches.getOrDefault("KC_DOCUMENT_TASK_REVIEW", List.of());
            List<Map<Integer, Object>> handbooks = indexBatches.getOrDefault("KC_DOCUMENT_TASK_HANDBOOK", List.of());
            if (actors.size() != 4 || !actors.stream().anyMatch(row -> "OWNER".equals(row.get(4)) && "177".equals(row.get(3)))
                || !actors.stream().anyMatch(row -> "HANDBOOK".equals(row.get(4)) && "179".equals(row.get(3)))
                || !actors.stream().anyMatch(row -> "DOCUMENT".equals(row.get(4)) && "180".equals(row.get(3)))
                || reviews.size() != 2 || !reviews.stream().anyMatch(row -> "review-current".equals(row.get(1)))
                || !reviews.stream().anyMatch(row -> "review-history".equals(row.get(1)))
                || handbooks.size() != 1 || !"handbook-99".equals(handbooks.get(0).get(3)))
                throw new AssertionError("Document-task lookup batches did not match nested task fields");
            if (newTaskWrites != 1 || newTaskPayload == null || !newTaskPayload.contains("新建任务")
                || commits != beforeCreation + 4)
                throw new AssertionError("New task replay or conflict changed persisted state");
            int beforeInvalidInputs = commits;
            put(client, base, "/v1/document-tasks/config", "invalid-config", "{}", 422,
                "DOCUMENT_TASK_CONFIG_WRITE_INVALID");
            put(client, base, "/v1/document-tasks/config", "invalid-json", "[", 400,
                "INVALID_JSON");
            put(client, base, "/v1/document-tasks/YDBRD-99", "different-header", createTask, 422,
                "DOCUMENT_TASK_WRITE_INVALID");
            expect(client, base, "/v1/document-tasks/YDBRD-42/extra", 400,
                "DOCUMENT_TASK_PATH_INVALID");
            expect(client, base, "/v1/document-tasks/mine?principalId=177&page=bad", 422,
                "DOCUMENT_TASK_PAGE_INVALID");
            if (commits != beforeInvalidInputs || newTaskWrites != 1 || taskRevision != 3)
                throw new AssertionError("Invalid HTTP inputs modified document task state");
            String committedPayload = taskPayload;
            long committedRevision = taskRevision;
            int committedTransactions = commits;
            List<Map<String, Object>> invalidTasks = List.of(
                Map.of("number", "YDBRD-42", "ownerId", "x".repeat(129)),
                Map.of("number", "YDBRD-42", "ownerId", "177", "decomposition",
                    Map.of("handbooks", List.of(Map.of("id", "valid-book", "documents",
                        List.of(Map.of("reviewTaskId", "r".repeat(129))))))),
                Map.of("number", "YDBRD-42", "ownerId", "177", "decomposition",
                    Map.of("handbooks", List.of(Map.of("id", "", "documents", List.of())))));
            String[] expectedErrors = { "DOCUMENT_TASK_ACTOR_INVALID", "DOCUMENT_TASK_REVIEW_ID_INVALID",
                "DOCUMENT_TASK_HANDBOOK_INVALID" };
            for (int index = 0; index < invalidTasks.size(); index++) {
                String key = "invalid-index-" + index;
                String invalidWrite = Main.Json.stringify(Map.of("task", invalidTasks.get(index),
                    "expectedRowVersion", committedRevision, "idempotencyKey", key,
                    "requestSha256", "a".repeat(64)));
                put(client, base, "/v1/document-tasks/YDBRD-42", key, invalidWrite, 422,
                    expectedErrors[index]);
                if (commits != committedTransactions)
                    throw new AssertionError("Rejected index write committed a transaction");
                // The in-memory JDBC fixture rolls back its synthetic row after each rejected request.
                taskPayload = committedPayload;
                taskRevision = committedRevision;
            }
            expect(client, base, "/v1/document-tasks/YDBRD-42", 200, "更新任务");
            if (taskRevision != committedRevision || commits != committedTransactions + 1)
                throw new AssertionError("Rejected index writes changed the committed task");
            int beforeCorruptReads = commits;
            configMissing = true;
            expect(client, base, "/v1/document-tasks/config", 503, "STORAGE_UNAVAILABLE");
            configMissing = false;
            String savedConfig = configPayload;
            configPayload = "[]";
            expect(client, base, "/v1/document-tasks/config", 422, "DOCUMENT_TASK_CONFIG_INVALID");
            configPayload = savedConfig;
            taskPayload = "[";
            expect(client, base, "/v1/document-tasks/YDBRD-42", 422, "DOCUMENT_TASK_PAYLOAD_INVALID");
            taskPayload = committedPayload;
            if (commits != beforeCorruptReads)
                throw new AssertionError("Corrupt document-task reads committed a transaction");
            expect(client, base, "/v1/document-tasks/config", 200, "\"defaultOwnerId\":\"178\"");
            expect(client, base, "/v1/document-tasks/YDBRD-42", 200, "更新任务");
        } finally {
            server.stop(0);
            Field field = Main.class.getDeclaredField("connectionPool");
            field.setAccessible(true);
            Object pool = field.get(application);
            Method close = pool.getClass().getDeclaredMethod("closeAll");
            close.setAccessible(true);
            close.invoke(pool);
        }
        System.out.println("PASS: document task real HTTP reads");
    }
}

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import migration.SchemaMigrationManager;

import java.io.BufferedWriter;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Reader;
import java.io.StringReader;
import java.io.StringWriter;
import java.io.Writer;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.Clob;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.lang.reflect.Proxy;

public final class Main {
    private static final String DRIVER = "com.yashandb.jdbc.Driver";
    private static final int DEFAULT_MAX_BODY_BYTES = 16 * 1024 * 1024;

    private final String jdbcUrl = required("YASDB_JDBC_URL");
    private final String username = required("YASDB_USERNAME");
    private final String password = required("YASDB_PASSWORD");
    private final int maxBodyBytes = integer("YASDB_STORAGE_MAX_BODY_BYTES", DEFAULT_MAX_BODY_BYTES);
    private final Path sqlDirectory = Path.of(env("YASDB_STORAGE_SQL_DIR", "sql")).toAbsolutePath().normalize();
    private final SchemaMigrationManager schemaMigrations = new SchemaMigrationManager(sqlDirectory);
    private final Path techDomainSeedFile = Path.of(env("YASDB_TECH_DOMAINS_SEED_FILE", sqlDirectory.resolve("tech-domains.seed.json").toString())).toAbsolutePath().normalize();
    private final JdbcConnectionPool connectionPool;
    private final HandbookProjectionRepository handbookProjectionRepository = new HandbookProjectionRepository();
    private final PrincipalRepository principalRepository = new PrincipalRepository();
    private static boolean perfEnabled() { return "1".equals(System.getenv("PERF_TRACE")); }
    private static void perf(String event, long started, long sqlStarted, long lockStarted) {
        if (!perfEnabled()) return;
        long now = System.nanoTime();
        System.err.printf("[perf] %s connection_acquire_ms=%.3f sql_execute_ms=%.3f for_update_wait_ms=%.3f commit_ms=%.3f request_total_ms=%.3f%n",
            event, 0d, sqlStarted > 0 ? (now - sqlStarted) / 1e6 : 0d,
            lockStarted > 0 ? (now - lockStarted) / 1e6 : 0d, 0d, (now - started) / 1e6);
    }

    public static void main(String[] args) throws Exception {
        String command = args.length == 0 ? "serve" : args[0];
        if (args.length > 1 || !("serve".equals(command) || "migrate".equals(command))) {
            throw new IllegalArgumentException("用法：Main [serve|migrate]");
        }
        Class.forName(DRIVER);
        Main application = new Main();
        if ("migrate".equals(command)) {
            try {
                application.migrate();
                System.out.println("数据库迁移已完成");
            } finally {
                application.connectionPool.closeAll();
            }
            return;
        }
        application.verifyMigrations();
        application.connectionPool.start();
        application.start();
        Runtime.getRuntime().addShutdownHook(new Thread(application.connectionPool::closeAll));
    }

    private void start() throws IOException {
        String host = env("YASDB_STORAGE_HOST", "127.0.0.1");
        int port = integer("YASDB_STORAGE_PORT", 14210);
        HttpServer server = HttpServer.create(new InetSocketAddress(host, port), 0);
        server.createContext("/health", this::health);
        server.createContext("/v1/records", this::records);
        server.createContext("/v1/domain/handbooks", this::domainHandbooks);
        server.createContext("/v1/domain/principals", this::domainPrincipals);
        server.createContext("/v1/domain/outlines", this::domainOutlines);
        server.createContext("/v1/domain/tech-domains", this::techDomains);
        server.createContext("/v1/domain/build-tasks", this::buildTasks);
        server.createContext("/v1/export", this::exportAll);
        server.setExecutor(Executors.newFixedThreadPool(integer("YASDB_STORAGE_THREADS", 8)));
        server.start();
        System.out.printf("YashanDB 存储服务已启动：http://%s:%d%n", host, port);
    }

    private Main() throws SQLException {
        this.connectionPool = new JdbcConnectionPool(jdbcUrl, username, password,
            integer("YASDB_STORAGE_POOL_MAX", Math.max(4, integer("YASDB_STORAGE_THREADS", 8))),
            integer("YASDB_STORAGE_POOL_MIN", 1));
    }

    private Connection connection() throws SQLException {
        long started = System.nanoTime();
        Connection connection = connectionPool.borrow();
        if (perfEnabled()) System.err.printf("[perf] connection_acquire_ms=%.3f%n", (System.nanoTime() - started) / 1e6);
        return connection;
    }

    private void migrate() throws SQLException {
        try (Connection connection = connection()) {
            schemaMigrations.migrate(connection);
            seedTechDomains(connection);
            connection.commit();
        }
    }

    private void verifyMigrations() throws SQLException {
        try (Connection connection = connection()) {
            schemaMigrations.verify(connection);
        }
    }

    private void seedTechDomains(Connection connection) throws SQLException {
        if (!Files.isRegularFile(techDomainSeedFile)) {
            return;
        }
        try {
            Object parsed = Json.parse(Files.readString(techDomainSeedFile, StandardCharsets.UTF_8));
            Map<String, Object> seed = asMapOrEmpty(parsed);
            for (Map<String, Object> domain : listOfMaps(seed.get("techDomains"))) {
                String domainId = coalesce(domain.get("id"));
                String code = coalesce(domain.get("code"), domainId);
                String name = coalesce(domain.get("name"), code);
                if (domainId == null) {
                    continue;
                }
                try (PreparedStatement query = connection.prepareStatement("SELECT TECH_DOMAIN_ID FROM KC_TECH_DOMAIN WHERE DOMAIN_CODE = ?")) {
                    query.setString(1, code);
                    try (ResultSet result = query.executeQuery()) {
                        if (!result.next()) {
                            try (PreparedStatement insert = connection.prepareStatement("INSERT INTO KC_TECH_DOMAIN(DOMAIN_CODE, DOMAIN_NAME, STATE, CREATED_BY, UPDATED_BY) VALUES (?, ?, 'ACTIVE', 'system:seed', 'system:seed')")) {
                                insert.setString(1, code);
                                insert.setString(2, name);
                                insert.executeUpdate();
                            }
                        }
                    }
                }
                // 人员 ID 必须来自 CAS/企业目录；种子文件中的演示人员不进入目标业务表。
            }
        } catch (JsonParseException | IOException error) {
            throw new SQLException("技术领域种子配置读取失败：" + techDomainSeedFile, error);
        }
    }

    private void health(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) { methodNotAllowed(exchange); return; }
        long requestStarted = System.nanoTime();
        try (Connection connection = connection(); Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery("SELECT 1 FROM DUAL")) {
            long sqlStarted = System.nanoTime();
            result.next();
            DatabaseMetaData metadata = connection.getMetaData();
            connection.commit();
            perf("health", requestStarted, sqlStarted, 0);
            sendJson(exchange, 200, mapOf(
                "success", true,
                "database", metadata.getDatabaseProductName(),
                "databaseVersion", metadata.getDatabaseProductVersion(),
                "driver", metadata.getDriverName(),
                "driverVersion", metadata.getDriverVersion()
            ));
        } catch (Exception error) {
            failure(exchange, 503, "DATABASE_UNAVAILABLE", "数据库连接不可用");
        }
    }

    private void records(HttpExchange exchange) throws IOException {
        String suffix = exchange.getRequestURI().getRawPath().substring("/v1/records".length());
        String[] parts = suffix.split("/", -1);
        if (parts.length != 3 || parts[1].isBlank() || parts[2].isBlank()) {
            failure(exchange, 400, "INVALID_RECORD_PATH", "记录路径必须包含 namespace 和 key");
            return;
        }
        String namespace = decode(parts[1]);
        String key = decode(parts[2]);
        if (!namespace.matches("[A-Za-z0-9._-]{1,64}") || key.length() > 256) {
            failure(exchange, 400, "INVALID_RECORD_ID", "记录标识不合法");
            return;
        }
        switch (exchange.getRequestMethod()) {
            case "GET" -> getRecord(exchange, namespace, key);
            case "PUT" -> putRecord(exchange, namespace, key);
            case "DELETE" -> deleteRecord(exchange, namespace, key);
            default -> methodNotAllowed(exchange);
        }
    }

    private void getRecord(HttpExchange exchange, String namespace, String key) throws IOException {
        long requestStarted = System.nanoTime();
        String sql = "SELECT PAYLOAD, PAYLOAD_SHA256, REVISION, DELETED, CREATED_AT, UPDATED_AT FROM KC_RECORD WHERE NAMESPACE=? AND RECORD_KEY=?";
        try (Connection connection = connection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, namespace);
            statement.setString(2, key);
            long sqlStarted = System.nanoTime();
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) {
                    connection.rollback();
                    failure(exchange, 404, "RECORD_NOT_FOUND", "记录不存在");
                    return;
                }
                String payload = readClob(result.getClob(1));
                sendJson(exchange, 200, mapOf(
                    "success", true,
                    "namespace", namespace,
                    "key", key,
                    "revision", result.getLong(3),
                    "deleted", "Y".equals(result.getString(4)),
                    "sha256", trimToEmpty(result.getString(2)),
                    "createdAt", timestampToString(result.getTimestamp(5)),
                    "updatedAt", timestampToString(result.getTimestamp(6)),
                    "payload", Json.parse(payload)
                ));
                connection.commit();
                perf("get_record", requestStarted, sqlStarted, 0);
            }
        } catch (JsonParseException error) {
            failure(exchange, 503, "DATABASE_UNAVAILABLE", "读取数据库记录失败");
        } catch (Exception error) {
            failure(exchange, 503, "DATABASE_UNAVAILABLE", "读取数据库记录失败");
        }
    }

    private void putRecord(HttpExchange exchange, String namespace, String key) throws IOException {
        long requestStarted = System.nanoTime();
        byte[] bytes;
        try {
            bytes = readBody(exchange, maxBodyBytes);
        } catch (BodyTooLarge error) {
            failure(exchange, 413, "PAYLOAD_TOO_LARGE", "记录内容超过限制");
            return;
        }
        String payload = new String(bytes, StandardCharsets.UTF_8).trim();
        if (!looksLikeJson(payload)) {
            failure(exchange, 400, "INVALID_JSON", "请求体必须是 JSON");
            return;
        }
        Long expected = expectedRevision(exchange, false);
        if (Long.valueOf(Long.MIN_VALUE).equals(expected)) {
            return;
        }
        String digest = sha256(payload);
        try (Connection connection = connection()) {
            long revision = upsertRecord(connection, namespace, key, payload, digest, expected);
            long commitStarted = System.nanoTime();
            connection.commit();
            if (perfEnabled()) System.err.printf("[perf] put_record commit_ms=%.3f request_total_ms=%.3f%n", (System.nanoTime() - commitStarted) / 1e6, (System.nanoTime() - requestStarted) / 1e6);
            sendJson(exchange, 200, mapOf(
                "success", true,
                "namespace", namespace,
                "key", key,
                "revision", revision,
                "sha256", digest,
                "updatedAt", Instant.now().toString()
            ));
        } catch (RevisionConflict error) {
            failure(exchange, 409, "REVISION_CONFLICT", "记录已被其他请求修改");
        } catch (Exception error) {
            failure(exchange, 503, "DATABASE_UNAVAILABLE", "写入数据库记录失败");
        }
    }

    private long upsertRecord(Connection connection, String namespace, String key, String payload, String digest, Long expected) throws Exception {
        Long current = null;
        String currentDigest = null;
        boolean currentDeleted = false;
        long lockStarted = System.nanoTime();
        try (PreparedStatement lock = connection.prepareStatement("SELECT REVISION, PAYLOAD_SHA256, DELETED FROM KC_RECORD WHERE NAMESPACE=? AND RECORD_KEY=? FOR UPDATE")) {
            lock.setString(1, namespace);
            lock.setString(2, key);
            try (ResultSet result = lock.executeQuery()) {
                if (result.next()) {
                    current = result.getLong(1);
                    currentDigest = trimToEmpty(result.getString(2));
                    currentDeleted = "Y".equals(result.getString(3));
                }
            }
        }
        if (perfEnabled()) System.err.printf("[perf] for_update_wait_ms=%.3f%n", (System.nanoTime() - lockStarted) / 1e6);
        if (expected != null && (current == null ? expected != 0 : !expected.equals(current))) {
            throw new RevisionConflict();
        }
        if (current == null) {
            try (PreparedStatement insert = connection.prepareStatement("INSERT INTO KC_RECORD(NAMESPACE, RECORD_KEY, PAYLOAD, PAYLOAD_SHA256, REVISION, DELETED) VALUES (?, ?, ?, ?, 1, 'N')")) {
                insert.setString(1, namespace);
                insert.setString(2, key);
                insert.setCharacterStream(3, new StringReader(payload));
                insert.setString(4, digest);
                insert.executeUpdate();
            }
            return 1;
        }
        if (!currentDeleted && digest.equals(currentDigest)) {
            return current;
        }
        long next = current + 1;
        try (PreparedStatement update = connection.prepareStatement("UPDATE KC_RECORD SET PAYLOAD=?, PAYLOAD_SHA256=?, REVISION=?, DELETED='N', UPDATED_AT=CURRENT_TIMESTAMP WHERE NAMESPACE=? AND RECORD_KEY=?")) {
            update.setCharacterStream(1, new StringReader(payload));
            update.setString(2, digest);
            update.setLong(3, next);
            update.setString(4, namespace);
            update.setString(5, key);
            update.executeUpdate();
        }
        return next;
    }

    private void deleteRecord(HttpExchange exchange, String namespace, String key) throws IOException {
        Long expected = expectedRevision(exchange, true);
        if (Long.valueOf(Long.MIN_VALUE).equals(expected)) {
            return;
        }
        try (Connection connection = connection();
             PreparedStatement update = connection.prepareStatement(
                 "UPDATE KC_RECORD SET DELETED='Y', REVISION=REVISION+1, UPDATED_AT=CURRENT_TIMESTAMP WHERE NAMESPACE=? AND RECORD_KEY=? AND REVISION=?")) {
            update.setString(1, namespace);
            update.setString(2, key);
            update.setLong(3, expected);
            int changed = update.executeUpdate();
            if (changed != 1) {
                connection.rollback();
                failure(exchange, 409, "REVISION_CONFLICT", "记录不存在或已被修改");
                return;
            }
            connection.commit();
            sendJson(exchange, 200, mapOf("success", true, "revision", expected + 1));
        } catch (Exception error) {
            failure(exchange, 503, "DATABASE_UNAVAILABLE", "删除数据库记录失败");
        }
    }

    private void exportAll(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            methodNotAllowed(exchange);
            return;
        }
        String sql = "SELECT NAMESPACE, RECORD_KEY, PAYLOAD, PAYLOAD_SHA256, REVISION, DELETED, CREATED_AT, UPDATED_AT FROM KC_RECORD ORDER BY NAMESPACE, RECORD_KEY";
        try (Connection connection = connection(); PreparedStatement statement = connection.prepareStatement(sql); ResultSet result = statement.executeQuery()) {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("Cache-Control", "no-store");
            exchange.sendResponseHeaders(200, 0);
            try (Writer writer = new BufferedWriter(new OutputStreamWriter(exchange.getResponseBody(), StandardCharsets.UTF_8))) {
                DatabaseMetaData metadata = connection.getMetaData();
                writer.write("{\"exportSchemaVersion\":1,\"exportedAt\":\"");
                writer.write(Instant.now().toString());
                writer.write("\",\"databaseProduct\":\"");
                writer.write(escape(metadata.getDatabaseProductName()));
                writer.write("\",\"records\":[");
                boolean first = true;
                while (result.next()) {
                    if (!first) {
                        writer.write(',');
                    }
                    first = false;
                    writer.write(recordJson(
                        result.getString(1),
                        result.getString(2),
                        readClob(result.getClob(3)),
                        result.getString(4),
                        result.getLong(5),
                        "Y".equals(result.getString(6)),
                        result.getTimestamp(7),
                        result.getTimestamp(8)
                    ));
                }
                writer.write("]}");
            }
            connection.commit();
        } catch (Exception error) {
            if (!exchange.getResponseHeaders().containsKey("Content-Type")) {
                failure(exchange, 503, "DATABASE_UNAVAILABLE", "导出数据库记录失败");
            }
        }
    }

    private void domainHandbooks(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getRawPath();
        try {
            if ("GET".equals(exchange.getRequestMethod()) && "/v1/domain/handbooks".equals(path)) {
                long requestStarted = System.nanoTime();
                long connectionStarted = System.nanoTime();
                try (Connection connection = connection()) {
                    double connectionMs = (System.nanoTime() - connectionStarted) / 1e6;
                    Map<String, Double> timings = new LinkedHashMap<>();
                    Map<String, Object> projection = projectHandbooks(connection, timings);
                    connection.commit();
                    long serializationStarted = System.nanoTime();
                    String body = Json.stringify(projection);
                    double serializationMs = (System.nanoTime() - serializationStarted) / 1e6;
                    double totalMs = (System.nanoTime() - requestStarted) / 1e6;
                    exchange.getResponseHeaders().set("Server-Timing", String.format(Locale.ROOT,
                        "db-connection;dur=%.3f, db-query;dur=%.3f, row-mapping;dur=%.3f, json-serialization;dur=%.3f, storage-total;dur=%.3f",
                        connectionMs, timings.getOrDefault("queryMs", 0d), timings.getOrDefault("mappingMs", 0d), serializationMs, totalMs));
                    send(exchange, 200, body);
                }
                return;
            }
            if ("PUT".equals(exchange.getRequestMethod()) && "/v1/domain/handbooks/snapshot".equals(path)) {
                Map<String, Object> payload = readJsonObject(exchange);
                try (Connection connection = connection()) {
                    Map<String, Object> data = saveHandbooksSnapshot(connection, payload);
                    connection.commit();
                    sendJson(exchange, 200, mapOf("success", true, "data", data));
                }
                return;
            }
            methodNotAllowed(exchange);
        } catch (JsonParseException error) {
            failure(exchange, 400, "INVALID_JSON", error.getMessage());
        } catch (SQLException error) {
            failure(exchange, 503, "DATABASE_UNAVAILABLE", "手册领域读写失败");
        }
    }

    private void domainPrincipals(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getRawPath();
        try (Connection connection = connection()) {
            if ("GET".equals(exchange.getRequestMethod()) && "/v1/domain/principals".equals(path)) {
                Map<String, String> query = queryParameters(exchange.getRequestURI().getRawQuery());
                Map<String, Object> data = principalRepository.list(connection, query.get("q"), query.get("state"), query.get("bindingStatus"));
                connection.commit();
                sendJson(exchange, 200, mapOf("success", true, "data", data));
                return;
            }
            if ("POST".equals(exchange.getRequestMethod()) && "/v1/domain/principals".equals(path)) {
                Map<String, Object> payload = readJsonObject(exchange);
                Map<String, Object> data = principalRepository.create(connection,
                    coalesce(payload.get("displayName")), coalesce(payload.get("casLoginName")),
                    coalesce(payload.get("state"), "ACTIVE"), coalesce(payload.get("actor"), "system:api"));
                connection.commit();
                sendJson(exchange, 201, mapOf("success", true, "data", data));
                return;
            }
            if ("POST".equals(exchange.getRequestMethod()) && "/v1/domain/principals/import".equals(path)) {
                Map<String, Object> payload = readJsonObject(exchange);
                String sourceSha = coalesce(payload.get("sourceSha256"));
                if (sourceSha == null || !sourceSha.matches("[0-9a-fA-F]{64}")) throw new SQLException("PERSONNEL_SOURCE_SHA_REQUIRED");
                String batchId = "PERSONNEL-" + sourceSha.substring(0, 32).toLowerCase(Locale.ROOT);
                try (PreparedStatement query = connection.prepareStatement("SELECT STATUS FROM KC_MIGRATION_BATCH WHERE BATCH_ID=?")) {
                    query.setString(1, batchId);
                    try (ResultSet result = query.executeQuery()) {
                        if (result.next()) {
                            if (!"COMPLETED".equals(result.getString(1))) throw new SQLException("PERSONNEL_IMPORT_INCOMPLETE");
                            Map<String, Object> data = principalRepository.list(connection, null, null, null);
                            connection.commit();
                            sendJson(exchange, 200, mapOf("success", true, "data", data, "idempotent", true));
                            return;
                        }
                    }
                }
                List<Map<String, Object>> items = listOfMaps(payload.get("items"));
                if (items.isEmpty()) throw new SQLException("PERSONNEL_IMPORT_EMPTY");
                if (items.size() > 1000) throw new SQLException("PERSONNEL_IMPORT_TOO_LARGE");
                String actor = coalesce(payload.get("actor"), "system:import");
                for (Map<String, Object> item : items) principalRepository.importPerson(connection,
                    coalesce(item.get("displayName")), coalesce(item.get("casLoginName")), coalesce(item.get("state"), "ACTIVE"), actor);
                try (PreparedStatement insert = connection.prepareStatement(
                    "INSERT INTO KC_MIGRATION_BATCH(BATCH_ID, SOURCE_KIND, STATUS, RECORD_COUNT, SOURCE_SHA256, RESULT_SHA256, COMPLETED_AT) "
                        + "VALUES (?, 'PERSONNEL_FILE', 'COMPLETED', ?, ?, ?, CURRENT_TIMESTAMP)")) {
                    insert.setString(1, batchId); insert.setLong(2, items.size()); insert.setString(3, sourceSha);
                    insert.setString(4, sha256(Json.stringify(items))); insert.executeUpdate();
                }
                Map<String, Object> data = principalRepository.list(connection, null, null, null);
                connection.commit();
                sendJson(exchange, 200, mapOf("success", true, "data", data, "idempotent", false));
                return;
            }
            if ("POST".equals(exchange.getRequestMethod()) && "/v1/domain/principals/cas-login".equals(path)) {
                Map<String, Object> payload = readJsonObject(exchange);
                Map<String, Object> data = principalRepository.syncCasLogin(connection,
                    coalesce(payload.get("casLoginName")), coalesce(payload.get("displayName")),
                    coalesce(payload.get("actor"), "system:cas"));
                connection.commit();
                sendJson(exchange, 200, mapOf("success", true, "data", data));
                return;
            }
            if ("PATCH".equals(exchange.getRequestMethod()) && path.startsWith("/v1/domain/principals/")
                && path.length() > "/v1/domain/principals/".length()) {
                long principalId;
                try { principalId = Long.parseLong(decode(path.substring("/v1/domain/principals/".length()))); }
                catch (NumberFormatException error) { throw new SQLException("PERSONNEL_NOT_FOUND"); }
                Map<String, Object> payload = readJsonObject(exchange);
                long expectedRowVersion;
                try { expectedRowVersion = Long.parseLong(coalesce(payload.get("rowVersion"))); }
                catch (Exception error) { throw new SQLException("PERSONNEL_VERSION_REQUIRED"); }
                Map<String, Object> data = principalRepository.update(connection, principalId,
                    coalesce(payload.get("displayName")), coalesce(payload.get("casLoginName")),
                    coalesce(payload.get("state"), "ACTIVE"), expectedRowVersion,
                    coalesce(payload.get("actor"), "system:api"));
                connection.commit();
                sendJson(exchange, 200, mapOf("success", true, "data", data));
                return;
            }
            methodNotAllowed(exchange);
        } catch (JsonParseException error) {
            failure(exchange, 400, "INVALID_JSON", error.getMessage());
        } catch (SQLException error) {
            String code = coalesce(error.getMessage(), "PERSONNEL_OPERATION_FAILED");
            int status = code.endsWith("NOT_FOUND") ? 404 : code.contains("CONFLICT") || code.endsWith("IMMUTABLE") ? 409 : code.endsWith("REQUIRED") || code.endsWith("INVALID") || code.endsWith("EMPTY") || code.endsWith("TOO_LARGE") ? 422 : 503;
            failure(exchange, status, code, personnelErrorMessage(code));
        }
    }

    private void domainOutlines(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getRawPath();
        try {
            if ("GET".equals(exchange.getRequestMethod()) && "/v1/domain/outlines".equals(path)) {
                try (Connection connection = connection()) {
                    sendJson(exchange, 200, projectOutlines(connection));
                    connection.commit();
                }
                return;
            }
            if ("PUT".equals(exchange.getRequestMethod()) && "/v1/domain/outlines/snapshot".equals(path)) {
                Map<String, Object> payload = readJsonObject(exchange);
                try (Connection connection = connection()) {
                    Map<String, Object> data = saveOutlinesSnapshot(connection, payload);
                    connection.commit();
                    sendJson(exchange, 200, mapOf("success", true, "data", data));
                }
                return;
            }
            if (path.startsWith("/v1/domain/outlines/") && path.endsWith("/governance")) {
                String outlineId = decode(path.substring("/v1/domain/outlines/".length(), path.length() - "/governance".length()));
                try (Connection connection = connection()) {
                    if ("GET".equals(exchange.getRequestMethod())) {
                        sendJson(exchange, 200, mapOf("success", true, "data", projectOutlineGovernance(connection, outlineId)));
                    } else if ("PUT".equals(exchange.getRequestMethod())) {
                        Map<String, Object> payload = readJsonObject(exchange);
                        Map<String, Object> data = saveOutlineGovernance(connection, outlineId, payload);
                        connection.commit();
                        sendJson(exchange, 200, mapOf("success", true, "data", data));
                    } else {
                        methodNotAllowed(exchange);
                    }
                }
                return;
            }
            if (path.startsWith("/v1/domain/outlines/") && path.endsWith("/publish")) {
                String outlineId = decode(path.substring("/v1/domain/outlines/".length(), path.length() - "/publish".length()));
                if (!"POST".equals(exchange.getRequestMethod())) {
                    methodNotAllowed(exchange);
                    return;
                }
                Map<String, Object> payload = readJsonObject(exchange);
                try (Connection connection = connection()) {
                    Map<String, Object> data = publishOutline(connection, outlineId, payload);
                    connection.commit();
                    sendJson(exchange, 200, mapOf("success", true, "data", data));
                }
                return;
            }
            if ("DELETE".equals(exchange.getRequestMethod()) && path.startsWith("/v1/domain/outlines/") && path.length() > "/v1/domain/outlines/".length()) {
                String id = decode(path.substring("/v1/domain/outlines/".length()));
                try (Connection connection = connection()) {
                    Map<String, Object> data = deleteOutline(connection, id);
                    connection.commit();
                    sendJson(exchange, 200, mapOf("success", true, "data", data));
                }
                return;
            }
            methodNotAllowed(exchange);
        } catch (JsonParseException error) {
            failure(exchange, 400, "INVALID_JSON", error.getMessage());
        } catch (GovernanceValidationException error) {
            sendJson(exchange, error.status, mapOf(
                "success", false,
                "error", mapOf("code", error.code, "message", error.getMessage(), "status", error.status, "details", error.details)
            ));
        } catch (SQLException error) {
            String code = error.getMessage();
            if ("OUTLINE_NOT_FOUND".equals(code)) {
                failure(exchange, 404, "OUTLINE_NOT_FOUND", "大纲不存在");
            } else if ("OUTLINE_IMMUTABLE".equals(code)) {
                failure(exchange, 409, "OUTLINE_IMMUTABLE", "当前大纲版本不可修改或删除");
            } else if ("OUTLINE_DOCUMENT_REQUIRED".equals(code)) {
                failure(exchange, 422, "OUTLINE_DOCUMENT_REQUIRED", "大纲至少需要一个 document 叶子节点");
            } else if ("OUTLINE_HANDBOOK_REQUIRED".equals(code)) {
                failure(exchange, 422, "OUTLINE_HANDBOOK_REQUIRED", "大纲必须指定所属手册");
            } else if ("OUTLINE_HANDBOOK_NOT_FOUND".equals(code)) {
                failure(exchange, 404, "OUTLINE_HANDBOOK_NOT_FOUND", "所属手册不存在，请先创建手册");
            } else if ("OUTLINE_RESPONSIBILITY_REQUIRED".equals(code)) {
                failure(exchange, 422, "OUTLINE_RESPONSIBILITY_REQUIRED", "发布前必须完成所有 document 的技术领域分工");
            } else if ("OUTLINE_VERSION_CONFLICT".equals(code)) {
                failure(exchange, 409, code, "候选大纲版本已变化，请刷新后重试");
            } else if ("PUBLISHED_CONTENT_LOCKED".equals(code)) {
                failure(exchange, 409, code, "已发布大纲只能调整技术领域，不能修改内容说明");
            } else if ("PUBLISHED_ASSIGNMENT_REQUIRED".equals(code)) {
                failure(exchange, 422, code, "已发布大纲不能取消页面的全部技术领域分工");
            } else if ("INVALID_DOMAIN_PAYLOAD".equals(code)) {
                failure(exchange, 422, code, "技术领域分工数据不合法");
            } else {
                failure(exchange, 503, "DATABASE_UNAVAILABLE", "大纲领域读写失败");
            }
        }
    }

    private void techDomains(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            methodNotAllowed(exchange);
            return;
        }
        try (Connection connection = connection()) {
            sendJson(exchange, 200, mapOf("success", true, "data", projectTechDomains(connection)));
            connection.commit();
        } catch (SQLException error) {
            failure(exchange, 503, "DATABASE_UNAVAILABLE", "技术领域信息读取失败");
        }
    }

    private void buildTasks(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getRawPath();
        try {
            if ("GET".equals(exchange.getRequestMethod()) && "/v1/domain/build-tasks".equals(path)) {
                try (Connection connection = connection()) {
                    sendJson(exchange, 200, mapOf("success", true, "data", projectBuildTasks(connection)));
                    connection.commit();
                }
                return;
            }
            if (path.startsWith("/v1/domain/build-tasks/") && path.contains("/items/")) {
                String suffix = path.substring("/v1/domain/build-tasks/".length());
                String[] parts = suffix.split("/items/", -1);
                if (parts.length != 2 || parts[0].isBlank() || parts[1].isBlank()) {
                    failure(exchange, 400, "INVALID_TASK_ITEM_PATH", "任务项路径不合法");
                    return;
                }
                if (!"PATCH".equals(exchange.getRequestMethod())) {
                    methodNotAllowed(exchange);
                    return;
                }
                Map<String, Object> payload = readJsonObject(exchange);
                try (Connection connection = connection()) {
                    Map<String, Object> data = updateBuildTaskItem(connection, decode(parts[0]), decode(parts[1]), payload);
                    connection.commit();
                    sendJson(exchange, 200, mapOf("success", true, "data", data));
                }
                return;
            }
            if (path.startsWith("/v1/domain/build-tasks/") && path.length() > "/v1/domain/build-tasks/".length()) {
                String taskId = decode(path.substring("/v1/domain/build-tasks/".length()));
                if (!"GET".equals(exchange.getRequestMethod())) {
                    methodNotAllowed(exchange);
                    return;
                }
                try (Connection connection = connection()) {
                    Map<String, Object> task = projectBuildTask(connection, taskId);
                    if (task == null) {
                        failure(exchange, 404, "BUILD_TASK_NOT_FOUND", "领域建设任务不存在");
                    } else {
                        sendJson(exchange, 200, mapOf("success", true, "data", task));
                    }
                    connection.commit();
                }
                return;
            }
            methodNotAllowed(exchange);
        } catch (JsonParseException error) {
            failure(exchange, 400, "INVALID_JSON", error.getMessage());
        } catch (GovernanceValidationException error) {
            sendJson(exchange, error.status, mapOf(
                "success", false,
                "error", mapOf("code", error.code, "message", error.getMessage(), "details", error.details)
            ));
        } catch (SQLException error) {
            String code = error.getMessage();
            if ("BUILD_TASK_NOT_FOUND".equals(code)) {
                failure(exchange, 404, "BUILD_TASK_NOT_FOUND", "领域建设任务不存在");
            } else if ("BUILD_TASK_ITEM_NOT_FOUND".equals(code)) {
                failure(exchange, 404, "BUILD_TASK_ITEM_NOT_FOUND", "任务页面不存在");
            } else {
                failure(exchange, 503, "DATABASE_UNAVAILABLE", "领域建设任务读写失败");
            }
        }
    }

    private Map<String, Object> saveHandbooksSnapshot(Connection connection, Map<String, Object> payload) throws SQLException, JsonParseException {
        List<Map<String, Object>> handbooks = listOfMaps(payload.get("handbooks"));
        for (Map<String, Object> handbook : handbooks) {
            upsertManual(connection, handbook, payload);
        }
        recordManualMigrationBatch(connection, payload, handbooks);
        return projectHandbooks(connection);
    }

    private void recordManualMigrationBatch(Connection connection, Map<String, Object> payload, List<Map<String, Object>> handbooks) throws SQLException {
        Map<String, Object> source = asMapOrEmpty(payload.get("source"));
        String sourceSha = coalesce(source.get("sha256"));
        if (!"knowledge-assets-json".equals(source.get("type")) || sourceSha == null) return;
        String batchId = "MANUAL-" + sourceSha.substring(0, Math.min(32, sourceSha.length()));
        try (PreparedStatement query = connection.prepareStatement("SELECT BATCH_ID FROM KC_MIGRATION_BATCH WHERE BATCH_ID=?")) {
            query.setString(1, batchId);
            try (ResultSet result = query.executeQuery()) { if (result.next()) return; }
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_MIGRATION_BATCH(BATCH_ID, SOURCE_KIND, STATUS, RECORD_COUNT, SOURCE_SHA256, RESULT_SHA256, COMPLETED_AT) VALUES (?, 'MANUAL_JSON', 'COMPLETED', ?, ?, ?, CURRENT_TIMESTAMP)")) {
            insert.setString(1, batchId);
            insert.setLong(2, handbooks.size());
            insert.setString(3, sourceSha);
            insert.setString(4, sha256(Json.stringify(handbooks)));
            insert.executeUpdate();
        }
    }

    private Map<String, Object> projectTechDomains(Connection connection) throws SQLException {
        List<Map<String, Object>> domains = new ArrayList<>();
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        String domainSql = "SELECT TECH_DOMAIN_ID, DOMAIN_CODE, DOMAIN_NAME FROM KC_TECH_DOMAIN WHERE STATE='ACTIVE' ORDER BY DOMAIN_NAME, TECH_DOMAIN_ID";
        try (PreparedStatement statement = connection.prepareStatement(domainSql); ResultSet result = statement.executeQuery()) {
            while (result.next()) {
                Map<String, Object> domain = new LinkedHashMap<>();
                domain.put("id", result.getString(1));
                domain.put("code", result.getString(2));
                domain.put("name", result.getString(3));
                domain.put("leader", null);
                domain.put("members", new ArrayList<>());
                domains.add(domain);
                byId.put(result.getString(1), domain);
            }
        }
        String personnelSql = "SELECT TECH_DOMAIN_ID, PRINCIPAL_ID, MEMBER_ROLE FROM KC_TECH_DOMAIN_MEMBER WHERE STATE = 'ACTIVE' ORDER BY PRINCIPAL_ID";
        try (PreparedStatement statement = connection.prepareStatement(personnelSql); ResultSet result = statement.executeQuery()) {
            while (result.next()) {
                Map<String, Object> domain = byId.get(result.getString(1));
                if (domain == null) {
                    continue;
                }
                Map<String, Object> person = mapOf(
                    "id", result.getString(2),
                    "name", result.getString(2),
                    "role", result.getString(3).toLowerCase()
                );
                if ("LEADER".equals(result.getString(3))) {
                    domain.put("leader", person);
                } else {
                    @SuppressWarnings("unchecked")
                    List<Object> members = (List<Object>) domain.get("members");
                    members.add(person);
                }
            }
        }
        return mapOf("techDomains", domains, "generatedAt", Instant.now().toString());
    }

    private Map<String, Object> outlineHeader(Connection connection, String outlineId) throws SQLException {
        String sql = "SELECT V.OUTLINE_VERSION_ID, M.MANUAL_CODE, V.STATE, V.ROW_VERSION, O.OUTLINE_ID, "
            + "COALESCE(V.SOURCE_REF, TO_CHAR(V.OUTLINE_VERSION_ID)) "
            + "FROM KC_MANUAL_OUTLINE_VERSION V JOIN KC_MANUAL_OUTLINE O ON O.OUTLINE_ID=V.OUTLINE_ID "
            + "JOIN KC_MANUAL M ON M.MANUAL_ID=O.MANUAL_ID WHERE V.OUTLINE_VERSION_ID = ?";
        long internalId = resolveOutlineVersionId(connection, outlineId);
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, internalId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) {
                    throw new SQLException("OUTLINE_NOT_FOUND");
                }
                return mapOf(
                    "internalId", result.getLong(1),
                    "id", result.getString(6),
                    "manualId", result.getString(2),
                    "state", result.getString(3),
                    "editVersion", result.getLong(4),
                    "outlineSubjectId", result.getLong(5)
                );
            }
        }
    }

    private Map<String, List<String>> explicitNodeDomains(Connection connection, String outlineId) throws SQLException {
        Map<String, List<String>> assignments = new LinkedHashMap<>();
        String sql = "SELECT N.NODE_KEY, I.TECH_DOMAIN_ID FROM KC_MANUAL_OUTLINE_RESP_ITEM I "
            + "JOIN KC_MANUAL_OUTLINE_NODE N ON N.OUTLINE_NODE_ID=I.OUTLINE_NODE_ID "
            + "WHERE I.RESP_VERSION_ID=(SELECT CURRENT_RESP_VERSION_ID FROM KC_MANUAL_OUTLINE_VERSION WHERE OUTLINE_VERSION_ID=?) "
            + "ORDER BY N.SORT_NO, I.DOMAIN_ROLE DESC, I.TECH_DOMAIN_ID";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, resolveOutlineVersionId(connection, outlineId));
            try (ResultSet result = statement.executeQuery()) {
                while (result.next()) {
                    assignments.computeIfAbsent(result.getString(1), ignored -> new ArrayList<>()).add(result.getString(2));
                }
            }
        }
        return assignments;
    }

    private Map<String, Object> projectOutlineGovernance(Connection connection, String outlineId) throws SQLException {
        Map<String, Object> header = outlineHeader(connection, outlineId);
        List<Map<String, Object>> nodes = outlineNodes(connection, outlineId);
        Map<String, List<String>> explicit = explicitNodeDomains(connection, outlineId);
        List<Map<String, Object>> assignments = new ArrayList<>();
        for (Map.Entry<String, List<String>> entry : explicit.entrySet()) {
            assignments.add(mapOf("nodeId", entry.getKey(), "techDomainIds", entry.getValue()));
        }

        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        for (Map<String, Object> node : nodes) {
            byId.put(String.valueOf(node.get("id")), node);
        }
        List<Map<String, Object>> effective = new ArrayList<>();
        long documents = 0L;
        long assignedDocuments = 0L;
        for (Map<String, Object> node : nodes) {
            if (!"document".equals(node.get("kind"))) {
                continue;
            }
            documents++;
            List<String> domainIds = new ArrayList<>();
            String current = String.valueOf(node.get("id"));
            while (current != null && !"null".equals(current)) {
                for (String domainId : explicit.getOrDefault(current, List.of())) {
                    if (!domainIds.contains(domainId)) {
                        domainIds.add(domainId);
                    }
                }
                Map<String, Object> parent = byId.get(current);
                Object parentId = parent == null ? null : parent.get("parentId");
                current = parentId == null ? null : String.valueOf(parentId);
            }
            if (!domainIds.isEmpty()) {
                assignedDocuments++;
            }
            effective.add(mapOf(
                "nodeId", node.get("id"),
                "documentId", coalesce(node.get("sourceId"), node.get("id")),
                "title", node.get("title"),
                "techDomainIds", domainIds
            ));
        }
        List<Map<String, Object>> ownedEffective = new ArrayList<>();
        for (Map<String, Object> item : effective) {
            Map<String, Object> owned = new LinkedHashMap<>(item);
            List<Map<String, Object>> ownerships = new ArrayList<>();
            for (Object domainValue : listValues(item.get("techDomainIds"))) {
                String domainId = String.valueOf(domainValue);
                Map<String, Object> ownership = new LinkedHashMap<>();
                ownership.put("techDomainId", domainId);
                ownership.put("techDomainName", techDomainName(connection, domainId));
                ownership.put("taskId", null);
                ownership.put("assigneeId", null);
                ownership.put("assigneeName", null);
                ownership.put("status", "pending_binding");
                ownerships.add(ownership);
            }
            owned.put("ownerships", ownerships);
            ownedEffective.add(owned);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("outlineId", outlineId);
        body.put("manualId", header.get("manualId"));
        body.put("state", header.get("state"));
        body.put("editVersion", header.get("editVersion"));
        body.put("nodes", nodes);
        body.put("assignments", assignments);
        body.put("effectiveDocumentAssignments", ownedEffective);
        body.put("techDomains", projectTechDomains(connection).get("techDomains"));
        body.put("tasks", projectBuildTasksForOutline(connection, outlineId));
        body.put("summary", mapOf(
            "totalDocuments", documents,
            "assignedDocuments", assignedDocuments,
            "unassignedDocuments", documents - assignedDocuments
        ));
        return body;
    }

    private List<Map<String, Object>> effectiveAssignments(List<Map<String, Object>> nodes, List<Map<String, Object>> assignments) {
        Map<String, List<String>> explicit = new LinkedHashMap<>();
        for (Map<String, Object> assignment : assignments) {
            String nodeId = coalesce(assignment.get("nodeId"), assignment.get("outlineNodeId"));
            if (nodeId == null) {
                continue;
            }
            List<String> domains = explicit.computeIfAbsent(nodeId, ignored -> new ArrayList<>());
            for (Object value : listValues(assignment.get("techDomainIds"))) {
                String domainId = String.valueOf(value);
                if (!domains.contains(domainId)) {
                    domains.add(domainId);
                }
            }
        }
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        for (Map<String, Object> node : nodes) {
            byId.put(String.valueOf(node.get("id")), node);
        }
        List<Map<String, Object>> effective = new ArrayList<>();
        for (Map<String, Object> node : nodes) {
            if (!"document".equals(node.get("kind"))) {
                continue;
            }
            List<String> domainIds = new ArrayList<>();
            String current = String.valueOf(node.get("id"));
            while (current != null && !"null".equals(current)) {
                for (String domainId : explicit.getOrDefault(current, List.of())) {
                    if (!domainIds.contains(domainId)) {
                        domainIds.add(domainId);
                    }
                }
                Map<String, Object> currentNode = byId.get(current);
                current = currentNode == null ? null : coalesce(currentNode.get("parentId"));
            }
            effective.add(mapOf(
                "nodeId", node.get("id"),
                "documentId", coalesce(node.get("sourceId"), node.get("id")),
                "title", node.get("title"),
                "techDomainIds", domainIds
            ));
        }
        return effective;
    }

    private Map<String, Object> saveOutlineGovernance(Connection connection, String outlineId, Map<String, Object> payload) throws SQLException {
        Map<String, Object> header = outlineHeader(connection, outlineId);
        long internalOutlineId = ((Number) header.get("internalId")).longValue();
        boolean published = "PUBLISHED".equals(header.get("state"));
        if ("SUPERSEDED".equals(header.get("state")) || "ARCHIVED".equals(header.get("state"))) {
            throw new SQLException("OUTLINE_IMMUTABLE");
        }
        if (payload.containsKey("editVersion") && Long.parseLong(String.valueOf(payload.get("editVersion"))) != ((Number) header.get("editVersion")).longValue()) {
            throw new SQLException("OUTLINE_VERSION_CONFLICT");
        }
        List<Map<String, Object>> nodes = outlineNodes(connection, outlineId);
        Set<String> nodeIds = new java.util.HashSet<>();
        Map<String, String> descriptionsByNode = new LinkedHashMap<>();
        for (Map<String, Object> node : nodes) {
            String nodeId = String.valueOf(node.get("id"));
            nodeIds.add(nodeId);
            descriptionsByNode.put(nodeId, String.valueOf(node.get("description") == null ? "" : node.get("description")));
        }
        List<Map<String, Object>> descriptions = listOfMaps(payload.get("descriptions"));
        for (Map<String, Object> item : descriptions) {
            String nodeId = coalesce(item.get("nodeId"));
            if (nodeId == null || !nodeIds.contains(nodeId)) {
                throw new SQLException("INVALID_DOMAIN_PAYLOAD");
            }
            if (published && !String.valueOf(item.get("description") == null ? "" : item.get("description")).equals(descriptionsByNode.get(nodeId))) {
                throw new SQLException("PUBLISHED_CONTENT_LOCKED");
            }
        }
        List<Map<String, Object>> assignments = payload.containsKey("assignments")
            ? listOfMaps(payload.get("assignments"))
            : List.of();
        if (published && !payload.containsKey("assignments")) {
            throw new SQLException("PUBLISHED_ASSIGNMENT_REQUIRED");
        }
        for (Map<String, Object> assignment : assignments) {
            String nodeId = coalesce(assignment.get("nodeId"));
            if (nodeId == null || !nodeIds.contains(nodeId)) {
                throw new SQLException("INVALID_DOMAIN_PAYLOAD");
            }
            for (Object domainValue : listValues(assignment.get("techDomainIds"))) {
                String domainId = String.valueOf(domainValue);
                if (!techDomainExists(connection, domainId)) {
                    throw new SQLException("INVALID_DOMAIN_PAYLOAD");
                }
            }
        }
        if (published) {
            List<Map<String, Object>> missing = new ArrayList<>();
            for (Map<String, Object> item : effectiveAssignments(nodes, assignments)) {
                if (listValues(item.get("techDomainIds")).isEmpty()) {
                    missing.add(mapOf("nodeId", item.get("nodeId"), "documentId", item.get("documentId"), "title", item.get("title")));
                }
            }
            if (!missing.isEmpty()) {
                throw new GovernanceValidationException("PUBLISHED_ASSIGNMENT_REQUIRED", "已发布大纲不能取消页面的全部技术领域分工", 422, mapOf("missingDocuments", missing));
            }
        }
        if (!published) {
            for (Map<String, Object> item : descriptions) {
                String nodeId = coalesce(item.get("nodeId"));
            String description = item.get("description") == null ? "" : String.valueOf(item.get("description"));
                try (PreparedStatement update = connection.prepareStatement("UPDATE KC_MANUAL_OUTLINE_NODE SET NODE_DESCRIPTION = ?, UPDATED_BY=?, UPDATED_AT = CURRENT_TIMESTAMP WHERE NODE_KEY = ? AND OUTLINE_VERSION_ID = ?")) {
                    update.setCharacterStream(1, new StringReader(description));
                    update.setString(2, coalesce(payload.get("assignedBy"), "system:api"));
                    update.setString(3, nodeId);
                    update.setLong(4, internalOutlineId);
                    update.executeUpdate();
                }
            }
        }
        if (payload.containsKey("assignments")) {
            replaceResponsibilityItems(connection, internalOutlineId, effectiveAssignments(nodes, assignments), coalesce(payload.get("assignedBy"), "system:api"));
        }
        try (PreparedStatement update = connection.prepareStatement("UPDATE KC_MANUAL_OUTLINE_VERSION SET ROW_VERSION = ROW_VERSION + 1, UPDATED_BY=?, UPDATED_AT = CURRENT_TIMESTAMP WHERE OUTLINE_VERSION_ID = ?")) {
            update.setString(1, coalesce(payload.get("assignedBy"), "system:api"));
            update.setLong(2, internalOutlineId);
            update.executeUpdate();
        }
        return projectOutlineGovernance(connection, outlineId);
    }

    private void replaceResponsibilityItems(Connection connection, long outlineId, List<Map<String, Object>> effective, String actor) throws SQLException {
        long respVersionId = ensureResponsibilityVersion(connection, outlineId, actor);
        try (PreparedStatement delete = connection.prepareStatement("DELETE FROM KC_MANUAL_OUTLINE_RESP_ITEM WHERE RESP_VERSION_ID=?")) {
            delete.setLong(1, respVersionId);
            delete.executeUpdate();
        }
        for (Map<String, Object> item : effective) {
            long nodeId = resolveOutlineNodeId(connection, outlineId, String.valueOf(item.get("nodeId")));
            List<Object> domains = listValues(item.get("techDomainIds"));
            for (int index = 0; index < domains.size(); index++) {
                String domainId = String.valueOf(domains.get(index));
                Long ownerId = techDomainLeaderId(connection, Long.parseLong(domainId));
                try (PreparedStatement insert = connection.prepareStatement(
                    "INSERT INTO KC_MANUAL_OUTLINE_RESP_ITEM(RESP_VERSION_ID, OUTLINE_NODE_ID, TECH_DOMAIN_ID, DOMAIN_ROLE, OWNER_PRINCIPAL_ID, BINDING_STATUS, CREATED_BY, UPDATED_BY) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
                    insert.setLong(1, respVersionId);
                    insert.setLong(2, nodeId);
                    insert.setLong(3, Long.parseLong(domainId));
                    insert.setString(4, index == 0 ? "PRIMARY" : "COLLABORATOR");
                    if (ownerId == null) insert.setNull(5, java.sql.Types.BIGINT); else insert.setLong(5, ownerId);
                    insert.setString(6, ownerId == null ? "PENDING" : "BOUND");
                    insert.setString(7, actor);
                    insert.setString(8, actor);
                    insert.executeUpdate();
                }
            }
        }
        try (PreparedStatement update = connection.prepareStatement("UPDATE KC_MANUAL_OUTLINE_RESP_VERSION SET MAPPING_SHA256=?, ROW_VERSION=ROW_VERSION+1, UPDATED_BY=?, UPDATED_AT=CURRENT_TIMESTAMP WHERE RESP_VERSION_ID=?")) {
            update.setString(1, sha256(Json.stringify(effective)));
            update.setString(2, actor);
            update.setLong(3, respVersionId);
            update.executeUpdate();
        }
    }

    private long ensureResponsibilityVersion(Connection connection, long outlineId, String actor) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT CURRENT_RESP_VERSION_ID FROM KC_MANUAL_OUTLINE_VERSION WHERE OUTLINE_VERSION_ID=? FOR UPDATE")) {
            query.setLong(1, outlineId);
            try (ResultSet result = query.executeQuery()) {
                if (!result.next()) throw new SQLException("OUTLINE_NOT_FOUND");
                long current = result.getLong(1);
                if (!result.wasNull()) return current;
            }
        }
        long versionNo = 1L;
        try (PreparedStatement query = connection.prepareStatement("SELECT COALESCE(MAX(VERSION_NO),0)+1 FROM KC_MANUAL_OUTLINE_RESP_VERSION WHERE OUTLINE_VERSION_ID=?")) {
            query.setLong(1, outlineId);
            try (ResultSet result = query.executeQuery()) { result.next(); versionNo = result.getLong(1); }
        }
        long id = nextTableId(connection, "KC_RESPONSIBILITY_SEQ");
        try (PreparedStatement insert = connection.prepareStatement("INSERT INTO KC_MANUAL_OUTLINE_RESP_VERSION(RESP_VERSION_ID, OUTLINE_VERSION_ID, VERSION_NO, STATE, MAPPING_SHA256, CREATED_BY, UPDATED_BY) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?)")) {
            insert.setLong(1, id); insert.setLong(2, outlineId); insert.setLong(3, versionNo);
            insert.setString(4, sha256("[]")); insert.setString(5, actor); insert.setString(6, actor); insert.executeUpdate();
        }
        try (PreparedStatement update = connection.prepareStatement("UPDATE KC_MANUAL_OUTLINE_VERSION SET CURRENT_RESP_VERSION_ID=? WHERE OUTLINE_VERSION_ID=?")) {
            update.setLong(1, id); update.setLong(2, outlineId); update.executeUpdate();
        }
        return id;
    }

    private Map<String, Object> publishOutline(Connection connection, String outlineId, Map<String, Object> payload) throws SQLException {
        Map<String, Object> header = outlineHeader(connection, outlineId);
        long internalOutlineId = ((Number) header.get("internalId")).longValue();
        if ("PUBLISHED".equals(header.get("state"))) {
            return projectOutlineGovernance(connection, outlineId);
        }
        if ("SUPERSEDED".equals(header.get("state")) || "ARCHIVED".equals(header.get("state"))) {
            throw new SQLException("OUTLINE_IMMUTABLE");
        }
        if (payload.containsKey("editVersion") && Long.parseLong(String.valueOf(payload.get("editVersion"))) != ((Number) header.get("editVersion")).longValue()) {
            throw new SQLException("OUTLINE_VERSION_CONFLICT");
        }
        Map<String, Object> governance = projectOutlineGovernance(connection, outlineId);
        List<Map<String, Object>> effective = listOfMaps(governance.get("effectiveDocumentAssignments"));
        List<Map<String, Object>> missing = new ArrayList<>();
        for (Map<String, Object> item : effective) {
            List<Object> values = listValues(item.get("techDomainIds"));
            if (values.isEmpty()) {
                missing.add(mapOf("nodeId", item.get("nodeId"), "documentId", item.get("documentId"), "title", item.get("title")));
            }
        }
        if (!missing.isEmpty()) {
            throw new GovernanceValidationException("OUTLINE_RESPONSIBILITY_REQUIRED", "发布前必须完成所有 document 的技术领域分工", 422, mapOf("missingDocuments", missing));
        }
        String actor = coalesce(payload.get("principalId"), payload.get("publishedBy"), "system:api");
        long subjectId = ((Number) header.get("outlineSubjectId")).longValue();
        try (PreparedStatement update = connection.prepareStatement("UPDATE KC_MANUAL_OUTLINE_VERSION SET STATE='SUPERSEDED', UPDATED_BY=?, UPDATED_AT=CURRENT_TIMESTAMP WHERE OUTLINE_ID=? AND OUTLINE_VERSION_ID<>? AND STATE='PUBLISHED'")) {
            update.setString(1, actor);
            update.setLong(2, subjectId);
            update.setLong(3, internalOutlineId);
            update.executeUpdate();
        }
        Timestamp publishedAt = Timestamp.from(Instant.now());
        try (PreparedStatement update = connection.prepareStatement("UPDATE KC_MANUAL_OUTLINE_VERSION SET STATE='PUBLISHED', PUBLISHED_BY=?, PUBLISHED_AT=?, PUBLISH_REQUEST_ID=?, PUBLISH_REASON=?, UPDATED_BY=?, UPDATED_AT=CURRENT_TIMESTAMP WHERE OUTLINE_VERSION_ID=?")) {
            update.setString(1, actor);
            update.setTimestamp(2, publishedAt);
            update.setString(3, coalesce(payload.get("requestId"), payload.get("idempotencyKey")));
            update.setString(4, coalesce(payload.get("reason")));
            update.setString(5, actor);
            update.setLong(6, internalOutlineId);
            update.executeUpdate();
        }
        try (PreparedStatement update = connection.prepareStatement("UPDATE KC_MANUAL_OUTLINE_RESP_VERSION SET STATE='PUBLISHED', PUBLISHED_BY=?, PUBLISHED_AT=?, UPDATED_BY=?, UPDATED_AT=CURRENT_TIMESTAMP WHERE RESP_VERSION_ID=(SELECT CURRENT_RESP_VERSION_ID FROM KC_MANUAL_OUTLINE_VERSION WHERE OUTLINE_VERSION_ID=?)")) {
            update.setString(1, actor); update.setTimestamp(2, publishedAt); update.setString(3, actor); update.setLong(4, internalOutlineId); update.executeUpdate();
        }
        try (PreparedStatement update = connection.prepareStatement("UPDATE KC_MANUAL_OUTLINE SET CURRENT_OUTLINE_VERSION_ID=?, UPDATED_BY=?, UPDATED_AT=CURRENT_TIMESTAMP WHERE OUTLINE_ID=?")) {
            update.setLong(1, internalOutlineId);
            update.setString(2, actor);
            update.setLong(3, subjectId);
            update.executeUpdate();
        }
        return projectOutlineGovernance(connection, outlineId);
    }

    private boolean techDomainExists(Connection connection, String domainId) throws SQLException {
        long numericId;
        try {
            numericId = Long.parseLong(domainId);
        } catch (NumberFormatException error) {
            return false;
        }
        try (PreparedStatement statement = connection.prepareStatement("SELECT TECH_DOMAIN_ID FROM KC_TECH_DOMAIN WHERE TECH_DOMAIN_ID = ? AND STATE='ACTIVE'")) {
            statement.setLong(1, numericId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    private Long techDomainLeaderId(Connection connection, long domainId) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT PRINCIPAL_ID FROM KC_TECH_DOMAIN_MEMBER WHERE TECH_DOMAIN_ID=? AND MEMBER_ROLE='LEADER' AND STATE='ACTIVE' ORDER BY PRINCIPAL_ID")) {
            query.setLong(1, domainId);
            try (ResultSet result = query.executeQuery()) {
                return result.next() ? result.getLong(1) : null;
            }
        }
    }

    private List<Map<String, Object>> projectBuildTasksForOutline(Connection connection, String outlineId) throws SQLException {
        return projectBuildTasks(connection, resolveOutlineVersionId(connection, outlineId));
    }

    private Map<String, Object> projectBuildTasks(Connection connection) throws SQLException {
        return mapOf("tasks", projectBuildTasks(connection, null), "generatedAt", Instant.now().toString());
    }

    private Map<String, Object> projectBuildTask(Connection connection, String taskId) throws SQLException {
        for (Map<String, Object> task : projectBuildTasks(connection, null)) {
            if (taskId.equals(task.get("id"))) return task;
        }
        return null;
    }

    private List<Map<String, Object>> projectBuildTasks(Connection connection, Long onlyOutlineVersionId) throws SQLException {
        List<Map<String, Object>> tasks = new ArrayList<>();
        String sql = "SELECT DISTINCT V.OUTLINE_VERSION_ID, COALESCE(V.SOURCE_REF, TO_CHAR(V.OUTLINE_VERSION_ID)), "
            + "M.MANUAL_CODE, I.TECH_DOMAIN_ID, D.DOMAIN_NAME, V.PUBLISHED_AT, V.CREATED_AT, V.UPDATED_AT "
            + "FROM KC_MANUAL_OUTLINE_VERSION V JOIN KC_MANUAL_OUTLINE O ON O.OUTLINE_ID=V.OUTLINE_ID "
            + "JOIN KC_MANUAL M ON M.MANUAL_ID=O.MANUAL_ID "
            + "JOIN KC_MANUAL_OUTLINE_RESP_ITEM I ON I.RESP_VERSION_ID=V.CURRENT_RESP_VERSION_ID "
            + "JOIN KC_TECH_DOMAIN D ON D.TECH_DOMAIN_ID=I.TECH_DOMAIN_ID WHERE V.STATE='PUBLISHED' "
            + (onlyOutlineVersionId == null ? "" : "AND V.OUTLINE_VERSION_ID=? ")
            + "ORDER BY V.UPDATED_AT DESC, V.OUTLINE_VERSION_ID, I.TECH_DOMAIN_ID";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            if (onlyOutlineVersionId != null) statement.setLong(1, onlyOutlineVersionId);
            try (ResultSet result = statement.executeQuery()) {
                while (result.next()) tasks.add(projectBuildTaskRow(connection, result));
            }
        }
        return tasks;
    }

    private String techDomainName(Connection connection, String domainId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("SELECT DOMAIN_NAME FROM KC_TECH_DOMAIN WHERE TECH_DOMAIN_ID = ?")) {
            statement.setString(1, domainId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? result.getString(1) : domainId;
            }
        }
    }

    private Map<String, Object> projectBuildTaskRow(Connection connection, ResultSet result) throws SQLException {
        long outlineVersionId = result.getLong(1);
        String externalOutlineId = result.getString(2);
        String domainId = result.getString(4);
        String taskId = buildTaskId(externalOutlineId, domainId);
        Map<String, Object> personnel = domainPersonnel(connection, domainId);
        Map<String, Object> leader = personnel.get("leader") instanceof Map<?, ?> value ? castMap(value) : Map.of();
        Map<String, Object> task = new LinkedHashMap<>();
        task.put("id", taskId);
        task.put("manualId", result.getString(3));
        task.put("outlineVersionId", externalOutlineId);
        task.put("techDomainId", domainId);
        task.put("techDomainName", result.getString(5));
        task.put("domainLeaderId", leader.get("id"));
        task.put("domainLeaderName", leader.get("name"));
        task.put("domainMembers", personnel.get("members"));
        task.put("state", "open");
        task.put("publishedAt", timestampToString(result.getTimestamp(6)));
        task.put("createdAt", timestampToString(result.getTimestamp(7)));
        task.put("updatedAt", timestampToString(result.getTimestamp(8)));
        List<Map<String, Object>> items = new ArrayList<>();
        String itemSql = "SELECT I.RESP_ITEM_ID, N.NODE_KEY, N.NODE_TITLE, I.OWNER_PRINCIPAL_ID, I.BINDING_STATUS, I.UPDATED_BY, I.UPDATED_AT "
            + "FROM KC_MANUAL_OUTLINE_RESP_ITEM I JOIN KC_MANUAL_OUTLINE_NODE N ON N.OUTLINE_NODE_ID=I.OUTLINE_NODE_ID "
            + "JOIN KC_MANUAL_OUTLINE_VERSION V ON V.CURRENT_RESP_VERSION_ID=I.RESP_VERSION_ID "
            + "WHERE V.OUTLINE_VERSION_ID=? AND I.TECH_DOMAIN_ID=? ORDER BY N.SORT_NO, I.RESP_ITEM_ID";
        try (PreparedStatement statement = connection.prepareStatement(itemSql)) {
            statement.setLong(1, outlineVersionId);
            statement.setLong(2, Long.parseLong(domainId));
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    String nodeKey = rows.getString(2);
                    String assigneeId = rows.getString(4);
                    items.add(mapOf(
                        "id", buildTaskItemId(taskId, nodeKey, domainId), "taskId", taskId,
                        "documentId", nodeKey, "documentTitle", rows.getString(3), "outlineNodeId", nodeKey,
                        "techDomainId", domainId, "assigneeId", assigneeId, "assigneeName", assigneeId,
                        "status", "BOUND".equals(rows.getString(5)) ? "assigned" : "unassigned",
                        "assignedBy", rows.getString(6), "assignedAt", timestampToString(rows.getTimestamp(7))
                    ));
                }
            }
        }
        task.put("items", items);
        return task;
    }

    private Map<String, Object> domainPersonnel(Connection connection, String domainId) throws SQLException {
        Map<String, Object> value = mapOf("leader", null, "members", new ArrayList<>());
        try (PreparedStatement statement = connection.prepareStatement(
            "SELECT PRINCIPAL_ID, MEMBER_ROLE FROM KC_TECH_DOMAIN_MEMBER WHERE TECH_DOMAIN_ID=? AND STATE='ACTIVE' ORDER BY MEMBER_ROLE, PRINCIPAL_ID")) {
            statement.setLong(1, Long.parseLong(domainId));
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    Map<String, Object> person = mapOf("id", rows.getString(1), "name", rows.getString(1), "role", rows.getString(2).toLowerCase());
                    if ("LEADER".equals(rows.getString(2))) value.put("leader", person);
                    else {
                        @SuppressWarnings("unchecked")
                        List<Object> members = (List<Object>) value.get("members");
                        members.add(person);
                    }
                }
            }
        }
        return value;
    }

    private String buildTaskId(String outlineId, String domainId) {
        return "build-task_" + sha256(outlineId + "|" + domainId).substring(0, 16);
    }

    private String buildTaskItemId(String taskId, String nodeKey, String domainId) {
        return "build-item_" + sha256(taskId + "|" + nodeKey + "|" + domainId).substring(0, 16);
    }

    private Map<String, Object> updateBuildTaskItem(Connection connection, String taskId, String itemId, Map<String, Object> payload) throws SQLException {
        Map<String, Object> task = projectBuildTask(connection, taskId);
        if (task == null) throw new SQLException("BUILD_TASK_NOT_FOUND");
        Map<String, Object> selected = null;
        for (Map<String, Object> item : listOfMaps(task.get("items"))) if (itemId.equals(item.get("id"))) selected = item;
        if (selected == null) throw new SQLException("BUILD_TASK_ITEM_NOT_FOUND");
        String domainId = String.valueOf(task.get("techDomainId"));
        Map<String, Object> assignee = payload.get("assignee") instanceof Map<?, ?> map ? castMap(map) : Map.of();
        String assigneeId = coalesce(payload.get("assigneeId"), assignee.get("id"));
        String assigneeName = coalesce(payload.get("assigneeName"), assignee.get("name"));
        String status = coalesce(payload.get("status"), assigneeId == null ? "unassigned" : "assigned");
        if (assigneeId != null) {
            try (PreparedStatement query = connection.prepareStatement("SELECT PRINCIPAL_ID FROM KC_TECH_DOMAIN_MEMBER WHERE TECH_DOMAIN_ID=? AND PRINCIPAL_ID=? AND STATE='ACTIVE'")) {
                query.setLong(1, Long.parseLong(domainId));
                query.setLong(2, Long.parseLong(assigneeId));
                try (ResultSet result = query.executeQuery()) {
                    if (!result.next()) throw new GovernanceValidationException("BUILD_TASK_ASSIGNEE_INVALID", "只能分配给当前技术领域的负责人或成员", 422, mapOf("techDomainId", domainId, "assigneeId", assigneeId));
                    if (assigneeName == null) assigneeName = result.getString(1);
                }
            }
        } else {
            assigneeName = null;
        }
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_MANUAL_OUTLINE_RESP_ITEM SET OWNER_PRINCIPAL_ID=?, BINDING_STATUS=?, UPDATED_BY=?, UPDATED_AT=CURRENT_TIMESTAMP "
                + "WHERE RESP_ITEM_ID=(SELECT I.RESP_ITEM_ID FROM KC_MANUAL_OUTLINE_RESP_ITEM I JOIN KC_MANUAL_OUTLINE_NODE N ON N.OUTLINE_NODE_ID=I.OUTLINE_NODE_ID "
                + "JOIN KC_MANUAL_OUTLINE_VERSION V ON V.CURRENT_RESP_VERSION_ID=I.RESP_VERSION_ID WHERE COALESCE(V.SOURCE_REF, TO_CHAR(V.OUTLINE_VERSION_ID))=? AND N.NODE_KEY=? AND I.TECH_DOMAIN_ID=?)")) {
            if (assigneeId == null) update.setNull(1, java.sql.Types.BIGINT); else update.setLong(1, Long.parseLong(assigneeId));
            update.setString(2, assigneeId == null ? "PENDING" : "BOUND");
            update.setString(3, coalesce(payload.get("assignedBy"), "system:api"));
            update.setString(4, String.valueOf(task.get("outlineVersionId")));
            update.setString(5, String.valueOf(selected.get("outlineNodeId")));
            update.setLong(6, Long.parseLong(domainId));
            update.executeUpdate();
        }
        return projectBuildTask(connection, taskId);
    }

    private Map<String, Object> projectHandbooks(Connection connection) throws SQLException {
        return projectHandbooks(connection, null);
    }

    private Map<String, Object> projectHandbooks(Connection connection, Map<String, Double> timings) throws SQLException {
        long projectionStarted = System.nanoTime();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("version", 1L);
        body.put("generatedAt", Instant.now().toString());
        body.put("handbooks", new ArrayList<>());
        body.put("audits", new ArrayList<>());
        HandbookProjectionRepository.Projection projection = handbookProjectionRepository.list(connection);
        @SuppressWarnings("unchecked")
        List<Object> handbooks = (List<Object>) body.get("handbooks");
        for (HandbookProjectionRepository.HandbookRow row : projection.rows()) {
            handbooks.add(projectHandbook(row));
        }
        if (timings != null) {
            timings.put("queryMs", projection.queryMs());
            timings.put("mappingMs", projection.mappingMs());
        }
        if (perfEnabled()) {
            System.err.printf("[perf] handbooks_projection rows=%d db_query_ms=%.3f row_mapping_ms=%.3f total_ms=%.3f%n",
                handbooks.size(), projection.queryMs(), projection.mappingMs(), (System.nanoTime() - projectionStarted) / 1e6);
        }
        return body;
    }

    private Map<String, Object> projectHandbook(HandbookProjectionRepository.HandbookRow row) throws SQLException {
        try {
            Map<String, Object> handbook = new LinkedHashMap<>();
            handbook.put("handbookId", row.manualCode());
            handbook.put("id", row.manualCode());
            handbook.put("manualId", row.manualId());
            handbook.put("code", row.manualCode());
            handbook.put("name", coalesce(row.manualName(), row.manualCode()));
            handbook.put("title", handbook.get("name"));
            handbook.put("productId", row.productId());
            handbook.put("productName", row.productName());
            handbook.put("productType", row.productName());
            handbook.put("ownerA", ownerProjection(row.primaryOwnerId(), row.primaryOwnerName()));
            handbook.put("ownerB", ownerProjection(row.deputyOwnerId(), row.deputyOwnerName()));
            handbook.put("departmentId", row.orgUnitId());
            handbook.put("orgUnitId", row.orgUnitId());
            String currentOutlineId = row.currentOutlineExternalId();
            handbook.put("currentOutlineVersionId", currentOutlineId);
            handbook.put("outline", outlineSummary(currentOutlineId, null));
            handbook.put("status", row.state().toLowerCase());
            handbook.put("sourceStatus", handbook.get("status"));
            handbook.put("archivedAt", timestampToString(row.archivedAt()));
            handbook.put("assetVersion", row.rowVersion());
            handbook.put("summary", row.summary());
            handbook.put("isAtomic", "ATOMIC".equals(row.manualKind()));
            handbook.put("externalVisible", row.externallyVisible());
            handbook.put("documentSummary", mapOf("total", 0L, "published", 0L, "inProgress", 0L, "runningTasks", 0L));
            handbook.put("createdAt", timestampToString(row.createdAt()));
            handbook.put("updatedAt", timestampToString(row.updatedAt()));
            return handbook;
        } catch (Exception error) {
            throw new SQLException("读取手册投影失败", error);
        }
    }

    private Map<String, Object> ownerProjection(String principalId, String principalName) {
        return principalId == null ? null : mapOf(
            "principalId", principalId, "userId", principalId, "id", principalId,
            "displayName", coalesce(principalName, principalId), "bindingStatus", "bound"
        );
    }

    private Map<String, Object> saveOutlinesSnapshot(Connection connection, Map<String, Object> payload) throws SQLException, JsonParseException {
        List<Map<String, Object>> outlines = listOfMaps(payload.get("outlines"));
        Set<Long> manualIds = new java.util.HashSet<>();
        for (Map<String, Object> outline : outlines) {
            validateOutlineSnapshot(outline);
            String outlineId = outlineId(outline);
            String handbookId = handbookIdFromOutline(outline, outlineId);
            long manualId = requireExistingManual(connection, handbookId);
            long outlineVersionId = upsertOutlineVersion(connection, manualId, outlineId, outline, payload);
            manualIds.add(manualId);
            rebuildOutlineChildren(connection, outlineVersionId, outlineId, outline);
            replaceOutlineAssignmentsFromSnapshot(connection, outlineVersionId, outlineId, outline, coalesce(payload.get("principalId"), payload.get("updatedBy"), "system:api"));
        }
        updateCurrentOutlinePointers(connection, manualIds);
        return projectOutlines(connection);
    }

    private Map<String, Object> projectOutlines(Connection connection) throws SQLException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("outlines", new ArrayList<>());
        body.put("generatedAt", Instant.now().toString());
        String sql = "SELECT O.OUTLINE_ID, M.MANUAL_CODE, M.MANUAL_NAME, "
            + "CASE WHEN O.CURRENT_OUTLINE_VERSION_ID IS NULL THEN 'DRAFT' ELSE 'ACTIVE' END, O.CURRENT_OUTLINE_VERSION_ID, "
            + "V.OUTLINE_VERSION_ID, V.VERSION_CODE, M.MANUAL_NAME, V.STATE, V.BASE_OUTLINE_VERSION_ID, "
            + "V.SOURCE_TYPE, V.SOURCE_SHA256, V.PARSER_VERSION, V.RULE_VERSION, V.ROW_VERSION, "
            + "V.PUBLISHED_AT, O.CREATED_AT, O.UPDATED_AT, V.SOURCE_REF "
            + "FROM KC_MANUAL_OUTLINE O JOIN KC_MANUAL M ON M.MANUAL_ID=O.MANUAL_ID "
            + "LEFT JOIN KC_MANUAL_OUTLINE_VERSION V ON V.OUTLINE_ID = O.OUTLINE_ID "
            + "ORDER BY O.CREATED_AT, O.OUTLINE_ID, V.CREATED_AT, V.OUTLINE_VERSION_ID";
        try (PreparedStatement statement = connection.prepareStatement(sql); ResultSet result = statement.executeQuery()) {
            @SuppressWarnings("unchecked")
            List<Object> outlines = (List<Object>) body.get("outlines");
            while (result.next()) {
                outlines.add(projectOutline(connection, result));
            }
        }
        return body;
    }

    private Map<String, Object> projectOutline(Connection connection, ResultSet result) throws SQLException {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            String internalVersionId = result.getString(6);
            String versionId = result.getString(19) == null ? internalVersionId : result.getString(19);
            body.put("id", versionId == null ? result.getString(1) : versionId);
            body.put("outlineId", versionId == null ? result.getString(1) : versionId);
            body.put("handbookId", result.getString(2));
            body.put("manualId", result.getString(2));
            body.put("name", result.getString(3));
            body.put("currentOutlineVersionId", externalOutlineId(connection, result.getString(5)));
            body.put("outlineStructureVersion", result.getString(7));
            body.put("versionName", result.getString(8));
            body.put("state", (internalVersionId == null ? result.getString(4) : result.getString(9)).toLowerCase());
            body.put("baseVersionId", externalOutlineId(connection, result.getString(10)));
            body.put("sourceType", result.getString(11));
            body.put("sourceFingerprint", result.getString(12));
            body.put("parserVersion", result.getString(13));
            body.put("ruleVersion", result.getString(14));
            body.put("editVersion", versionId == null ? result.getLong(15) : result.getLong(15));
            body.put("published_at", timestampToString(result.getTimestamp(16)));
            body.put("created_at", timestampToString(result.getTimestamp(17)));
            body.put("updated_at", timestampToString(result.getTimestamp(18)));
            List<Map<String, Object>> nodes = internalVersionId == null ? new ArrayList<>() : outlineNodes(connection, Long.parseLong(internalVersionId));
            body.put("nodes", nodes);
            body.put("kp_count", countNodesByKind(nodes, "document"));
            return body;
        } catch (Exception error) {
            throw new SQLException("读取大纲投影失败", error);
        }
    }

    private Map<String, Object> deleteOutline(Connection connection, String outlineId) throws SQLException {
        String sql = "SELECT O.MANUAL_ID, V.STATE FROM KC_MANUAL_OUTLINE_VERSION V JOIN KC_MANUAL_OUTLINE O ON O.OUTLINE_ID=V.OUTLINE_ID WHERE V.OUTLINE_VERSION_ID = ? FOR UPDATE";
        long internalOutlineId = resolveOutlineVersionId(connection, outlineId);
        long manualId;
        String state;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, internalOutlineId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) {
                    throw new SQLException("OUTLINE_NOT_FOUND");
                }
                manualId = result.getLong(1);
                state = result.getString(2);
            }
        } catch (SQLException error) {
            throw error;
        }
        if ("PUBLISHED".equals(state) || "SUPERSEDED".equals(state)) {
            throw new SQLException("OUTLINE_IMMUTABLE");
        }
        deleteOutlineChildren(connection, internalOutlineId);
        try (PreparedStatement delete = connection.prepareStatement("DELETE FROM KC_MANUAL_OUTLINE_VERSION WHERE OUTLINE_VERSION_ID = ?")) {
            delete.setLong(1, internalOutlineId);
            delete.executeUpdate();
        }
        updateCurrentOutlinePointer(connection, manualId);
        return mapOf("id", outlineId, "deleted", true);
    }

    private void upsertManual(Connection connection, Map<String, Object> handbook, Map<String, Object> snapshot) throws SQLException, JsonParseException {
        String sourceId = handbookId(handbook);
        String code = coalesce(handbook.get("code"), sourceId);
        String title = coalesce(handbook.get("title"), handbook.get("name"), code);
        long productId = productId(handbook.get("productId"));
        String productName = coalesce(handbook.get("productName"));
        if (productName == null) throw new SQLException("PRODUCT_NAME_REQUIRED");
        Map<String, Object> ownerA = asMapOrEmpty(handbook.get("ownerA"));
        Map<String, Object> ownerB = asMapOrEmpty(handbook.get("ownerB"));
        Long ownerAId = optionalNumericId(ownerA.get("userId"), ownerA.get("id"));
        Long ownerBId = optionalNumericId(ownerB.get("userId"), ownerB.get("id"));
        Long departmentId = optionalNumericId(handbook.get("orgUnitId"), handbook.get("departmentId"));
        String status = manualState(coalesce(handbook.get("status"), handbook.get("sourceStatus"), "DRAFT"));
        String archivedAt = coalesce(handbook.get("archivedAt"));
        String summary = coalesce(handbook.get("summary"));
        String actor = coalesce(snapshot.get("principalId"), snapshot.get("updatedBy"), "system:api");
        String manualKind = Boolean.TRUE.equals(handbook.get("isAtomic")) ? "ATOMIC" : "COMPOSITE";
        String visible = Boolean.TRUE.equals(handbook.get("externalVisible")) ? "Y" : "N";
        long manualId = 0L;
        try (PreparedStatement query = connection.prepareStatement("SELECT MANUAL_ID, ROW_VERSION FROM KC_MANUAL WHERE PRODUCT_ID=? AND MANUAL_CODE=? FOR UPDATE")) {
            query.setLong(1, productId);
            query.setString(2, code);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) {
                    manualId = result.getLong(1);
                    long version = result.getLong(2) + 1;
                    try (PreparedStatement update = connection.prepareStatement(
                        "UPDATE KC_MANUAL SET MANUAL_CODE=?, MANUAL_NAME=?, PRODUCT_ID=?, PRODUCT_NAME=?, ORG_UNIT_ID=?, MANUAL_KIND=?, IS_EXTERNALLY_VISIBLE=?, STATE=?, ARCHIVED_AT=?, ROW_VERSION=?, SUMMARY=?, UPDATED_BY=?, UPDATED_AT=CURRENT_TIMESTAMP WHERE MANUAL_ID=?")) {
                        update.setString(1, code);
                        update.setString(2, title);
                        update.setLong(3, productId);
                        update.setString(4, productName);
                        if (departmentId == null) update.setNull(5, java.sql.Types.BIGINT); else update.setLong(5, departmentId);
                        update.setString(6, manualKind);
                        update.setString(7, visible);
                        update.setString(8, status);
                        update.setTimestamp(9, archivedAt == null ? null : Timestamp.from(Instant.parse(archivedAt)));
                        update.setLong(10, version);
                        update.setCharacterStream(11, new StringReader(summary == null ? "" : summary));
                        update.setString(12, actor);
                        update.setLong(13, manualId);
                        update.executeUpdate();
                    }
                    replaceManualOwners(connection, manualId, ownerAId, ownerBId, actor);
                    ensureManualOutline(connection, manualId, actor);
                    return;
                }
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_MANUAL(MANUAL_CODE, MANUAL_NAME, PRODUCT_ID, PRODUCT_NAME, ORG_UNIT_ID, MANUAL_KIND, IS_EXTERNALLY_VISIBLE, STATE, SUMMARY, ARCHIVED_AT, CREATED_BY, UPDATED_BY) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
            insert.setString(1, code);
            insert.setString(2, title);
            insert.setLong(3, productId);
            insert.setString(4, productName);
            if (departmentId == null) insert.setNull(5, java.sql.Types.BIGINT); else insert.setLong(5, departmentId);
            insert.setString(6, manualKind);
            insert.setString(7, visible);
            insert.setString(8, status);
            insert.setCharacterStream(9, new StringReader(summary == null ? "" : summary));
            insert.setTimestamp(10, archivedAt == null ? null : Timestamp.from(Instant.parse(archivedAt)));
            insert.setString(11, actor);
            insert.setString(12, actor);
            insert.executeUpdate();
        }
        try (PreparedStatement query = connection.prepareStatement("SELECT MANUAL_ID FROM KC_MANUAL WHERE PRODUCT_ID=? AND MANUAL_CODE=?")) {
            query.setLong(1, productId); query.setString(2, code);
            try (ResultSet result = query.executeQuery()) { if (!result.next()) throw new SQLException("MANUAL_INSERT_FAILED"); manualId = result.getLong(1); }
        }
        replaceManualOwners(connection, manualId, ownerAId, ownerBId, actor);
        ensureManualOutline(connection, manualId, actor);
    }

    private String manualState(String value) {
        String normalized = value == null ? "DRAFT" : value.trim().toUpperCase();
        return switch (normalized) {
            case "IMPORTED", "CREATED", "ASSET_CREATED", "ACTIVE" -> "ACTIVE";
            case "FROZEN" -> "FROZEN";
            case "ARCHIVED" -> "ARCHIVED";
            default -> "DRAFT";
        };
    }

    private void replaceManualOwners(Connection connection, long manualId, Long primary, Long deputy, String actor) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement("DELETE FROM KC_MANUAL_OWNER WHERE MANUAL_ID = ?")) {
            delete.setLong(1, manualId);
            delete.executeUpdate();
        }
        insertManualOwner(connection, manualId, "PRIMARY", primary, actor);
        if (deputy != null && !deputy.equals(primary)) insertManualOwner(connection, manualId, "DEPUTY", deputy, actor);
    }

    private void insertManualOwner(Connection connection, long manualId, String role, Long principalId, String actor) throws SQLException {
        if (principalId == null) return;
        Map<String, Object> principal = principalRepository.findById(connection, principalId);
        if (principal == null || !"ACTIVE".equals(principal.get("state"))) throw new SQLException("MANUAL_OWNER_INVALID");
        String principalName = String.valueOf(principal.get("displayName"));
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_MANUAL_OWNER(MANUAL_ID, OWNER_ROLE, PRINCIPAL_ID, PRINCIPAL_NAME, PRINCIPAL_NAME_SYNCED_AT, CREATED_BY, UPDATED_BY) "
                + "VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)")) {
            insert.setLong(1, manualId);
            insert.setString(2, role);
            insert.setLong(3, principalId);
            insert.setString(4, principalName);
            insert.setString(5, actor);
            insert.setString(6, actor);
            insert.executeUpdate();
        }
    }

    private void ensureManualOutline(Connection connection, long manualId, String actor) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT OUTLINE_ID FROM KC_MANUAL_OUTLINE WHERE MANUAL_ID = ?")) {
            query.setLong(1, manualId);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) {
                    try (PreparedStatement update = connection.prepareStatement(
                        "UPDATE KC_MANUAL_OUTLINE SET UPDATED_BY=?, UPDATED_AT=CURRENT_TIMESTAMP WHERE MANUAL_ID=?")) {
                        update.setString(1, actor);
                        update.setLong(2, manualId);
                        update.executeUpdate();
                    }
                    return;
                }
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_MANUAL_OUTLINE(MANUAL_ID, CREATED_BY, UPDATED_BY) VALUES (?, ?, ?)")) {
            insert.setLong(1, manualId);
            insert.setString(2, actor);
            insert.setString(3, actor);
            insert.executeUpdate();
        }
    }

    private long requireExistingManual(Connection connection, String handbookId) throws SQLException {
        if (handbookId == null || handbookId.isBlank()) {
            throw new SQLException("OUTLINE_HANDBOOK_REQUIRED");
        }
        try (PreparedStatement query = connection.prepareStatement("SELECT MANUAL_ID FROM KC_MANUAL WHERE MANUAL_CODE = ?")) {
            query.setString(1, handbookId);
            try (ResultSet result = query.executeQuery()) {
                if (!result.next()) {
                    throw new SQLException("OUTLINE_HANDBOOK_NOT_FOUND");
                }
                return result.getLong(1);
            }
        }
    }

    private long nextTableId(Connection connection, String sequenceName) throws SQLException {
        Set<String> allowedSequences = Set.of(
            "KC_OUTLINE_SEQ",
            "KC_RESPONSIBILITY_SEQ"
        );
        if (!allowedSequences.contains(sequenceName)) {
            throw new SQLException("ID_SEQUENCE_NOT_ALLOWED");
        }
        try (PreparedStatement query = connection.prepareStatement("SELECT " + sequenceName + ".NEXTVAL FROM DUAL");
             ResultSet result = query.executeQuery()) {
            if (!result.next()) throw new SQLException("TABLE_ID_UNAVAILABLE");
            return result.getLong(1);
        }
    }

    private long outlineSubjectId(Connection connection, long manualId) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT OUTLINE_ID FROM KC_MANUAL_OUTLINE WHERE MANUAL_ID=?")) {
            query.setLong(1, manualId);
            try (ResultSet result = query.executeQuery()) {
                if (!result.next()) throw new SQLException("OUTLINE_SUBJECT_NOT_FOUND");
                return result.getLong(1);
            }
        }
    }

    private long resolveOutlineVersionId(Connection connection, String outlineId) throws SQLException {
        if (outlineId == null || outlineId.isBlank()) throw new SQLException("OUTLINE_NOT_FOUND");
        try (PreparedStatement query = connection.prepareStatement("SELECT OUTLINE_VERSION_ID FROM KC_MANUAL_OUTLINE_VERSION WHERE SOURCE_REF=?")) {
            query.setString(1, outlineId);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) return result.getLong(1);
            }
        }
        try {
            long internalId = Long.parseLong(outlineId);
            try (PreparedStatement query = connection.prepareStatement("SELECT OUTLINE_VERSION_ID FROM KC_MANUAL_OUTLINE_VERSION WHERE OUTLINE_VERSION_ID=?")) {
                query.setLong(1, internalId);
                try (ResultSet result = query.executeQuery()) {
                    if (result.next()) return internalId;
                }
            }
        } catch (NumberFormatException ignored) {
            // 公共 API 允许非数字业务 ID，仅数字形式才兼容旧内部 ID。
        }
        throw new SQLException("OUTLINE_NOT_FOUND");
    }

    private Long optionalOutlineVersionId(Connection connection, String outlineId) throws SQLException {
        return outlineId == null || outlineId.isBlank() ? null : resolveOutlineVersionId(connection, outlineId);
    }

    private String externalOutlineId(Connection connection, String internalId) throws SQLException {
        if (internalId == null || internalId.isBlank()) return null;
        try (PreparedStatement query = connection.prepareStatement("SELECT COALESCE(SOURCE_REF, TO_CHAR(OUTLINE_VERSION_ID)) FROM KC_MANUAL_OUTLINE_VERSION WHERE OUTLINE_VERSION_ID=?")) {
            query.setLong(1, Long.parseLong(internalId));
            try (ResultSet result = query.executeQuery()) {
                return result.next() ? result.getString(1) : internalId;
            }
        }
    }

    private long resolveOutlineNodeId(Connection connection, long outlineVersionId, String nodeKey) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT OUTLINE_NODE_ID FROM KC_MANUAL_OUTLINE_NODE WHERE OUTLINE_VERSION_ID=? AND NODE_KEY=?")) {
            query.setLong(1, outlineVersionId);
            query.setString(2, nodeKey);
            try (ResultSet result = query.executeQuery()) {
                if (!result.next()) throw new SQLException("INVALID_DOMAIN_PAYLOAD");
                return result.getLong(1);
            }
        }
    }

    private long upsertOutlineVersion(Connection connection, long manualId, String outlineId, Map<String, Object> outline, Map<String, Object> snapshot) throws SQLException {
        String versionCode = coalesce(outline.get("outlineStructureVersion"), outlineId);
        String state = outlineState(coalesce(outline.get("state"), "DRAFT"));
        Long baseVersionId = optionalOutlineVersionId(connection, coalesce(outline.get("baseVersionId")));
        String sourceType = outlineSourceType(coalesce(outline.get("sourceType"), "MANUAL"));
        String sourceFingerprint = coalesce(outline.get("sourceFingerprint"));
        String parserVersion = coalesce(outline.get("parserVersion"));
        String ruleVersion = coalesce(outline.get("ruleVersion"));
        String publishedAt = coalesce(outline.get("published_at"), outline.get("publishedAt"));
        String actor = coalesce(snapshot.get("principalId"), snapshot.get("updatedBy"), "system:api");
        long subjectId = outlineSubjectId(connection, manualId);
        String structureSha = sha256(Json.stringify(outline.get("content") == null ? Map.of() : outline.get("content")));
        try (PreparedStatement query = connection.prepareStatement("SELECT OUTLINE_VERSION_ID, ROW_VERSION FROM KC_MANUAL_OUTLINE_VERSION WHERE SOURCE_REF = ? FOR UPDATE")) {
            query.setString(1, outlineId);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) {
                    long internalId = result.getLong(1);
                    long editVersion = result.getLong(2) + 1;
                    try (PreparedStatement update = connection.prepareStatement(
                        "UPDATE KC_MANUAL_OUTLINE_VERSION SET OUTLINE_ID=?, VERSION_CODE=?, STATE=?, BASE_OUTLINE_VERSION_ID=?, SOURCE_TYPE=?, SOURCE_SHA256=?, PARSER_VERSION=?, RULE_VERSION=?, STRUCTURE_SHA256=?, ROW_VERSION=?, PUBLISHED_BY=?, PUBLISHED_AT=?, UPDATED_BY=?, UPDATED_AT=CURRENT_TIMESTAMP WHERE OUTLINE_VERSION_ID=?")) {
                        update.setLong(1, subjectId);
                        update.setString(2, versionCode);
                        update.setString(3, state);
                        if (baseVersionId == null) update.setNull(4, java.sql.Types.BIGINT); else update.setLong(4, baseVersionId);
                        update.setString(5, sourceType);
                        update.setString(6, sourceFingerprint);
                        update.setString(7, parserVersion);
                        update.setString(8, ruleVersion);
                        update.setString(9, structureSha);
                        update.setLong(10, editVersion);
                        update.setString(11, "PUBLISHED".equals(state) ? actor : null);
                        update.setTimestamp(12, "PUBLISHED".equals(state) ? (publishedAt == null ? Timestamp.from(Instant.now()) : Timestamp.from(Instant.parse(publishedAt))) : null);
                        update.setString(13, actor);
                        update.setLong(14, internalId);
                        update.executeUpdate();
                    }
                    return internalId;
                }
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_MANUAL_OUTLINE_VERSION(OUTLINE_VERSION_ID, OUTLINE_ID, VERSION_CODE, STATE, BASE_OUTLINE_VERSION_ID, SOURCE_TYPE, SOURCE_REF, SOURCE_SHA256, PARSER_VERSION, RULE_VERSION, STRUCTURE_SHA256, PUBLISHED_BY, PUBLISHED_AT, CREATED_BY, UPDATED_BY) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
            long internalId = nextTableId(connection, "KC_OUTLINE_SEQ");
            insert.setLong(1, internalId);
            insert.setLong(2, subjectId);
            insert.setString(3, versionCode);
            insert.setString(4, state);
            if (baseVersionId == null) insert.setNull(5, java.sql.Types.BIGINT); else insert.setLong(5, baseVersionId);
            insert.setString(6, sourceType);
            insert.setString(7, outlineId);
            insert.setString(8, sourceFingerprint);
            insert.setString(9, parserVersion);
            insert.setString(10, ruleVersion);
            insert.setString(11, structureSha);
            insert.setString(12, "PUBLISHED".equals(state) ? actor : null);
            insert.setTimestamp(13, "PUBLISHED".equals(state) ? (publishedAt == null ? Timestamp.from(Instant.now()) : Timestamp.from(Instant.parse(publishedAt))) : null);
            insert.setString(14, actor);
            insert.setString(15, actor);
            insert.executeUpdate();
            return internalId;
        }
    }

    private String outlineState(String value) {
        String normalized = value == null ? "DRAFT" : value.trim().toUpperCase();
        return switch (normalized) {
            case "READY" -> "READY";
            case "PUBLISHED" -> "PUBLISHED";
            case "SUPERSEDED" -> "SUPERSEDED";
            case "ARCHIVED" -> "ARCHIVED";
            default -> "DRAFT";
        };
    }

    private String outlineSourceType(String value) {
        String normalized = value == null ? "MANUAL" : value.trim().toUpperCase();
        return switch (normalized) {
            case "IMPORT", "REVERSE_EXTRACT", "MIGRATION" -> normalized;
            default -> "MANUAL";
        };
    }

    private void rebuildOutlineChildren(Connection connection, long outlineVersionId, String externalOutlineId, Map<String, Object> outline) throws SQLException {
        deleteOutlineChildren(connection, outlineVersionId);
        Map<String, Object> content = asMapOrEmpty(outline.get("content"));
        List<Map<String, Object>> parts = listOfMaps(content.get("parts"));
        long order = 0;
        for (int partIndex = 0; partIndex < parts.size(); partIndex++) {
            Map<String, Object> part = parts.get(partIndex);
            String partTitle = coalesce(part.get("part"), part.get("name"), part.get("title"), "未命名部分");
            String partId = stableNodeId(externalOutlineId, "part", String.valueOf(partIndex + 1), partTitle);
            long partInternalId = insertOutlineNode(connection, partId, outlineVersionId, null, "directory", partTitle, coalesce(part.get("description"), part.get("desc")), 1, ++order);
            order = insertDocuments(connection, outlineVersionId, externalOutlineId, partInternalId, listOfMaps(part.get("documents")), 2, String.valueOf(partIndex + 1), order);
            order = insertDirectories(connection, outlineVersionId, externalOutlineId, partInternalId, listOfMaps(part.get("chapters")), 2, String.valueOf(partIndex + 1), order);
            order = insertDirectories(connection, outlineVersionId, externalOutlineId, partInternalId, listOfMaps(part.get("children")), 2, String.valueOf(partIndex + 1), order);
        }
    }

    private void replaceOutlineAssignmentsFromSnapshot(Connection connection, long outlineVersionId, String outlineId, Map<String, Object> outline, String actor) throws SQLException {
        Object governanceValue = outline.get("governance");
        List<Map<String, Object>> assignments = governanceValue instanceof Map<?, ?> governance
            ? listOfMaps(castMap(governance).get("assignments"))
            : List.of();
        Map<String, String> nodeIdsBySourceId = new LinkedHashMap<>();
        Set<String> nodeIds = new java.util.HashSet<>();
        for (Map<String, Object> node : outlineNodes(connection, outlineId)) {
            String nodeId = coalesce(node.get("id"));
            if (nodeId != null) {
                nodeIds.add(nodeId);
            }
            if (!"document".equals(node.get("kind"))) {
                continue;
            }
            String sourceId = coalesce(node.get("sourceId"));
            if (sourceId != null && nodeId != null) {
                nodeIdsBySourceId.put(sourceId, nodeId);
            }
        }
        List<Map<String, Object>> contentAssignments = assignmentsFromContent(outline.get("content"), outlineId);
        List<Map<String, Object>> resolvedAssignments = new ArrayList<>();
        Set<String> resolvedKeys = new java.util.HashSet<>();
        for (Map<String, Object> assignment : assignments) {
            String sourceNodeId = coalesce(assignment.get("nodeId"), assignment.get("outlineNodeId"));
            String resolvedNodeId = nodeIdsBySourceId.getOrDefault(sourceNodeId, sourceNodeId);
            if (!nodeIds.contains(resolvedNodeId)) {
                continue;
            }
            Map<String, Object> resolved = mapOf("nodeId", resolvedNodeId, "techDomainIds", listValues(assignment.get("techDomainIds")));
            for (Object domainValue : listValues(resolved.get("techDomainIds"))) {
                resolvedKeys.add(resolvedNodeId + "|" + domainValue);
            }
            resolvedAssignments.add(resolved);
        }
        for (Map<String, Object> assignment : contentAssignments) {
            String sourceNodeId = coalesce(assignment.get("nodeId"), assignment.get("outlineNodeId"));
            String resolvedNodeId = nodeIdsBySourceId.getOrDefault(sourceNodeId, sourceNodeId);
            if (!nodeIds.contains(resolvedNodeId)) {
                continue;
            }
            List<Object> domainValues = listValues(assignment.get("techDomainIds"));
            List<Object> missingDomainValues = new ArrayList<>();
            for (Object domainValue : domainValues) {
                if (!resolvedKeys.contains(resolvedNodeId + "|" + domainValue)) {
                    missingDomainValues.add(domainValue);
                }
            }
            if (!missingDomainValues.isEmpty()) {
                resolvedAssignments.add(mapOf("nodeId", resolvedNodeId, "techDomainIds", missingDomainValues));
                for (Object domainValue : missingDomainValues) {
                    resolvedKeys.add(resolvedNodeId + "|" + domainValue);
                }
            }
        }
        for (Map<String, Object> assignment : resolvedAssignments) for (Object domainValue : listValues(assignment.get("techDomainIds"))) {
            if (!techDomainExists(connection, String.valueOf(domainValue))) throw new SQLException("INVALID_DOMAIN_PAYLOAD");
        }
        if (!resolvedAssignments.isEmpty()) replaceResponsibilityItems(connection, outlineVersionId, effectiveAssignments(outlineNodes(connection, outlineVersionId), resolvedAssignments), actor);
    }

    private List<Map<String, Object>> assignmentsFromContent(Object content, String outlineId) {
        List<Map<String, Object>> assignments = new ArrayList<>();
        Map<String, Object> value = asMapOrEmpty(content);
        for (Map<String, Object> part : listOfMaps(value.get("parts"))) {
            collectContentAssignments(assignments, part.get("documents"));
            for (Map<String, Object> chapter : listOfMaps(part.get("chapters"))) {
                collectContentAssignmentsRecursive(assignments, chapter);
            }
            for (Map<String, Object> child : listOfMaps(part.get("children"))) {
                collectContentAssignmentsRecursive(assignments, child);
            }
        }
        return assignments;
    }

    private void collectContentAssignmentsRecursive(List<Map<String, Object>> assignments, Map<String, Object> directory) {
        collectContentAssignments(assignments, directory.get("documents"));
        for (Map<String, Object> child : listOfMaps(directory.get("children"))) {
            collectContentAssignmentsRecursive(assignments, child);
        }
    }

    private void collectContentAssignments(List<Map<String, Object>> assignments, Object value) {
        for (Map<String, Object> document : listOfMaps(value)) {
            String nodeId = coalesce(document.get("nodeId"), document.get("outlineNodeId"), document.get("stableId"));
            String sourceId = coalesce(document.get("id"), document.get("documentId"), document.get("code"));
            Object domains = document.get("techDomainIds");
            if (nodeId == null && sourceId != null) {
                nodeId = sourceId;
            }
            if (nodeId != null && !listValues(domains).isEmpty()) {
                assignments.add(mapOf("nodeId", nodeId, "techDomainIds", listValues(domains)));
            }
        }
    }

    private long insertDirectories(Connection connection, long outlineVersionId, String externalOutlineId, long parentId, List<Map<String, Object>> directories, int level, String parentPath, long order) throws SQLException {
        for (int directoryIndex = 0; directoryIndex < directories.size(); directoryIndex++) {
            Map<String, Object> directory = directories.get(directoryIndex);
            String title = coalesce(directory.get("name"), directory.get("title"), "未命名章节");
            String path = parentPath + "." + (directoryIndex + 1);
            String nodeId = stableNodeId(externalOutlineId, level == 2 ? "chapter" : "section", path, title);
            long internalNodeId = insertOutlineNode(connection, nodeId, outlineVersionId, parentId, "directory", title, coalesce(directory.get("description"), directory.get("desc")), level, ++order);
            order = insertDocuments(connection, outlineVersionId, externalOutlineId, internalNodeId, leafDocuments(directory), level + 1, path, order);
            order = insertDirectories(connection, outlineVersionId, externalOutlineId, internalNodeId, listOfMaps(directory.get("children")), level + 1, path, order);
        }
        return order;
    }

    private long insertDocuments(Connection connection, long outlineVersionId, String externalOutlineId, long parentId, List<Map<String, Object>> documents, int level, String parentPath, long order) throws SQLException {
        for (int documentIndex = 0; documentIndex < documents.size(); documentIndex++) {
            Map<String, Object> document = documents.get(documentIndex);
            String sourceId = coalesce(document.get("id"), document.get("documentId"), document.get("code"), String.valueOf(documentIndex + 1));
            String path = parentPath + "." + (documentIndex + 1);
            int documentLevel = document.get("outlineLevel") instanceof Number value
                ? value.intValue()
                : level;
            String documentId = coalesce(document.get("nodeId"), document.get("outlineNodeId"), document.get("stableId"), stableNodeId(externalOutlineId, "document", path, sourceId));
            String documentTitle = coalesce(document.get("name"), document.get("title"), "未命名文档");
            String documentDesc = coalesce(document.get("desc"), document.get("description"), document.get("body"), documentTitle);
            insertOutlineNode(connection, documentId, outlineVersionId, parentId, "document", documentTitle, documentDesc, documentLevel, ++order);
        }
        return order;
    }

    private long insertOutlineNode(Connection connection, String nodeKey, long outlineVersionId, Long parentId, String nodeType, String title, String description, int level, long order) throws SQLException {
        long id = nextTableId(connection, "KC_OUTLINE_SEQ");
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_MANUAL_OUTLINE_NODE(OUTLINE_NODE_ID, OUTLINE_VERSION_ID, NODE_KEY, PARENT_NODE_ID, NODE_TYPE, NODE_TITLE, NODE_DESCRIPTION, LEVEL_NO, SORT_NO, IS_REQUIRED, CREATED_BY, UPDATED_BY) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Y', 'system:api', 'system:api')")) {
            insert.setLong(1, id);
            insert.setLong(2, outlineVersionId);
            insert.setString(3, nodeKey);
            if (parentId == null) insert.setNull(4, java.sql.Types.BIGINT); else insert.setLong(4, parentId);
            insert.setString(5, "document".equalsIgnoreCase(nodeType) ? "DOCUMENT" : "DIRECTORY");
            insert.setString(6, title);
            insert.setCharacterStream(7, new StringReader(description == null ? "" : description));
            insert.setLong(8, level);
            insert.setLong(9, order);
            insert.executeUpdate();
        }
        return id;
    }

    private List<Map<String, Object>> outlineNodes(Connection connection, String outlineVersionId) throws SQLException {
        return outlineNodes(connection, resolveOutlineVersionId(connection, outlineVersionId));
    }

    private List<Map<String, Object>> outlineNodes(Connection connection, long outlineVersionId) throws SQLException {
        List<Map<String, Object>> nodes = new ArrayList<>();
        String sql = "SELECT N.NODE_KEY, P.NODE_KEY, N.NODE_TYPE, N.NODE_KEY, N.NODE_TITLE, N.NODE_DESCRIPTION, N.LEVEL_NO, N.SORT_NO "
            + "FROM KC_MANUAL_OUTLINE_NODE N LEFT JOIN KC_MANUAL_OUTLINE_NODE P ON P.OUTLINE_NODE_ID=N.PARENT_NODE_ID "
            + "WHERE N.OUTLINE_VERSION_ID = ? ORDER BY N.SORT_NO, N.OUTLINE_NODE_ID";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, outlineVersionId);
            try (ResultSet result = statement.executeQuery()) {
                while (result.next()) {
                    Map<String, Object> node = new LinkedHashMap<>();
                    node.put("id", result.getString(1));
                    node.put("parentId", result.getString(2));
                    node.put("kind", result.getString(3).toLowerCase());
                    node.put("sourceId", result.getString(4));
                    node.put("title", result.getString(5));
                    node.put("description", readClobOrNull(result.getClob(6)));
                    node.put("level", result.getLong(7));
                    node.put("path", null);
                    node.put("order", result.getLong(8));
                    nodes.add(node);
                }
            }
        } catch (Exception error) {
            throw new SQLException("读取大纲节点失败", error);
        }
        return nodes;
    }

    private List<Map<String, Object>> leafDocuments(Map<String, Object> chapter) {
        List<Map<String, Object>> documents = new ArrayList<>();
        Object value = chapter.get("documents");
        if (!(value instanceof List<?>)) {
            value = chapter.get("kps");
        }
        if (!(value instanceof List<?>)) {
            value = chapter.get("knowledgePoints");
        }
        if (value instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    documents.add(castMap(map));
                }
            }
        }
        return documents;
    }

    private void deleteOutlineChildren(Connection connection, long outlineId) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement(
            "DELETE FROM KC_MANUAL_OUTLINE_RESP_ITEM WHERE RESP_VERSION_ID IN (SELECT RESP_VERSION_ID FROM KC_MANUAL_OUTLINE_RESP_VERSION WHERE OUTLINE_VERSION_ID=?)")) {
            delete.setLong(1, outlineId);
            delete.executeUpdate();
        }
        String[] tables = {
            "KC_MANUAL_OUTLINE_RESP_VERSION",
            "KC_MANUAL_OUTLINE_CHECK_RUN", "KC_MANUAL_OUTLINE_CHANGE",
            "KC_MANUAL_OUTLINE_VERSION_TAG", "KC_MANUAL_OUTLINE_NODE"
        };
        for (String table : tables) {
            try (PreparedStatement delete = connection.prepareStatement("DELETE FROM " + table + " WHERE OUTLINE_VERSION_ID = ?")) {
                delete.setLong(1, outlineId);
                delete.executeUpdate();
            }
        }
    }

    private void updateCurrentOutlinePointers(Connection connection, Set<Long> manualIds) throws SQLException {
        for (long manualId : manualIds) {
            updateCurrentOutlinePointer(connection, manualId);
        }
    }

    private void updateCurrentOutlinePointer(Connection connection, long manualId) throws SQLException {
        long subjectId = outlineSubjectId(connection, manualId);
        Long outlineId = null;
        try (PreparedStatement query = connection.prepareStatement("SELECT OUTLINE_VERSION_ID FROM KC_MANUAL_OUTLINE_VERSION WHERE OUTLINE_ID = ? AND STATE = 'PUBLISHED' ORDER BY UPDATED_AT DESC")) {
            query.setLong(1, subjectId);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) {
                    outlineId = result.getLong(1);
                }
            }
        }
        if (outlineId == null) {
            try (PreparedStatement query = connection.prepareStatement("SELECT OUTLINE_VERSION_ID FROM KC_MANUAL_OUTLINE_VERSION WHERE OUTLINE_ID = ? ORDER BY UPDATED_AT DESC")) {
                query.setLong(1, subjectId);
                try (ResultSet result = query.executeQuery()) {
                    if (result.next()) {
                        outlineId = result.getLong(1);
                    }
                }
            }
        }
        try (PreparedStatement update = connection.prepareStatement("UPDATE KC_MANUAL_OUTLINE SET CURRENT_OUTLINE_VERSION_ID = ?, UPDATED_BY='system:api', UPDATED_AT = CURRENT_TIMESTAMP WHERE MANUAL_ID = ?")) {
            if (outlineId == null) update.setNull(1, java.sql.Types.BIGINT); else update.setLong(1, outlineId);
            update.setLong(2, manualId);
            update.executeUpdate();
        }
    }

    private void validateOutlineSnapshot(Map<String, Object> outline) throws SQLException {
        if (countLeafDocuments(outline.get("content")) <= 0) {
            throw new SQLException("OUTLINE_DOCUMENT_REQUIRED");
        }
    }

    private int countLeafDocuments(Object content) {
        Map<String, Object> outline = asMapOrEmpty(content);
        int count = 0;
        for (Map<String, Object> part : listOfMaps(outline.get("parts"))) {
            for (Map<String, Object> chapter : listOfMaps(part.get("chapters"))) {
                count += leafDocuments(chapter).size();
            }
        }
        return count;
    }

    private long countNodesByKind(List<Map<String, Object>> nodes, String kind) {
        long count = 0L;
        for (Map<String, Object> node : nodes) {
            if (kind.equals(node.get("kind"))) {
                count++;
            }
        }
        return count;
    }

    private String handbookId(Map<String, Object> handbook) throws SQLException {
        String value = coalesce(handbook.get("handbookId"), handbook.get("id"), handbook.get("code"));
        if (value == null) {
            throw new SQLException("手册缺少 handbookId");
        }
        return value;
    }

    private String outlineId(Map<String, Object> outline) throws SQLException {
        String value = coalesce(outline.get("id"), outline.get("outlineStructureVersion"));
        if (value == null) {
            throw new SQLException("大纲缺少 id");
        }
        return value;
    }

    private String handbookIdFromOutline(Map<String, Object> outline, String outlineId) {
        return coalesce(outline.get("handbookId"), outline.get("manualId"), outline.get("manual_id"), outlineId);
    }

    private String outlineIdFromHandbook(Map<String, Object> handbook) {
        Map<String, Object> outline = asMapOrEmpty(handbook.get("outline"));
        return coalesce(handbook.get("currentOutlineVersionId"), outline.get("outlineVersion"), outline.get("outlineId"));
    }

    private Map<String, Object> ownerObject(String id, String name, Object fallback) {
        Map<String, Object> result = asMapOrEmpty(fallback);
        result.put("userId", id);
        result.put("displayName", name);
        result.put("bindingStatus", id != null || name != null ? "bound" : "unassigned");
        return result;
    }

    private Map<String, Object> outlineSummary(String currentOutlineVersionId, Object fallback) {
        Map<String, Object> result = asMapOrEmpty(fallback);
        result.put("outlineId", currentOutlineVersionId);
        result.put("outlineVersion", currentOutlineVersionId);
        result.put("bindingStatus", currentOutlineVersionId == null ? result.getOrDefault("bindingStatus", "not_created") : "published");
        return result;
    }

    private Map<String, Object> asMapOrEmpty(Object value) {
        if (value instanceof Map<?, ?> map) {
            return castMap(map);
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                Object parsed = Json.parse(text);
                if (parsed instanceof Map<?, ?> map) {
                    return castMap(map);
                }
            } catch (JsonParseException ignored) {
                // 兼容字段损坏时保留空投影，主表字段仍可正常读取。
            }
        }
        return new LinkedHashMap<>();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Object value) {
        return (Map<String, Object>) value;
    }

    private static List<Map<String, Object>> listOfMaps(Object value) {
        List<Map<String, Object>> result = new ArrayList<>();
        if (!(value instanceof List<?> list)) {
            return result;
        }
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                result.add(castMap(map));
            }
        }
        return result;
    }

    private static List<Object> listValues(Object value) {
        if (value instanceof List<?> list) {
            return new ArrayList<>(list);
        }
        if (value == null) {
            return List.of();
        }
        return List.of(value);
    }

    private static Map<String, Object> mapOf(Object... values) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i + 1 < values.length; i += 2) {
            map.put(String.valueOf(values[i]), values[i + 1]);
        }
        return map;
    }

    private static Map<String, Object> readJsonObject(HttpExchange exchange) throws IOException, JsonParseException {
        byte[] bytes;
        try {
            bytes = readBody(exchange, DEFAULT_MAX_BODY_BYTES);
        } catch (BodyTooLarge error) {
            throw new IOException("请求体超过限制", error);
        }
        String text = new String(bytes, StandardCharsets.UTF_8).trim();
        if (text.isEmpty()) {
            return new LinkedHashMap<>();
        }
        Object parsed = Json.parse(text);
        if (!(parsed instanceof Map<?, ?> map)) {
            throw new JsonParseException("请求体必须是 JSON 对象");
        }
        return castMap(map);
    }

    private static byte[] readBody(HttpExchange exchange, int limit) throws IOException, BodyTooLarge {
        try (InputStream input = exchange.getRequestBody(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int total = 0;
            int count;
            while ((count = input.read(buffer)) != -1) {
                total += count;
                if (total > limit) {
                    throw new BodyTooLarge();
                }
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    private static String readClob(Clob clob) throws Exception {
        try (Reader reader = clob.getCharacterStream(); StringWriter writer = new StringWriter()) {
            reader.transferTo(writer);
            return writer.toString();
        }
    }

    private static String readClobOrNull(Clob clob) throws Exception {
        if (clob == null) {
            return null;
        }
        return readClob(clob);
    }

    private static String recordJson(String namespace, String key, String payload, String digest, long revision, boolean deleted, Timestamp created, Timestamp updated) {
        return "{\"namespace\":\"" + escape(namespace) + "\",\"key\":\"" + escape(key) + "\",\"revision\":" + revision
            + ",\"deleted\":" + deleted + ",\"sha256\":\"" + escape(trimToEmpty(digest)) + "\",\"createdAt\":\"" + timestampToString(created)
            + "\",\"updatedAt\":\"" + timestampToString(updated) + "\",\"payload\":" + payload + "}";
    }

    private static Long expectedRevision(HttpExchange exchange, boolean required) throws IOException {
        String value = exchange.getRequestHeaders().getFirst("If-Match");
        if (value == null || value.isBlank()) {
            if (required) {
                failure(exchange, 428, "REVISION_REQUIRED", "必须提供 If-Match revision");
                return Long.MIN_VALUE;
            }
            return null;
        }
        value = value.replace("\"", "").trim();
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException error) {
            failure(exchange, 400, "INVALID_REVISION", "If-Match 必须是整数 revision");
            return Long.MIN_VALUE;
        }
    }

    private static boolean looksLikeJson(String payload) {
        if (payload.isEmpty()) {
            return false;
        }
        char first = payload.charAt(0);
        char last = payload.charAt(payload.length() - 1);
        return (first == '{' && last == '}')
            || (first == '[' && last == ']')
            || "null".equals(payload)
            || "true".equals(payload)
            || "false".equals(payload)
            || first == '"'
            || first == '-'
            || Character.isDigit(first);
    }

    private static String timestampToString(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant().toString();
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static Map<String, String> queryParameters(String rawQuery) {
        Map<String, String> values = new LinkedHashMap<>();
        if (rawQuery == null || rawQuery.isBlank()) return values;
        for (String pair : rawQuery.split("&")) {
            if (pair.isBlank()) continue;
            int separator = pair.indexOf('=');
            String key = decode(separator < 0 ? pair : pair.substring(0, separator));
            String value = decode(separator < 0 ? "" : pair.substring(separator + 1));
            values.put(key, value);
        }
        return values;
    }

    private static String personnelErrorMessage(String code) {
        return switch (code) {
            case "PERSONNEL_NAME_REQUIRED" -> "姓名为必填项";
            case "CAS_LOGIN_NAME_REQUIRED" -> "CAS 登录名为必填项";
            case "CAS_LOGIN_NAME_CONFLICT", "CAS_LOGIN_BIND_CONFLICT" -> "CAS 登录名已绑定其他人员";
            case "CAS_LOGIN_NAME_IMMUTABLE" -> "已绑定的 CAS 登录名不允许换绑";
            case "PERSONNEL_STATE_INVALID" -> "人员状态只允许 ACTIVE 或 INACTIVE";
            case "PERSONNEL_BINDING_STATUS_INVALID" -> "CAS 绑定状态只允许 BOUND 或 PENDING";
            case "PERSONNEL_NOT_FOUND" -> "人员不存在";
            case "PERSONNEL_VERSION_REQUIRED" -> "人员更新必须携带版本号";
            case "PERSONNEL_VERSION_CONFLICT" -> "人员信息已被其他操作修改，请刷新后重试";
            case "PERSONNEL_SOURCE_SHA_REQUIRED" -> "人员导入必须携带源文件 SHA-256";
            case "PERSONNEL_IMPORT_EMPTY" -> "人员导入文件没有有效数据";
            case "PERSONNEL_IMPORT_TOO_LARGE" -> "单次最多导入 1000 人";
            case "PERSONNEL_IMPORT_INCOMPLETE" -> "同一导入批次存在未完成记录，请先检查批次";
            case "MANUAL_OWNER_INVALID" -> "责任人不存在或已停用";
            default -> "人员目录读写失败";
        };
    }

    private static String escape(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\r", "\\r").replace("\n", "\\n");
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }

    private static String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private static String coalesce(Object... values) {
        if (values == null) {
            return null;
        }
        for (Object value : values) {
            if (value == null) {
                continue;
            }
            String text = String.valueOf(value).trim();
            if (!text.isEmpty() && !"null".equals(text)) {
                return text;
            }
        }
        return null;
    }

    private static Long optionalNumericId(Object... values) throws SQLException {
        String value = coalesce(values);
        if (value == null) return null;
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException error) {
            throw new SQLException("ID 必须是数字：" + value);
        }
    }

    private static long productId(Object productId) throws SQLException {
        Long numeric = optionalNumericId(productId);
        if (numeric != null) return numeric;
        throw new SQLException("产品 ID 必须是数字");
    }

    private static String stableNodeId(String outlineId, String kind, String path, String title) {
        String source = String.valueOf(outlineId) + "|" + kind + "|" + String.valueOf(path) + "|" + String.valueOf(title);
        return kind + "_" + sha256(source).substring(0, 16);
    }

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value;
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("缺少环境变量：" + name);
        }
        return value;
    }

    private static int integer(String name, int fallback) {
        return Integer.parseInt(env(name, String.valueOf(fallback)));
    }

    private static void sendJson(HttpExchange exchange, int status, Object body) throws IOException {
        send(exchange, status, Json.stringify(body));
    }

    private static void send(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }

    private static void failure(HttpExchange exchange, int status, String code, String message) throws IOException {
        send(exchange, status, "{\"success\":false,\"error\":{\"code\":\"" + escape(code) + "\",\"message\":\"" + escape(message) + "\"}}");
    }
    private static void methodNotAllowed(HttpExchange exchange) throws IOException { failure(exchange, 405, "METHOD_NOT_ALLOWED", "请求方法不支持"); }
    /** Small JDK-only pool: keeps JDBC connections alive without adding a dependency. */
    private static final class JdbcConnectionPool {
        private final String url, user, password;
        private final int max, min;
        private final long borrowTimeoutMs;
        private final BlockingQueue<Connection> idle;
        private int created;
        JdbcConnectionPool(String url, String user, String password, int max, int min) {
            this.url = url; this.user = user; this.password = password;
            this.max = Math.max(1, max); this.min = Math.max(0, Math.min(min, this.max));
            this.borrowTimeoutMs = Math.max(100, Long.parseLong(env("YASDB_STORAGE_POOL_BORROW_TIMEOUT_MS", "5000")));
            this.idle = new ArrayBlockingQueue<>(this.max);
        }
        synchronized void start() throws SQLException {
            while (created < min) idle.offer(newConnection());
        }
        private Connection newConnection() throws SQLException {
            Connection raw = DriverManager.getConnection(url, user, password);
            raw.setAutoCommit(false); created++;
            return raw;
        }
        Connection borrow() throws SQLException {
            Connection raw = idle.poll();
            if (raw == null) synchronized (this) { raw = created < max ? newConnection() : null; }
            if (raw == null) {
                try { raw = idle.poll(borrowTimeoutMs, TimeUnit.MILLISECONDS); } catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new SQLException("等待数据库连接被中断", error); }
                if (raw == null) throw new SQLException("数据库连接池耗尽，请稍后重试");
            }
            final Connection leased = raw;
            final AtomicBoolean returned = new AtomicBoolean(false);
            return (Connection) Proxy.newProxyInstance(Connection.class.getClassLoader(), new Class[]{Connection.class}, (proxy, method, args) -> {
                if ("close".equals(method.getName())) {
                    if (!returned.compareAndSet(false, true)) return null;
                    leased.rollback();
                    if (!idle.offer(leased)) {
                        try { leased.close(); } finally { synchronized (JdbcConnectionPool.this) { created--; } }
                    }
                    return null;
                }
                if ("isClosed".equals(method.getName())) return leased.isClosed();
                try { return method.invoke(leased, args); } catch (java.lang.reflect.InvocationTargetException error) { throw error.getCause(); }
            });
        }
        synchronized void closeAll() { idle.forEach(connection -> { try { connection.close(); } catch (Exception ignored) {} }); idle.clear(); created = 0; }
    }
    private static final class RevisionConflict extends Exception {}
    private static final class BodyTooLarge extends Exception {}
    private static final class GovernanceValidationException extends SQLException {
        private final String code;
        private final int status;
        private final Map<String, Object> details;

        GovernanceValidationException(String code, String message, int status, Map<String, Object> details) {
            super(message);
            this.code = code;
            this.status = status;
            this.details = details;
        }
    }
    private static final class JsonParseException extends Exception {
        JsonParseException(String message) { super(message); }
    }

    private static final class Json {
        static Object parse(String text) throws JsonParseException {
            return new Parser(text).parse();
        }

        static String stringify(Object value) {
            StringBuilder builder = new StringBuilder();
            write(builder, value);
            return builder.toString();
        }

        private static void write(StringBuilder builder, Object value) {
            if (value == null) {
                builder.append("null");
                return;
            }
            if (value instanceof String text) {
                builder.append('"').append(escapeJson(text)).append('"');
                return;
            }
            if (value instanceof Number || value instanceof Boolean) {
                builder.append(value);
                return;
            }
            if (value instanceof Map<?, ?> map) {
                builder.append('{');
                boolean first = true;
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    if (!first) {
                        builder.append(',');
                    }
                    first = false;
                    builder.append('"').append(escapeJson(String.valueOf(entry.getKey()))).append('"').append(':');
                    write(builder, entry.getValue());
                }
                builder.append('}');
                return;
            }
            if (value instanceof Iterable<?> iterable) {
                builder.append('[');
                boolean first = true;
                for (Object item : iterable) {
                    if (!first) {
                        builder.append(',');
                    }
                    first = false;
                    write(builder, item);
                }
                builder.append(']');
                return;
            }
            builder.append('"').append(escapeJson(String.valueOf(value))).append('"');
        }

        private static String escapeJson(String text) {
            StringBuilder builder = new StringBuilder();
            for (char ch : text.toCharArray()) {
                switch (ch) {
                    case '"' -> builder.append("\\\"");
                    case '\\' -> builder.append("\\\\");
                    case '\b' -> builder.append("\\b");
                    case '\f' -> builder.append("\\f");
                    case '\n' -> builder.append("\\n");
                    case '\r' -> builder.append("\\r");
                    case '\t' -> builder.append("\\t");
                    default -> {
                        if (ch < 0x20) {
                            builder.append(String.format("\\u%04x", (int) ch));
                        } else {
                            builder.append(ch);
                        }
                    }
                }
            }
            return builder.toString();
        }

        private static final class Parser {
            private final String text;
            private int index;

            Parser(String text) {
                this.text = text == null ? "" : text;
            }

            Object parse() throws JsonParseException {
                skipWhitespace();
                Object value = parseValue();
                skipWhitespace();
                if (index != text.length()) {
                    throw new JsonParseException("JSON 末尾存在多余内容");
                }
                return value;
            }

            private Object parseValue() throws JsonParseException {
                skipWhitespace();
                if (index >= text.length()) {
                    throw new JsonParseException("JSON 不能为空");
                }
                char ch = text.charAt(index);
                if (ch == '{') return parseObject();
                if (ch == '[') return parseArray();
                if (ch == '"') return parseString();
                if (ch == 't') return parseLiteral("true", Boolean.TRUE);
                if (ch == 'f') return parseLiteral("false", Boolean.FALSE);
                if (ch == 'n') return parseLiteral("null", null);
                if (ch == '-' || Character.isDigit(ch)) return parseNumber();
                throw new JsonParseException("非法 JSON 值");
            }

            private Map<String, Object> parseObject() throws JsonParseException {
                expect('{');
                Map<String, Object> map = new LinkedHashMap<>();
                skipWhitespace();
                if (peek('}')) {
                    index++;
                    return map;
                }
                while (true) {
                    skipWhitespace();
                    String key = parseString();
                    skipWhitespace();
                    expect(':');
                    Object value = parseValue();
                    map.put(key, value);
                    skipWhitespace();
                    if (peek('}')) {
                        index++;
                        return map;
                    }
                    expect(',');
                }
            }

            private List<Object> parseArray() throws JsonParseException {
                expect('[');
                List<Object> list = new ArrayList<>();
                skipWhitespace();
                if (peek(']')) {
                    index++;
                    return list;
                }
                while (true) {
                    list.add(parseValue());
                    skipWhitespace();
                    if (peek(']')) {
                        index++;
                        return list;
                    }
                    expect(',');
                }
            }

            private String parseString() throws JsonParseException {
                expect('"');
                StringBuilder builder = new StringBuilder();
                while (index < text.length()) {
                    char ch = text.charAt(index++);
                    if (ch == '"') {
                        return builder.toString();
                    }
                    if (ch == '\\') {
                        if (index >= text.length()) {
                            throw new JsonParseException("字符串转义未结束");
                        }
                        char escaped = text.charAt(index++);
                        switch (escaped) {
                            case '"', '\\', '/' -> builder.append(escaped);
                            case 'b' -> builder.append('\b');
                            case 'f' -> builder.append('\f');
                            case 'n' -> builder.append('\n');
                            case 'r' -> builder.append('\r');
                            case 't' -> builder.append('\t');
                            case 'u' -> {
                                if (index + 4 > text.length()) {
                                    throw new JsonParseException("Unicode 转义长度不足");
                                }
                                String hex = text.substring(index, index + 4);
                                builder.append((char) Integer.parseInt(hex, 16));
                                index += 4;
                            }
                            default -> throw new JsonParseException("不支持的转义字符");
                        }
                        continue;
                    }
                    builder.append(ch);
                }
                throw new JsonParseException("字符串未结束");
            }

            private Object parseNumber() throws JsonParseException {
                int start = index;
                if (peek('-')) index++;
                while (index < text.length() && Character.isDigit(text.charAt(index))) index++;
                boolean fractional = false;
                if (peek('.')) {
                    fractional = true;
                    index++;
                    while (index < text.length() && Character.isDigit(text.charAt(index))) index++;
                }
                if (peek('e') || peek('E')) {
                    fractional = true;
                    index++;
                    if (peek('+') || peek('-')) index++;
                    while (index < text.length() && Character.isDigit(text.charAt(index))) index++;
                }
                String number = text.substring(start, index);
                try {
                    if (fractional) {
                        return Double.parseDouble(number);
                    }
                    long value = Long.parseLong(number);
                    if (value >= Integer.MIN_VALUE && value <= Integer.MAX_VALUE) {
                        return (int) value;
                    }
                    return value;
                } catch (NumberFormatException error) {
                    throw new JsonParseException("非法数字");
                }
            }

            private Object parseLiteral(String literal, Object value) throws JsonParseException {
                if (!text.startsWith(literal, index)) {
                    throw new JsonParseException("非法 JSON 字面量");
                }
                index += literal.length();
                return value;
            }

            private void skipWhitespace() {
                while (index < text.length() && Character.isWhitespace(text.charAt(index))) {
                    index++;
                }
            }

            private void expect(char expected) throws JsonParseException {
                if (index >= text.length() || text.charAt(index) != expected) {
                    throw new JsonParseException("期望字符 " + expected);
                }
                index++;
            }

            private boolean peek(char expected) {
                return index < text.length() && text.charAt(index) == expected;
            }
        }
    }
}

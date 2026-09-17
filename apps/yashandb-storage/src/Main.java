import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

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
    private final Path techDomainSeedFile = Path.of(env("YASDB_TECH_DOMAINS_SEED_FILE", sqlDirectory.resolve("tech-domains.seed.json").toString())).toAbsolutePath().normalize();
    private final JdbcConnectionPool connectionPool;
    private static boolean perfEnabled() { return "1".equals(System.getenv("PERF_TRACE")); }
    private static void perf(String event, long started, long sqlStarted, long lockStarted) {
        if (!perfEnabled()) return;
        long now = System.nanoTime();
        System.err.printf("[perf] %s connection_acquire_ms=%.3f sql_execute_ms=%.3f for_update_wait_ms=%.3f commit_ms=%.3f request_total_ms=%.3f%n",
            event, 0d, sqlStarted > 0 ? (now - sqlStarted) / 1e6 : 0d,
            lockStarted > 0 ? (now - lockStarted) / 1e6 : 0d, 0d, (now - started) / 1e6);
    }

    public static void main(String[] args) throws Exception {
        Class.forName(DRIVER);
        Main application = new Main();
        application.migrate();
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
            createTableIfMissing(connection, "KC_SCHEMA_MIGRATION", sql("001_schema_migration.sql"));
            createTableIfMissing(connection, "KC_RECORD", sql("002_record.sql"));
            createTableIfMissing(connection, "KC_MIGRATION_BATCH", sql("003_migration_batch.sql"));
            StorageSchemaDao.createIndexIfMissing(connection, "IDX_KC_RECORD_NAMESPACE", sql("004_record_indexes.sql"));
            createTableIfMissing(connection, "MANUALS", sql("005_manuals.sql"));
            createTableIfMissing(connection, "DEPARTMENTS", sql("006_departments.sql"));
            createTableIfMissing(connection, "TECH_DOMAINS", sql("007_tech_domains.sql"));
            createTableIfMissing(connection, "PERSONNEL_DOMAINS", sql("008_personnel_domains.sql"));
            createTableIfMissing(connection, "MANUAL_OUTLINE_VERSIONS", sql("009_manual_outline_versions.sql"));
            createTableIfMissing(connection, "MANUAL_OUTLINE_NODES", sql("010_manual_outline_nodes.sql"));
            createTableIfMissing(connection, "MANUAL_DOCUMENTS", sql("011_manual_documents.sql"));
            createTableIfMissing(connection, "MANUAL_DOCUMENT_SECTIONS", sql("012_manual_document_sections.sql"));
            createTableIfMissing(connection, "TECH_DOMAIN_PERSONNEL", sql("013_tech_domain_personnel.sql"));
            createTableIfMissing(connection, "MANUAL_OUTLINE_NODE_DOMAINS", sql("014_manual_outline_node_domains.sql"));
            createTableIfMissing(connection, "MANUAL_BUILD_TASKS", sql("015_manual_build_tasks.sql"));
            createTableIfMissing(connection, "MANUAL_BUILD_TASK_ITEMS", sql("016_manual_build_task_items.sql"));
            seedTechDomains(connection);
            backfillBuildTaskAssignees(connection);
            recordMigration(connection, "001_record_store", sha256("KC_SCHEMA_MIGRATION|KC_RECORD|KC_MIGRATION_BATCH"));
            recordMigration(connection, "002_record_indexes", sha256("IDX_KC_RECORD_NAMESPACE|NAMESPACE,DELETED,UPDATED_AT"));
            recordMigration(connection, "003_manual_outline_domain", sha256(
                "MANUALS|DEPARTMENTS|TECH_DOMAINS|PERSONNEL_DOMAINS|MANUAL_OUTLINE_VERSIONS|MANUAL_OUTLINE_NODES|MANUAL_DOCUMENTS|MANUAL_DOCUMENT_SECTIONS"
            ));
            recordMigration(connection, "004_outline_governance_tasks", sha256(
                "TECH_DOMAIN_PERSONNEL|MANUAL_OUTLINE_NODE_DOMAINS|MANUAL_BUILD_TASKS|MANUAL_BUILD_TASK_ITEMS"
            ));
            recordMigration(connection, "005_build_task_leader_assignment", sha256(
                "MANUAL_BUILD_TASK_ITEMS.ASSIGNEE_ID|MANUAL_BUILD_TASK_ITEMS.ASSIGNEE_NAME|MANUAL_BUILD_TASK_ITEMS.STATUS|MANUAL_BUILD_TASK_ITEMS.ASSIGNED_AT"
            ));
            connection.commit();
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
                try (PreparedStatement query = connection.prepareStatement("SELECT ID FROM TECH_DOMAINS WHERE ID = ?")) {
                    query.setString(1, domainId);
                    try (ResultSet result = query.executeQuery()) {
                        if (!result.next()) {
                            try (PreparedStatement insert = connection.prepareStatement("INSERT INTO TECH_DOMAINS(ID, CODE, NAME) VALUES (?, ?, ?)")) {
                                insert.setString(1, domainId);
                                insert.setString(2, code);
                                insert.setString(3, name);
                                insert.executeUpdate();
                            }
                        }
                    }
                }
                Map<String, Object> leader = domain.get("leader") instanceof Map<?, ?> map ? castMap(map) : null;
                if (leader != null) {
                    seedTechDomainPerson(connection, domainId, leader, "leader");
                }
                for (Map<String, Object> member : listOfMaps(domain.get("members"))) {
                    seedTechDomainPerson(connection, domainId, member, "member");
                }
            }
        } catch (JsonParseException | IOException error) {
            throw new SQLException("技术领域种子配置读取失败：" + techDomainSeedFile, error);
        }
    }

    private void seedTechDomainPerson(Connection connection, String domainId, Map<String, Object> person, String role) throws SQLException {
        String personId = coalesce(person.get("id"), person.get("personId"));
        String personName = coalesce(person.get("name"), person.get("personName"), personId);
        if (personId == null) {
            return;
        }
        String id = "domain-person_" + sha256(domainId + "|" + personId).substring(0, 16);
        try (PreparedStatement query = connection.prepareStatement("SELECT ID FROM TECH_DOMAIN_PERSONNEL WHERE DOMAIN_ID = ? AND PERSON_ID = ?")) {
            query.setString(1, domainId);
            query.setString(2, personId);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) {
                    try (PreparedStatement update = connection.prepareStatement("UPDATE TECH_DOMAIN_PERSONNEL SET PERSON_NAME=?, ROLE_CODE=?, STATUS='active', UPDATED_AT=CURRENT_TIMESTAMP WHERE DOMAIN_ID=? AND PERSON_ID=?")) {
                        update.setString(1, personName);
                        update.setString(2, role);
                        update.setString(3, domainId);
                        update.setString(4, personId);
                        update.executeUpdate();
                    }
                    return;
                }
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO TECH_DOMAIN_PERSONNEL(ID, DOMAIN_ID, PERSON_ID, PERSON_NAME, ROLE_CODE, STATUS) VALUES (?, ?, ?, ?, ?, 'active')")) {
            insert.setString(1, id);
            insert.setString(2, domainId);
            insert.setString(3, personId);
            insert.setString(4, personName);
            insert.setString(5, role);
            insert.executeUpdate();
        }
    }

    private void backfillBuildTaskAssignees(Connection connection) throws SQLException {
        List<Map<String, Object>> pending = new ArrayList<>();
        String sql = "SELECT I.ID, T.DOMAIN_LEADER_ID, T.DOMAIN_LEADER_NAME FROM MANUAL_BUILD_TASK_ITEMS I JOIN MANUAL_BUILD_TASKS T ON T.ID = I.TASK_ID WHERE I.ASSIGNEE_ID IS NULL AND T.DOMAIN_LEADER_ID IS NOT NULL";
        try (PreparedStatement query = connection.prepareStatement(sql); ResultSet result = query.executeQuery()) {
            while (result.next()) {
                pending.add(mapOf(
                    "itemId", result.getString(1),
                    "leaderId", result.getString(2),
                    "leaderName", result.getString(3)
                ));
            }
        }
        for (Map<String, Object> item : pending) {
            try (PreparedStatement update = connection.prepareStatement(
                "UPDATE MANUAL_BUILD_TASK_ITEMS SET ASSIGNEE_ID=?, ASSIGNEE_NAME=?, STATUS='assigned', ASSIGNED_AT=?, UPDATED_AT=CURRENT_TIMESTAMP WHERE ID=? AND ASSIGNEE_ID IS NULL")) {
                update.setString(1, String.valueOf(item.get("leaderId")));
                update.setString(2, item.get("leaderName") == null ? null : String.valueOf(item.get("leaderName")));
                update.setString(3, Instant.now().toString());
                update.setString(4, String.valueOf(item.get("itemId")));
                update.executeUpdate();
            }
        }
    }

    private String sql(String filename) throws SQLException {
        Path file = sqlDirectory.resolve(filename).normalize();
        if (!file.startsWith(sqlDirectory) || !Files.isRegularFile(file)) {
            throw new SQLException("找不到数据库迁移 SQL：" + file);
        }
        try {
            return Files.readString(file, StandardCharsets.UTF_8);
        } catch (IOException error) {
            throw new SQLException("读取数据库迁移 SQL 失败：" + file, error);
        }
    }

    private void createTableIfMissing(Connection connection, String table, String ddl) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT COUNT(*) FROM USER_TABLES WHERE TABLE_NAME = ?")) {
            query.setString(1, table);
            try (ResultSet result = query.executeQuery()) {
                result.next();
                if (result.getLong(1) > 0) {
                    return;
                }
            }
        }
        try (Statement statement = connection.createStatement()) {
            String executable = ddl.trim();
            if (executable.endsWith(";")) {
                executable = executable.substring(0, executable.length() - 1).trim();
            }
            statement.execute(executable);
        }
    }

    private void recordMigration(Connection connection, String version, String checksum) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT CHECKSUM FROM KC_SCHEMA_MIGRATION WHERE VERSION_ID = ?")) {
            query.setString(1, version);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) {
                    if (!checksum.equals(result.getString(1).trim())) {
                        throw new SQLException("数据库迁移摘要不一致：" + version);
                    }
                    return;
                }
            }
        }
        try (PreparedStatement insert = connection.prepareStatement("INSERT INTO KC_SCHEMA_MIGRATION(VERSION_ID, CHECKSUM) VALUES (?, ?)")) {
            insert.setString(1, version);
            insert.setString(2, checksum);
            insert.executeUpdate();
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
                try (Connection connection = connection()) {
                    sendJson(exchange, 200, projectHandbooks(connection));
                    connection.commit();
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
        return projectHandbooks(connection);
    }

    private Map<String, Object> projectTechDomains(Connection connection) throws SQLException {
        List<Map<String, Object>> domains = new ArrayList<>();
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        String domainSql = "SELECT ID, CODE, NAME FROM TECH_DOMAINS ORDER BY NAME, ID";
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
        String personnelSql = "SELECT DOMAIN_ID, PERSON_ID, PERSON_NAME, ROLE_CODE, STATUS FROM TECH_DOMAIN_PERSONNEL WHERE STATUS = 'active' ORDER BY PERSON_NAME, PERSON_ID";
        try (PreparedStatement statement = connection.prepareStatement(personnelSql); ResultSet result = statement.executeQuery()) {
            while (result.next()) {
                Map<String, Object> domain = byId.get(result.getString(1));
                if (domain == null) {
                    continue;
                }
                Map<String, Object> person = mapOf(
                    "id", result.getString(2),
                    "name", result.getString(3),
                    "role", result.getString(4)
                );
                if ("leader".equals(result.getString(4))) {
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
        String sql = "SELECT ID, MANUAL_ID, STATE, EDIT_VERSION FROM MANUAL_OUTLINE_VERSIONS WHERE ID = ?";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, outlineId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) {
                    throw new SQLException("OUTLINE_NOT_FOUND");
                }
                return mapOf(
                    "id", result.getString(1),
                    "manualId", result.getString(2),
                    "state", result.getString(3),
                    "editVersion", result.getLong(4)
                );
            }
        }
    }

    private Map<String, List<String>> explicitNodeDomains(Connection connection, String outlineId) throws SQLException {
        Map<String, List<String>> assignments = new LinkedHashMap<>();
        String sql = "SELECT NODE_ID, TECH_DOMAIN_ID FROM MANUAL_OUTLINE_NODE_DOMAINS WHERE OUTLINE_VERSION_ID = ? ORDER BY NODE_ID, TECH_DOMAIN_ID";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, outlineId);
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
        List<Map<String, Object>> tasks = projectBuildTasksForOutline(connection, outlineId);
        Map<String, Map<String, Object>> taskItemsByKey = new LinkedHashMap<>();
        for (Map<String, Object> task : tasks) {
            for (Map<String, Object> item : listOfMaps(task.get("items"))) {
                String key = coalesce(item.get("documentId")) + "|" + coalesce(item.get("techDomainId"));
                taskItemsByKey.put(key, item);
            }
        }
        List<Map<String, Object>> ownedEffective = new ArrayList<>();
        for (Map<String, Object> item : effective) {
            Map<String, Object> owned = new LinkedHashMap<>(item);
            List<Map<String, Object>> ownerships = new ArrayList<>();
            for (Object domainValue : listValues(item.get("techDomainIds"))) {
                String domainId = String.valueOf(domainValue);
                Map<String, Object> taskItem = taskItemsByKey.get(coalesce(item.get("documentId")) + "|" + domainId);
                Map<String, Object> ownership = new LinkedHashMap<>();
                ownership.put("techDomainId", domainId);
                ownership.put("techDomainName", techDomainName(connection, domainId));
                ownership.put("taskId", taskItem == null ? null : taskItem.get("taskId"));
                ownership.put("assigneeId", taskItem == null ? null : taskItem.get("assigneeId"));
                ownership.put("assigneeName", taskItem == null ? null : taskItem.get("assigneeName"));
                ownership.put("status", taskItem == null ? "not_published" : taskItem.get("status"));
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
        body.put("tasks", tasks);
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
        boolean published = "published".equals(header.get("state"));
        if ("superseded".equals(header.get("state"))) {
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
                try (PreparedStatement update = connection.prepareStatement("UPDATE MANUAL_OUTLINE_NODES SET DESCRIPTION = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ? AND OUTLINE_VERSION_ID = ?")) {
                    update.setCharacterStream(1, new StringReader(description));
                    update.setString(2, nodeId);
                    update.setString(3, outlineId);
                    update.executeUpdate();
                }
                try (PreparedStatement update = connection.prepareStatement("UPDATE MANUAL_DOCUMENTS SET SUMMARY = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE OUTLINE_VERSION_ID = ? AND OUTLINE_NODE_ID = ?")) {
                    update.setCharacterStream(1, new StringReader(description));
                    update.setString(2, outlineId);
                    update.setString(3, nodeId);
                    update.executeUpdate();
                }
            }
        }
        if (payload.containsKey("assignments")) {
            try (PreparedStatement delete = connection.prepareStatement("DELETE FROM MANUAL_OUTLINE_NODE_DOMAINS WHERE OUTLINE_VERSION_ID = ?")) {
                delete.setString(1, outlineId);
                delete.executeUpdate();
            }
            for (Map<String, Object> assignment : assignments) {
                String nodeId = coalesce(assignment.get("nodeId"));
                for (Object domainValue : listValues(assignment.get("techDomainIds"))) {
                    String domainId = String.valueOf(domainValue);
                    String id = "node-domain_" + sha256(outlineId + "|" + nodeId + "|" + domainId).substring(0, 16);
                    try (PreparedStatement insert = connection.prepareStatement(
                        "INSERT INTO MANUAL_OUTLINE_NODE_DOMAINS(ID, MANUAL_ID, OUTLINE_VERSION_ID, NODE_ID, TECH_DOMAIN_ID, ASSIGNMENT_SOURCE, ASSIGNED_BY) VALUES (?, ?, ?, ?, ?, 'explicit', ?)")) {
                        insert.setString(1, id);
                        insert.setString(2, String.valueOf(header.get("manualId")));
                        insert.setString(3, outlineId);
                        insert.setString(4, nodeId);
                        insert.setString(5, domainId);
                        insert.setString(6, coalesce(payload.get("assignedBy")));
                        insert.executeUpdate();
                    }
                }
            }
            if (published) {
                synchronizeBuildTasks(connection, String.valueOf(header.get("manualId")), outlineId, effectiveAssignments(nodes, assignments), Instant.now().toString());
            }
        }
        try (PreparedStatement update = connection.prepareStatement("UPDATE MANUAL_OUTLINE_VERSIONS SET EDIT_VERSION = EDIT_VERSION + 1, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?")) {
            update.setString(1, outlineId);
            update.executeUpdate();
        }
        return projectOutlineGovernance(connection, outlineId);
    }

    private Map<String, Object> publishOutline(Connection connection, String outlineId, Map<String, Object> payload) throws SQLException {
        Map<String, Object> header = outlineHeader(connection, outlineId);
        if ("published".equals(header.get("state"))) {
            return projectOutlineGovernance(connection, outlineId);
        }
        if ("superseded".equals(header.get("state"))) {
            throw new SQLException("OUTLINE_IMMUTABLE");
        }
        if (payload.containsKey("editVersion") && Long.parseLong(String.valueOf(payload.get("editVersion"))) != ((Number) header.get("editVersion")).longValue()) {
            throw new SQLException("OUTLINE_VERSION_CONFLICT");
        }
        Map<String, Object> governance = projectOutlineGovernance(connection, outlineId);
        List<Map<String, Object>> effective = listOfMaps(governance.get("effectiveDocumentAssignments"));
        List<Map<String, Object>> missing = new ArrayList<>();
        Set<String> domainIds = new java.util.LinkedHashSet<>();
        for (Map<String, Object> item : effective) {
            List<Object> values = listValues(item.get("techDomainIds"));
            if (values.isEmpty()) {
                missing.add(mapOf("nodeId", item.get("nodeId"), "documentId", item.get("documentId"), "title", item.get("title")));
            } else {
                for (Object value : values) domainIds.add(String.valueOf(value));
            }
        }
        if (!missing.isEmpty()) {
            throw new GovernanceValidationException("OUTLINE_RESPONSIBILITY_REQUIRED", "发布前必须完成所有 document 的技术领域分工", 422, mapOf("missingDocuments", missing));
        }
        try (PreparedStatement update = connection.prepareStatement("UPDATE MANUAL_OUTLINE_VERSIONS SET STATE = 'superseded', UPDATED_AT = CURRENT_TIMESTAMP WHERE MANUAL_ID = ? AND ID <> ? AND STATE = 'published'")) {
            update.setString(1, String.valueOf(header.get("manualId")));
            update.setString(2, outlineId);
            update.executeUpdate();
        }
        String publishedAt = Instant.now().toString();
        try (PreparedStatement update = connection.prepareStatement("UPDATE MANUAL_OUTLINE_VERSIONS SET STATE = 'published', PUBLISHED_AT = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?")) {
            update.setString(1, publishedAt);
            update.setString(2, outlineId);
            update.executeUpdate();
        }
        for (String domainId : domainIds) {
            Map<String, Object> domain = domainPersonnel(connection, domainId);
            String taskId = "build-task_" + sha256(outlineId + "|" + domainId).substring(0, 16);
            upsertBuildTask(connection, taskId, String.valueOf(header.get("manualId")), outlineId, domainId, domain, publishedAt);
            for (Map<String, Object> item : effective) {
                if (!listValues(item.get("techDomainIds")).contains(domainId)) continue;
                String documentId = String.valueOf(item.get("documentId"));
                String nodeId = String.valueOf(item.get("nodeId"));
                String itemId = "build-item_" + sha256(taskId + "|" + documentId + "|" + domainId).substring(0, 16);
                upsertBuildTaskItem(connection, itemId, taskId, String.valueOf(header.get("manualId")), documentId, nodeId, domainId);
            }
        }
        try (PreparedStatement update = connection.prepareStatement("UPDATE MANUALS SET CURRENT_OUTLINE_VERSION_ID = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?")) {
            update.setString(1, outlineId);
            update.setString(2, String.valueOf(header.get("manualId")));
            update.executeUpdate();
        }
        return projectOutlineGovernance(connection, outlineId);
    }

    private boolean techDomainExists(Connection connection, String domainId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("SELECT ID FROM TECH_DOMAINS WHERE ID = ?")) {
            statement.setString(1, domainId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    private Map<String, Object> domainPersonnel(Connection connection, String domainId) throws SQLException {
        Map<String, Object> result = mapOf("leader", null, "members", new ArrayList<>());
        String sql = "SELECT PERSON_ID, PERSON_NAME, ROLE_CODE FROM TECH_DOMAIN_PERSONNEL WHERE DOMAIN_ID = ? AND STATUS = 'active' ORDER BY PERSON_NAME, PERSON_ID";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, domainId);
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    Map<String, Object> person = mapOf("id", rows.getString(1), "name", rows.getString(2), "role", rows.getString(3));
                    if ("leader".equals(rows.getString(3))) {
                        result.put("leader", person);
                    } else {
                        @SuppressWarnings("unchecked")
                        List<Object> members = (List<Object>) result.get("members");
                        members.add(person);
                    }
                }
            }
        }
        return result;
    }

    private void upsertBuildTask(Connection connection, String taskId, String manualId, String outlineId, String domainId, Map<String, Object> domain, String publishedAt) throws SQLException {
        Map<String, Object> leader = domain.get("leader") instanceof Map<?, ?> map ? castMap(map) : Map.of();
        String leaderId = coalesce(leader.get("id"));
        String leaderName = coalesce(leader.get("name"));
        try (PreparedStatement query = connection.prepareStatement("SELECT ID FROM MANUAL_BUILD_TASKS WHERE ID = ?")) {
            query.setString(1, taskId);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) {
                    try (PreparedStatement update = connection.prepareStatement("UPDATE MANUAL_BUILD_TASKS SET DOMAIN_LEADER_ID=?, DOMAIN_LEADER_NAME=?, STATE='open', PUBLISHED_AT=?, UPDATED_AT=CURRENT_TIMESTAMP WHERE ID=?")) {
                        update.setString(1, leaderId);
                        update.setString(2, leaderName);
                        update.setString(3, publishedAt);
                        update.setString(4, taskId);
                        update.executeUpdate();
                    }
                    return;
                }
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO MANUAL_BUILD_TASKS(ID, MANUAL_ID, OUTLINE_VERSION_ID, TECH_DOMAIN_ID, DOMAIN_LEADER_ID, DOMAIN_LEADER_NAME, STATE, PUBLISHED_AT) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)")) {
            insert.setString(1, taskId);
            insert.setString(2, manualId);
            insert.setString(3, outlineId);
            insert.setString(4, domainId);
            insert.setString(5, leaderId);
            insert.setString(6, leaderName);
            insert.setString(7, publishedAt);
            insert.executeUpdate();
        }
    }

    private void upsertBuildTaskItem(Connection connection, String itemId, String taskId, String manualId, String documentId, String nodeId, String domainId) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT ID FROM MANUAL_BUILD_TASK_ITEMS WHERE ID = ?")) {
            query.setString(1, itemId);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) return;
            }
        }
        Map<String, Object> personnel = domainPersonnel(connection, domainId);
        Map<String, Object> leader = personnel.get("leader") instanceof Map<?, ?> map ? castMap(map) : Map.of();
        String leaderId = coalesce(leader.get("id"));
        String leaderName = coalesce(leader.get("name"));
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO MANUAL_BUILD_TASK_ITEMS(ID, TASK_ID, MANUAL_ID, DOCUMENT_ID, OUTLINE_NODE_ID, TECH_DOMAIN_ID, ASSIGNEE_ID, ASSIGNEE_NAME, STATUS, ASSIGNED_AT) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
            insert.setString(1, itemId);
            insert.setString(2, taskId);
            insert.setString(3, manualId);
            insert.setString(4, documentId);
            insert.setString(5, nodeId);
            insert.setString(6, domainId);
            insert.setString(7, leaderId);
            insert.setString(8, leaderName);
            insert.setString(9, leaderId == null ? "unassigned" : "assigned");
            insert.setString(10, leaderId == null ? null : Instant.now().toString());
            insert.executeUpdate();
        }
    }

    private void synchronizeBuildTasks(Connection connection, String manualId, String outlineId, List<Map<String, Object>> effective, String publishedAt) throws SQLException {
        Set<String> requiredItems = new java.util.HashSet<>();
        for (Map<String, Object> item : effective) {
            String documentId = String.valueOf(item.get("documentId"));
            for (Object domainValue : listValues(item.get("techDomainIds"))) {
                String domainId = String.valueOf(domainValue);
                requiredItems.add(documentId + "|" + domainId);
                Map<String, Object> domain = domainPersonnel(connection, domainId);
                String taskId = "build-task_" + sha256(outlineId + "|" + domainId).substring(0, 16);
                upsertBuildTask(connection, taskId, manualId, outlineId, domainId, domain, publishedAt);
                String itemId = "build-item_" + sha256(taskId + "|" + documentId + "|" + domainId).substring(0, 16);
                upsertBuildTaskItem(connection, itemId, taskId, manualId, documentId, String.valueOf(item.get("nodeId")), domainId);
            }
        }
        List<Map<String, Object>> currentItems = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT I.ID, I.DOCUMENT_ID, I.TECH_DOMAIN_ID FROM MANUAL_BUILD_TASK_ITEMS I JOIN MANUAL_BUILD_TASKS T ON T.ID = I.TASK_ID WHERE T.OUTLINE_VERSION_ID = ?")) {
            query.setString(1, outlineId);
            try (ResultSet result = query.executeQuery()) {
                while (result.next()) {
                    currentItems.add(mapOf(
                        "id", result.getString(1),
                        "key", result.getString(2) + "|" + result.getString(3)
                    ));
                }
            }
        }
        for (Map<String, Object> item : currentItems) {
            if (!requiredItems.contains(String.valueOf(item.get("key")))) {
                try (PreparedStatement delete = connection.prepareStatement("DELETE FROM MANUAL_BUILD_TASK_ITEMS WHERE ID = ?")) {
                    delete.setString(1, String.valueOf(item.get("id")));
                    delete.executeUpdate();
                }
            }
        }
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT T.ID FROM MANUAL_BUILD_TASKS T WHERE T.OUTLINE_VERSION_ID = ? AND NOT EXISTS (SELECT 1 FROM MANUAL_BUILD_TASK_ITEMS I WHERE I.TASK_ID = T.ID)")) {
            query.setString(1, outlineId);
            List<String> emptyTasks = new ArrayList<>();
            try (ResultSet result = query.executeQuery()) {
                while (result.next()) {
                    emptyTasks.add(result.getString(1));
                }
            }
            for (String taskId : emptyTasks) {
                try (PreparedStatement delete = connection.prepareStatement("DELETE FROM MANUAL_BUILD_TASKS WHERE ID = ?")) {
                    delete.setString(1, taskId);
                    delete.executeUpdate();
                }
            }
        }
    }

    private List<Map<String, Object>> projectBuildTasksForOutline(Connection connection, String outlineId) throws SQLException {
        List<Map<String, Object>> tasks = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
            "SELECT ID, MANUAL_ID, OUTLINE_VERSION_ID, TECH_DOMAIN_ID, DOMAIN_LEADER_ID, DOMAIN_LEADER_NAME, STATE, PUBLISHED_AT, CREATED_AT, UPDATED_AT FROM MANUAL_BUILD_TASKS WHERE OUTLINE_VERSION_ID = ? ORDER BY CREATED_AT, ID")) {
            statement.setString(1, outlineId);
            try (ResultSet result = statement.executeQuery()) {
                while (result.next()) tasks.add(projectBuildTaskRow(connection, result));
            }
        }
        return tasks;
    }

    private Map<String, Object> projectBuildTasks(Connection connection) throws SQLException {
        List<Map<String, Object>> tasks = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(
            "SELECT ID, MANUAL_ID, OUTLINE_VERSION_ID, TECH_DOMAIN_ID, DOMAIN_LEADER_ID, DOMAIN_LEADER_NAME, STATE, PUBLISHED_AT, CREATED_AT, UPDATED_AT FROM MANUAL_BUILD_TASKS ORDER BY UPDATED_AT DESC, ID")) {
            try (ResultSet result = statement.executeQuery()) {
                while (result.next()) tasks.add(projectBuildTaskRow(connection, result));
            }
        }
        return mapOf("tasks", tasks, "generatedAt", Instant.now().toString());
    }

    private Map<String, Object> projectBuildTask(Connection connection, String taskId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
            "SELECT ID, MANUAL_ID, OUTLINE_VERSION_ID, TECH_DOMAIN_ID, DOMAIN_LEADER_ID, DOMAIN_LEADER_NAME, STATE, PUBLISHED_AT, CREATED_AT, UPDATED_AT FROM MANUAL_BUILD_TASKS WHERE ID = ?")) {
            statement.setString(1, taskId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? projectBuildTaskRow(connection, result) : null;
            }
        }
    }

    private Map<String, Object> projectBuildTaskRow(Connection connection, ResultSet result) throws SQLException {
        Map<String, Object> task = new LinkedHashMap<>();
        task.put("id", result.getString(1));
        task.put("manualId", result.getString(2));
        task.put("outlineVersionId", result.getString(3));
        task.put("techDomainId", result.getString(4));
        task.put("techDomainName", techDomainName(connection, result.getString(4)));
        task.put("domainLeaderId", result.getString(5));
        task.put("domainLeaderName", result.getString(6));
        Map<String, Object> personnel = domainPersonnel(connection, result.getString(4));
        task.put("domainMembers", personnel.get("members"));
        task.put("state", result.getString(7));
        task.put("publishedAt", result.getString(8));
        task.put("createdAt", timestampToString(result.getTimestamp(9)));
        task.put("updatedAt", timestampToString(result.getTimestamp(10)));
        List<Map<String, Object>> items = new ArrayList<>();
        String itemSql = "SELECT ID, DOCUMENT_ID, OUTLINE_NODE_ID, TECH_DOMAIN_ID, ASSIGNEE_ID, ASSIGNEE_NAME, STATUS, ASSIGNED_BY, ASSIGNED_AT FROM MANUAL_BUILD_TASK_ITEMS WHERE TASK_ID = ? ORDER BY CREATED_AT, ID";
        try (PreparedStatement statement = connection.prepareStatement(itemSql)) {
            statement.setString(1, result.getString(1));
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    items.add(mapOf(
                        "id", rows.getString(1),
                        "taskId", result.getString(1),
                        "documentId", rows.getString(2),
                        "documentTitle", documentTitle(connection, result.getString(2), rows.getString(2), rows.getString(3)),
                        "outlineNodeId", rows.getString(3),
                        "techDomainId", rows.getString(4),
                        "assigneeId", rows.getString(5),
                        "assigneeName", rows.getString(6),
                        "status", rows.getString(7),
                        "assignedBy", rows.getString(8),
                        "assignedAt", rows.getString(9)
                    ));
                }
            }
        }
        task.put("items", items);
        return task;
    }

    private String documentTitle(Connection connection, String manualId, String documentId, String outlineNodeId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
            "SELECT TITLE FROM MANUAL_DOCUMENTS WHERE MANUAL_ID = ? AND ID = ?")) {
            statement.setString(1, manualId);
            statement.setString(2, documentId);
            try (ResultSet result = statement.executeQuery()) {
                if (result.next() && result.getString(1) != null && !result.getString(1).isBlank()) {
                    return result.getString(1);
                }
            }
        }
        try (PreparedStatement statement = connection.prepareStatement(
            "SELECT TITLE FROM MANUAL_OUTLINE_NODES WHERE ID = ?")) {
            statement.setString(1, outlineNodeId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? result.getString(1) : documentId;
            }
        }
    }

    private String techDomainName(Connection connection, String domainId) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("SELECT NAME FROM TECH_DOMAINS WHERE ID = ?")) {
            statement.setString(1, domainId);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? result.getString(1) : domainId;
            }
        }
    }

    private Map<String, Object> updateBuildTaskItem(Connection connection, String taskId, String itemId, Map<String, Object> payload) throws SQLException {
        String domainId;
        try (PreparedStatement query = connection.prepareStatement("SELECT TECH_DOMAIN_ID FROM MANUAL_BUILD_TASK_ITEMS WHERE ID = ? AND TASK_ID = ?")) {
            query.setString(1, itemId);
            query.setString(2, taskId);
            try (ResultSet result = query.executeQuery()) {
                if (!result.next()) throw new SQLException("BUILD_TASK_ITEM_NOT_FOUND");
                domainId = result.getString(1);
            }
        }
        Map<String, Object> assignee = payload.get("assignee") instanceof Map<?, ?> map ? castMap(map) : Map.of();
        String assigneeId = coalesce(payload.get("assigneeId"), assignee.get("id"));
        String assigneeName = coalesce(payload.get("assigneeName"), assignee.get("name"));
        String status = coalesce(payload.get("status"), assigneeId == null ? "unassigned" : "assigned");
        if (assigneeId != null) {
            try (PreparedStatement query = connection.prepareStatement("SELECT PERSON_NAME FROM TECH_DOMAIN_PERSONNEL WHERE DOMAIN_ID = ? AND PERSON_ID = ? AND STATUS = 'active'")) {
                query.setString(1, domainId);
                query.setString(2, assigneeId);
                try (ResultSet result = query.executeQuery()) {
                    if (!result.next()) throw new GovernanceValidationException("BUILD_TASK_ASSIGNEE_INVALID", "只能分配给当前技术领域的负责人或成员", 422, mapOf("techDomainId", domainId, "assigneeId", assigneeId));
                    if (assigneeName == null) assigneeName = result.getString(1);
                }
            }
        } else {
            assigneeName = null;
        }
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE MANUAL_BUILD_TASK_ITEMS SET ASSIGNEE_ID=?, ASSIGNEE_NAME=?, STATUS=?, ASSIGNED_AT=?, UPDATED_AT=CURRENT_TIMESTAMP WHERE ID=? AND TASK_ID=?")) {
            update.setString(1, assigneeId);
            update.setString(2, assigneeName);
            update.setString(3, status);
            update.setString(4, assigneeId == null ? null : Instant.now().toString());
            update.setString(5, itemId);
            update.setString(6, taskId);
            update.executeUpdate();
        }
        return projectBuildTask(connection, taskId);
    }

    private Map<String, Object> projectHandbooks(Connection connection) throws SQLException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("version", 1L);
        body.put("generatedAt", Instant.now().toString());
        body.put("handbooks", new ArrayList<>());
        body.put("audits", new ArrayList<>());
        String sql = "SELECT ID, CODE, TITLE, PRODUCT_ID, OWNER_A_ID, OWNER_A_NAME, OWNER_B_ID, OWNER_B_NAME, DEPARTMENT_ID, CURRENT_OUTLINE_VERSION_ID, STATUS, ARCHIVED_AT, ASSET_VERSION, SUMMARY, LEGACY_PAYLOAD, CREATED_AT, UPDATED_AT FROM MANUALS ORDER BY CREATED_AT, ID";
        try (PreparedStatement statement = connection.prepareStatement(sql); ResultSet result = statement.executeQuery()) {
            @SuppressWarnings("unchecked")
            List<Object> handbooks = (List<Object>) body.get("handbooks");
            while (result.next()) {
                handbooks.add(projectHandbook(connection, result));
            }
        }
        return body;
    }

    private Map<String, Object> projectHandbook(Connection connection, ResultSet result) throws SQLException {
        try {
            Map<String, Object> legacy = asMapOrEmpty(readClobOrNull(result.getClob(15)));
            Map<String, Object> handbook = new LinkedHashMap<>(legacy);
            handbook.put("handbookId", result.getString(1));
            handbook.put("id", result.getString(1));
            handbook.put("code", result.getString(2));
            handbook.put("name", coalesce(result.getString(3), handbook.get("name"), result.getString(2)));
            handbook.put("title", handbook.get("name"));
            handbook.put("productId", coalesce(result.getString(4), handbook.get("productId")));
            handbook.put("productType", coalesce(result.getString(4), handbook.get("productType")));
            handbook.put("ownerA", ownerObject(result.getString(5), result.getString(6), handbook.get("ownerA")));
            handbook.put("ownerB", ownerObject(result.getString(7), result.getString(8), handbook.get("ownerB")));
            handbook.put("departmentId", coalesce(result.getString(9), handbook.get("departmentId")));
            handbook.put("currentOutlineVersionId", coalesce(result.getString(10), handbook.get("currentOutlineVersionId")));
            handbook.put("outline", outlineSummary(result.getString(10), handbook.get("outline")));
            handbook.put("status", coalesce(result.getString(11), handbook.get("status")));
            handbook.put("sourceStatus", handbook.get("status"));
            handbook.put("archivedAt", result.getString(12));
            handbook.put("assetVersion", result.getLong(13));
            handbook.put("summary", coalesce(readClobOrNull(result.getClob(14)), handbook.get("summary")));
            handbook.put("documentSummary", documentSummary(connection, result.getString(1), handbook.get("documentSummary")));
            handbook.put("legacyPayload", legacy);
            handbook.put("createdAt", timestampToString(result.getTimestamp(16)));
            handbook.put("updatedAt", timestampToString(result.getTimestamp(17)));
            return handbook;
        } catch (Exception error) {
            throw new SQLException("读取手册投影失败", error);
        }
    }

    private Map<String, Object> saveOutlinesSnapshot(Connection connection, Map<String, Object> payload) throws SQLException, JsonParseException {
        List<Map<String, Object>> outlines = listOfMaps(payload.get("outlines"));
        Set<String> activeIds = new java.util.HashSet<>();
        Set<String> handbookIds = new java.util.HashSet<>();
        for (Map<String, Object> outline : outlines) {
            validateOutlineSnapshot(outline);
            String outlineId = outlineId(outline);
            String handbookId = handbookIdFromOutline(outline, outlineId);
            requireExistingManual(connection, handbookId);
            activeIds.add(outlineId);
            handbookIds.add(handbookId);
            upsertOutlineVersion(connection, handbookId, outlineId, outline, payload);
            rebuildOutlineChildren(connection, handbookId, outlineId, outline);
            replaceOutlineAssignmentsFromSnapshot(connection, handbookId, outlineId, outline);
        }
        removeMissingOutlineVersions(connection, activeIds);
        updateCurrentOutlinePointers(connection, handbookIds);
        return projectOutlines(connection);
    }

    private Map<String, Object> projectOutlines(Connection connection) throws SQLException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("outlines", new ArrayList<>());
        body.put("generatedAt", Instant.now().toString());
        String sql = "SELECT ID, MANUAL_ID, VERSION_CODE, NAME, STATE, BASE_VERSION_ID, SOURCE_TYPE, SOURCE_FINGERPRINT, PARSER_VERSION, RULE_VERSION, EDIT_VERSION, PUBLISHED_AT, LEGACY_PAYLOAD, CREATED_AT, UPDATED_AT FROM MANUAL_OUTLINE_VERSIONS ORDER BY CREATED_AT, ID";
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
            Map<String, Object> wrapper = asMapOrEmpty(readClobOrNull(result.getClob(13)));
            Map<String, Object> outline = wrapper.containsKey("outline") && wrapper.get("outline") instanceof Map<?, ?> ? castMap(wrapper.get("outline")) : wrapper;
            Map<String, Object> body = new LinkedHashMap<>(outline);
            body.put("id", result.getString(1));
            body.put("handbookId", result.getString(2));
            body.put("manualId", result.getString(2));
            body.put("name", handbookTitle(connection, result.getString(2), result.getString(4), body.get("name")));
            body.put("outlineStructureVersion", coalesce(result.getString(3), body.get("outlineStructureVersion")));
            body.put("state", coalesce(result.getString(5), body.get("state"), "draft"));
            body.put("baseVersionId", coalesce(result.getString(6), body.get("baseVersionId")));
            body.put("sourceType", coalesce(result.getString(7), body.get("sourceType")));
            body.put("sourceFingerprint", coalesce(result.getString(8), body.get("sourceFingerprint")));
            body.put("parserVersion", coalesce(result.getString(9), body.get("parserVersion")));
            body.put("ruleVersion", coalesce(result.getString(10), body.get("ruleVersion")));
            body.put("editVersion", result.getLong(11));
            body.put("published_at", result.getString(12));
            body.put("created_at", timestampToString(result.getTimestamp(14)));
            body.put("updated_at", timestampToString(result.getTimestamp(15)));
            List<Map<String, Object>> nodes = outlineNodes(connection, result.getString(1));
            body.put("nodes", nodes);
            body.put("legacyPayload", wrapper);
            body.put("kp_count", countNodesByKind(nodes, "document"));
            return body;
        } catch (Exception error) {
            throw new SQLException("读取大纲投影失败", error);
        }
    }

    private String handbookTitle(Connection connection, String handbookId, String outlineName, Object legacyName) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT TITLE FROM MANUALS WHERE ID = ?")) {
            query.setString(1, handbookId);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) {
                    String title = result.getString(1);
                    if (title != null && !title.isBlank()) return title;
                }
            }
        }
        return coalesce(outlineName, legacyName, handbookId);
    }

    private Map<String, Object> deleteOutline(Connection connection, String outlineId) throws SQLException {
        String sql = "SELECT MANUAL_ID, STATE FROM MANUAL_OUTLINE_VERSIONS WHERE ID = ? FOR UPDATE";
        String manualId;
        String state;
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, outlineId);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) {
                    throw new SQLException("OUTLINE_NOT_FOUND");
                }
                manualId = result.getString(1);
                state = result.getString(2);
            }
        } catch (SQLException error) {
            throw error;
        }
        if ("published".equals(state) || "superseded".equals(state)) {
            throw new SQLException("OUTLINE_IMMUTABLE");
        }
        deleteOutlineChildren(connection, outlineId);
        try (PreparedStatement delete = connection.prepareStatement("DELETE FROM MANUAL_OUTLINE_VERSIONS WHERE ID = ?")) {
            delete.setString(1, outlineId);
            delete.executeUpdate();
        }
        updateCurrentOutlinePointer(connection, manualId);
        return mapOf("id", outlineId, "deleted", true);
    }

    private void upsertManual(Connection connection, Map<String, Object> handbook, Map<String, Object> snapshot) throws SQLException, JsonParseException {
        String manualId = handbookId(handbook);
        String code = coalesce(handbook.get("code"), manualId);
        String title = coalesce(handbook.get("title"), handbook.get("name"), code);
        String productId = coalesce(handbook.get("productId"), handbook.get("productType"));
        Map<String, Object> ownerA = asMapOrEmpty(handbook.get("ownerA"));
        Map<String, Object> ownerB = asMapOrEmpty(handbook.get("ownerB"));
        String ownerAId = coalesce(ownerA.get("userId"), ownerA.get("id"));
        String ownerAName = coalesce(ownerA.get("displayName"), ownerA.get("name"));
        String ownerBId = coalesce(ownerB.get("userId"), ownerB.get("id"));
        String ownerBName = coalesce(ownerB.get("displayName"), ownerB.get("name"));
        String departmentId = coalesce(handbook.get("departmentId"));
        String currentOutlineVersionId = coalesce(handbook.get("currentOutlineVersionId"), outlineIdFromHandbook(handbook));
        String status = coalesce(handbook.get("status"), handbook.get("sourceStatus"), "created");
        String archivedAt = coalesce(handbook.get("archivedAt"));
        String summary = coalesce(handbook.get("summary"));
        String legacyPayload = Json.stringify(new LinkedHashMap<>(handbook));
        try (PreparedStatement query = connection.prepareStatement("SELECT ASSET_VERSION FROM MANUALS WHERE ID = ? FOR UPDATE")) {
            query.setString(1, manualId);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) {
                    long version = result.getLong(1) + 1;
                    try (PreparedStatement update = connection.prepareStatement(
                        "UPDATE MANUALS SET CODE=?, TITLE=?, PRODUCT_ID=?, OWNER_A_ID=?, OWNER_A_NAME=?, OWNER_B_ID=?, OWNER_B_NAME=?, DEPARTMENT_ID=?, CURRENT_OUTLINE_VERSION_ID=?, STATUS=?, ARCHIVED_AT=?, ASSET_VERSION=?, SUMMARY=?, LEGACY_PAYLOAD=?, UPDATED_AT=CURRENT_TIMESTAMP WHERE ID=?")) {
                        update.setString(1, code);
                        update.setString(2, title);
                        update.setString(3, productId);
                        update.setString(4, ownerAId);
                        update.setString(5, ownerAName);
                        update.setString(6, ownerBId);
                        update.setString(7, ownerBName);
                        update.setString(8, departmentId);
                        update.setString(9, currentOutlineVersionId);
                        update.setString(10, status);
                        update.setString(11, archivedAt);
                        update.setLong(12, version);
                        update.setCharacterStream(13, new StringReader(summary == null ? "" : summary));
                        update.setCharacterStream(14, new StringReader(legacyPayload));
                        update.setString(15, manualId);
                        update.executeUpdate();
                    }
                    return;
                }
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO MANUALS(ID, CODE, TITLE, PRODUCT_ID, OWNER_A_ID, OWNER_A_NAME, OWNER_B_ID, OWNER_B_NAME, DEPARTMENT_ID, CURRENT_OUTLINE_VERSION_ID, STATUS, ARCHIVED_AT, ASSET_VERSION, SUMMARY, LEGACY_PAYLOAD, LEGACY_AUDITS) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
            insert.setString(1, manualId);
            insert.setString(2, code);
            insert.setString(3, title);
            insert.setString(4, productId);
            insert.setString(5, ownerAId);
            insert.setString(6, ownerAName);
            insert.setString(7, ownerBId);
            insert.setString(8, ownerBName);
            insert.setString(9, departmentId);
            insert.setString(10, currentOutlineVersionId);
            insert.setString(11, status);
            insert.setString(12, archivedAt);
            insert.setLong(13, 1L);
            insert.setCharacterStream(14, new StringReader(summary == null ? "" : summary));
            insert.setCharacterStream(15, new StringReader(legacyPayload));
            insert.setCharacterStream(16, new StringReader("[]"));
            insert.executeUpdate();
        }
    }

    private void requireExistingManual(Connection connection, String handbookId) throws SQLException {
        if (handbookId == null || handbookId.isBlank()) {
            throw new SQLException("OUTLINE_HANDBOOK_REQUIRED");
        }
        try (PreparedStatement query = connection.prepareStatement("SELECT ID FROM MANUALS WHERE ID = ?")) {
            query.setString(1, handbookId);
            try (ResultSet result = query.executeQuery()) {
                if (!result.next()) {
                    throw new SQLException("OUTLINE_HANDBOOK_NOT_FOUND");
                }
            }
        }
    }

    private void upsertOutlineVersion(Connection connection, String handbookId, String outlineId, Map<String, Object> outline, Map<String, Object> snapshot) throws SQLException {
        String versionCode = coalesce(outline.get("outlineStructureVersion"), outlineId);
        String name = handbookTitle(connection, handbookId, null, null);
        String state = coalesce(outline.get("state"), "draft");
        String baseVersionId = coalesce(outline.get("baseVersionId"));
        String sourceType = coalesce(outline.get("sourceType"), "manual");
        String sourceFingerprint = coalesce(outline.get("sourceFingerprint"));
        String parserVersion = coalesce(outline.get("parserVersion"));
        String ruleVersion = coalesce(outline.get("ruleVersion"));
        String publishedAt = coalesce(outline.get("published_at"), outline.get("publishedAt"));
        String legacyPayload = Json.stringify(new LinkedHashMap<>(outline));
        try (PreparedStatement query = connection.prepareStatement("SELECT EDIT_VERSION FROM MANUAL_OUTLINE_VERSIONS WHERE ID = ? FOR UPDATE")) {
            query.setString(1, outlineId);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) {
                    long editVersion = result.getLong(1) + 1;
                    try (PreparedStatement update = connection.prepareStatement(
                        "UPDATE MANUAL_OUTLINE_VERSIONS SET MANUAL_ID=?, VERSION_CODE=?, NAME=?, STATE=?, BASE_VERSION_ID=?, SOURCE_TYPE=?, SOURCE_FINGERPRINT=?, PARSER_VERSION=?, RULE_VERSION=?, EDIT_VERSION=?, PUBLISHED_AT=?, LEGACY_PAYLOAD=?, UPDATED_AT=CURRENT_TIMESTAMP WHERE ID=?")) {
                        update.setString(1, handbookId);
                        update.setString(2, versionCode);
                        update.setString(3, name);
                        update.setString(4, state);
                        update.setString(5, baseVersionId);
                        update.setString(6, sourceType);
                        update.setString(7, sourceFingerprint);
                        update.setString(8, parserVersion);
                        update.setString(9, ruleVersion);
                        update.setLong(10, editVersion);
                        update.setString(11, publishedAt);
                        update.setCharacterStream(12, new StringReader(legacyPayload));
                        update.setString(13, outlineId);
                        update.executeUpdate();
                    }
                    return;
                }
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO MANUAL_OUTLINE_VERSIONS(ID, MANUAL_ID, VERSION_CODE, NAME, STATE, BASE_VERSION_ID, SOURCE_TYPE, SOURCE_FINGERPRINT, PARSER_VERSION, RULE_VERSION, EDIT_VERSION, PUBLISHED_AT, LEGACY_PAYLOAD) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
            insert.setString(1, outlineId);
            insert.setString(2, handbookId);
            insert.setString(3, versionCode);
            insert.setString(4, name);
            insert.setString(5, state);
            insert.setString(6, baseVersionId);
            insert.setString(7, sourceType);
            insert.setString(8, sourceFingerprint);
            insert.setString(9, parserVersion);
            insert.setString(10, ruleVersion);
            insert.setLong(11, 1L);
            insert.setString(12, publishedAt);
            insert.setCharacterStream(13, new StringReader(legacyPayload));
            insert.executeUpdate();
        }
    }

    private void rebuildOutlineChildren(Connection connection, String handbookId, String outlineId, Map<String, Object> outline) throws SQLException {
        deleteOutlineChildren(connection, outlineId);
        Map<String, Object> content = asMapOrEmpty(outline.get("content"));
        List<Map<String, Object>> parts = listOfMaps(content.get("parts"));
        long order = 0;
        for (int partIndex = 0; partIndex < parts.size(); partIndex++) {
            Map<String, Object> part = parts.get(partIndex);
            String partTitle = coalesce(part.get("part"), part.get("name"), part.get("title"), "未命名部分");
            String partId = stableNodeId(outlineId, "part", String.valueOf(partIndex + 1), partTitle);
            insertOutlineNode(connection, partId, handbookId, outlineId, null, "directory", null, partTitle, coalesce(part.get("description"), part.get("desc")), 1, String.valueOf(partIndex + 1), ++order);
            order = insertDocuments(connection, handbookId, outlineId, partId, listOfMaps(part.get("documents")), 2, String.valueOf(partIndex + 1), order);
            order = insertDirectories(connection, handbookId, outlineId, partId, listOfMaps(part.get("chapters")), 2, String.valueOf(partIndex + 1), order);
            order = insertDirectories(connection, handbookId, outlineId, partId, listOfMaps(part.get("children")), 2, String.valueOf(partIndex + 1), order);
        }
    }

    private void replaceOutlineAssignmentsFromSnapshot(Connection connection, String handbookId, String outlineId, Map<String, Object> outline) throws SQLException {
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
        try (PreparedStatement delete = connection.prepareStatement("DELETE FROM MANUAL_OUTLINE_NODE_DOMAINS WHERE OUTLINE_VERSION_ID = ?")) {
            delete.setString(1, outlineId);
            delete.executeUpdate();
        }
        for (Map<String, Object> assignment : resolvedAssignments) {
            String nodeId = coalesce(assignment.get("nodeId"), assignment.get("outlineNodeId"));
            if (nodeId == null) continue;
            for (Object domainValue : listValues(assignment.get("techDomainIds"))) {
                String domainId = String.valueOf(domainValue);
                if (!techDomainExists(connection, domainId)) {
                    throw new SQLException("INVALID_DOMAIN_PAYLOAD");
                }
                String id = "node-domain_" + sha256(outlineId + "|" + nodeId + "|" + domainId).substring(0, 16);
                try (PreparedStatement insert = connection.prepareStatement(
                    "INSERT INTO MANUAL_OUTLINE_NODE_DOMAINS(ID, MANUAL_ID, OUTLINE_VERSION_ID, NODE_ID, TECH_DOMAIN_ID, ASSIGNMENT_SOURCE, ASSIGNED_BY) VALUES (?, ?, ?, ?, ?, 'explicit', ?)")) {
                    insert.setString(1, id);
                    insert.setString(2, handbookId);
                    insert.setString(3, outlineId);
                    insert.setString(4, nodeId);
                    insert.setString(5, domainId);
                    insert.setString(6, null);
                    insert.executeUpdate();
                }
            }
        }
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
            String nodeId = coalesce(document.get("nodeId"), document.get("outlineNodeId"));
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

    private long insertDirectories(Connection connection, String handbookId, String outlineId, String parentId, List<Map<String, Object>> directories, int level, String parentPath, long order) throws SQLException {
        for (int directoryIndex = 0; directoryIndex < directories.size(); directoryIndex++) {
            Map<String, Object> directory = directories.get(directoryIndex);
            String title = coalesce(directory.get("name"), directory.get("title"), "未命名章节");
            String path = parentPath + "." + (directoryIndex + 1);
            String nodeId = stableNodeId(outlineId, level == 2 ? "chapter" : "section", path, title);
            insertOutlineNode(connection, nodeId, handbookId, outlineId, parentId, "directory", null, title, coalesce(directory.get("description"), directory.get("desc")), level, path, ++order);
            order = insertDocuments(connection, handbookId, outlineId, nodeId, leafDocuments(directory), level + 1, path, order);
            order = insertDirectories(connection, handbookId, outlineId, nodeId, listOfMaps(directory.get("children")), level + 1, path, order);
        }
        return order;
    }

    private long insertDocuments(Connection connection, String handbookId, String outlineId, String parentId, List<Map<String, Object>> documents, int level, String parentPath, long order) throws SQLException {
        for (int documentIndex = 0; documentIndex < documents.size(); documentIndex++) {
            Map<String, Object> document = documents.get(documentIndex);
            String sourceId = coalesce(document.get("id"), document.get("documentId"), document.get("code"), String.valueOf(documentIndex + 1));
            String path = parentPath + "." + (documentIndex + 1);
            int documentLevel = document.get("outlineLevel") instanceof Number value
                ? value.intValue()
                : level;
            String documentId = stableNodeId(outlineId, "document", path, sourceId);
            String documentTitle = coalesce(document.get("name"), document.get("title"), "未命名文档");
            String documentDesc = coalesce(document.get("desc"), document.get("description"), document.get("body"), documentTitle);
            insertOutlineNode(connection, documentId, handbookId, outlineId, parentId, "document", sourceId, documentTitle, documentDesc, documentLevel, path, ++order);
            insertDocument(connection, handbookId, outlineId, documentId, document, order);
        }
        return order;
    }

    private void insertOutlineNode(Connection connection, String id, String handbookId, String outlineVersionId, String parentId, String nodeType, String sourceId, String title, String description, int level, String outlinePath, long order) throws SQLException {
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO MANUAL_OUTLINE_NODES(ID, MANUAL_ID, OUTLINE_VERSION_ID, PARENT_ID, NODE_TYPE, SOURCE_ID, TITLE, DESCRIPTION, OUTLINE_LEVEL, OUTLINE_PATH, ORDER_INDEX) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
            insert.setString(1, id);
            insert.setString(2, handbookId);
            insert.setString(3, outlineVersionId);
            insert.setString(4, parentId);
            insert.setString(5, nodeType);
            insert.setString(6, sourceId);
            insert.setString(7, title);
            insert.setCharacterStream(8, new StringReader(description == null ? "" : description));
            insert.setLong(9, level);
            insert.setString(10, outlinePath);
            insert.setLong(11, order);
            insert.executeUpdate();
        }
    }

    private void insertDocument(Connection connection, String handbookId, String outlineVersionId, String outlineNodeId, Map<String, Object> document, long order) throws SQLException {
        // Document rows belong to an outline node. Keep the source page number as
        // DOCUMENT_CODE so repeated imports can create independent candidates.
        String documentId = outlineNodeId;
        String documentCode = coalesce(document.get("code"), document.get("documentId"), document.get("id"), outlineNodeId);
        String title = coalesce(document.get("name"), document.get("title"), "未命名文档");
        String summary = coalesce(document.get("desc"), document.get("description"), document.get("body"), title);
        String ownerId = coalesce(document.get("ownerId"));
        String status = coalesce(document.get("status"), "draft");
        String legacyPayload = Json.stringify(document);
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO MANUAL_DOCUMENTS(ID, MANUAL_ID, OUTLINE_VERSION_ID, OUTLINE_NODE_ID, DOCUMENT_CODE, TITLE, SUMMARY, OWNER_ID, STATUS, LEGACY_PAYLOAD) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
            insert.setString(1, documentId);
            insert.setString(2, handbookId);
            insert.setString(3, outlineVersionId);
            insert.setString(4, outlineNodeId);
            insert.setString(5, documentCode);
            insert.setString(6, title);
            insert.setCharacterStream(7, new StringReader(summary));
            insert.setString(8, ownerId);
            insert.setString(9, status);
            insert.setCharacterStream(10, new StringReader(legacyPayload));
            insert.executeUpdate();
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO MANUAL_DOCUMENT_SECTIONS(ID, MANUAL_ID, DOCUMENT_ID, TITLE, BODY, TECH_DOMAIN_ID, OWNER_ID, STATUS, VERSION, ORDER_INDEX, PLANNED_END_DATE, FINISHED_AT) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
            insert.setString(1, documentId + ":section:1");
            insert.setString(2, handbookId);
            insert.setString(3, documentId);
            insert.setString(4, title);
            insert.setCharacterStream(5, new StringReader(summary));
            insert.setString(6, coalesce(document.get("techDomainId")));
            insert.setString(7, ownerId);
            insert.setString(8, status);
            insert.setLong(9, 1L);
            insert.setLong(10, order);
            insert.setString(11, coalesce(document.get("plannedEndDate")));
            insert.setString(12, coalesce(document.get("finishedAt")));
            insert.executeUpdate();
        }
    }

    private List<Map<String, Object>> outlineNodes(Connection connection, String outlineVersionId) throws SQLException {
        List<Map<String, Object>> nodes = new ArrayList<>();
        String sql = "SELECT ID, PARENT_ID, NODE_TYPE, SOURCE_ID, TITLE, DESCRIPTION, OUTLINE_LEVEL, OUTLINE_PATH, ORDER_INDEX FROM MANUAL_OUTLINE_NODES WHERE OUTLINE_VERSION_ID = ? ORDER BY ORDER_INDEX, ID";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, outlineVersionId);
            try (ResultSet result = statement.executeQuery()) {
                while (result.next()) {
                    Map<String, Object> node = new LinkedHashMap<>();
                    node.put("id", result.getString(1));
                    node.put("parentId", result.getString(2));
                    node.put("kind", result.getString(3));
                    node.put("sourceId", result.getString(4));
                    node.put("title", result.getString(5));
                    node.put("description", readClobOrNull(result.getClob(6)));
                    node.put("level", result.getLong(7));
                    node.put("path", result.getString(8));
                    node.put("order", result.getLong(9));
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

    private void deleteOutlineChildren(Connection connection, String outlineId) throws SQLException {
        List<String> documentIds = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement("SELECT ID FROM MANUAL_DOCUMENTS WHERE OUTLINE_VERSION_ID = ?")) {
            query.setString(1, outlineId);
            try (ResultSet result = query.executeQuery()) {
                while (result.next()) {
                    documentIds.add(result.getString(1));
                }
            }
        }
        for (String documentId : documentIds) {
            try (PreparedStatement delete = connection.prepareStatement("DELETE FROM MANUAL_DOCUMENT_SECTIONS WHERE DOCUMENT_ID = ?")) {
                delete.setString(1, documentId);
                delete.executeUpdate();
            }
        }
        try (PreparedStatement delete = connection.prepareStatement("DELETE FROM MANUAL_DOCUMENTS WHERE OUTLINE_VERSION_ID = ?")) {
            delete.setString(1, outlineId);
            delete.executeUpdate();
        }
        try (PreparedStatement delete = connection.prepareStatement("DELETE FROM MANUAL_OUTLINE_NODES WHERE OUTLINE_VERSION_ID = ?")) {
            delete.setString(1, outlineId);
            delete.executeUpdate();
        }
    }

    private void removeMissingOutlineVersions(Connection connection, Set<String> activeIds) throws SQLException {
        List<String> existing = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement("SELECT ID FROM MANUAL_OUTLINE_VERSIONS")) {
            try (ResultSet result = query.executeQuery()) {
                while (result.next()) {
                    existing.add(result.getString(1));
                }
            }
        }
        for (String id : existing) {
            if (!activeIds.contains(id)) {
                deleteOutlineChildren(connection, id);
                try (PreparedStatement delete = connection.prepareStatement("DELETE FROM MANUAL_OUTLINE_VERSIONS WHERE ID = ?")) {
                    delete.setString(1, id);
                    delete.executeUpdate();
                }
            }
        }
    }

    private void updateCurrentOutlinePointers(Connection connection, Set<String> handbookIds) throws SQLException {
        for (String handbookId : handbookIds) {
            updateCurrentOutlinePointer(connection, handbookId);
        }
    }

    private void updateCurrentOutlinePointer(Connection connection, String handbookId) throws SQLException {
        String outlineId = null;
        try (PreparedStatement query = connection.prepareStatement("SELECT ID FROM MANUAL_OUTLINE_VERSIONS WHERE MANUAL_ID = ? AND STATE = 'published' ORDER BY UPDATED_AT DESC")) {
            query.setString(1, handbookId);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) {
                    outlineId = result.getString(1);
                }
            }
        }
        if (outlineId == null) {
            try (PreparedStatement query = connection.prepareStatement("SELECT ID FROM MANUAL_OUTLINE_VERSIONS WHERE MANUAL_ID = ? ORDER BY UPDATED_AT DESC")) {
                query.setString(1, handbookId);
                try (ResultSet result = query.executeQuery()) {
                    if (result.next()) {
                        outlineId = result.getString(1);
                    }
                }
            }
        }
        try (PreparedStatement update = connection.prepareStatement("UPDATE MANUALS SET CURRENT_OUTLINE_VERSION_ID = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?")) {
            update.setString(1, outlineId);
            update.setString(2, handbookId);
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

    private Map<String, Object> documentSummary(Connection connection, String handbookId, Object fallback) throws SQLException {
        Map<String, Object> summary = asMapOrEmpty(fallback);
        long total = 0L;
        long published = 0L;
        long inProgress = 0L;
        long runningTasks = 0L;
        String sql = "SELECT STATUS, COUNT(*) FROM MANUAL_DOCUMENTS WHERE MANUAL_ID = ? GROUP BY STATUS";
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, handbookId);
            try (ResultSet result = statement.executeQuery()) {
                while (result.next()) {
                    String status = result.getString(1);
                    long count = result.getLong(2);
                    total += count;
                    if ("published".equalsIgnoreCase(status)) {
                        published += count;
                    } else {
                        inProgress += count;
                        if ("running".equalsIgnoreCase(status) || "processing".equalsIgnoreCase(status)) {
                            runningTasks += count;
                        }
                    }
                }
            }
        }
        summary.put("total", total);
        summary.put("published", published);
        summary.put("inProgress", inProgress);
        summary.put("runningTasks", runningTasks);
        return summary;
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

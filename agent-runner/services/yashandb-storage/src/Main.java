import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.*;
import java.time.Instant;
import java.util.HexFormat;
import java.util.concurrent.Executors;

public final class Main {
    private static final String DRIVER = "com.yashandb.jdbc.Driver";
    private static final int DEFAULT_MAX_BODY_BYTES = 16 * 1024 * 1024;

    private final String jdbcUrl = required("YASDB_JDBC_URL");
    private final String username = required("YASDB_USERNAME");
    private final String password = required("YASDB_PASSWORD");
    private final int maxBodyBytes = integer("YASDB_STORAGE_MAX_BODY_BYTES", DEFAULT_MAX_BODY_BYTES);
    private final Path sqlDirectory = Path.of(env("YASDB_STORAGE_SQL_DIR", "sql")).toAbsolutePath().normalize();

    public static void main(String[] args) throws Exception {
        Class.forName(DRIVER);
        Main application = new Main();
        application.migrate();
        application.start();
    }

    private void start() throws IOException {
        String host = env("YASDB_STORAGE_HOST", "127.0.0.1");
        int port = integer("YASDB_STORAGE_PORT", 14210);
        HttpServer server = HttpServer.create(new InetSocketAddress(host, port), 0);
        server.createContext("/health", this::health);
        server.createContext("/v1/records", this::records);
        server.createContext("/v1/export", this::exportAll);
        server.setExecutor(Executors.newFixedThreadPool(integer("YASDB_STORAGE_THREADS", 8)));
        server.start();
        System.out.printf("YashanDB 存储服务已启动：http://%s:%d%n", host, port);
    }

    private Connection connection() throws SQLException {
        Connection connection = DriverManager.getConnection(jdbcUrl, username, password);
        connection.setAutoCommit(false);
        return connection;
    }

    private void migrate() throws SQLException {
        try (Connection connection = connection()) {
            createTableIfMissing(connection, "KC_SCHEMA_MIGRATION", sql("001_schema_migration.sql"));
            createTableIfMissing(connection, "KC_RECORD", sql("002_record.sql"));
            createTableIfMissing(connection, "KC_MIGRATION_BATCH", sql("003_migration_batch.sql"));
            recordMigration(connection, "001_record_store", sha256("KC_SCHEMA_MIGRATION|KC_RECORD|KC_MIGRATION_BATCH"));
            connection.commit();
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
                if (result.getLong(1) > 0) return;
            }
        }
        try (Statement statement = connection.createStatement()) {
            String executable = ddl.trim();
            if (executable.endsWith(";")) executable = executable.substring(0, executable.length() - 1).trim();
            statement.execute(executable);
        }
    }

    private void recordMigration(Connection connection, String version, String checksum) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT CHECKSUM FROM KC_SCHEMA_MIGRATION WHERE VERSION_ID = ?")) {
            query.setString(1, version);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) {
                    if (!checksum.equals(result.getString(1).trim())) throw new SQLException("数据库迁移摘要不一致：" + version);
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
        try (Connection connection = connection(); Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery("SELECT 1 FROM DUAL")) {
            result.next();
            DatabaseMetaData metadata = connection.getMetaData();
            connection.commit();
            send(exchange, 200, "{\"success\":true,\"database\":\"" + escape(metadata.getDatabaseProductName())
                + "\",\"databaseVersion\":\"" + escape(metadata.getDatabaseProductVersion())
                + "\",\"driver\":\"" + escape(metadata.getDriverName())
                + "\",\"driverVersion\":\"" + escape(metadata.getDriverVersion()) + "\"}");
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
        String sql = "SELECT PAYLOAD, PAYLOAD_SHA256, REVISION, DELETED, CREATED_AT, UPDATED_AT FROM KC_RECORD WHERE NAMESPACE=? AND RECORD_KEY=?";
        try (Connection connection = connection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setString(1, namespace);
            statement.setString(2, key);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) { connection.rollback(); failure(exchange, 404, "RECORD_NOT_FOUND", "记录不存在"); return; }
                String payload = readClob(result.getClob(1));
                String body = recordJson(namespace, key, payload, result.getString(2), result.getLong(3), "Y".equals(result.getString(4)), result.getTimestamp(5), result.getTimestamp(6));
                connection.commit();
                send(exchange, 200, body);
            }
        } catch (Exception error) {
            failure(exchange, 503, "DATABASE_UNAVAILABLE", "读取数据库记录失败");
        }
    }

    private void putRecord(HttpExchange exchange, String namespace, String key) throws IOException {
        byte[] bytes;
        try { bytes = readBody(exchange, maxBodyBytes); }
        catch (BodyTooLarge error) { failure(exchange, 413, "PAYLOAD_TOO_LARGE", "记录内容超过限制"); return; }
        String payload = new String(bytes, StandardCharsets.UTF_8).trim();
        if (!looksLikeJson(payload)) { failure(exchange, 400, "INVALID_JSON", "请求体必须是 JSON"); return; }
        Long expected = expectedRevision(exchange, false);
        if (Long.valueOf(Long.MIN_VALUE).equals(expected)) return;
        String digest = sha256(payload);
        try (Connection connection = connection()) {
            long revision = upsert(connection, namespace, key, payload, digest, expected);
            connection.commit();
            send(exchange, 200, "{\"success\":true,\"namespace\":\"" + escape(namespace) + "\",\"key\":\"" + escape(key)
                + "\",\"revision\":" + revision + ",\"sha256\":\"" + digest + "\",\"updatedAt\":\"" + Instant.now() + "\"}");
        } catch (RevisionConflict error) {
            failure(exchange, 409, "REVISION_CONFLICT", "记录已被其他请求修改");
        } catch (Exception error) {
            failure(exchange, 503, "DATABASE_UNAVAILABLE", "写入数据库记录失败");
        }
    }

    private long upsert(Connection connection, String namespace, String key, String payload, String digest, Long expected) throws Exception {
        Long current = null;
        String currentDigest = null;
        boolean currentDeleted = false;
        try (PreparedStatement lock = connection.prepareStatement("SELECT REVISION, PAYLOAD_SHA256, DELETED FROM KC_RECORD WHERE NAMESPACE=? AND RECORD_KEY=? FOR UPDATE")) {
            lock.setString(1, namespace); lock.setString(2, key);
            try (ResultSet result = lock.executeQuery()) {
                if (result.next()) {
                    current = result.getLong(1);
                    currentDigest = result.getString(2).trim();
                    currentDeleted = "Y".equals(result.getString(3));
                }
            }
        }
        if (expected != null && (current == null ? expected != 0 : !expected.equals(current))) throw new RevisionConflict();
        if (current == null) {
            try (PreparedStatement insert = connection.prepareStatement("INSERT INTO KC_RECORD(NAMESPACE, RECORD_KEY, PAYLOAD, PAYLOAD_SHA256, REVISION, DELETED) VALUES (?, ?, ?, ?, 1, 'N')")) {
                insert.setString(1, namespace); insert.setString(2, key); insert.setCharacterStream(3, new StringReader(payload)); insert.setString(4, digest); insert.executeUpdate();
            }
            return 1;
        }
        if (!currentDeleted && digest.equals(currentDigest)) return current;
        long next = current + 1;
        try (PreparedStatement update = connection.prepareStatement("UPDATE KC_RECORD SET PAYLOAD=?, PAYLOAD_SHA256=?, REVISION=?, DELETED='N', UPDATED_AT=CURRENT_TIMESTAMP WHERE NAMESPACE=? AND RECORD_KEY=?")) {
            update.setCharacterStream(1, new StringReader(payload)); update.setString(2, digest); update.setLong(3, next); update.setString(4, namespace); update.setString(5, key); update.executeUpdate();
        }
        return next;
    }

    private void deleteRecord(HttpExchange exchange, String namespace, String key) throws IOException {
        Long expected = expectedRevision(exchange, true);
        if (Long.valueOf(Long.MIN_VALUE).equals(expected)) return;
        try (Connection connection = connection(); PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_RECORD SET DELETED='Y', REVISION=REVISION+1, UPDATED_AT=CURRENT_TIMESTAMP WHERE NAMESPACE=? AND RECORD_KEY=? AND REVISION=?")) {
            update.setString(1, namespace); update.setString(2, key); update.setLong(3, expected);
            int changed = update.executeUpdate();
            if (changed != 1) { connection.rollback(); failure(exchange, 409, "REVISION_CONFLICT", "记录不存在或已被修改"); return; }
            connection.commit();
            send(exchange, 200, "{\"success\":true,\"revision\":" + (expected + 1) + "}");
        } catch (Exception error) {
            failure(exchange, 503, "DATABASE_UNAVAILABLE", "删除数据库记录失败");
        }
    }

    private void exportAll(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) { methodNotAllowed(exchange); return; }
        String sql = "SELECT NAMESPACE, RECORD_KEY, PAYLOAD, PAYLOAD_SHA256, REVISION, DELETED, CREATED_AT, UPDATED_AT FROM KC_RECORD ORDER BY NAMESPACE, RECORD_KEY";
        try (Connection connection = connection(); PreparedStatement statement = connection.prepareStatement(sql); ResultSet result = statement.executeQuery()) {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.getResponseHeaders().set("Cache-Control", "no-store");
            exchange.sendResponseHeaders(200, 0);
            try (Writer writer = new BufferedWriter(new OutputStreamWriter(exchange.getResponseBody(), StandardCharsets.UTF_8))) {
                DatabaseMetaData metadata = connection.getMetaData();
                writer.write("{\"exportSchemaVersion\":1,\"exportedAt\":\""); writer.write(Instant.now().toString());
                writer.write("\",\"databaseProduct\":\""); writer.write(escape(metadata.getDatabaseProductName())); writer.write("\",\"records\":[");
                boolean first = true;
                while (result.next()) {
                    if (!first) writer.write(',');
                    first = false;
                    writer.write(recordJson(result.getString(1), result.getString(2), readClob(result.getClob(3)), result.getString(4), result.getLong(5), "Y".equals(result.getString(6)), result.getTimestamp(7), result.getTimestamp(8)));
                }
                writer.write("]}");
            }
            connection.commit();
        } catch (Exception error) {
            if (!exchange.getResponseHeaders().containsKey("Content-Type")) failure(exchange, 503, "DATABASE_UNAVAILABLE", "导出数据库记录失败");
        }
    }

    private static String recordJson(String namespace, String key, String payload, String digest, long revision, boolean deleted, Timestamp created, Timestamp updated) {
        return "{\"namespace\":\"" + escape(namespace) + "\",\"key\":\"" + escape(key) + "\",\"revision\":" + revision
            + ",\"deleted\":" + deleted + ",\"sha256\":\"" + escape(digest.trim()) + "\",\"createdAt\":\"" + created.toInstant()
            + "\",\"updatedAt\":\"" + updated.toInstant() + "\",\"payload\":" + payload + "}";
    }

    private Long expectedRevision(HttpExchange exchange, boolean required) throws IOException {
        String value = exchange.getRequestHeaders().getFirst("If-Match");
        if (value == null || value.isBlank()) {
            if (required) { failure(exchange, 428, "REVISION_REQUIRED", "必须提供 If-Match revision"); return Long.MIN_VALUE; }
            return null;
        }
        value = value.replace("\"", "").trim();
        try { return Long.parseLong(value); }
        catch (NumberFormatException error) { failure(exchange, 400, "INVALID_REVISION", "If-Match 必须是整数 revision"); return Long.MIN_VALUE; }
    }

    private static byte[] readBody(HttpExchange exchange, int limit) throws IOException, BodyTooLarge {
        try (InputStream input = exchange.getRequestBody(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int total = 0; int count;
            while ((count = input.read(buffer)) != -1) {
                total += count; if (total > limit) throw new BodyTooLarge(); output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    private static String readClob(Clob clob) throws Exception {
        try (Reader reader = clob.getCharacterStream(); StringWriter writer = new StringWriter()) {
            reader.transferTo(writer); return writer.toString();
        }
    }

    private static boolean looksLikeJson(String payload) {
        if (payload.isEmpty()) return false;
        char first = payload.charAt(0), last = payload.charAt(payload.length() - 1);
        return (first == '{' && last == '}') || (first == '[' && last == ']') || "null".equals(payload) || "true".equals(payload) || "false".equals(payload) || first == '"' || first == '-' || Character.isDigit(first);
    }

    private static String decode(String value) { return URLDecoder.decode(value, StandardCharsets.UTF_8); }
    private static String escape(String value) { return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\r", "\\r").replace("\n", "\\n"); }
    private static String sha256(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception error) { throw new IllegalStateException(error); }
    }
    private static String env(String name, String fallback) { String value = System.getenv(name); return value == null || value.isBlank() ? fallback : value; }
    private static String required(String name) { String value = System.getenv(name); if (value == null || value.isBlank()) throw new IllegalStateException("缺少环境变量：" + name); return value; }
    private static int integer(String name, int fallback) { return Integer.parseInt(env(name, String.valueOf(fallback))); }
    private static void send(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8"); exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, bytes.length); try (OutputStream output = exchange.getResponseBody()) { output.write(bytes); }
    }
    private static void failure(HttpExchange exchange, int status, String code, String message) throws IOException {
        send(exchange, status, "{\"success\":false,\"error\":{\"code\":\"" + escape(code) + "\",\"message\":\"" + escape(message) + "\"}}");
    }
    private static void methodNotAllowed(HttpExchange exchange) throws IOException { failure(exchange, 405, "METHOD_NOT_ALLOWED", "请求方法不支持"); }
    private static final class RevisionConflict extends Exception {}
    private static final class BodyTooLarge extends Exception {}
}

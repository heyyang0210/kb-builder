import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.nio.channels.Channels;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Clob;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.EnumSet;

/** Explicit, one-time copy from the legacy aggregate; never switches the writer. */
final class DocumentTaskMigration {
    void activate(Connection connection, Path backup) throws Exception {
        String repo = System.getenv("KNOWLEDGE_CENTER_REPO_ROOT");
        if (repo == null || repo.isBlank()) throw new IllegalStateException("未指定仓库根目录");
        Path runtimeRoot = Path.of(repo).toRealPath().resolve("runtime").toRealPath();
        Path backupFile = backup.toRealPath();
        if (!backupFile.startsWith(runtimeRoot) || !Files.isRegularFile(backupFile)
            || Files.isSymbolicLink(backup)) throw new SQLException("DOCUMENT_TASK_BACKUP_INVALID");
        String payload;
        String storedHash;
        long revision;
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT PAYLOAD,PAYLOAD_SHA256,REVISION FROM KC_RECORD " +
            "WHERE NAMESPACE='document_tasks' AND RECORD_KEY='state' AND DELETED='N' FOR UPDATE")) {
            try (ResultSet rows = query.executeQuery()) {
                if (!rows.next()) throw new SQLException("DOCUMENT_TASK_LEGACY_NOT_FOUND");
                payload = readClob(rows.getClob(1));
                storedHash = rows.getString(2);
                revision = rows.getLong(3);
            }
        }
        if (!sha256(payload).equals(storedHash)) throw new SQLException("DOCUMENT_TASK_LEGACY_HASH_MISMATCH");
        if (!sha256(Files.readString(backupFile, StandardCharsets.UTF_8)).equals(storedHash))
            throw new SQLException("DOCUMENT_TASK_BACKUP_HASH_MISMATCH");
        long expectedCount;
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT LEGACY_REVISION,LEGACY_SHA256,TASK_COUNT,MIGRATION_STATUS FROM KC_TASK_MIGRATION " +
            "WHERE MIGRATION_ID='document_tasks_v2' FOR UPDATE")) {
            try (ResultSet rows = query.executeQuery()) {
                if (!rows.next() || !"VERIFIED".equals(rows.getString(4)))
                    throw new SQLException("DOCUMENT_TASK_MIGRATION_NOT_VERIFIED");
                if (revision != rows.getLong(1) || !storedHash.equals(rows.getString(2)))
                    throw new SQLException("DOCUMENT_TASK_LEGACY_CHANGED");
                expectedCount = rows.getLong(3);
            }
        }
        Object parsed = Main.Json.parse(payload);
        if (!(parsed instanceof Map<?, ?> root) || !(root.get("tasks") instanceof List<?> tasks)
            || tasks.size() != expectedCount) throw new SQLException("DOCUMENT_TASK_RECONCILIATION_FAILED");
        Map<String, String> hashes = new java.util.HashMap<>();
        for (Object value : tasks) {
            if (!(value instanceof Map<?, ?> task)) throw new SQLException("DOCUMENT_TASK_RECONCILIATION_FAILED");
            String number = string(task.get("number"));
            if (number == null || hashes.put(number, sha256(Main.Json.stringify(task))) != null)
                throw new SQLException("DOCUMENT_TASK_RECONCILIATION_FAILED");
        }
        long verified = 0;
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT TASK_PREFIX,TASK_NUMBER,PAYLOAD FROM KC_DOCUMENT_TASK ORDER BY TASK_PREFIX,TASK_NUMBER");
             ResultSet rows = query.executeQuery()) {
            while (rows.next()) {
                String taskPayload = readClob(rows.getClob(3));
                String number = taskNumber(taskPayload);
                if (!sha256(taskPayload).equals(hashes.remove(number)))
                    throw new SQLException("DOCUMENT_TASK_RECONCILIATION_FAILED");
                verified++;
            }
        }
        if (verified != expectedCount || !hashes.isEmpty())
            throw new SQLException("DOCUMENT_TASK_RECONCILIATION_FAILED");
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_TASK_MIGRATION SET MIGRATION_STATUS='ACTIVE' " +
            "WHERE MIGRATION_ID='document_tasks_v2' AND MIGRATION_STATUS='VERIFIED'")) {
            if (update.executeUpdate() != 1) throw new SQLException("DOCUMENT_TASK_MIGRATION_CONFLICT");
        }
    }

    void verifyAndCopy(Connection connection, Path backup) throws Exception {
        String payload;
        String expectedHash;
        long revision;
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT PAYLOAD,PAYLOAD_SHA256,REVISION FROM KC_RECORD " +
            "WHERE NAMESPACE='document_tasks' AND RECORD_KEY='state' AND DELETED='N' FOR UPDATE")) {
            try (ResultSet rows = query.executeQuery()) {
                if (!rows.next()) throw new SQLException("DOCUMENT_TASK_LEGACY_NOT_FOUND");
                payload = readClob(rows.getClob(1));
                expectedHash = rows.getString(2);
                revision = rows.getLong(3);
            }
        }
        if (!sha256(payload).equals(expectedHash)) throw new SQLException("DOCUMENT_TASK_LEGACY_HASH_MISMATCH");
        Path target = backup.toAbsolutePath().normalize();
        String repo = System.getenv("KNOWLEDGE_CENTER_REPO_ROOT");
        if (repo == null || repo.isBlank()) throw new IllegalStateException("未指定仓库根目录，拒绝创建备份");
        Path runtimeRoot = Path.of(repo).toRealPath().resolve("runtime");
        if (!Files.isDirectory(runtimeRoot) || !target.startsWith(runtimeRoot)
            || target.equals(runtimeRoot)) throw new IllegalArgumentException("备份路径必须位于本仓库 runtime 内");
        if (Files.exists(target, java.nio.file.LinkOption.NOFOLLOW_LINKS))
            throw new IllegalStateException("备份文件已存在，拒绝覆盖");
        Path parent = target.getParent();
        Files.createDirectories(parent);
        if (!parent.toRealPath().startsWith(runtimeRoot.toRealPath()))
            throw new IllegalArgumentException("备份目录不能通过符号链接指向 runtime 以外");
        try (var channel = Files.newByteChannel(target,
            Set.of(StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE, java.nio.file.LinkOption.NOFOLLOW_LINKS),
            PosixFilePermissions.asFileAttribute(EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE)));
            var output = Channels.newOutputStream(channel)) {
            output.write(payload.getBytes(StandardCharsets.UTF_8));
        }
        if (!sha256(Files.readString(target, StandardCharsets.UTF_8)).equals(expectedHash)) {
            throw new SQLException("DOCUMENT_TASK_BACKUP_HASH_MISMATCH");
        }
        Object parsed = Main.Json.parse(payload);
        if (!(parsed instanceof Map<?, ?> root) || !(root.get("tasks") instanceof List<?> tasks)
            || !(root.get("schemaVersion") instanceof Number version) || version.intValue() != 2) {
            throw new SQLException("DOCUMENT_TASK_LEGACY_INVALID");
        }
        Object config = root.get("config");
        if (!(config instanceof Map<?, ?>)) throw new SQLException("DOCUMENT_TASK_CONFIG_INVALID");
        long existing;
        try (PreparedStatement query = connection.prepareStatement("SELECT COUNT(*) FROM KC_DOCUMENT_TASK")) {
            try (ResultSet rows = query.executeQuery()) { rows.next(); existing = rows.getLong(1); }
        }
        if (existing != 0) throw new SQLException("DOCUMENT_TASK_TARGET_NOT_EMPTY");
        Set<String> numbers = new HashSet<>();
        Set<String> identities = new HashSet<>();
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_DOCUMENT_TASK (TASK_PREFIX,TASK_NUMBER,PAYLOAD,OWNER_ID,PRODUCT_CODE,BUSINESS_VERSION," +
            "TASK_STATUS,DESCRIPTION) VALUES (?,?,?,?,?,?,?,?)")) {
            for (Object value : tasks) {
                if (!(value instanceof Map<?, ?> task)) throw new SQLException("DOCUMENT_TASK_LEGACY_INVALID");
                String number = string(task.get("number"));
                if (number == null || !numbers.add(number)) {
                    throw new SQLException("DOCUMENT_TASK_NUMBER_INVALID");
                }
                TaskNumber identity = TaskNumber.parseTask(number);
                if (!identities.add(identity.prefix + ":" + identity.value))
                    throw new SQLException("DOCUMENT_TASK_IDENTITY_COLLISION");
                String taskPayload = Main.Json.stringify(task);
                insert.setString(1, identity.prefix); insert.setLong(2, identity.value);
                insert.setString(3, taskPayload); insert.setString(4, string(task.get("ownerId")));
                insert.setString(5, string(task.get("product")));
                insert.setString(6, string(task.get("version")));
                insert.setString(7, DocumentTaskIndex.status(task));
                insert.setString(8, string(task.get("description")));
                insert.addBatch();
            }
            insert.executeBatch();
        }
        for (Object value : tasks) {
            Map<?, ?> task = (Map<?, ?>) value;
            DocumentTaskIndex.replace(connection, string(task.get("number")), task);
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_DOCUMENT_TASK_CONFIG (CONFIG_KEY,PAYLOAD) VALUES ('state',?)")) {
            insert.setString(1, Main.Json.stringify(config));
            insert.executeUpdate();
        }
        int verified = 0;
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT TASK_PREFIX,TASK_NUMBER,PAYLOAD FROM KC_DOCUMENT_TASK ORDER BY TASK_PREFIX,TASK_NUMBER");
             ResultSet rows = query.executeQuery()) {
            Map<String, String> original = new java.util.HashMap<>();
            for (Object value : tasks) {
                Map<?, ?> task = (Map<?, ?>) value;
                original.put(string(task.get("number")), sha256(Main.Json.stringify(task)));
            }
            while (rows.next()) {
                String taskPayload = readClob(rows.getClob(3));
                String number = taskNumber(taskPayload);
                if (!sha256(taskPayload).equals(original.remove(number))) {
                    throw new SQLException("DOCUMENT_TASK_RECONCILIATION_FAILED");
                }
                verified++;
            }
            if (!original.isEmpty() || verified != tasks.size()) throw new SQLException("DOCUMENT_TASK_RECONCILIATION_FAILED");
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_TASK_MIGRATION (MIGRATION_ID,MIGRATION_STATUS,LEGACY_REVISION," +
            "LEGACY_SHA256,TASK_COUNT,VERIFIED_AT) VALUES ('document_tasks_v2','VERIFIED',?,?,?,CURRENT_TIMESTAMP)")) {
            insert.setLong(1, revision); insert.setString(2, expectedHash); insert.setLong(3, verified);
            insert.executeUpdate();
        }
    }

    private static String string(Object value) { return value == null ? null : String.valueOf(value); }
    private static String taskNumber(String payload) throws Exception {
        Object parsed = Main.Json.parse(payload);
        if (!(parsed instanceof Map<?, ?> task) || !(task.get("number") instanceof String number))
            throw new SQLException("DOCUMENT_TASK_RECONCILIATION_FAILED");
        return number;
    }
    private static String readClob(Clob clob) throws Exception {
        if (clob == null) throw new SQLException("DOCUMENT_TASK_CLOB_MISSING");
        long length = clob.length();
        StringBuilder value = new StringBuilder();
        for (long offset = 1; offset <= length;) {
            String part = clob.getSubString(offset, (int) Math.min(1024 * 1024L, length - offset + 1));
            if (part == null || part.isEmpty()) throw new SQLException("DOCUMENT_TASK_CLOB_INCOMPLETE");
            value.append(part);
            offset += part.length();
        }
        return value.toString();
    }
    private static String sha256(String value) throws Exception {
        return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
            .digest(value.getBytes(StandardCharsets.UTF_8)));
    }
}

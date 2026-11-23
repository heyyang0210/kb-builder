import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.security.MessageDigest;
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
import java.util.Set;
import java.util.logging.Logger;
import javax.sql.rowset.serial.SerialClob;

/** Runs the public task migration commands against synthetic JDBC state. */
public final class StorageDocumentTaskMigrationCommandCheck {
    private static final Map<String, Object> TASK = Map.of("number", "YDBRD-42", "ownerId", "177",
        "description", "隔离迁移任务", "status", "pending_scope");
    private static final String TASK_PAYLOAD = Main.Json.stringify(TASK);
    private static final String LEGACY = Main.Json.stringify(Map.of("schemaVersion", 2,
        "config", Map.of("defaultOwnerId", "177"), "tasks", List.of(TASK)));
    private static final String LEGACY_HASH = sha256(LEGACY);
    private static final String SQL = "CREATE TABLE KC_SCHEMA_MIGRATION (VERSION_ID VARCHAR(128));";
    private static String schemaHash;
    private static String migrationStatus;
    private static String storedTask;
    private static String storedConfig;
    private static String legacyPayload = LEGACY;
    private static String legacyHash = LEGACY_HASH;
    private static String verifiedHash = LEGACY_HASH;
    private static long verifiedRevision = 3;
    private static int verifiedCount = 1;
    private static boolean corruptReadback;
    private static int commits;
    private static int taskBatches;

    private static String sha256(String value) {
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) { throw new AssertionError(error); }
    }

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

    private static ResultSet query(String sql, Map<Integer, Object> binds) throws Exception {
        if (sql.startsWith("SELECT COUNT(*) FROM USER_TABLES"))
            return rows(List.<Object[]>of(new Object[] { 1L }));
        if (sql.startsWith("SELECT CHECKSUM FROM KC_SCHEMA_MIGRATION"))
            return rows(List.<Object[]>of(new Object[] { schemaHash }));
        if (sql.startsWith("SELECT PAYLOAD,PAYLOAD_SHA256,REVISION FROM KC_RECORD"))
            return rows(List.<Object[]>of(new Object[] { new SerialClob(legacyPayload.toCharArray()), legacyHash, 3L }));
        if (sql.startsWith("SELECT LEGACY_REVISION,LEGACY_SHA256,TASK_COUNT,MIGRATION_STATUS"))
            return rows(migrationStatus == null ? List.of() : List.<Object[]>of(new Object[] {
                verifiedRevision, verifiedHash, verifiedCount, migrationStatus }));
        if (sql.startsWith("SELECT COUNT(*) FROM KC_DOCUMENT_TASK"))
            return rows(List.<Object[]>of(new Object[] { storedTask == null ? 0L : 1L }));
        if (sql.startsWith("SELECT TASK_PREFIX,TASK_NUMBER,PAYLOAD FROM KC_DOCUMENT_TASK"))
            return rows(storedTask == null ? List.of() : List.<Object[]>of(new Object[] {
                "YDBRD", 42L, new SerialClob(storedTask.toCharArray()) }));
        throw new AssertionError("Unexpected task migration query: " + sql);
    }

    private static PreparedStatement statement(String sql) {
        Map<Integer, Object> binds = new HashMap<>();
        List<Map<Integer, Object>> batches = new ArrayList<>();
        return proxy(PreparedStatement.class, (self, method, args) -> switch (method.getName()) {
            case "setString", "setLong", "setInt", "setObject" -> { binds.put((Integer) args[0], args[1]); yield null; }
            case "executeQuery" -> query(sql, binds);
            case "addBatch" -> { batches.add(new HashMap<>(binds)); yield null; }
            case "executeBatch" -> {
                if (sql.startsWith("INSERT INTO KC_DOCUMENT_TASK (")) {
                    if (batches.size() != 1 || !"YDBRD".equals(batches.get(0).get(1))
                        || !Long.valueOf(42).equals(batches.get(0).get(2)))
                        throw new AssertionError("Task copy lost numeric identity");
                    storedTask = corruptReadback ? "{}" : String.valueOf(batches.get(0).get(3)); taskBatches++;
                }
                yield new int[batches.size()];
            }
            case "executeUpdate" -> {
                if (sql.startsWith("DELETE FROM KC_DOCUMENT_TASK_")) yield 0;
                if (sql.startsWith("INSERT INTO KC_DOCUMENT_TASK_CONFIG")) {
                    storedConfig = String.valueOf(binds.get(1)); yield 1;
                }
                if (sql.startsWith("INSERT INTO KC_TASK_MIGRATION")) {
                    if (!Long.valueOf(3).equals(binds.get(1)) || !LEGACY_HASH.equals(binds.get(2))
                        || !Long.valueOf(1).equals(binds.get(3)))
                        throw new AssertionError("Verified migration metadata mismatch");
                    migrationStatus = "VERIFIED"; yield 1;
                }
                if (sql.startsWith("UPDATE KC_TASK_MIGRATION SET MIGRATION_STATUS='ACTIVE'")) {
                    if (!"VERIFIED".equals(migrationStatus)) yield 0;
                    migrationStatus = "ACTIVE"; yield 1;
                }
                throw new AssertionError("Unexpected task migration update: " + sql);
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

    public static void main(String[] args) throws Exception {
        String scenario = args[0];
        boolean activating = scenario.startsWith("activate");
        boolean approvedShared = scenario.endsWith("shared-approved");
        if (!activating && !scenario.startsWith("copy"))
            throw new IllegalArgumentException("Expected copy or activate scenario");
        Path sqlDirectory = Path.of(System.getenv("YASDB_STORAGE_SQL_DIR"));
        Files.createDirectories(sqlDirectory);
        Files.writeString(sqlDirectory.resolve("001_init.sql"), SQL);
        schemaHash = sha256(SQL);
        String configuredBackup = System.getenv("KC_DOCUMENT_TASK_BACKUP_PATH");
        Path backup = configuredBackup == null || configuredBackup.isBlank()
            ? sqlDirectory.resolve("backup.json") : Path.of(configuredBackup);
        Files.createDirectories(backup.getParent());
        if ("copy-invalid-legacy".equals(scenario))
            legacyPayload = Main.Json.stringify(Map.of("schemaVersion", 1,
                "config", Map.of("defaultOwnerId", "177"), "tasks", List.of(TASK)));
        if ("copy-duplicate".equals(scenario) || "activate-duplicate".equals(scenario)) {
            legacyPayload = Main.Json.stringify(Map.of("schemaVersion", 2,
                "config", Map.of("defaultOwnerId", "177"), "tasks", List.of(TASK, TASK)));
            verifiedCount = 2;
        }
        legacyHash = sha256(legacyPayload);
        verifiedHash = legacyHash;
        corruptReadback = "copy-bad-readback".equals(scenario);
        if (activating || "copy-existing".equals(scenario)) {
            if ("activate-symlink".equals(scenario)) {
                Path realBackup = backup.resolveSibling("backup-real.json");
                Files.writeString(realBackup, legacyPayload);
                Files.createSymbolicLink(backup, realBackup.getFileName());
            } else {
                Files.writeString(backup, "activate-bad-backup".equals(scenario) ? "corrupt" : legacyPayload);
            }
        }
        if (activating) {
            storedTask = TASK_PAYLOAD;
            migrationStatus = "VERIFIED";
            if ("activate-not-verified".equals(scenario)) migrationStatus = "PENDING";
            if ("activate-changed".equals(scenario)) verifiedRevision = 4;
            if ("activate-bad-row".equals(scenario)) storedTask = "{}";
            if ("activate-missing-row".equals(scenario)) storedTask = null;
        }
        registerDriver();
        String expectedError = switch (scenario) {
            case "copy-wrong-target", "copy-shared-no-approval" -> "共享库任务迁移需要明确的审批引用";
            case "copy-test-no-run-id" -> "测试库任务迁移必须绑定本次隔离测试运行";
            case "copy-no-backup" -> "必须指定旧任务备份路径";
            case "copy-existing" -> "备份文件已存在";
            case "copy-invalid-legacy" -> "DOCUMENT_TASK_LEGACY_INVALID";
            case "copy-duplicate" -> "DOCUMENT_TASK_NUMBER_INVALID";
            case "copy-bad-readback", "activate-duplicate", "activate-bad-row", "activate-missing-row" ->
                "DOCUMENT_TASK_RECONCILIATION_FAILED";
            case "activate-bad-backup" -> "DOCUMENT_TASK_BACKUP_HASH_MISMATCH";
            case "activate-no-repo" -> "未指定仓库根目录";
            case "activate-symlink" -> "DOCUMENT_TASK_BACKUP_INVALID";
            case "activate-wrong-target", "activate-shared-no-approval" -> "共享库任务迁移需要明确的审批引用";
            case "activate-test-no-run-id" -> "测试库任务迁移必须绑定本次隔离测试运行";
            case "activate-no-backup" -> "必须指定已核验的旧任务备份路径";
            case "activate-not-verified" -> "DOCUMENT_TASK_MIGRATION_NOT_VERIFIED";
            case "activate-changed" -> "DOCUMENT_TASK_LEGACY_CHANGED";
            default -> null;
        };
        if (expectedError != null) {
            try {
                Main.main(commandArgs(activating, approvedShared));
                throw new AssertionError("Expected command refusal: " + scenario);
            } catch (Exception error) {
                if (error.getMessage() == null || !error.getMessage().contains(expectedError)
                    || commits != 0 || "ACTIVE".equals(migrationStatus)) throw error;
                System.out.println("PASS: public task migration command " + scenario);
                return;
            }
        }
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                if (!LEGACY.equals(Files.readString(backup)) || commits != 1)
                    throw new AssertionError("Backup or commit boundary mismatch");
                if (!activating) {
                    if (!"VERIFIED".equals(migrationStatus) || taskBatches != 1
                        || !TASK_PAYLOAD.equals(storedTask) || !storedConfig.contains("defaultOwnerId"))
                        throw new AssertionError("Task copy did not reconcile");
                    Set<PosixFilePermission> permissions = Files.getPosixFilePermissions(backup);
                    if (!permissions.equals(Set.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE)))
                        throw new AssertionError("Backup permissions are not 0600");
                } else if (!"ACTIVE".equals(migrationStatus) || taskBatches != 0) {
                    throw new AssertionError("Task activation did not reconcile");
                }
                System.out.println("PASS: public task migration command " + scenario);
            } catch (Throwable error) { error.printStackTrace(); Runtime.getRuntime().halt(1); }
        }));
        Main.main(commandArgs(activating, approvedShared));
        throw new AssertionError("One-shot migration command did not exit");
    }

    private static String[] commandArgs(boolean activating, boolean approvedShared) {
        String command = activating ? "activate-tasks" : "migrate-tasks";
        return approvedShared ? new String[] { command, "--approval-ref", "test-approval-reference" }
            : new String[] { command };
    }
}

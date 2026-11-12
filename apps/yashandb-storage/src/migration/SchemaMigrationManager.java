package migration;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.regex.Pattern;

/** Owns discovery, compatibility checks, execution, and verification of schema migrations. */
public final class SchemaMigrationManager {
    private static final Pattern MIGRATION_FILE = Pattern.compile("^[0-9]{3}_[a-z0-9_]+\\.sql$");
    private static final Pattern MIGRATION_VERSION = Pattern.compile("^([0-9]{3})_[a-z0-9_]+$");
    private static final Pattern SIMPLE_INDEX = Pattern.compile(
        "(?is)^CREATE\\s+INDEX\\s+[A-Z0-9_]+\\s+ON\\s+([A-Z0-9_]+)\\s*\\(([^)]+)\\)$");
    private static final String MIGRATION_ALIASES_FILE = "migration-aliases.properties";

    private final Path sqlDirectory;

    public SchemaMigrationManager(Path sqlDirectory) {
        this.sqlDirectory = sqlDirectory.toAbsolutePath().normalize();
    }

    public void migrate(Connection connection) throws SQLException {
        List<Path> migrations = migrationFiles();
        Map<String, List<String>> aliases = migrationAliases(migrations);
        for (int index = 0; index < migrations.size(); index++) {
            Path file = migrations.get(index);
            String version = versionOf(file);
            String script = readSql(file);
            String checksum = sha256(script);
            boolean migrationTableExists = tableExists(connection, "KC_SCHEMA_MIGRATION");
            if (!migrationTableExists && index != 0) {
                throw new SQLException("首个迁移未创建 KC_SCHEMA_MIGRATION：" + migrations.get(0).getFileName());
            }
            if (migrationTableExists && migrationApplied(connection, version, checksum,
                aliases.getOrDefault(version, List.of()), true)) continue;
            try {
                executeSqlScript(connection, script, file.getFileName().toString());
                if (!tableExists(connection, "KC_SCHEMA_MIGRATION")) {
                    throw new SQLException("迁移未创建 KC_SCHEMA_MIGRATION：" + file.getFileName());
                }
                recordMigration(connection, version, checksum);
                connection.commit();
            } catch (SQLException error) {
                connection.rollback();
                throw error;
            }
        }
    }

    public void verify(Connection connection) throws SQLException {
        List<Path> migrations = migrationFiles();
        Map<String, List<String>> aliases = migrationAliases(migrations);
        boolean checksumMismatchFatal = checksumMismatchFatal();
        if (!tableExists(connection, "KC_SCHEMA_MIGRATION")) {
            throw new SQLException("数据库尚未初始化，请先执行 start.sh migrate");
        }
        for (Path file : migrations) {
            String version = versionOf(file);
            String checksum = sha256(readSql(file));
            if (!migrationApplied(connection, version, checksum, aliases.getOrDefault(version, List.of()), checksumMismatchFatal)) {
                throw new SQLException("存在待执行的数据库迁移，请先执行 start.sh migrate：" + version);
            }
        }
    }

    private boolean checksumMismatchFatal() throws SQLException {
        String policy = System.getenv().getOrDefault("YASDB_MIGRATION_CHECKSUM_POLICY", "warn").trim();
        if (policy.equalsIgnoreCase("strict")) return true;
        if (policy.equalsIgnoreCase("warn")) return false;
        throw new SQLException("YASDB_MIGRATION_CHECKSUM_POLICY 仅支持 warn 或 strict，当前值：" + policy);
    }

    private List<Path> migrationFiles() throws SQLException {
        try (var files = Files.list(sqlDirectory)) {
            List<Path> migrations = files.filter(Files::isRegularFile)
                .filter(file -> MIGRATION_FILE.matcher(file.getFileName().toString()).matches())
                .sorted(Comparator.comparing(file -> file.getFileName().toString()))
                .toList();
            if (migrations.isEmpty()) {
                throw new SQLException("数据库迁移目录中没有 NNN_*.sql 文件：" + sqlDirectory);
            }
            return migrations;
        } catch (IOException error) {
            throw new SQLException("读取数据库迁移目录失败：" + sqlDirectory, error);
        }
    }

    private String readSql(Path file) throws SQLException {
        try {
            return Files.readString(file, StandardCharsets.UTF_8);
        } catch (IOException error) {
            throw new SQLException("读取数据库迁移 SQL 失败：" + file, error);
        }
    }

    private Map<String, List<String>> migrationAliases(List<Path> migrations) throws SQLException {
        Path aliasesFile = sqlDirectory.resolve(MIGRATION_ALIASES_FILE);
        if (!Files.isRegularFile(aliasesFile)) return Map.of();
        Properties properties = new Properties();
        try (Reader reader = Files.newBufferedReader(aliasesFile, StandardCharsets.UTF_8)) {
            properties.load(reader);
        } catch (IOException error) {
            throw new SQLException("读取数据库迁移版本别名失败：" + aliasesFile, error);
        }
        Set<String> availableVersions = new LinkedHashSet<>();
        for (Path migration : migrations) availableVersions.add(versionOf(migration));
        Set<String> claimedAliases = new LinkedHashSet<>();
        Map<String, List<String>> aliases = new LinkedHashMap<>();
        for (String version : properties.stringPropertyNames().stream().sorted().toList()) {
            if (!availableVersions.contains(version)) {
                throw new SQLException("数据库迁移版本别名指向不存在的当前版本：" + version);
            }
            String versionNumber = migrationVersionNumber(version);
            List<String> legacyVersions = new ArrayList<>();
            for (String value : properties.getProperty(version, "").split(",")) {
                String legacyVersion = value.trim();
                if (legacyVersion.isEmpty()) continue;
                if (version.equals(legacyVersion)) {
                    throw new SQLException("数据库迁移版本别名不得指向自身：" + version);
                }
                if (!versionNumber.equals(migrationVersionNumber(legacyVersion))) {
                    throw new SQLException("数据库迁移版本别名的数字版本不一致：" + version + " -> " + legacyVersion);
                }
                if (!claimedAliases.add(legacyVersion)) {
                    throw new SQLException("数据库迁移历史版本被重复声明：" + legacyVersion);
                }
                legacyVersions.add(legacyVersion);
            }
            if (legacyVersions.isEmpty()) {
                throw new SQLException("数据库迁移版本别名不能为空：" + version);
            }
            aliases.put(version, List.copyOf(legacyVersions));
        }
        return Map.copyOf(aliases);
    }

    private static String versionOf(Path file) {
        return file.getFileName().toString().replaceFirst("\\.sql$", "");
    }

    private static String migrationVersionNumber(String version) throws SQLException {
        var matcher = MIGRATION_VERSION.matcher(version);
        if (!matcher.matches()) throw new SQLException("数据库迁移版本标识不合法：" + version);
        return matcher.group(1);
    }

    private boolean tableExists(Connection connection, String table) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT COUNT(*) FROM USER_TABLES WHERE TABLE_NAME = ?")) {
            query.setString(1, table);
            try (ResultSet result = query.executeQuery()) {
                result.next();
                return result.getLong(1) > 0;
            }
        }
    }

    private boolean migrationApplied(Connection connection, String version, String checksum, List<String> aliases,
        boolean checksumMismatchFatal) throws SQLException {
        List<String> candidates = new ArrayList<>();
        candidates.add(version);
        candidates.addAll(aliases);
        boolean applied = false;
        try (PreparedStatement query = connection.prepareStatement("SELECT CHECKSUM FROM KC_SCHEMA_MIGRATION WHERE VERSION_ID = ?")) {
            for (String candidate : candidates) {
                query.setString(1, candidate);
                try (ResultSet result = query.executeQuery()) {
                    if (!result.next()) continue;
                    String recordedChecksum = result.getString(1).trim();
                    if (!checksum.equals(recordedChecksum)) {
                        String message = "数据库迁移摘要不一致：" + candidate
                            + "（数据库=" + recordedChecksum + "，当前文件=" + checksum + "）";
                        if (checksumMismatchFatal) throw new SQLException(message);
                        System.err.println("警告：" + message
                            + "；当前策略为 warn，开发环境继续启动，执行 migrate 时仍会严格拒绝该冲突");
                    }
                    applied = true;
                }
            }
        }
        return applied;
    }

    private void executeSqlScript(Connection connection, String script, String filename) throws SQLException {
        List<String> statements = splitSqlStatements(script);
        if (statements.isEmpty()) throw new SQLException("数据库迁移脚本为空：" + filename);
        try (Statement statement = connection.createStatement()) {
            for (String sql : statements) {
                try {
                    statement.execute(sql);
                } catch (SQLException error) {
                    if (!error.getMessage().contains("YAS-02043") || !hasEquivalentIndex(connection, sql)) throw error;
                    System.err.println("迁移中的索引列已由等价索引覆盖，跳过重复建索引：" + filename);
                }
            }
        } catch (SQLException error) {
            throw new SQLException("执行数据库迁移失败：" + filename + "：" + error.getMessage(), error);
        }
    }

    private boolean hasEquivalentIndex(Connection connection, String sql) throws SQLException {
        var matcher = SIMPLE_INDEX.matcher(sql.trim());
        if (!matcher.matches()) return false;
        String table = matcher.group(1).toUpperCase();
        List<String> columns = List.of(matcher.group(2).toUpperCase().replace(" ", "").split(","));
        Map<String, List<String>> indexes = new LinkedHashMap<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT INDEX_NAME,COLUMN_NAME FROM USER_IND_COLUMNS WHERE TABLE_NAME=? " +
            "ORDER BY INDEX_NAME,COLUMN_POSITION")) {
            query.setString(1, table);
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) indexes.computeIfAbsent(rows.getString(1), ignored -> new ArrayList<>())
                    .add(rows.getString(2));
            }
        }
        return indexes.values().stream().anyMatch(columns::equals);
    }

    static List<String> splitSqlStatements(String script) throws SQLException {
        List<String> statements = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean singleQuoted = false;
        boolean doubleQuoted = false;
        boolean lineComment = false;
        boolean blockComment = false;
        for (int index = 0; index < script.length(); index++) {
            char ch = script.charAt(index);
            char next = index + 1 < script.length() ? script.charAt(index + 1) : '\0';
            if (lineComment) {
                if (ch == '\n') { lineComment = false; current.append(ch); }
                continue;
            }
            if (blockComment) {
                if (ch == '*' && next == '/') { blockComment = false; index++; }
                continue;
            }
            if (!singleQuoted && !doubleQuoted && ch == '-' && next == '-') { lineComment = true; index++; continue; }
            if (!singleQuoted && !doubleQuoted && ch == '/' && next == '*') { blockComment = true; index++; continue; }
            if (!doubleQuoted && ch == '\'' && (index == 0 || script.charAt(index - 1) != '\\')) {
                if (singleQuoted && next == '\'') { current.append(ch).append(next); index++; continue; }
                singleQuoted = !singleQuoted;
            } else if (!singleQuoted && ch == '"') {
                doubleQuoted = !doubleQuoted;
            }
            if (!singleQuoted && !doubleQuoted && ch == ';') {
                String sql = current.toString().trim();
                if (!sql.isEmpty()) statements.add(sql);
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }
        if (singleQuoted || doubleQuoted || blockComment) throw new SQLException("数据库迁移 SQL 存在未闭合字符串或注释");
        String tail = current.toString().trim();
        if (!tail.isEmpty()) statements.add(tail);
        return statements;
    }

    private void recordMigration(Connection connection, String version, String checksum) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT CHECKSUM FROM KC_SCHEMA_MIGRATION WHERE VERSION_ID = ?")) {
            query.setString(1, version);
            try (ResultSet result = query.executeQuery()) {
                if (result.next()) {
                    String recordedChecksum = result.getString(1).trim();
                    if (!checksum.equals(recordedChecksum)) {
                        throw new SQLException("数据库迁移摘要不一致：" + version
                            + "（数据库=" + recordedChecksum + "，当前文件=" + checksum + "）");
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

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }
}

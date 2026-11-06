package migration;

import java.lang.reflect.Proxy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;

public final class MigrationExecutionCheck {
    private static final class Database {
        final Map<String, String> applied = new HashMap<>();
        boolean tableExists;
        int commits;
        int rollbacks;
        int statements;
        int insertAttempts;
        String concurrentChecksum;
        boolean failMigrationInsert;

        @SuppressWarnings("unchecked")
        <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
            return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler);
        }

        ResultSet rows(Object[][] values) {
            int[] position = {-1};
            return proxy(ResultSet.class, (object, method, args) -> {
                if (method.getName().equals("next")) return ++position[0] < values.length;
                if (method.getName().equals("getLong")) return ((Number) values[position[0]][(Integer) args[0] - 1]).longValue();
                if (method.getName().equals("getString")) return String.valueOf(values[position[0]][(Integer) args[0] - 1]);
                return null;
            });
        }

        PreparedStatement query(String sql) {
            Map<Integer, Object> binds = new HashMap<>();
            return proxy(PreparedStatement.class, (object, method, args) -> {
                if (method.getName().equals("setString")) { binds.put((Integer) args[0], args[1]); return null; }
                if (method.getName().equals("executeQuery")) {
                    if (sql.contains("USER_TABLES")) return rows(new Object[][]{{tableExists ? 1L : 0L}});
                    if (sql.contains("SELECT CHECKSUM")) {
                        String checksum = applied.get(binds.get(1));
                        return rows(checksum == null ? new Object[0][] : new Object[][]{{checksum}});
                    }
                    throw new AssertionError("unexpected query: " + sql);
                }
                if (method.getName().equals("executeUpdate")) {
                    if (!sql.startsWith("INSERT INTO KC_SCHEMA_MIGRATION")) throw new AssertionError(sql);
                    insertAttempts++;
                    if (failMigrationInsert) throw new SQLException("fixture insert failed");
                    applied.put(String.valueOf(binds.get(1)), String.valueOf(binds.get(2)));
                    return 1;
                }
                return null;
            });
        }

        Connection connection() {
            Statement statement = proxy(Statement.class, (object, method, args) -> {
                if (method.getName().equals("execute")) {
                    String sql = String.valueOf(args[0]);
                    statements++;
                    if (sql.equals("FAIL")) throw new SQLException("fixture SQL failed");
                    if (sql.contains("KC_SCHEMA_MIGRATION")) {
                        tableExists = true;
                        if (concurrentChecksum != null) applied.put("001_init", concurrentChecksum);
                    }
                    return true;
                }
                return null;
            });
            return proxy(Connection.class, (object, method, args) -> {
                if (method.getName().equals("prepareStatement")) return query(String.valueOf(args[0]));
                if (method.getName().equals("createStatement")) return statement;
                if (method.getName().equals("commit")) { commits++; return null; }
                if (method.getName().equals("rollback")) { rollbacks++; return null; }
                return null;
            });
        }
    }

    public static void main(String[] args) throws Exception {
        Path directory = Path.of(args[0]);
        Files.createDirectories(directory);
        Path first = directory.resolve("001_init.sql");
        Path second = directory.resolve("002_add.sql");
        Path failing = directory.resolve("003_fail.sql");
        Files.deleteIfExists(second);
        Files.deleteIfExists(failing);
        Files.deleteIfExists(directory.resolve("migration-aliases.properties"));
        Files.writeString(first, "CREATE TABLE KC_SCHEMA_MIGRATION (VERSION_ID VARCHAR(128));");

        Database database = new Database();
        Connection connection = database.connection();
        SchemaMigrationManager manager = new SchemaMigrationManager(directory);
        manager.migrate(connection);
        manager.verify(connection);
        if (database.commits != 1 || database.applied.size() != 1) throw new AssertionError("initial migration was not recorded");
        manager.migrate(connection);
        if (database.commits != 1 || database.statements != 1) throw new AssertionError("applied migration ran again");

        Files.writeString(second, "CREATE TABLE T (ID INT);");
        try {
            manager.verify(connection);
            throw new AssertionError("pending migration was accepted");
        } catch (SQLException expected) {
            if (!expected.getMessage().contains("待执行")) throw expected;
        }
        manager.migrate(connection);
        manager.verify(connection);
        if (database.commits != 2 || database.applied.size() != 2) throw new AssertionError("second migration was not recorded");

        Files.writeString(failing, "FAIL;");
        try {
            manager.migrate(connection);
            throw new AssertionError("failing migration was accepted");
        } catch (SQLException expected) {
            if (!expected.getMessage().contains("执行数据库迁移失败")) throw expected;
        }
        if (database.rollbacks != 1 || database.applied.size() != 2) throw new AssertionError("failed migration was committed");
        Files.delete(failing);
        String originalChecksum = database.applied.remove("001_init");
        database.applied.put("001_legacy", originalChecksum);
        Path aliases = directory.resolve("migration-aliases.properties");
        Files.writeString(aliases, "001_init=001_legacy\n");
        manager.verify(connection);
        int beforeAliases = database.statements;
        manager.migrate(connection);
        if (database.statements != beforeAliases || database.applied.containsKey("001_init"))
            throw new AssertionError("historical alias reran an applied migration");
        for (String[] invalid : new String[][]{
                {"009_unknown=009_legacy\n", "指向不存在"},
                {"001_init=001_init\n", "不得指向自身"},
                {"001_init=002_legacy\n", "数字版本不一致"},
                {"001_init=  \n", "不能为空"}}) {
            Files.writeString(aliases, invalid[0]);
            try {
                manager.verify(connection);
                throw new AssertionError("invalid alias was accepted: " + invalid[0]);
            } catch (SQLException expected) {
                if (!expected.getMessage().contains(invalid[1])) throw expected;
            }
        }
        Path sameNumber = directory.resolve("001_other.sql");
        Files.writeString(sameNumber, "CREATE TABLE T2 (ID INT);");
        Files.writeString(aliases, "001_init=001_legacy\n001_other=001_legacy\n");
        try {
            manager.verify(connection);
            throw new AssertionError("duplicate legacy alias was accepted");
        } catch (SQLException expected) {
            if (!expected.getMessage().contains("重复声明")) throw expected;
        }
        Files.delete(sameNumber);
        Files.writeString(aliases, "001_init=001_legacy\n");
        manager.verify(connection);
        database.applied.put("001_legacy", "outdated-checksum");
        manager.verify(connection);
        int beforeMismatch = database.statements;
        int commitsBeforeMismatch = database.commits;
        try {
            manager.migrate(connection);
            throw new AssertionError("migrate accepted a checksum mismatch");
        } catch (SQLException expected) {
            if (!expected.getMessage().contains("迁移摘要不一致")) throw expected;
        }
        if (database.statements != beforeMismatch || database.commits != commitsBeforeMismatch)
            throw new AssertionError("checksum mismatch executed SQL or committed");
        database.applied.put("001_legacy", originalChecksum);
        manager.verify(connection);
        Path emptyDirectory = directory.resolve("empty-directory");
        Files.createDirectories(emptyDirectory);
        try {
            new SchemaMigrationManager(emptyDirectory).migrate(new Database().connection());
            throw new AssertionError("empty migration directory was accepted");
        } catch (SQLException expected) {
            if (!expected.getMessage().contains("没有 NNN_*.sql")) throw expected;
        }
        try {
            new SchemaMigrationManager(directory.resolve("missing-directory")).verify(new Database().connection());
            throw new AssertionError("missing migration directory was accepted");
        } catch (SQLException expected) {
            if (!expected.getMessage().contains("读取数据库迁移目录失败")) throw expected;
        }
        try {
            manager.verify(new Database().connection());
            throw new AssertionError("uninitialized database was accepted");
        } catch (SQLException expected) {
            if (!expected.getMessage().contains("数据库尚未初始化")) throw expected;
        }
        Path noTableDirectory = directory.resolve("no-table-directory");
        Files.createDirectories(noTableDirectory);
        Files.writeString(noTableDirectory.resolve("001_unrelated.sql"), "CREATE TABLE OTHER_TABLE (ID INT);");
        Database noTable = new Database();
        try {
            new SchemaMigrationManager(noTableDirectory).migrate(noTable.connection());
            throw new AssertionError("first migration without migration table was accepted");
        } catch (SQLException expected) {
            if (!expected.getMessage().contains("迁移未创建 KC_SCHEMA_MIGRATION")) throw expected;
        }
        if (noTable.rollbacks != 1 || !noTable.applied.isEmpty()) throw new AssertionError("no-table migration changed state");
        Path blankDirectory = directory.resolve("blank-script-directory");
        Files.createDirectories(blankDirectory);
        Files.writeString(blankDirectory.resolve("001_blank.sql"), "-- only a comment\n");
        Database blank = new Database();
        try {
            new SchemaMigrationManager(blankDirectory).migrate(blank.connection());
            throw new AssertionError("empty SQL migration was accepted");
        } catch (SQLException expected) {
            if (!expected.getMessage().contains("迁移脚本为空")) throw expected;
        }
        if (blank.rollbacks != 1 || !blank.applied.isEmpty()) throw new AssertionError("blank migration changed state");
        for (String scenario : new String[]{"matching", "mismatched", "insert-failure"}) {
            Path raceDirectory = directory.resolve("record-" + scenario);
            Files.createDirectories(raceDirectory);
            Files.writeString(raceDirectory.resolve("001_init.sql"), Files.readString(first));
            Database race = new Database();
            if (scenario.equals("matching")) race.concurrentChecksum = originalChecksum;
            if (scenario.equals("mismatched")) race.concurrentChecksum = "other-checksum";
            if (scenario.equals("insert-failure")) race.failMigrationInsert = true;
            try {
                new SchemaMigrationManager(raceDirectory).migrate(race.connection());
                if (!scenario.equals("matching")) throw new AssertionError(scenario + " was accepted");
            } catch (SQLException expected) {
                if (scenario.equals("matching")) throw expected;
                String reason = scenario.equals("mismatched") ? "迁移摘要不一致" : "fixture insert failed";
                if (!expected.getMessage().contains(reason)) throw expected;
            }
            if (race.statements != 1) throw new AssertionError(scenario + " did not execute its SQL");
            if (scenario.equals("matching")) {
                if (race.commits != 1 || race.rollbacks != 0 || race.insertAttempts != 0)
                    throw new AssertionError("matching concurrent record was inserted again");
            } else if (race.commits != 0 || race.rollbacks != 1
                    || race.insertAttempts != (scenario.equals("insert-failure") ? 1 : 0)) {
                throw new AssertionError(scenario + " did not roll back correctly");
            }
        }
        System.out.println("PASS: migration application, idempotency, verification and rollback");
    }
}

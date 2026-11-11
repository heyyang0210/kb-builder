package migration;

import java.sql.SQLException;
import java.util.List;

public final class MigrationSqlParserCheck {
    private static void check(String sql, List<String> expected) throws SQLException {
        List<String> actual = SchemaMigrationManager.splitSqlStatements(sql);
        if (!expected.equals(actual)) throw new AssertionError(actual + " != " + expected);
    }

    private static void reject(String sql) throws SQLException {
        try {
            SchemaMigrationManager.splitSqlStatements(sql);
            throw new AssertionError("accepted unfinished SQL: " + sql);
        } catch (SQLException expected) {
            if (!expected.getMessage().contains("未闭合")) throw expected;
        }
    }

    public static void main(String[] args) throws SQLException {
        check("-- header\nCREATE TABLE T (ID INTEGER); /* separator */ INSERT INTO T VALUES (1);",
            List.of("CREATE TABLE T (ID INTEGER)", "INSERT INTO T VALUES (1)"));
        check("INSERT INTO T VALUES ('a;''b', \"semi;column\"); SELECT 1",
            List.of("INSERT INTO T VALUES ('a;''b', \"semi;column\")", "SELECT 1"));
        check("'leading; value'; SELECT '-- /* remain quoted'",
            List.of("'leading; value'", "SELECT '-- /* remain quoted'"));
        check("SELECT 'escaped \\' quote; still string';", List.of("SELECT 'escaped \\' quote; still string'"));
        check("; -- only comment", List.of());
        reject("SELECT 'unfinished");
        reject("SELECT \"unfinished");
        reject("SELECT 1 /* unfinished");
        reject("SELECT 1 /* unfinished *");
        System.out.println("PASS: migration SQL comments, quotes, delimiters and unfinished input");
    }
}

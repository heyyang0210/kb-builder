import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Blob;
import java.sql.Clob;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Types;
import java.util.List;
import java.util.regex.Pattern;

public final class SyncYashanDbSchemaData {
    private static final Pattern SAFE_IDENTIFIER = Pattern.compile("[A-Z][A-Z0-9_]*");

    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("用法：SyncYashanDbSchemaData <table-list-file>");
        List<String> tables = Files.readAllLines(Path.of(args[0])).stream().map(String::trim).filter(value -> !value.isEmpty()).toList();
        for (String table : tables) {
            if (!SAFE_IDENTIFIER.matcher(table).matches()) throw new IllegalArgumentException("非法表名：" + table);
        }
        try (
            Connection source = DriverManager.getConnection(required("SYNC_SOURCE_JDBC_URL"), required("SYNC_SOURCE_USERNAME"), required("SYNC_SOURCE_PASSWORD"));
            Connection target = DriverManager.getConnection(required("SYNC_TARGET_JDBC_URL"), required("SYNC_TARGET_USERNAME"), required("SYNC_TARGET_PASSWORD"))
        ) {
            target.setAutoCommit(false);
            for (String table : tables) copyTable(source, target, table);
        }
    }

    private static void copyTable(Connection source, Connection target, String table) throws Exception {
        String selectSql = "SELECT * FROM \"" + table + "\"";
        try (PreparedStatement select = source.prepareStatement(selectSql); ResultSet rows = select.executeQuery()) {
            ResultSetMetaData metadata = rows.getMetaData();
            int columns = metadata.getColumnCount();
            StringBuilder insertSql = new StringBuilder("INSERT INTO \"").append(table).append("\" (");
            for (int index = 1; index <= columns; index++) {
                if (index > 1) insertSql.append(',');
                insertSql.append('\"').append(metadata.getColumnName(index)).append('\"');
            }
            insertSql.append(") VALUES (").append("?,".repeat(columns));
            insertSql.setLength(insertSql.length() - 1);
            insertSql.append(')');
            int copied = 0;
            try (PreparedStatement insert = target.prepareStatement(insertSql.toString())) {
                while (rows.next()) {
                    for (int index = 1; index <= columns; index++) bind(rows, insert, metadata.getColumnType(index), index);
                    insert.executeUpdate();
                    copied++;
                }
                target.commit();
                System.out.println(table + "\t" + copied);
            } catch (Exception error) {
                target.rollback();
                throw error;
            }
        }
    }

    private static void bind(ResultSet rows, PreparedStatement insert, int type, int index) throws Exception {
        if (type == Types.CLOB || type == Types.NCLOB || type == Types.LONGVARCHAR || type == Types.LONGNVARCHAR) {
            Clob value = rows.getClob(index);
            if (value == null) insert.setNull(index, type);
            else insert.setCharacterStream(index, value.getCharacterStream());
            return;
        }
        if (type == Types.BLOB || type == Types.BINARY || type == Types.VARBINARY || type == Types.LONGVARBINARY) {
            Blob value = rows.getBlob(index);
            if (value == null) insert.setNull(index, type);
            else insert.setBinaryStream(index, value.getBinaryStream());
            return;
        }
        Object value = rows.getObject(index);
        if (value == null) insert.setNull(index, type);
        else insert.setObject(index, value);
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("缺少环境变量：" + name);
        return value;
    }
}

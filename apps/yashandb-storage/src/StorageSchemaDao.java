import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/** JDBC schema DAO: keeps catalog checks and DDL execution out of the HTTP entry point. */
final class StorageSchemaDao {
    private StorageSchemaDao() {}

    static void createIndexIfMissing(Connection connection, String index, String ddl) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT COUNT(*) FROM USER_INDEXES WHERE INDEX_NAME = ?")) {
            query.setString(1, index);
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
}

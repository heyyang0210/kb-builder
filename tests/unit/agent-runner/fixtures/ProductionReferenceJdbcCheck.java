import java.io.StringReader;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Constructor;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.HexFormat;

public final class ProductionReferenceJdbcCheck {
    private static final String NAMESPACE = "handbook-production";
    private static final String KEY = "state";

    public static void main(String[] args) throws Exception {
        if (!"test_hy".equalsIgnoreCase(System.getenv("YASDB_USERNAME"))) throw new IllegalStateException("仅允许 test_hy");
        Class.forName("com.yashandb.jdbc.Driver");
        try (Connection connection = DriverManager.getConnection(System.getenv("YASDB_JDBC_URL"), System.getenv("YASDB_USERNAME"), System.getenv("YASDB_PASSWORD"))) {
            connection.setAutoCommit(false);
            try {
                String active = activeOutline(connection);
                String deleted = "outline_e2e_missing_reference";
                long revision = seed(connection, payload(deleted, null), true);
                Method upsert = Main.class.getDeclaredMethod("upsertRecord", Connection.class, String.class, String.class, String.class, String.class, Long.class);
                upsert.setAccessible(true);
                Constructor<Main> constructor = Main.class.getDeclaredConstructor();
                constructor.setAccessible(true);
                Main main = constructor.newInstance();
                revision = write(upsert, main, connection, payload(deleted, active), revision);
                if (!readPayload(connection).equals(payload(deleted, active))) throw new AssertionError("历史引用被改动");
                expectRejected(upsert, main, connection, payload(deleted, deleted), revision);
                expectRejected(upsert, main, connection, payload(deleted, active).replace("历史正文", "历史改动"), revision);
                if (!readPayload(connection).equals(payload(deleted, active))) throw new AssertionError("被拒绝的写入改变了聚合");
                System.out.println("PASS: test_hy JDBC unchanged history, active new job, invalid new/changed references, rollback");
            } finally { connection.rollback(); }
        }
    }

    private static String activeOutline(Connection connection) throws Exception {
        try (PreparedStatement query = connection.prepareStatement("SELECT SOURCE_REF FROM KC_MANUAL_OUTLINE_VERSION WHERE DELETED_AT IS NULL AND SOURCE_REF IS NOT NULL AND ROWNUM=1"); ResultSet row = query.executeQuery()) {
            if (!row.next()) throw new IllegalStateException("test_hy 缺少有效大纲版本");
            return row.getString(1);
        }
    }

    private static long seed(Connection connection, String payload, boolean existingExpected) throws Exception {
        long current = 0;
        try (PreparedStatement query = connection.prepareStatement("SELECT REVISION FROM KC_RECORD WHERE NAMESPACE=? AND RECORD_KEY=? FOR UPDATE")) {
            query.setString(1, NAMESPACE); query.setString(2, KEY);
            try (ResultSet row = query.executeQuery()) { if (row.next()) current = row.getLong(1); }
        }
        if (existingExpected && current == 0) throw new IllegalStateException("test_hy 缺少生产聚合");
        try (PreparedStatement update = connection.prepareStatement("UPDATE KC_RECORD SET PAYLOAD=?, PAYLOAD_SHA256=?, REVISION=?, DELETED='N' WHERE NAMESPACE=? AND RECORD_KEY=?")) {
            update.setCharacterStream(1, new StringReader(payload)); update.setString(2, digest(payload)); update.setLong(3, current + 1);
            update.setString(4, NAMESPACE); update.setString(5, KEY);
            if (update.executeUpdate() != 1) throw new AssertionError("聚合准备失败");
        }
        return current + 1;
    }

    private static long write(Method upsert, Main main, Connection connection, String payload, long revision) throws Exception {
        return (Long) upsert.invoke(main, connection, NAMESPACE, KEY, payload, digest(payload), revision);
    }

    private static void expectRejected(Method upsert, Main main, Connection connection, String payload, long revision) throws Exception {
        try { write(upsert, main, connection, payload, revision); throw new AssertionError("坏引用被接受"); }
        catch (InvocationTargetException error) {
            if (!"OutlineReferenceRejected".equals(error.getCause().getClass().getSimpleName())) throw error;
        }
    }

    private static String payload(String historical, String newId) {
        return "{\"drafts\":{\"old\":{\"outlineVersionId\":\"" + historical + "\",\"markdown\":\"历史正文\"}},\"aiJobs\":"
            + (newId == null ? "{}" : "{\"new\":{\"outlineVersionId\":\"" + newId + "\",\"status\":\"queued\"}}") + "}";
    }

    private static String readPayload(Connection connection) throws Exception {
        try (PreparedStatement query = connection.prepareStatement("SELECT PAYLOAD FROM KC_RECORD WHERE NAMESPACE=? AND RECORD_KEY=?")) {
            query.setString(1, NAMESPACE); query.setString(2, KEY);
            try (ResultSet row = query.executeQuery()) { row.next(); return row.getClob(1).getSubString(1, (int) row.getClob(1).length()); }
        }
    }

    private static String digest(String value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    }
}

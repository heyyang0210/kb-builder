import java.io.Reader;
import java.io.StringWriter;
import java.sql.Clob;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

/** 手册列表只读投影；集中维护查询、结果行映射和数据库分段计时。 */
final class HandbookProjectionRepository {
    static final String LIST_SQL = "SELECT M.MANUAL_ID, M.MANUAL_CODE, M.MANUAL_NAME, M.PRODUCT_ID, M.PRODUCT_NAME, M.ORG_UNIT_ID, "
        + "COALESCE(V.SOURCE_REF, TO_CHAR(O.CURRENT_OUTLINE_VERSION_ID)) AS CURRENT_OUTLINE_EXTERNAL_ID, "
        + "M.STATE, V.STATE AS CURRENT_OUTLINE_STATE, M.ARCHIVED_AT, M.ROW_VERSION, M.SUMMARY, M.MANUAL_KIND, M.IS_EXTERNALLY_VISIBLE, "
        + "M.CREATED_AT, M.UPDATED_AT, P.PRINCIPAL_ID AS PRIMARY_OWNER_ID, P.PRINCIPAL_NAME AS PRIMARY_OWNER_NAME, "
        + "D.PRINCIPAL_ID AS DEPUTY_OWNER_ID, D.PRINCIPAL_NAME AS DEPUTY_OWNER_NAME "
        + "FROM KC_MANUAL M LEFT JOIN KC_MANUAL_OUTLINE O ON O.MANUAL_ID = M.MANUAL_ID "
        + "LEFT JOIN KC_MANUAL_OUTLINE_VERSION V ON V.OUTLINE_VERSION_ID = O.CURRENT_OUTLINE_VERSION_ID "
        + "LEFT JOIN KC_MANUAL_OWNER P ON P.MANUAL_ID = M.MANUAL_ID AND P.OWNER_ROLE = 'PRIMARY' "
        + "LEFT JOIN KC_MANUAL_OWNER D ON D.MANUAL_ID = M.MANUAL_ID AND D.OWNER_ROLE = 'DEPUTY' "
        + "ORDER BY M.CREATED_AT, M.MANUAL_ID";

    Projection list(Connection connection) throws SQLException {
        long queryStarted = System.nanoTime();
        try (PreparedStatement statement = connection.prepareStatement(LIST_SQL); ResultSet result = statement.executeQuery()) {
            long queryCompleted = System.nanoTime();
            List<HandbookRow> rows = new ArrayList<>();
            while (result.next()) {
                rows.add(new HandbookRow(
                    result.getLong(1), result.getString(2), result.getString(3), result.getLong(4), result.getString(5),
                    result.getString(6), result.getString(7), result.getString(8), result.getString(9), result.getTimestamp(10),
                    result.getLong(11), readClobOrNull(result.getClob(12)), result.getString(13), "Y".equals(result.getString(14)),
                    result.getTimestamp(15), result.getTimestamp(16), result.getString(17), result.getString(18),
                    result.getString(19), result.getString(20)
                ));
            }
            return new Projection(rows, (queryCompleted - queryStarted) / 1e6, (System.nanoTime() - queryCompleted) / 1e6);
        } catch (Exception error) {
            if (error instanceof SQLException sqlError) throw sqlError;
            throw new SQLException("读取手册投影失败", error);
        }
    }

    private static String readClobOrNull(Clob clob) throws Exception {
        if (clob == null) return null;
        try (Reader reader = clob.getCharacterStream(); StringWriter writer = new StringWriter()) {
            reader.transferTo(writer);
            return writer.toString();
        }
    }

    record Projection(List<HandbookRow> rows, double queryMs, double mappingMs) {}

    record HandbookRow(
        long manualId, String manualCode, String manualName, long productId, String productName, String orgUnitId,
        String currentOutlineExternalId, String state, String currentOutlineState, Timestamp archivedAt, long rowVersion, String summary,
        String manualKind, boolean externallyVisible, Timestamp createdAt, Timestamp updatedAt,
        String primaryOwnerId, String primaryOwnerName, String deputyOwnerId, String deputyOwnerName
    ) {}
}

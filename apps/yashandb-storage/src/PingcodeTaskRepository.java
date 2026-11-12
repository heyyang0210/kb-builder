import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.LinkedHashSet;
import java.util.UUID;

/** Storage operations for Pingcode sources and immutable page snapshots. */
final class PingcodeTaskRepository {
    List<Map<String, Object>> listSources(Connection connection) throws SQLException {
        List<Map<String, Object>> items = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT SOURCE_ID,SOURCE_NAME,SOURCE_TYPE,SOURCE_URL,CONNECTION_ID,SOURCE_STATE,ROW_VERSION," +
            "LAST_CONFIRMED_RUN,CREATED_BY,CREATED_AT,UPDATED_AT FROM KC_PINGCODE_SOURCE ORDER BY UPDATED_AT DESC")) {
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) items.add(source(rows));
            }
        }
        return items;
    }

    Map<String, Object> findSource(Connection connection, String id) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT SOURCE_ID,SOURCE_NAME,SOURCE_TYPE,SOURCE_URL,CONNECTION_ID,SOURCE_STATE,ROW_VERSION," +
            "LAST_CONFIRMED_RUN,CREATED_BY,CREATED_AT,UPDATED_AT FROM KC_PINGCODE_SOURCE WHERE SOURCE_ID=?")) {
            query.setString(1, id);
            try (ResultSet rows = query.executeQuery()) { return rows.next() ? source(rows) : null; }
        }
    }

    Map<String, Object> createSource(Connection connection, String name, String type, String url,
                                      String connectionId, String actor) throws SQLException {
        if (name == null || name.isBlank() || name.length() > 255 || url == null || url.length() > 2000
            || !"REQUIREMENT".equals(type) && !"TICKET".equals(type)
            || connectionId == null || connectionId.isBlank() || actor == null || actor.isBlank()
            || !validSourceUrl(type, url)) {
            throw new SQLException("PINGCODE_SOURCE_INVALID");
        }
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT SOURCE_ID FROM KC_PINGCODE_SOURCE WHERE CONNECTION_ID=? AND SOURCE_TYPE=? AND SOURCE_URL=?")) {
            query.setString(1, connectionId); query.setString(2, type); query.setString(3, url);
            try (ResultSet rows = query.executeQuery()) {
                if (rows.next()) throw new SQLException("PINGCODE_SOURCE_CONFLICT");
            }
        }
        String id = UUID.randomUUID().toString();
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_PINGCODE_SOURCE (SOURCE_ID,SOURCE_NAME,SOURCE_TYPE,SOURCE_URL,CONNECTION_ID,CREATED_BY)" +
            " VALUES (?,?,?,?,?,?)")) {
            insert.setString(1, id); insert.setString(2, name); insert.setString(3, type);
            insert.setString(4, url); insert.setString(5, connectionId); insert.setString(6, actor);
            insert.executeUpdate();
        }
        return findSource(connection, id);
    }

    Map<String, Object> createRun(Connection connection, String sourceId, long revision, String actor)
        throws SQLException {
        Map<String, Object> source = findSource(connection, sourceId);
        if (source == null) throw new SQLException("PINGCODE_SOURCE_NOT_FOUND");
        if (!"ACTIVE".equals(source.get("state"))) throw new SQLException("PINGCODE_SOURCE_DISABLED");
        if (((Number) source.get("revision")).longValue() != revision) throw new SQLException("ROW_VERSION_CONFLICT");
        String id = UUID.randomUUID().toString();
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_PINGCODE_RUN (RUN_ID,SOURCE_ID,SOURCE_REVISION,RUN_STATUS,CREATED_BY)" +
            " VALUES (?,?,?,'COLLECTING',?)")) {
            insert.setString(1, id); insert.setString(2, sourceId); insert.setLong(3, revision);
            insert.setString(4, actor); insert.executeUpdate();
        }
        return findRun(connection, id);
    }

    List<Map<String, Object>> listRuns(Connection connection, String sourceId) throws SQLException {
        if (findSource(connection, sourceId) == null) throw new SQLException("PINGCODE_SOURCE_NOT_FOUND");
        List<Map<String, Object>> result = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT RUN_ID FROM KC_PINGCODE_RUN WHERE SOURCE_ID=? ORDER BY CREATED_AT DESC " +
            "FETCH NEXT 20 ROWS ONLY")) {
            query.setString(1, sourceId);
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) result.add(findRun(connection, rows.getString(1)));
            }
        }
        return result;
    }

    Map<String, Object> findRun(Connection connection, String id) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT RUN_ID,SOURCE_ID,SOURCE_REVISION,RUN_STATUS,SOURCE_VERSION,CRITERIA_SHA256," +
            "PREVIEW_DIGEST,TASK_REVISION_DIGEST,PAGE_COUNT,ROW_COUNT,SR_COUNT,NEW_COUNT,CHANGED_COUNT,UNCHANGED_COUNT," +
            "REMOVED_COUNT,IR_COUNT,UNLINKED_IR_COUNT,PAGES_READ,ROWS_READ,ERROR_CODE,CREATED_BY," +
            "CREATED_AT,FINISHED_AT,CONFIRMED_AT FROM KC_PINGCODE_RUN WHERE RUN_ID=?")) {
            query.setString(1, id);
            try (ResultSet rows = query.executeQuery()) {
                if (!rows.next()) return null;
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", rows.getString(1)); item.put("sourceId", rows.getString(2));
                item.put("sourceRevision", rows.getLong(3)); item.put("status", rows.getString(4));
                item.put("sourceVersion", rows.getString(5)); item.put("criteriaSha256", rows.getString(6));
                item.put("digest", rows.getString(7)); item.put("taskRevisionDigest", rows.getString(8));
                item.put("pageCount", rows.getObject(9)); item.put("rowCount", rows.getObject(10));
                item.put("srCount", rows.getObject(11)); item.put("newCount", rows.getObject(12));
                item.put("changedCount", rows.getObject(13)); item.put("unchangedCount", rows.getObject(14));
                item.put("removedCount", rows.getObject(15)); item.put("irCount", rows.getObject(16));
                item.put("unlinkedIrCount", rows.getObject(17)); item.put("pagesRead", rows.getLong(18));
                item.put("rowsRead", rows.getLong(19)); item.put("errorCode", rows.getString(20));
                item.put("createdBy", rows.getString(21)); item.put("createdAt", timestamp(rows, 22));
                item.put("finishedAt", timestamp(rows, 23)); item.put("confirmedAt", timestamp(rows, 24));
                return item;
            }
        }
    }

    void stagePage(Connection connection, String runId, Map<String, Object> page, String criteriaSha256)
        throws SQLException {
        Map<String, Object> run = findRun(connection, runId);
        if (run == null) throw new SQLException("PINGCODE_RUN_NOT_FOUND");
        if (!"COLLECTING".equals(run.get("status"))) throw new SQLException("PINGCODE_RUN_NOT_COLLECTING");
        Map<String, Object> source = findSource(connection, (String) run.get("sourceId"));
        int pageIndex = number(page.get("pageIndex"));
        int reportedPageCount = number(page.get("pageCount"));
        int rowCount = number(page.get("count"));
        int pageCount = Math.max(1, reportedPageCount);
        if (pageIndex != ((Number) run.get("pagesRead")).intValue() || reportedPageCount < 0 || rowCount < 0
            || page.get("items") instanceof List<?> == false || criteriaSha256 == null
            || !criteriaSha256.matches("[a-f0-9]{64}") || source == null
            || !("REQUIREMENT".equals(source.get("type")) && "requirement".equals(page.get("sourceType"))
                || "TICKET".equals(source.get("type")) && "ticket".equals(page.get("sourceType")))) {
            throw new SQLException("PINGCODE_PAGE_INVALID");
        }
        if (run.get("pageCount") != null && (((Number) run.get("pageCount")).intValue() != pageCount
            || ((Number) run.get("rowCount")).intValue() != rowCount
            || !equal((String) run.get("sourceVersion"), string(page.get("sourceVersion")))
            || !equal((String) run.get("criteriaSha256"), criteriaSha256))) {
            throw new SQLException("PINGCODE_SOURCE_CHANGED");
        }
        List<?> rows = (List<?>) page.get("items");
        if (reportedPageCount == 0 && (rowCount != 0 || !rows.isEmpty())) {
            throw new SQLException("PINGCODE_PAGE_INVALID");
        }
        if (pageIndex >= pageCount || ((Number) run.get("rowsRead")).longValue() + rows.size() > rowCount) {
            throw new SQLException("PINGCODE_PAGE_INVALID");
        }
        String type = string(page.get("sourceType"));
        for (Object value : rows) {
            if (!(value instanceof Map<?, ?> raw)) throw new SQLException("PINGCODE_PAGE_INVALID");
            @SuppressWarnings("unchecked") Map<String, Object> row = (Map<String, Object>) raw;
            if ("requirement".equals(type)) {
                if (!(row.get("workItems") instanceof List<?> works)) throw new SQLException("PINGCODE_RELATION_INVALID");
                stageIr(connection, runId, row, works.size());
                for (Object work : works) {
                    if (!(work instanceof Map<?, ?> item)) throw new SQLException("PINGCODE_RELATION_INVALID");
                    @SuppressWarnings("unchecked") Map<String, Object> sr = (Map<String, Object>) item;
                    stageItem(connection, runId, sr, string(row.get("ir")));
                }
            } else if ("ticket".equals(type)) stageItem(connection, runId, row, null);
            else throw new SQLException("PINGCODE_SOURCE_TYPE_INVALID");
        }
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_PINGCODE_RUN SET SOURCE_VERSION=?,CRITERIA_SHA256=?,PAGE_COUNT=?,ROW_COUNT=?," +
            "PAGES_READ=PAGES_READ+1,ROWS_READ=ROWS_READ+? WHERE RUN_ID=? AND RUN_STATUS='COLLECTING'")) {
            update.setString(1, string(page.get("sourceVersion"))); update.setString(2, criteriaSha256);
            update.setInt(3, pageCount); update.setInt(4, rowCount);
            update.setInt(5, rows.size()); update.setString(6, runId);
            if (update.executeUpdate() != 1) throw new SQLException("PINGCODE_RUN_CONFLICT");
        }
    }

    void finishRun(Connection connection, String runId, String digest) throws SQLException {
        Map<String, Object> run = findRun(connection, runId);
        if (run == null) throw new SQLException("PINGCODE_RUN_NOT_FOUND");
        if (!"COLLECTING".equals(run.get("status")) || run.get("pageCount") == null
            || ((Number) run.get("pageCount")).longValue() != ((Number) run.get("pagesRead")).longValue()
            || ((Number) run.get("rowCount")).longValue() != ((Number) run.get("rowsRead")).longValue() || digest == null
            || !digest.matches("[a-f0-9]{64}")) throw new SQLException("PINGCODE_RUN_INCOMPLETE");
        Map<String, Object> source = findSource(connection, (String) run.get("sourceId"));
        String previousRun = source == null ? null : (String) source.get("lastConfirmedRun");
        long srCount = count(connection, "SELECT COUNT(*) FROM KC_PINGCODE_SNAPSHOT WHERE RUN_ID=?", runId);
        long irCount = count(connection, "SELECT COUNT(*) FROM KC_PINGCODE_IR_SNAPSHOT WHERE RUN_ID=?", runId);
        long unlinkedIrCount = count(connection,
            "SELECT COUNT(*) FROM KC_PINGCODE_IR_SNAPSHOT WHERE RUN_ID=? AND RELATED_SR_COUNT=0", runId);
        long newCount = previousRun == null ? srCount : count(connection,
            "SELECT COUNT(*) FROM KC_PINGCODE_SNAPSHOT S WHERE S.RUN_ID=? AND NOT EXISTS " +
            "(SELECT 1 FROM KC_PINGCODE_SNAPSHOT O WHERE O.RUN_ID=? AND O.SR_NUMBER=S.SR_NUMBER)", runId, previousRun);
        long changedCount = previousRun == null ? 0 : count(connection,
            "SELECT COUNT(*) FROM KC_PINGCODE_SNAPSHOT S JOIN KC_PINGCODE_SNAPSHOT O " +
            "ON O.RUN_ID=? AND O.SR_NUMBER=S.SR_NUMBER WHERE S.RUN_ID=? " +
            "AND (S.BODY_SHA256<>O.BODY_SHA256 OR COALESCE(S.TITLE,'')<>COALESCE(O.TITLE,''))",
            previousRun, runId);
        long removedCount = previousRun == null ? 0 : count(connection,
            "SELECT COUNT(*) FROM KC_PINGCODE_SNAPSHOT O WHERE O.RUN_ID=? AND NOT EXISTS " +
            "(SELECT 1 FROM KC_PINGCODE_SNAPSHOT S WHERE S.RUN_ID=? AND S.SR_NUMBER=O.SR_NUMBER)", previousRun, runId);
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_PINGCODE_RUN SET RUN_STATUS='AWAITING_CONFIRM',PREVIEW_DIGEST=?,TASK_REVISION_DIGEST=?," +
            "SR_COUNT=?,NEW_COUNT=?,CHANGED_COUNT=?,UNCHANGED_COUNT=?,REMOVED_COUNT=?," +
            "IR_COUNT=?,UNLINKED_IR_COUNT=?,FINISHED_AT=CURRENT_TIMESTAMP " +
            "WHERE RUN_ID=? AND RUN_STATUS='COLLECTING'")) {
            update.setString(1, digest); update.setString(2, taskRevisionDigest(connection, runId, previousRun));
            update.setLong(3, srCount); update.setLong(4, newCount);
            update.setLong(5, changedCount); update.setLong(6, srCount - newCount - changedCount);
            update.setLong(7, removedCount); update.setLong(8, irCount);
            update.setLong(9, unlinkedIrCount); update.setString(10, runId);
            if (update.executeUpdate() != 1) throw new SQLException("PINGCODE_RUN_CONFLICT");
        }
    }

    Map<String, Object> preview(Connection connection, String runId, int page, int pageSize, String view)
        throws SQLException {
        Map<String, Object> run = findRun(connection, runId);
        if (run == null) throw new SQLException("PINGCODE_RUN_NOT_FOUND");
        if ("COLLECTING".equals(run.get("status"))) throw new SQLException("PINGCODE_RUN_INCOMPLETE");
        if (page < 1 || pageSize < 1 || pageSize > 100 || (long) (page - 1) * pageSize > Integer.MAX_VALUE)
            throw new SQLException("PINGCODE_PREVIEW_PAGE_INVALID");
        Map<String, Object> source = findSource(connection, (String) run.get("sourceId"));
        String previousRun = source == null ? null : (String) source.get("lastConfirmedRun");
        List<Map<String, Object>> items = new ArrayList<>();
        boolean removed = "removed".equals(view);
        boolean conflicts = "conflicts".equals(view);
        String querySql = removed
            ? "SELECT O.SR_NUMBER,O.TITLE,O.BODY_SHA256,NULL,NULL FROM KC_PINGCODE_SNAPSHOT O " +
              "WHERE O.RUN_ID=? AND NOT EXISTS (SELECT 1 FROM KC_PINGCODE_SNAPSHOT S WHERE S.RUN_ID=? " +
              "AND S.SR_NUMBER=O.SR_NUMBER) ORDER BY O.SR_NUMBER OFFSET ? ROWS FETCH NEXT ? ROWS ONLY"
            : "SELECT S.SR_NUMBER,S.TITLE,S.BODY_SHA256,O.TITLE,O.BODY_SHA256 " +
              "FROM KC_PINGCODE_SNAPSHOT S LEFT JOIN KC_PINGCODE_SNAPSHOT O " +
              "ON O.RUN_ID=? AND O.SR_NUMBER=S.SR_NUMBER WHERE S.RUN_ID=? " +
              (conflicts ? "AND EXISTS (SELECT 1 FROM KC_PINGCODE_TASK_SOURCE T " +
                "JOIN KC_PINGCODE_SOURCE P ON P.SOURCE_ID=T.SOURCE_ID " +
                "WHERE T.SR_NUMBER=S.SR_NUMBER AND T.PRESENT='Y' AND T.SOURCE_ID<>? " +
                "AND P.SOURCE_STATE='ACTIVE') " : "") +
              "ORDER BY S.SR_NUMBER OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
        try (PreparedStatement query = connection.prepareStatement(querySql)) {
            query.setString(1, previousRun == null ? "" : previousRun); query.setString(2, runId);
            int offsetParameter = conflicts ? 4 : 3;
            if (conflicts) query.setString(3, (String) run.get("sourceId"));
            query.setInt(offsetParameter, (page - 1) * pageSize); query.setInt(offsetParameter + 1, pageSize);
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) {
                    String number = TaskNumber.sr(rows.getLong(1));
                    String oldHash = rows.getString(5);
                    String oldTitle = rows.getString(4);
                    String action = removed ? "removed" : oldHash == null ? "created" :
                        !equal(rows.getString(3), oldHash) || !equal(rows.getString(2), oldTitle)
                            ? "updated" : "unchanged";
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("number", number); item.put("title", rows.getString(2));
                    item.put("previousTitle", oldTitle); item.put("action", action);
                    item.put("sources", taskSources(connection, number,
                        removed ? null : (String) run.get("sourceId")));
                    item.put("ir", irNumbers(connection, runId, number));
                    items.add(item);
                }
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("run", run); result.put("items", items); result.put("page", page);
        result.put("pageSize", pageSize); result.put("view", view);
        result.put("total", removed ? run.get("removedCount") : conflicts ? count(connection,
            "SELECT COUNT(*) FROM KC_PINGCODE_SNAPSHOT S WHERE S.RUN_ID=? AND EXISTS " +
            "(SELECT 1 FROM KC_PINGCODE_TASK_SOURCE T JOIN KC_PINGCODE_SOURCE P ON P.SOURCE_ID=T.SOURCE_ID " +
            "WHERE T.SR_NUMBER=S.SR_NUMBER AND T.PRESENT='Y' AND T.SOURCE_ID<>? AND P.SOURCE_STATE='ACTIVE')",
            runId, (String) run.get("sourceId")) : run.get("srCount"));
        return result;
    }

    private List<Map<String, Object>> taskSources(Connection connection, String number, String pendingSource)
        throws SQLException {
        List<Map<String, Object>> result = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT T.SOURCE_ID,S.SOURCE_NAME,S.SOURCE_TYPE,T.IS_PRIMARY FROM KC_PINGCODE_TASK_SOURCE T " +
            "JOIN KC_PINGCODE_SOURCE S ON S.SOURCE_ID=T.SOURCE_ID " +
            "WHERE T.SR_NUMBER=? AND T.PRESENT='Y' AND S.SOURCE_STATE='ACTIVE' ORDER BY T.SOURCE_ID")) {
            query.setLong(1, TaskNumber.sr(number));
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) result.add(Map.of("id", rows.getString(1), "name", rows.getString(2),
                    "type", rows.getString(3), "primary", "Y".equals(rows.getString(4))));
            }
        }
        if (pendingSource != null && result.stream().noneMatch(value -> pendingSource.equals(value.get("id")))) {
            Map<String, Object> source = findSource(connection, pendingSource);
            if (source != null) result.add(Map.of("id", source.get("id"), "name", source.get("name"),
                "type", source.get("type"), "primary", false));
        }
        return result;
    }

    private List<String> irNumbers(Connection connection, String runId, String number) throws SQLException {
        List<String> result = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT IR_NUMBER FROM KC_PINGCODE_IR_RELATION WHERE RUN_ID=? AND SR_NUMBER=? ORDER BY IR_NUMBER")) {
            query.setString(1, runId); query.setLong(2, TaskNumber.sr(number));
            try (ResultSet rows = query.executeQuery()) { while (rows.next()) result.add(TaskNumber.ir(rows.getLong(1))); }
        }
        return result;
    }

    Map<String, Object> sourceSnapshot(Connection connection, String number) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT S.RUN_ID,S.TITLE,S.BODY_MARKDOWN,S.BODY_SHA256,S.SOURCE_UPDATED_AT," +
            "S.RESOURCE_VERSION,S.RESOURCE_STATE,P.SOURCE_ID,P.SOURCE_NAME,P.SOURCE_TYPE,P.SOURCE_URL," +
            "R.CONFIRMED_AT FROM KC_PINGCODE_TASK_SOURCE T " +
            "JOIN KC_PINGCODE_SOURCE P ON P.SOURCE_ID=T.SOURCE_ID " +
            "JOIN KC_PINGCODE_RUN R ON R.RUN_ID=T.LAST_RUN_ID " +
            "JOIN KC_PINGCODE_SNAPSHOT S ON S.RUN_ID=R.RUN_ID AND S.SR_NUMBER=T.SR_NUMBER " +
            "WHERE T.SR_NUMBER=? AND T.IS_PRIMARY='Y' AND T.PRESENT='Y' " +
            "AND R.RUN_STATUS IN ('CONFIRMED','CONFIRMED_MISSING_IMAGES')")) {
            query.setLong(1, TaskNumber.sr(number));
            try (ResultSet rows = query.executeQuery()) {
                if (!rows.next()) throw new SQLException("PINGCODE_SNAPSHOT_NOT_FOUND");
                String runId = rows.getString(1);
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("number", number); result.put("runId", runId);
                result.put("title", rows.getString(2)); result.put("markdown", rows.getString(3));
                result.put("bodySha256", rows.getString(4)); result.put("sourceUpdatedAt", rows.getString(5));
                result.put("resourceVersion", rows.getLong(6)); result.put("resourceState", rows.getString(7));
                result.put("sourceId", rows.getString(8)); result.put("sourceName", rows.getString(9));
                result.put("type", rows.getString(10)); result.put("sourceUrl", rows.getString(11));
                result.put("confirmedAt", timestamp(rows, 12));
                result.put("ir", irNumbers(connection, runId, number));
                result.put("resources", resources(connection, runId, number));
                return result;
            }
        }
    }

    private List<Map<String, Object>> resources(Connection connection, String runId, String number)
        throws SQLException {
        List<Map<String, Object>> result = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT RESOURCE_ID,RESOURCE_VERSION,RESOURCE_PATH,CONTENT_TYPE,BYTE_COUNT," +
            "RESOURCE_STATE,ERROR_CODE FROM KC_PINGCODE_RESOURCE " +
            "WHERE RUN_ID=? AND SR_NUMBER=? ORDER BY RESOURCE_ID,RESOURCE_VERSION DESC")) {
            query.setString(1, runId); query.setLong(2, TaskNumber.sr(number));
            String lastId = null;
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) {
                    if (rows.getString(1).equals(lastId)) continue;
                    lastId = rows.getString(1);
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", lastId); item.put("version", rows.getLong(2));
                    item.put("path", rows.getString(3)); item.put("contentType", rows.getString(4));
                    item.put("byteCount", rows.getObject(5)); item.put("state", rows.getString(6));
                    item.put("errorCode", rows.getString(7)); result.add(item);
                }
            }
        }
        return result;
    }

    Map<String, Object> changes(Connection connection, String number, int page, int pageSize)
        throws SQLException {
        if (page < 1 || pageSize < 1 || pageSize > 100 || (long) (page - 1) * pageSize > Integer.MAX_VALUE)
            throw new SQLException("PINGCODE_CHANGE_PAGE_INVALID");
        long total = count(connection,
            "SELECT COUNT(*) FROM KC_PINGCODE_CHANGE C JOIN KC_PINGCODE_RUN R ON R.RUN_ID=C.RUN_ID " +
            "WHERE C.SR_NUMBER=? AND R.RUN_STATUS IN ('CONFIRMED','CONFIRMED_MISSING_IMAGES')", TaskNumber.sr(number));
        List<Map<String, Object>> items = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT C.RUN_ID,C.FIELD_NAME,C.BEFORE_VALUE,C.AFTER_VALUE,R.CONFIRMED_AT," +
            "P.SOURCE_ID,P.SOURCE_NAME,P.SOURCE_TYPE,P.SOURCE_URL FROM KC_PINGCODE_CHANGE C " +
            "JOIN KC_PINGCODE_RUN R ON R.RUN_ID=C.RUN_ID " +
            "JOIN KC_PINGCODE_SOURCE P ON P.SOURCE_ID=R.SOURCE_ID " +
            "WHERE C.SR_NUMBER=? AND R.RUN_STATUS IN ('CONFIRMED','CONFIRMED_MISSING_IMAGES') " +
            "ORDER BY R.CONFIRMED_AT DESC,C.FIELD_NAME OFFSET ? ROWS FETCH NEXT ? ROWS ONLY")) {
            query.setLong(1, TaskNumber.sr(number)); query.setInt(2, (page - 1) * pageSize);
            query.setInt(3, pageSize);
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("runId", rows.getString(1)); item.put("field", rows.getString(2));
                    item.put("before", rows.getString(3)); item.put("after", rows.getString(4));
                    item.put("confirmedAt", timestamp(rows, 5)); item.put("sourceId", rows.getString(6));
                    item.put("sourceName", rows.getString(7)); item.put("type", rows.getString(8));
                    item.put("sourceUrl", rows.getString(9)); items.add(item);
                }
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items); result.put("total", total);
        result.put("page", page); result.put("pageSize", pageSize);
        return result;
    }

    Map<String, Object> failedResources(Connection connection, String runId, int page, int pageSize)
        throws SQLException {
        Map<String, Object> run = findRun(connection, runId);
        if (run == null) throw new SQLException("PINGCODE_RUN_NOT_FOUND");
        if (!"CONFIRMED_MISSING_IMAGES".equals(run.get("status")) && !"CONFIRMED".equals(run.get("status")))
            throw new SQLException("PINGCODE_RUN_NOT_CONFIRMABLE");
        if (page < 1 || pageSize < 1 || pageSize > 100 || (long) (page - 1) * pageSize > Integer.MAX_VALUE)
            throw new SQLException("PINGCODE_RESOURCE_PAGE_INVALID");
        String latestFailed = " FROM KC_PINGCODE_RESOURCE R WHERE R.RUN_ID=? AND R.RESOURCE_STATE='FAILED' " +
            "AND NOT EXISTS (SELECT 1 FROM KC_PINGCODE_RESOURCE N WHERE N.RUN_ID=R.RUN_ID " +
            "AND N.SR_NUMBER=R.SR_NUMBER AND N.RESOURCE_ID=R.RESOURCE_ID " +
            "AND N.RESOURCE_VERSION>R.RESOURCE_VERSION)";
        long total = count(connection, "SELECT COUNT(*)" + latestFailed, runId);
        List<Map<String, Object>> items = new ArrayList<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT R.SR_NUMBER,R.RESOURCE_ID,R.RESOURCE_VERSION,R.RESOURCE_PATH,R.ERROR_CODE " +
            latestFailed + " ORDER BY R.SR_NUMBER,R.RESOURCE_ID OFFSET ? ROWS FETCH NEXT ? ROWS ONLY")) {
            query.setString(1, runId); query.setInt(2, (page - 1) * pageSize); query.setInt(3, pageSize);
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("number", TaskNumber.sr(rows.getLong(1))); item.put("id", rows.getString(2));
                    item.put("version", rows.getLong(3)); item.put("url", rows.getString(4));
                    item.put("errorCode", rows.getString(5)); items.add(item);
                }
            }
        }
        return Map.of("items", items, "total", total, "page", page, "pageSize", pageSize);
    }

    Map<String, Object> retryResource(Connection connection, String runId, Map<String, Object> input)
        throws SQLException {
        Map<String, Object> run = findRun(connection, runId);
        if (run == null) throw new SQLException("PINGCODE_RUN_NOT_FOUND");
        if (!"CONFIRMED_MISSING_IMAGES".equals(run.get("status")))
            throw new SQLException("PINGCODE_RUN_NOT_CONFIRMABLE");
        String number = string(input.get("number"));
        String id = string(input.get("id"));
        String state = string(input.get("state"));
        String resourcePath = string(input.get("path"));
        String contentType = string(input.get("contentType"));
        Object bytes = input.get("byteCount");
        Object expected = input.get("expectedVersion");
        if (number == null || !number.matches("YDBRD-[0-9]+") || id == null
            || !id.matches("[a-f0-9]{64}") || !(expected instanceof Number)
            || !("READY".equals(state) || "FAILED".equals(state))
            || "READY".equals(state) && (resourcePath == null
                || !resourcePath.matches("assets/[a-f0-9]{64}\\.(png|jpg|gif|webp)")
                || !(bytes instanceof Number n) || n.longValue() < 1 || contentType == null))
            throw new SQLException("PINGCODE_RESOURCE_INVALID");
        long srNumber = TaskNumber.sr(number);
        long currentVersion;
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT RESOURCE_VERSION,RESOURCE_STATE,RESOURCE_PATH FROM KC_PINGCODE_RESOURCE " +
            "WHERE RUN_ID=? AND SR_NUMBER=? AND RESOURCE_ID=? ORDER BY RESOURCE_VERSION DESC FETCH NEXT 1 ROWS ONLY")) {
            query.setString(1, runId); query.setLong(2, srNumber); query.setString(3, id);
            try (ResultSet rows = query.executeQuery()) {
                if (!rows.next()) throw new SQLException("PINGCODE_RESOURCE_NOT_FOUND");
                currentVersion = rows.getLong(1);
                if (!"FAILED".equals(rows.getString(2)) || currentVersion != ((Number) expected).longValue()
                    || !equal(rows.getString(3), string(input.get("sourceUrl"))))
                    throw new SQLException("PINGCODE_RESOURCE_CONFLICT");
            }
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_PINGCODE_RESOURCE (RUN_ID,SR_NUMBER,RESOURCE_ID,RESOURCE_VERSION," +
            "RESOURCE_PATH,CONTENT_TYPE,BYTE_COUNT,RESOURCE_STATE,ERROR_CODE) VALUES (?,?,?,?,?,?,?,?,?)")) {
            insert.setString(1, runId); insert.setLong(2, srNumber); insert.setString(3, id);
            insert.setLong(4, currentVersion + 1);
            insert.setString(5, "READY".equals(state) ? resourcePath : string(input.get("sourceUrl")));
            insert.setString(6, contentType);
            if (bytes instanceof Number n) insert.setLong(7, n.longValue());
            else insert.setNull(7, java.sql.Types.BIGINT);
            insert.setString(8, state); insert.setString(9, string(input.get("errorCode")));
            insert.executeUpdate();
        }
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_PINGCODE_SNAPSHOT SET RESOURCE_VERSION=RESOURCE_VERSION+1," +
            "RESOURCE_STATE=CASE WHEN EXISTS (SELECT 1 FROM KC_PINGCODE_RESOURCE R " +
            "WHERE R.RUN_ID=? AND R.SR_NUMBER=? AND R.RESOURCE_STATE='FAILED' " +
            "AND NOT EXISTS (SELECT 1 FROM KC_PINGCODE_RESOURCE N WHERE N.RUN_ID=R.RUN_ID " +
            "AND N.SR_NUMBER=R.SR_NUMBER AND N.RESOURCE_ID=R.RESOURCE_ID " +
            "AND N.RESOURCE_VERSION>R.RESOURCE_VERSION)) THEN 'MISSING' ELSE 'COMPLETE' END " +
            "WHERE RUN_ID=? AND SR_NUMBER=?")) {
            update.setString(1, runId); update.setLong(2, srNumber);
            update.setString(3, runId); update.setLong(4, srNumber);
            if (update.executeUpdate() != 1) throw new SQLException("PINGCODE_RESOURCE_NOT_FOUND");
        }
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_PINGCODE_RUN SET RUN_STATUS='CONFIRMED' WHERE RUN_ID=? " +
            "AND RUN_STATUS='CONFIRMED_MISSING_IMAGES' AND NOT EXISTS " +
            "(SELECT 1 FROM KC_PINGCODE_SNAPSHOT WHERE RUN_ID=? AND RESOURCE_STATE='MISSING')")) {
            update.setString(1, runId); update.setString(2, runId); update.executeUpdate();
        }
        return findRun(connection, runId);
    }

    /** Atomically promotes a complete preview into the task projection. */
    Map<String, Object> confirmRun(Connection connection, String runId, String digest, long revision,
                                   Map<String, String> primarySources) throws SQLException {
        Map<String, Object> run = findRun(connection, runId);
        if (run == null) throw new SQLException("PINGCODE_RUN_NOT_FOUND");
        if ("CONFIRMED".equals(run.get("status")) || "CONFIRMED_MISSING_IMAGES".equals(run.get("status"))) {
            Map<String, Object> confirmedSource = findSource(connection, (String) run.get("sourceId"));
            if (equal((String) run.get("digest"), digest) && confirmedSource != null
                && equal((String) confirmedSource.get("lastConfirmedRun"), runId)) return run;
            throw new SQLException("PREVIEW_STALE");
        }
        if (!"AWAITING_CONFIRM".equals(run.get("status"))) throw new SQLException("PINGCODE_RUN_NOT_CONFIRMABLE");
        if (!equal((String) run.get("digest"), digest)) throw new SQLException("PREVIEW_STALE");
        if (!taskStorageReady(connection)) throw new SQLException("PINGCODE_TASK_MIGRATION_REQUIRED");
        Map<String, Object> taskConfig = new DocumentTaskReadRepository().config(connection);
        String defaultOwnerId = string(taskConfig.get("defaultOwnerId"));
        if (defaultOwnerId == null || defaultOwnerId.isBlank())
            throw new SQLException("DOCUMENT_TASK_OWNER_REQUIRED");
        Map<String, Object> source = findSource(connection, (String) run.get("sourceId"));
        if (source == null || !"ACTIVE".equals(source.get("state"))
            || ((Number) source.get("revision")).longValue() != revision
            || ((Number) run.get("sourceRevision")).longValue() != revision)
            throw new SQLException("PREVIEW_STALE");
        String sourceId = (String) source.get("id");
        String previousRun = (String) source.get("lastConfirmedRun");
        if (!equal((String) run.get("taskRevisionDigest"), taskRevisionDigest(connection, runId, previousRun)))
            throw new SQLException("PREVIEW_STALE");
        Map<String, String> decisions = primarySources == null ? Map.of() : primarySources;
        Set<String> affected = new LinkedHashSet<>();
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT SR_NUMBER,TITLE FROM KC_PINGCODE_SNAPSHOT WHERE RUN_ID=? ORDER BY SR_NUMBER")) {
            query.setString(1, runId);
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("number", TaskNumber.sr(rows.getLong(1))); item.put("title", rows.getString(2));
                    String number = (String) item.get("number");
                    affected.add(number);
                    boolean previouslyPresent = sourcePresent(connection, number, sourceId);
                    upsertTaskSource(connection, number, sourceId, runId, true);
                    String chosen = selectPrimary(connection, number, decisions.get(number), !previouslyPresent);
                    Map<String, String> selected = selectedSnapshot(connection, chosen,
                        sourceId.equals(chosen) ? runId : null, number);
                    upsertTask(connection, number, selected, chosen, defaultOwnerId);
                    markPrimary(connection, number, chosen);
                }
            }
        }
        if (previousRun != null) recordChanges(connection, runId, previousRun);
        if (previousRun != null) {
            try (PreparedStatement query = connection.prepareStatement(
                "SELECT SR_NUMBER FROM KC_PINGCODE_SNAPSHOT WHERE RUN_ID=? AND NOT EXISTS " +
                "(SELECT 1 FROM KC_PINGCODE_SNAPSHOT N WHERE N.RUN_ID=? AND N.SR_NUMBER=KC_PINGCODE_SNAPSHOT.SR_NUMBER)")) {
                query.setString(1, previousRun); query.setString(2, runId);
                try (ResultSet rows = query.executeQuery()) {
                    while (rows.next()) {
                        String number = TaskNumber.sr(rows.getLong(1));
                        affected.add(number);
                        upsertTaskSource(connection, number, sourceId, runId, false);
                        String chosen = selectPrimary(connection, number, decisions.get(number), false);
                        if (chosen == null) {
                            try (PreparedStatement update = connection.prepareStatement(
                                "UPDATE KC_DOCUMENT_TASK SET ATTENTION=CASE WHEN UPPER(TASK_STATUS)='COMPLETED' THEN 'NORMAL' ELSE 'SECONDARY' END," +
                                "UPDATED_AT=CURRENT_TIMESTAMP,ROW_VERSION=ROW_VERSION+1 " +
                                "WHERE TASK_PREFIX='YDBRD' AND TASK_NUMBER=?")) {
                                update.setLong(1, TaskNumber.sr(number)); update.executeUpdate();
                            }
                            markPrimary(connection, number, null);
                        } else {
                            upsertTask(connection, number, selectedSnapshot(connection, chosen, null, number), chosen, defaultOwnerId);
                            markPrimary(connection, number, chosen);
                        }
                    }
                }
            }
        }
        if (!affected.containsAll(decisions.keySet())) throw new SQLException("PRIMARY_SOURCE_UNAVAILABLE");
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_PINGCODE_SOURCE SET LAST_CONFIRMED_RUN=?,ROW_VERSION=ROW_VERSION+1,UPDATED_AT=CURRENT_TIMESTAMP WHERE SOURCE_ID=?")) {
            update.setString(1, runId); update.setString(2, sourceId); update.executeUpdate();
        }
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_PINGCODE_RUN SET RUN_STATUS=CASE WHEN EXISTS " +
            "(SELECT 1 FROM KC_PINGCODE_SNAPSHOT WHERE RUN_ID=? AND RESOURCE_STATE='MISSING') " +
            "THEN 'CONFIRMED_MISSING_IMAGES' ELSE 'CONFIRMED' END,CONFIRMED_AT=CURRENT_TIMESTAMP " +
            "WHERE RUN_ID=? AND RUN_STATUS='AWAITING_CONFIRM'")) {
            update.setString(1, runId); update.setString(2, runId);
            if (update.executeUpdate() != 1) throw new SQLException("PINGCODE_RUN_CONFLICT");
        }
        return findRun(connection, runId);
    }

    private boolean taskStorageReady(Connection connection) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT MIGRATION_STATUS FROM KC_TASK_MIGRATION WHERE MIGRATION_ID='document_tasks_v2'")) {
            try (ResultSet rows = query.executeQuery()) {
                return rows.next() && "ACTIVE".equals(rows.getString(1));
            }
        }
    }

    private void upsertTaskSource(Connection connection, String number, String sourceId, String runId,
                                  boolean present) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_PINGCODE_TASK_SOURCE SET LAST_RUN_ID=?,PRESENT=? WHERE SR_NUMBER=? AND SOURCE_ID=?")) {
            update.setString(1, runId); update.setString(2, present ? "Y" : "N");
            update.setLong(3, TaskNumber.sr(number)); update.setString(4, sourceId);
            if (update.executeUpdate() == 0) try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO KC_PINGCODE_TASK_SOURCE (SR_NUMBER,SOURCE_ID,LAST_RUN_ID,PRESENT,IS_PRIMARY) VALUES (?,?,?,?,?)")) {
                insert.setLong(1, TaskNumber.sr(number)); insert.setString(2, sourceId); insert.setString(3, runId);
                insert.setString(4, present ? "Y" : "N"); insert.setString(5, "N"); insert.executeUpdate();
            }
        }
    }

    private boolean sourcePresent(Connection connection, String number, String sourceId) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT PRESENT FROM KC_PINGCODE_TASK_SOURCE WHERE SR_NUMBER=? AND SOURCE_ID=?")) {
            query.setLong(1, TaskNumber.sr(number)); query.setString(2, sourceId);
            try (ResultSet rows = query.executeQuery()) { return rows.next() && "Y".equals(rows.getString(1)); }
        }
    }

    private String selectPrimary(Connection connection, String number, String requested, boolean newSource)
        throws SQLException {
        Set<String> present = new LinkedHashSet<>();
        String previous = null;
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT T.SOURCE_ID,T.IS_PRIMARY FROM KC_PINGCODE_TASK_SOURCE T " +
            "JOIN KC_PINGCODE_SOURCE S ON S.SOURCE_ID=T.SOURCE_ID " +
            "WHERE T.SR_NUMBER=? AND T.PRESENT='Y' AND S.SOURCE_STATE='ACTIVE'")) {
            query.setLong(1, TaskNumber.sr(number));
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) {
                    present.add(rows.getString(1));
                    if ("Y".equals(rows.getString(2))) previous = rows.getString(1);
                }
            }
        }
        if (requested != null && !present.contains(requested)) throw new SQLException("PRIMARY_SOURCE_UNAVAILABLE");
        if (requested != null) return requested;
        if (newSource && present.size() > 1) throw new SQLException("PRIMARY_SOURCE_DECISION_REQUIRED");
        if (previous != null) return previous;
        if (present.size() == 1) return present.iterator().next();
        if (present.isEmpty()) return null;
        throw new SQLException("PRIMARY_SOURCE_DECISION_REQUIRED");
    }

    private void markPrimary(Connection connection, String number, String primary) throws SQLException {
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_PINGCODE_TASK_SOURCE SET IS_PRIMARY=CASE WHEN SOURCE_ID=? AND PRESENT='Y' THEN 'Y' ELSE 'N' END WHERE SR_NUMBER=?")) {
            update.setString(1, primary); update.setLong(2, TaskNumber.sr(number)); update.executeUpdate();
        }
    }

    private Map<String, String> selectedSnapshot(Connection connection, String sourceId, String pendingRun,
                                                  String number) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT S.TITLE,P.SOURCE_TYPE,P.SOURCE_URL FROM KC_PINGCODE_SOURCE P " +
            "JOIN KC_PINGCODE_SNAPSHOT S ON S.RUN_ID=COALESCE(?,P.LAST_CONFIRMED_RUN) " +
            "WHERE P.SOURCE_ID=? AND S.SR_NUMBER=?")) {
            query.setString(1, pendingRun); query.setString(2, sourceId);
            query.setLong(3, TaskNumber.sr(number));
            try (ResultSet rows = query.executeQuery()) {
                if (!rows.next()) throw new SQLException("PRIMARY_SOURCE_SNAPSHOT_MISSING");
                return Map.of("title", rows.getString(1) == null ? "" : rows.getString(1),
                    "type", rows.getString(2), "url", rows.getString(3));
            }
        }
    }

    private void upsertTask(Connection connection, String number, Map<String, String> selected,
                            String primary, String defaultOwnerId)
        throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT PAYLOAD FROM KC_DOCUMENT_TASK WHERE TASK_PREFIX='YDBRD' AND TASK_NUMBER=? FOR UPDATE")) {
            query.setLong(1, TaskNumber.sr(number));
            try (ResultSet rows = query.executeQuery()) {
                if (rows.next()) {
                    Map<String, Object> payload = mergeTaskSource(parseTaskPayload(rows.getString(1)), selected, primary);
                    try (PreparedStatement update = connection.prepareStatement(
                        "UPDATE KC_DOCUMENT_TASK SET PAYLOAD=?,DESCRIPTION=?,SOURCE_TYPE=?,PRIMARY_SOURCE_ID=?," +
                        "ATTENTION='NORMAL',UPDATED_AT=CURRENT_TIMESTAMP,ROW_VERSION=ROW_VERSION+1 " +
                        "WHERE TASK_PREFIX='YDBRD' AND TASK_NUMBER=?")) {
                        update.setString(1, Main.Json.stringify(payload)); update.setString(2, selected.get("title"));
                        update.setString(3, selected.get("type")); update.setString(4, primary);
                        update.setLong(5, TaskNumber.sr(number)); update.executeUpdate();
                    }
                    return;
                }
            }
        }
        Map<String, Object> source = new LinkedHashMap<>();
        source.put("number", number); source.put("description", selected.get("title"));
        source.put("sourceUrl", selected.get("url"));
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("number", number); payload.put("description", selected.get("title"));
        payload.put("source", source); payload.put("ownerId", defaultOwnerId);
        payload.put("sourceType", selected.get("type")); payload.put("primarySourceId", primary);
        payload.put("decomposition", Map.of("ticketImpact", "", "confirmed", false, "handbooks", List.of()));
        payload.put("revision", 0);
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_DOCUMENT_TASK (TASK_PREFIX,TASK_NUMBER,PAYLOAD,TASK_STATUS,OWNER_ID," +
            "SOURCE_TYPE,PRIMARY_SOURCE_ID,DESCRIPTION) VALUES ('YDBRD',?,?,'PENDING_SCOPE',?,?,?,?)")) {
            insert.setLong(1, TaskNumber.sr(number)); insert.setString(2, Main.Json.stringify(payload));
            insert.setString(3, defaultOwnerId); insert.setString(4, selected.get("type"));
            insert.setString(5, primary); insert.setString(6, selected.get("title")); insert.executeUpdate();
        }
        DocumentTaskIndex.replace(connection, number, payload);
    }

    static Map<String, Object> mergeTaskSource(Map<String, Object> payload,
                                                Map<String, String> selected, String primary) {
        Map<String, Object> result = new LinkedHashMap<>(payload);
        result.put("description", selected.get("title"));
        result.put("sourceType", selected.get("type"));
        result.put("primarySourceId", primary);
        Map<String, Object> source = new LinkedHashMap<>();
        if (result.get("source") instanceof Map<?, ?> existing) {
            for (Map.Entry<?, ?> field : existing.entrySet())
                source.put(String.valueOf(field.getKey()), field.getValue());
        }
        source.put("description", selected.get("title"));
        source.put("sourceUrl", selected.get("url"));
        result.put("source", source);
        return result;
    }

    private static Map<String, Object> parseTaskPayload(String value) throws SQLException {
        try {
            Object parsed = Main.Json.parse(value);
            if (!(parsed instanceof Map<?, ?> raw)) throw new SQLException("DOCUMENT_TASK_PAYLOAD_INVALID");
            Map<String, Object> result = new LinkedHashMap<>();
            for (Map.Entry<?, ?> field : raw.entrySet()) result.put(String.valueOf(field.getKey()), field.getValue());
            return result;
        } catch (Exception error) {
            throw new SQLException("DOCUMENT_TASK_PAYLOAD_INVALID", error);
        }
    }

    private void recordChanges(Connection connection, String runId, String previousRun) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT N.SR_NUMBER,N.TITLE,O.TITLE,N.BODY_SHA256,O.BODY_SHA256," +
            "N.BODY_MARKDOWN,O.BODY_MARKDOWN FROM KC_PINGCODE_SNAPSHOT N " +
            "JOIN KC_PINGCODE_SNAPSHOT O ON O.RUN_ID=? AND O.SR_NUMBER=N.SR_NUMBER " +
            "WHERE N.RUN_ID=? AND (N.BODY_SHA256<>O.BODY_SHA256 " +
            "OR COALESCE(N.TITLE,'')<>COALESCE(O.TITLE,''))")) {
            query.setString(1, previousRun); query.setString(2, runId);
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) {
                    String number = TaskNumber.sr(rows.getLong(1));
                    if (!equal(rows.getString(2), rows.getString(3)))
                        insertChange(connection, runId, number, "title", rows.getString(3), rows.getString(2));
                    if (!equal(rows.getString(4), rows.getString(5)))
                        insertChange(connection, runId, number, "body", rows.getString(7), rows.getString(6));
                }
            }
        }
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT DISTINCT N.SR_NUMBER FROM KC_PINGCODE_IR_RELATION N WHERE N.RUN_ID=? AND " +
            "NOT EXISTS (SELECT 1 FROM KC_PINGCODE_IR_RELATION O WHERE O.RUN_ID=? " +
            "AND O.SR_NUMBER=N.SR_NUMBER AND O.IR_NUMBER=N.IR_NUMBER) UNION " +
            "SELECT DISTINCT O.SR_NUMBER FROM KC_PINGCODE_IR_RELATION O WHERE O.RUN_ID=? AND " +
            "NOT EXISTS (SELECT 1 FROM KC_PINGCODE_IR_RELATION N WHERE N.RUN_ID=? " +
            "AND N.SR_NUMBER=O.SR_NUMBER AND N.IR_NUMBER=O.IR_NUMBER)")) {
            query.setString(1, runId); query.setString(2, previousRun);
            query.setString(3, previousRun); query.setString(4, runId);
            try (ResultSet rows = query.executeQuery()) {
                while (rows.next()) {
                    String number = TaskNumber.sr(rows.getLong(1));
                    insertChange(connection, runId, number, "ir", Main.Json.stringify(irNumbers(connection, previousRun, number)),
                        Main.Json.stringify(irNumbers(connection, runId, number)));
                }
            }
        }
    }

    private void insertChange(Connection connection, String runId, String number, String field,
                              String before, String after) throws SQLException {
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_PINGCODE_CHANGE (RUN_ID,SR_NUMBER,FIELD_NAME,BEFORE_VALUE,AFTER_VALUE) VALUES (?,?,?,?,?)")) {
            insert.setString(1, runId); insert.setLong(2, TaskNumber.sr(number)); insert.setString(3, field);
            insert.setString(4, before); insert.setString(5, after); insert.executeUpdate();
        }
    }

    private static long count(Connection connection, String sql, Object... parameters) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement(sql)) {
            for (int i = 0; i < parameters.length; i++) query.setObject(i + 1, parameters[i]);
            try (ResultSet rows = query.executeQuery()) { return rows.next() ? rows.getLong(1) : 0; }
        }
    }

    private static String taskRevisionDigest(Connection connection, String runId, String previousRun)
        throws SQLException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (PreparedStatement query = connection.prepareStatement(
                "SELECT N.SR_NUMBER,T.ROW_VERSION FROM (" +
                "SELECT SR_NUMBER FROM KC_PINGCODE_SNAPSHOT WHERE RUN_ID=? UNION " +
                "SELECT SR_NUMBER FROM KC_PINGCODE_SNAPSHOT WHERE RUN_ID=?) N " +
                "LEFT JOIN KC_DOCUMENT_TASK T ON T.TASK_PREFIX='YDBRD' " +
                "AND T.TASK_NUMBER=N.SR_NUMBER ORDER BY N.SR_NUMBER")) {
                query.setString(1, runId); query.setString(2, previousRun == null ? "" : previousRun);
                try (ResultSet rows = query.executeQuery()) {
                    while (rows.next()) {
                        String entry = TaskNumber.sr(rows.getLong(1)) + ":" +
                            (rows.getObject(2) == null ? "new" : rows.getLong(2)) + "\n";
                        digest.update(entry.getBytes(StandardCharsets.UTF_8));
                    }
                }
            }
            return java.util.HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException error) { throw new SQLException("SHA256_UNAVAILABLE", error); }
    }

    void markRun(Connection connection, String runId, String status, String errorCode) throws SQLException {
        if (!"FAILED".equals(status) && !"CANCELLED".equals(status)) throw new SQLException("PINGCODE_RUN_STATUS_INVALID");
        try (PreparedStatement update = connection.prepareStatement(
            "UPDATE KC_PINGCODE_RUN SET RUN_STATUS=?,ERROR_CODE=?,FINISHED_AT=CURRENT_TIMESTAMP" +
            " WHERE RUN_ID=? AND RUN_STATUS='COLLECTING'")) {
            update.setString(1, status); update.setString(2, errorCode); update.setString(3, runId);
            if (update.executeUpdate() != 1) throw new SQLException("PINGCODE_RUN_CONFLICT");
        }
    }

    private void stageItem(Connection connection, String runId, Map<String, Object> sr, String ir)
        throws SQLException {
        String number = string(sr.get("number"));
        String id = string(sr.get("id"));
        String shortId = string(sr.get("shortId"));
        if (number == null || !number.matches("YDBRD-[0-9]+") || id == null || id.isBlank()
            || shortId == null || shortId.isBlank() || ir != null && !ir.matches("YASHAN-[0-9]+"))
            throw new SQLException("PINGCODE_ITEM_INVALID");
        long srNumber = TaskNumber.sr(number);
        Long irNumber = ir == null ? null : TaskNumber.ir(ir);
        String oldId = null;
        String oldHash = null;
        String bodyHash = sha256(string(sr.get("description")));
        Object rawResources = sr.get("imageResources");
        if (rawResources != null && !(rawResources instanceof List<?>))
            throw new SQLException("PINGCODE_RESOURCE_INVALID");
        try (PreparedStatement query = connection.prepareStatement(
            "SELECT UPSTREAM_ID,BODY_SHA256 FROM KC_PINGCODE_SNAPSHOT WHERE RUN_ID=? AND SR_NUMBER=?")) {
            query.setString(1, runId); query.setLong(2, srNumber);
            try (ResultSet rows = query.executeQuery()) {
                if (rows.next()) { oldId = rows.getString(1); oldHash = rows.getString(2); }
            }
        }
        if (oldId != null && !oldId.equals(id)) throw new SQLException("PINGCODE_IDENTITY_CONFLICT");
        if (oldId != null && !oldHash.equals(bodyHash)) throw new SQLException("PINGCODE_CONTENT_CONFLICT");
        if (oldId == null) try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_PINGCODE_SNAPSHOT (RUN_ID,SR_NUMBER,UPSTREAM_ID,SHORT_ID,TITLE,BODY_MARKDOWN," +
            "BODY_SHA256,SOURCE_UPDATED_AT) VALUES (?,?,?,?,?,?,?,?)")) {
            insert.setString(1, runId); insert.setLong(2, srNumber); insert.setString(3, id);
            insert.setString(4, shortId); insert.setString(5, string(sr.get("title")));
            insert.setString(6, string(sr.get("description"))); insert.setString(7, bodyHash);
            insert.setString(8, string(sr.get("updatedAt")));
            insert.executeUpdate();
        }
        if (oldId == null && rawResources instanceof List<?> resources) {
            boolean missing = false;
            for (Object value : resources) {
                if (!(value instanceof Map<?, ?> item)) throw new SQLException("PINGCODE_RESOURCE_INVALID");
                String resourceId = string(item.get("id"));
                String state = string(item.get("state"));
                String resourcePath = string(item.get("path"));
                String contentType = string(item.get("contentType"));
                Object byteCount = item.get("byteCount");
                if (resourceId == null || !resourceId.matches("[a-f0-9]{64}")
                    || !("READY".equals(state) || "FAILED".equals(state))
                    || "READY".equals(state) && (resourcePath == null
                        || !resourcePath.matches("assets/[a-f0-9]{64}\\.(png|jpg|gif|webp)")
                        || !(byteCount instanceof Number n) || n.longValue() < 1 || contentType == null))
                    throw new SQLException("PINGCODE_RESOURCE_INVALID");
                if ("FAILED".equals(state)) missing = true;
                try (PreparedStatement insert = connection.prepareStatement(
                    "INSERT INTO KC_PINGCODE_RESOURCE (RUN_ID,SR_NUMBER,RESOURCE_ID,RESOURCE_PATH," +
                    "CONTENT_TYPE,BYTE_COUNT,RESOURCE_STATE,ERROR_CODE) VALUES (?,?,?,?,?,?,?,?)")) {
                    insert.setString(1, runId); insert.setLong(2, srNumber); insert.setString(3, resourceId);
                    insert.setString(4, resourcePath); insert.setString(5, contentType);
                    if (byteCount instanceof Number n) insert.setLong(6, n.longValue());
                    else insert.setNull(6, java.sql.Types.BIGINT);
                    insert.setString(7, state); insert.setString(8, string(item.get("errorCode")));
                    insert.executeUpdate();
                }
            }
            if (missing) try (PreparedStatement update = connection.prepareStatement(
                "UPDATE KC_PINGCODE_SNAPSHOT SET RESOURCE_STATE='MISSING' WHERE RUN_ID=? AND SR_NUMBER=?")) {
                update.setString(1, runId); update.setLong(2, srNumber); update.executeUpdate();
            }
        }
        if (ir != null) try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_PINGCODE_IR_RELATION (RUN_ID,SR_NUMBER,IR_NUMBER) " +
            "SELECT ?,?,? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM KC_PINGCODE_IR_RELATION " +
            "WHERE RUN_ID=? AND SR_NUMBER=? AND IR_NUMBER=?)")) {
            insert.setString(1, runId); insert.setLong(2, srNumber); insert.setLong(3, irNumber);
            insert.setString(4, runId); insert.setLong(5, srNumber); insert.setLong(6, irNumber);
            insert.executeUpdate();
        }
    }

    private void stageIr(Connection connection, String runId, Map<String, Object> ir, int relatedCount)
        throws SQLException {
        String number = string(ir.get("ir"));
        String id = string(ir.get("irId"));
        if (number == null || !number.matches("YASHAN-[0-9]+") || id == null || id.isBlank()) {
            throw new SQLException("PINGCODE_IR_INVALID");
        }
        try (PreparedStatement insert = connection.prepareStatement(
            "INSERT INTO KC_PINGCODE_IR_SNAPSHOT (RUN_ID,IR_NUMBER,UPSTREAM_ID,RELATED_SR_COUNT) VALUES (?,?,?,?)")) {
            insert.setString(1, runId); insert.setLong(2, TaskNumber.ir(number));
            insert.setString(3, id); insert.setInt(4, relatedCount);
            insert.executeUpdate();
        }
    }

    static boolean validSourceUrl(String type, String value) {
        try {
            URI uri = new URI(value);
            if (!"https".equals(uri.getScheme()) || !"pingcode.yasdb.com".equals(uri.getHost())
                || uri.getRawUserInfo() != null || uri.getRawFragment() != null) return false;
            if ("REQUIREMENT".equals(type)) {
                return uri.getPath().matches("/ship/products/[A-Za-z0-9_-]+/baselines/[A-Za-z0-9_-]+/ideas")
                    && (uri.getRawQuery() == null || uri.getRawQuery().matches("category=[A-Za-z0-9_-]+"));
            }
            return "TICKET".equals(type)
                && uri.getPath().matches("/pjm/projects/YDBRD/defect/[A-Za-z0-9_-]+")
                && uri.getRawQuery() == null;
        } catch (URISyntaxException error) { return false; }
    }

    private static String sha256(String value) throws SQLException {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest((value == null ? "" : value).getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException error) { throw new SQLException("SHA256_UNAVAILABLE", error); }
    }

    private static Map<String, Object> source(ResultSet rows) throws SQLException {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", rows.getString(1)); item.put("name", rows.getString(2));
        item.put("type", rows.getString(3)); item.put("url", rows.getString(4));
        item.put("connectionId", rows.getString(5)); item.put("state", rows.getString(6));
        item.put("revision", rows.getLong(7)); item.put("lastConfirmedRun", rows.getString(8));
        item.put("createdBy", rows.getString(9)); item.put("createdAt", timestamp(rows, 10));
        item.put("updatedAt", timestamp(rows, 11));
        return item;
    }

    private static String timestamp(ResultSet rows, int index) throws SQLException {
        java.sql.Timestamp value = rows.getTimestamp(index);
        return value == null ? null : value.toInstant().toString();
    }
    private static String string(Object value) { return value == null ? null : String.valueOf(value); }
    private static boolean equal(String left, String right) { return java.util.Objects.equals(left, right); }
    private static int number(Object value) throws SQLException {
        if (!(value instanceof Number n)) throw new SQLException("PINGCODE_PAGE_INVALID");
        return n.intValue();
    }
}

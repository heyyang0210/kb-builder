import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Connection;
import java.sql.Driver;
import java.sql.DriverManager;
import java.sql.DriverPropertyInfo;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.List;
import java.util.Properties;
import java.util.logging.Logger;

/** Exercises domain and build-task read projections through the production HTTP handlers. */
public final class StorageDomainReadHttpCheck {
    private static boolean populated;
    private static boolean failNodeRead;
    private static boolean missingOutlineHeader;
    private static boolean missingCreatedTeamLookup;
    private static boolean missingOutlineSequence;
    private static boolean missingOutlineSubject;
    private static int nodeReadQueries;
    private static boolean teamBindingAvailable = true;
    private static boolean createdTeam;
    private static long rosterVersion = 1;
    private static long leaderId = 11;
    private static long memberId = 12;
    private static long outlineEditVersion = 3;
    private static int governanceMutations;
    private static Long responsibilityVersionId = 301L;
    private static int responsibilityVersionsCreated;
    private static int responsibilityPointerWrites;
    private static boolean domainLeaderAvailable = true;
    private static int pendingResponsibilityWrites;
    private static Long itemAssigneeId = 11L;
    private static String itemAssignedBy = "fixture";
    private static int itemMutations;
    private static String outlineState = "PUBLISHED";
    private static boolean hasDocumentAssignment = true;
    private static boolean directoryAssignments;
    private static int publishMutations;
    private static int snapshotMutations;
    private static int snapshotAssignmentWrites;
    private static String nodeDescription;
    private static int nodeDescriptionWrites;
    private static int snapshotPointerWrites;
    private static boolean publishedPointerAvailable = true;
    private static Timestamp deletedPointerBoundary;
    private static String snapshotState;
    private static String snapshotSource;
    private static boolean legacySnapshotMode;
    private static final List<String> legacyNodeShapes = new java.util.ArrayList<>();
    private static int commits;
    private static long nextOutlineSequence = 402;
    private static long candidateVersionId;
    private static long candidateNodeId;
    private static boolean candidateCreated;
    private static boolean candidatePurged;
    private static Timestamp candidateDeletedAt;
    private static Timestamp publicDeletedAt;
    private static Long currentOutlineVersionId = 101L;
    private static boolean publicWasCurrent;
    private static boolean candidateReferenced;
    private static int lifecycleAudits;
    private static int lifecycleDeletes;
    private static int lifecycleRestores;
    private static int lifecyclePurges;
    private static final Timestamp NOW = Timestamp.valueOf("2026-11-05 00:00:00");

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler);
    }

    private static ResultSet rows(String sql, java.util.Map<Integer, Object> binds) throws java.sql.SQLException {
        if (sql.startsWith("SELECT N.NODE_KEY, P.NODE_KEY, N.NODE_TYPE, N.NODE_KEY")) nodeReadQueries++;
        if (failNodeRead && sql.startsWith("SELECT N.NODE_KEY, P.NODE_KEY, N.NODE_TYPE, N.NODE_KEY"))
            throw new java.sql.SQLException("fixture node query unavailable");
        List<Object[]> values;
        if (sql.startsWith("SELECT TECH_DOMAIN_ID, DOMAIN_CODE"))
            values = populated ? List.<Object[]>of(new Object[]{7L, "SQL", "SQL领域", 3L}) : List.of();
        else if (sql.startsWith("SELECT D.TEAM_GROUP_ID"))
            values = populated && teamBindingAvailable ? List.<Object[]>of(new Object[]{3L}) : List.of();
        else if (sql.startsWith("SELECT M.PRINCIPAL_ID,M.MEMBER_ROLE") && sql.contains("P.STATE='ACTIVE'"))
            values = populated ? List.<Object[]>of(new Object[]{11L, "LEADER", "何阳"}, new Object[]{12L, "MEMBER", "乙"}) : List.of();
        else if (sql.startsWith("SELECT DISTINCT V.OUTLINE_VERSION_ID"))
            values = populated && "PUBLISHED".equals(outlineState)
                ? List.<Object[]>of(new Object[]{101L, "outline-public", "HB-1", "7", "SQL领域", NOW, NOW, NOW}) : List.of();
        else if (sql.startsWith("SELECT M.MANUAL_CODE, M.MANUAL_NAME, M.PRODUCT_ID"))
            values = populated ? List.<Object[]>of(new Object[]{"HB-1", "SQL参考手册", "P-1", "YashanDB", "ACTIVE", null,
                NOW, "outline-internal", "outline-public", "v1", "PUBLISHED", 3L, NOW, NOW, 6L, 2L}) : List.of();
        else if (sql.startsWith("SELECT O.OUTLINE_ID, M.MANUAL_CODE, M.MANUAL_NAME")) {
            values = populated ? new java.util.ArrayList<>(List.<Object[]>of(
                new Object[]{9L, "HB-1", "SQL参考手册", "ACTIVE", "101", "101", "v1", "SQL参考手册", "PUBLISHED", null,
                    "import", "fixture-digest", "parser-v1", "rule-v1", outlineEditVersion, NOW, NOW, NOW, "outline-public", null, null},
                new Object[]{10L, "HB-legacy", "旧版手册", "DRAFT", null, null, null, null, null, null,
                    null, null, null, null, 0L, null, NOW, NOW, null, null, null})) : List.of();
            if (candidateCreated && !candidatePurged) values.add(new Object[]{9L, "HB-1", "SQL参考手册", "ACTIVE", "101", String.valueOf(candidateVersionId),
                "candidate-v1", "SQL参考手册", "DRAFT", null, "MANUAL", null, null, null, 1L, null, NOW, NOW, "outline-candidate", candidateDeletedAt, null});
        }
        else if (sql.startsWith("SELECT COALESCE(SOURCE_REF, TO_CHAR(OUTLINE_VERSION_ID))"))
            values = Long.valueOf(101L).equals(binds.get(1)) ? List.<Object[]>of(new Object[]{"outline-public"})
                : candidateCreated && Long.valueOf(candidateVersionId).equals(binds.get(1))
                    ? List.<Object[]>of(new Object[]{"outline-candidate"}) : List.of();
        else if (sql.startsWith("SELECT OUTLINE_VERSION_ID FROM KC_MANUAL_OUTLINE_VERSION WHERE SOURCE_REF=? OR TO_CHAR"))
            values = "outline-public".equals(binds.get(1)) ? List.<Object[]>of(new Object[]{101L})
                : candidateCreated && !candidatePurged && "outline-candidate".equals(binds.get(1))
                    ? List.<Object[]>of(new Object[]{candidateVersionId}) : List.of();
        else if (sql.startsWith("SELECT OUTLINE_VERSION_ID FROM KC_MANUAL_OUTLINE_VERSION WHERE SOURCE_REF=?"))
            values = "outline-public".equals(binds.get(1)) ? List.<Object[]>of(new Object[]{101L})
                : candidateCreated && !candidatePurged && "outline-candidate".equals(binds.get(1))
                    ? List.<Object[]>of(new Object[]{candidateVersionId}) : List.of();
        else if (sql.startsWith("SELECT OUTLINE_VERSION_ID FROM KC_MANUAL_OUTLINE_VERSION WHERE OUTLINE_VERSION_ID=?"))
            values = populated && Long.valueOf(101L).equals(binds.get(1)) ? List.<Object[]>of(new Object[]{101L}) : List.of();
        else if (sql.startsWith("SELECT O.OUTLINE_ID,O.CURRENT_OUTLINE_VERSION_ID"))
            values = Long.valueOf(101L).equals(binds.get(1)) || candidateCreated && !candidatePurged && Long.valueOf(candidateVersionId).equals(binds.get(1))
                ? List.<Object[]>of(new Object[]{9L, currentOutlineVersionId}) : List.of();
        else if (sql.startsWith("SELECT DELETED_WAS_CURRENT FROM KC_MANUAL_OUTLINE_VERSION"))
            values = List.<Object[]>of(new Object[]{Long.valueOf(101L).equals(binds.get(1)) ? publicWasCurrent ? "Y" : "N" : "N"});
        else if (sql.startsWith("SELECT COUNT(*) FROM KC_MANUAL_OUTLINE_VERSION WHERE BASE_OUTLINE_VERSION_ID"))
            values = List.<Object[]>of(new Object[]{0});
        else if (sql.startsWith("SELECT NAMESPACE,PAYLOAD FROM KC_RECORD WHERE NAMESPACE NOT IN"))
            values = candidateReferenced ? List.<Object[]>of(new Object[]{"production", new javax.sql.rowset.serial.SerialClob(
                "{\"outlineVersionId\":\"outline-candidate\"}".toCharArray())}) : List.of();
        else if (sql.startsWith("SELECT REVISION, PAYLOAD_SHA256, DELETED") && sql.contains("FROM KC_RECORD")) values = List.of();
        else if (sql.startsWith("SELECT KC_OUTLINE_SEQ.NEXTVAL FROM DUAL"))
            values = missingOutlineSequence ? List.of() : List.<Object[]>of(new Object[]{nextOutlineSequence++});
        else if (sql.startsWith("SELECT MANUAL_ID FROM KC_MANUAL WHERE MANUAL_CODE"))
            values = "HB-1".equals(binds.get(1)) ? List.<Object[]>of(new Object[]{6L}) : List.of();
        else if (sql.startsWith("SELECT OUTLINE_ID FROM KC_MANUAL_OUTLINE WHERE MANUAL_ID=?"))
            values = !missingOutlineSubject && Long.valueOf(6L).equals(binds.get(1)) ? List.<Object[]>of(new Object[]{9L}) : List.of();
        else if (sql.startsWith("SELECT OUTLINE_ID FROM KC_MANUAL_OUTLINE WHERE OUTLINE_ID=? FOR UPDATE"))
            values = Long.valueOf(9L).equals(binds.get(1)) ? List.<Object[]>of(new Object[]{9L}) : List.of();
        else if (sql.startsWith("SELECT OUTLINE_VERSION_ID, ROW_VERSION, DELETED_AT FROM KC_MANUAL_OUTLINE_VERSION"))
            values = "outline-public".equals(binds.get(1)) ? List.<Object[]>of(new Object[]{101L, outlineEditVersion, null}) : List.of();
        else if (sql.startsWith("SELECT MAX(DELETED_AT) FROM KC_MANUAL_OUTLINE_VERSION"))
            values = List.<Object[]>of(new Object[]{deletedPointerBoundary});
        else if (sql.startsWith("SELECT OUTLINE_VERSION_ID FROM KC_MANUAL_OUTLINE_VERSION WHERE OUTLINE_ID = ? AND STATE = 'PUBLISHED'")) {
            if (deletedPointerBoundary != null && !deletedPointerBoundary.equals(binds.get(2)))
                throw new AssertionError("published pointer omitted deletion boundary");
            values = publishedPointerAvailable ? List.<Object[]>of(new Object[]{101L}) : List.of();
        }
        else if (sql.startsWith("SELECT OUTLINE_VERSION_ID FROM KC_MANUAL_OUTLINE_VERSION WHERE OUTLINE_ID = ? AND DELETED_AT IS NULL")) {
            if (deletedPointerBoundary != null && !deletedPointerBoundary.equals(binds.get(2)))
                throw new AssertionError("fallback pointer omitted deletion boundary");
            values = List.<Object[]>of(new Object[]{101L});
        }
        else if (sql.startsWith("SELECT V.OUTLINE_VERSION_ID, M.MANUAL_CODE, V.STATE, V.ROW_VERSION, O.OUTLINE_ID"))
            values = missingOutlineHeader ? List.of() : Long.valueOf(101L).equals(binds.get(1)) ? List.<Object[]>of(new Object[]{101L, "HB-1", outlineState, outlineEditVersion, 9L, "outline-public", publicDeletedAt})
                : candidateCreated && !candidatePurged && Long.valueOf(candidateVersionId).equals(binds.get(1))
                    ? List.<Object[]>of(new Object[]{candidateVersionId, "HB-1", "DRAFT", 1L, 9L, "outline-candidate", candidateDeletedAt}) : List.of();
        else if (sql.startsWith("SELECT TECH_DOMAIN_ID FROM KC_TECH_DOMAIN WHERE TECH_DOMAIN_ID"))
            values = Long.valueOf(7L).equals(binds.get(1)) ? List.<Object[]>of(new Object[]{7L}) : List.of();
        else if (sql.startsWith("SELECT CURRENT_RESP_VERSION_ID FROM KC_MANUAL_OUTLINE_VERSION"))
            values = List.<Object[]>of(new Object[]{responsibilityVersionId});
        else if (sql.startsWith("SELECT COALESCE(MAX(VERSION_NO),0)+1 FROM KC_MANUAL_OUTLINE_RESP_VERSION"))
            values = List.<Object[]>of(new Object[]{2L});
        else if (sql.startsWith("SELECT KC_RESPONSIBILITY_SEQ.NEXTVAL FROM DUAL"))
            values = List.<Object[]>of(new Object[]{302L});
        else if (sql.startsWith("SELECT OUTLINE_NODE_ID FROM KC_MANUAL_OUTLINE_NODE WHERE OUTLINE_VERSION_ID"))
            values = "doc-1".equals(binds.get(2)) ? List.<Object[]>of(new Object[]{401L}) : List.of();
        else if (sql.startsWith("SELECT N.NODE_KEY, P.NODE_KEY, N.NODE_TYPE, N.NODE_KEY"))
            values = "outline-public".equals(binds.get(1)) || Long.valueOf(101L).equals(binds.get(1))
                ? directoryAssignments ? List.<Object[]>of(
                    new Object[]{"dir-1", null, "DIRECTORY", "dir-1", "连接目录", null, 1L, 1L},
                    new Object[]{"doc-1", "dir-1", "DOCUMENT", "doc-1", "连接管理", null, 2L, 2L})
                    : List.<Object[]>of(new Object[]{"doc-1", null, "DOCUMENT", "doc-1", "连接管理",
                        nodeDescription == null ? null : new javax.sql.rowset.serial.SerialClob(nodeDescription.toCharArray()), 1L, 1L})
                : candidateCreated && Long.valueOf(candidateVersionId).equals(binds.get(1))
                    ? List.<Object[]>of(new Object[]{"doc-new", null, "DOCUMENT", "doc-new", "候选文档", null, 1L, 1L}) : List.of();
        else if (sql.startsWith("SELECT N.NODE_KEY, I.TECH_DOMAIN_ID, D.DOMAIN_NAME"))
            values = Long.valueOf(101L).equals(binds.get(1))
                ? List.<Object[]>of(new Object[]{"doc-1", "SQL", "SQL领域", 11L, "何阳", "bound", "PRIMARY"}) : List.of();
        else if (sql.startsWith("SELECT N.NODE_KEY, I.TECH_DOMAIN_ID FROM KC_MANUAL_OUTLINE_RESP_ITEM"))
            values = directoryAssignments ? List.<Object[]>of(new Object[]{"dir-1", "7"}, new Object[]{"doc-1", "7"})
                : hasDocumentAssignment ? List.<Object[]>of(new Object[]{"doc-1", "7"}) : List.of();
        else if (sql.startsWith("SELECT M.PRINCIPAL_ID FROM KC_TECH_DOMAIN D"))
            values = domainLeaderAvailable ? List.<Object[]>of(new Object[]{11L}) : List.of();
        else if (sql.startsWith("SELECT I.RESP_ITEM_ID, N.NODE_KEY, N.NODE_TITLE"))
            values = List.<Object[]>of(new Object[]{201L, "doc-1", "连接管理", itemAssigneeId,
                itemAssigneeId == null ? null : itemAssigneeId == 11L ? "何阳" : "乙",
                itemAssigneeId == null ? "PENDING" : "BOUND", itemAssignedBy, NOW});
        else if (sql.startsWith("SELECT TECH_DOMAIN_ID, DOMAIN_NAME FROM KC_TECH_DOMAIN"))
            values = List.<Object[]>of(new Object[]{7L, "SQL领域"});
        else if (sql.startsWith("SELECT I.RESP_ITEM_ID, N.NODE_KEY")) values = List.of();
        else if (sql.startsWith("SELECT G.TEAM_GROUP_ID,G.GROUP_CODE")) {
            if (!populated) values = List.of();
            else if (sql.contains("WHERE G.TEAM_GROUP_ID=?")) {
                long id = ((Number) binds.get(1)).longValue();
                values = id == 3L ? List.<Object[]>of(new Object[]{3L, "sql-team", "SQL小组", "TECH_DOMAIN", "ACTIVE", rosterVersion, 7L, "SQL领域"})
                    : id == 4L && createdTeam ? List.<Object[]>of(new Object[]{4L, "new-team", "新小组", "TECH_DOMAIN", "ACTIVE", 1L, null, null}) : List.of();
            } else {
                values = new java.util.ArrayList<>();
                values.add(new Object[]{3L, "sql-team", "SQL小组", "TECH_DOMAIN", "ACTIVE", rosterVersion, 7L, "SQL领域"});
                if (createdTeam) values.add(new Object[]{4L, "new-team", "新小组", "TECH_DOMAIN", "ACTIVE", 1L, null, null});
            }
        }
        else if (sql.startsWith("SELECT M.PRINCIPAL_ID,M.MEMBER_ROLE,P.DISPLAY_NAME FROM KC_TEAM_GROUP_MEMBER"))
            values = populated && ((Number) binds.get(1)).longValue() == 3L ? List.<Object[]>of(
                new Object[]{leaderId, "LEADER", leaderId == 11 ? "何阳" : "乙"},
                new Object[]{memberId, "MEMBER", memberId == 11 ? "何阳" : "乙"}) : List.of();
        else if (sql.startsWith("SELECT COUNT(*) FROM KC_TEAM_GROUP"))
            values = List.<Object[]>of(new Object[]{createdTeam && "新小组".equals(binds.get(1)) ? 1L : 0L});
        else if (sql.startsWith("SELECT TEAM_GROUP_ID FROM KC_TEAM_GROUP WHERE GROUP_TYPE"))
            values = !missingCreatedTeamLookup && createdTeam && "new-team".equals(binds.get(1)) ? List.<Object[]>of(new Object[]{4L}) : List.of();
        else if (sql.startsWith("SELECT TEAM_GROUP_ID FROM KC_TEAM_GROUP WHERE TEAM_GROUP_ID=? FOR UPDATE"))
            values = ((Number) binds.get(1)).longValue() == 3L ? List.<Object[]>of(new Object[]{3L}) : List.of();
        else if (sql.startsWith("SELECT PRINCIPAL_ID FROM KC_PLATFORM_PRINCIPAL")) {
            long id = ((Number) binds.get(1)).longValue();
            values = id == 11L || id == 12L ? List.<Object[]>of(new Object[]{id}) : List.of();
        }
        else throw new AssertionError("unexpected query: " + sql);
        int[] cursor = {-1};
        boolean[] lastWasNull = {false};
        return proxy(ResultSet.class, (self, method, args) -> {
            if (method.getName().equals("next")) return ++cursor[0] < values.size();
            if (method.getName().equals("wasNull")) return lastWasNull[0];
            if (method.getName().startsWith("get")) {
                Object value = values.get(cursor[0])[(Integer) args[0] - 1];
                lastWasNull[0] = value == null;
                if (method.getName().equals("getLong")) return value == null ? 0L : ((Number) value).longValue();
                if (method.getName().equals("getInt")) return value == null ? 0 : ((Number) value).intValue();
                if (method.getName().equals("getString")) return value == null ? null : String.valueOf(value);
                return value;
            }
            return null;
        });
    }

    private static Connection connection() {
        return proxy(Connection.class, (self, method, args) -> {
            if (method.getName().equals("isClosed")) return false;
            if (method.getName().equals("commit")) { commits++; return null; }
            if (method.getName().equals("createStatement")) return proxy(java.sql.Statement.class, (statement, call, values) ->
                call.getName().equals("executeQuery") ? singleRow() : null);
            if (method.getName().equals("prepareStatement")) {
                String sql = (String) args[0];
                java.util.Map<Integer, Object> binds = new java.util.HashMap<>();
                java.util.List<java.util.Map<Integer, Object>> batch = new java.util.ArrayList<>();
                return proxy(PreparedStatement.class, (statement, call, values) -> {
                    if (call.getName().startsWith("set")) {
                        binds.put((Integer) values[0], call.getName().equals("setNull") ? null : values[1]);
                        return null;
                    }
                    if (call.getName().equals("executeQuery")) return rows(sql, binds);
                    if (call.getName().equals("addBatch")) { batch.add(new java.util.HashMap<>(binds)); return null; }
                    if (call.getName().equals("executeBatch")) {
                        for (java.util.Map<Integer, Object> item : batch) {
                            if ("LEADER".equals(item.get(3))) leaderId = ((Number) item.get(2)).longValue();
                            else memberId = ((Number) item.get(2)).longValue();
                        }
                        return new int[batch.size()];
                    }
                    if (call.getName().equals("executeUpdate")) {
                        if (sql.startsWith("INSERT INTO KC_RECORD(")) {
                            if (!"outline-lifecycle-audit".equals(binds.get(1))) throw new AssertionError("unexpected record write");
                            lifecycleAudits++;
                        }
                        else if (sql.startsWith("UPDATE KC_MANUAL_OUTLINE_VERSION SET DELETED_AT=CURRENT_TIMESTAMP")) {
                            long target = ((Number) binds.get(4)).longValue();
                            if (Long.valueOf(candidateVersionId).equals(target)) candidateDeletedAt = NOW;
                            else if (target == 101L) { publicDeletedAt = NOW; publicWasCurrent = Long.valueOf(101L).equals(currentOutlineVersionId); }
                            else throw new AssertionError("deleted another version");
                            lifecycleDeletes++;
                        }
                        else if (sql.startsWith("UPDATE KC_MANUAL_OUTLINE_VERSION SET DELETED_AT=NULL")) {
                            long target = ((Number) binds.get(1)).longValue();
                            if (Long.valueOf(candidateVersionId).equals(target)) candidateDeletedAt = null;
                            else if (target == 101L) publicDeletedAt = null;
                            else throw new AssertionError("restored another version");
                            lifecycleRestores++;
                        }
                        else if (sql.startsWith("UPDATE KC_MANUAL_OUTLINE SET CURRENT_OUTLINE_VERSION_ID=?")) {
                            if (binds.get(2) instanceof Number) {
                                if (!Long.valueOf(9L).equals(binds.get(2))) throw new AssertionError("lifecycle pointer targeted another subject");
                                currentOutlineVersionId = (Long) binds.get(1);
                                if (Long.valueOf(101L).equals(currentOutlineVersionId)) publicWasCurrent = false;
                            } else {
                                if (!Long.valueOf(101L).equals(binds.get(1)) || !Long.valueOf(9L).equals(binds.get(3)))
                                    throw new AssertionError("published pointer targeted another outline");
                                currentOutlineVersionId = 101L;
                            }
                            publishMutations++;
                        }
                        else if (sql.startsWith("UPDATE KC_MANUAL_OUTLINE_VERSION SET CURRENT_RESP_VERSION_ID=NULL")) lifecyclePurges++;
                        else if (sql.startsWith("INSERT INTO KC_MANUAL_OUTLINE_RESP_VERSION(")) {
                            if (!Long.valueOf(302L).equals(binds.get(1)) || !Long.valueOf(101L).equals(binds.get(2))
                                    || !Long.valueOf(2L).equals(binds.get(3))
                                    || !"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945".equals(binds.get(4))
                                    || !"fixture-admin".equals(binds.get(5)) || !"fixture-admin".equals(binds.get(6))
                                    || !sql.contains("'DRAFT'"))
                                throw new AssertionError("responsibility version creation lost version, digest or actor");
                            responsibilityVersionsCreated++;
                        }
                        else if (sql.startsWith("UPDATE KC_MANUAL_OUTLINE_VERSION SET CURRENT_RESP_VERSION_ID=?")) {
                            if (!Long.valueOf(302L).equals(binds.get(1)) || !Long.valueOf(101L).equals(binds.get(2)))
                                throw new AssertionError("responsibility pointer targeted another version");
                            responsibilityVersionId = (Long) binds.get(1);
                            responsibilityPointerWrites++;
                        }
                        else if (sql.startsWith("DELETE FROM KC_MANUAL_OUTLINE_VERSION WHERE OUTLINE_VERSION_ID=?")) {
                            if (!Long.valueOf(candidateVersionId).equals(binds.get(1))) throw new AssertionError("purged another version");
                            candidatePurged = true;
                            lifecyclePurges++;
                        }
                        else if (sql.startsWith("INSERT INTO KC_TEAM_GROUP(")) createdTeam = true;
                        else if (sql.startsWith("UPDATE KC_TEAM_GROUP SET ROW_VERSION")) rosterVersion++;
                        else if (sql.startsWith("UPDATE KC_MANUAL_OUTLINE_NODE SET NODE_DESCRIPTION")) {
                            if (!"fixture-admin".equals(binds.get(2)) || !"doc-1".equals(binds.get(3))
                                    || !Long.valueOf(101L).equals(binds.get(4)))
                                throw new AssertionError("draft description update targeted another node or actor");
                            java.io.StringWriter text = new java.io.StringWriter();
                            ((java.io.Reader) binds.get(1)).transferTo(text);
                            nodeDescription = text.toString();
                            nodeDescriptionWrites++;
                        }
                        else if (sql.startsWith("DELETE FROM KC_MANUAL_OUTLINE_RESP_ITEM WHERE RESP_VERSION_ID=?")
                                || sql.startsWith("INSERT INTO KC_MANUAL_OUTLINE_RESP_ITEM(")
                                || sql.startsWith("UPDATE KC_MANUAL_OUTLINE_RESP_VERSION SET MAPPING_SHA256")) {
                            if (snapshotMutations > 0 && sql.startsWith("INSERT INTO KC_MANUAL_OUTLINE_RESP_ITEM(")) {
                                if (!Long.valueOf(401L).equals(binds.get(2)) || !Long.valueOf(7L).equals(binds.get(3))
                                        || !"PRIMARY".equals(binds.get(4)))
                                    throw new AssertionError("snapshot responsibility used unexpected node, domain or role");
                                snapshotAssignmentWrites++;
                            }
                            if (!domainLeaderAvailable && sql.startsWith("INSERT INTO KC_MANUAL_OUTLINE_RESP_ITEM(")) {
                                if (!Long.valueOf(302L).equals(binds.get(1)) || binds.get(5) != null
                                        || !"PENDING".equals(binds.get(6)))
                                    throw new AssertionError("missing domain leader was not persisted as pending");
                                pendingResponsibilityWrites++;
                            }
                            governanceMutations++;
                        }
                        else if (sql.startsWith("UPDATE KC_MANUAL_OUTLINE_VERSION SET ROW_VERSION = ROW_VERSION + 1")) {
                            outlineEditVersion++;
                            governanceMutations++;
                        }
                        else if (sql.startsWith("UPDATE KC_MANUAL_OUTLINE_RESP_ITEM SET OWNER_PRINCIPAL_ID=")) {
                            itemAssigneeId = (Long) binds.get(1);
                            itemAssignedBy = String.valueOf(binds.get(3));
                            itemMutations++;
                        }
                        else if (sql.startsWith("UPDATE KC_MANUAL_OUTLINE_VERSION SET STATE='SUPERSEDED'")) {
                            if (!Long.valueOf(9L).equals(binds.get(2)) || !Long.valueOf(101L).equals(binds.get(3)))
                                throw new AssertionError("published predecessor update targeted another outline");
                            publishMutations++;
                        }
                        else if (sql.startsWith("UPDATE KC_MANUAL_OUTLINE_VERSION SET STATE='PUBLISHED'")) {
                            if (!"fixture-admin".equals(binds.get(1)) || !Long.valueOf(101L).equals(binds.get(6)))
                                throw new AssertionError("published version update used unexpected actor or version");
                            outlineState = "PUBLISHED";
                            publishMutations++;
                        }
                        else if (sql.startsWith("UPDATE KC_MANUAL_OUTLINE_RESP_VERSION SET STATE='PUBLISHED'")) {
                            if (!Long.valueOf(101L).equals(binds.get(4))) throw new AssertionError("responsibility version targeted another outline");
                            publishMutations++;
                        }
                        else if (sql.startsWith("UPDATE KC_MANUAL_OUTLINE SET CURRENT_OUTLINE_VERSION_ID=")) {
                            if (!Long.valueOf(101L).equals(binds.get(1)) || !Long.valueOf(9L).equals(binds.get(3)))
                                throw new AssertionError("current outline pointer targeted another outline");
                            publishMutations++;
                        }
                        else if (sql.startsWith("UPDATE KC_MANUAL_OUTLINE_VERSION SET OUTLINE_ID=")) {
                            if (!Long.valueOf(9L).equals(binds.get(1)) || !Long.valueOf(101L).equals(binds.get(14)))
                                throw new AssertionError("snapshot update targeted another version");
                            outlineEditVersion = (Long) binds.get(10);
                            snapshotState = (String) binds.get(3);
                            snapshotSource = (String) binds.get(5);
                            snapshotMutations++;
                        }
                        else if (sql.startsWith("INSERT INTO KC_MANUAL_OUTLINE_VERSION(")) {
                            if (!Long.valueOf(9L).equals(binds.get(2)) || !"outline-candidate".equals(binds.get(7)))
                                throw new AssertionError("candidate version used unexpected subject or source ID");
                            candidateVersionId = ((Number) binds.get(1)).longValue();
                            candidateCreated = true;
                            snapshotMutations++;
                        }
                        else if (sql.startsWith("DELETE FROM KC_MANUAL_OUTLINE_RESP_ITEM WHERE RESP_VERSION_ID IN")
                                || sql.startsWith("DELETE FROM KC_MANUAL_OUTLINE_RESP_VERSION WHERE OUTLINE_VERSION_ID")
                                || sql.startsWith("DELETE FROM KC_MANUAL_OUTLINE_CHECK_RUN WHERE OUTLINE_VERSION_ID")
                                || sql.startsWith("DELETE FROM KC_MANUAL_OUTLINE_CHANGE WHERE OUTLINE_VERSION_ID")
                                || sql.startsWith("DELETE FROM KC_MANUAL_OUTLINE_VERSION_TAG WHERE OUTLINE_VERSION_ID")
                                || sql.startsWith("DELETE FROM KC_MANUAL_OUTLINE_NODE WHERE OUTLINE_VERSION_ID")) {
                            if (Long.valueOf(101L).equals(binds.get(1))) snapshotMutations++;
                            else if (Long.valueOf(candidateVersionId).equals(binds.get(1))) lifecyclePurges++;
                            else throw new AssertionError("cleared another version");
                        }
                        else if (sql.startsWith("INSERT INTO KC_MANUAL_OUTLINE_NODE(")) {
                            boolean currentNode = Long.valueOf(101L).equals(binds.get(2)) && "doc-1".equals(binds.get(3));
                            boolean candidateNode = candidateCreated && Long.valueOf(candidateVersionId).equals(binds.get(2))
                                && "doc-new".equals(binds.get(3));
                            boolean legacyNode = legacySnapshotMode && Long.valueOf(101L).equals(binds.get(2));
                            if (!currentNode && !candidateNode && !legacyNode)
                                throw new AssertionError("snapshot inserted another node");
                            if (candidateNode) candidateNodeId = ((Number) binds.get(1)).longValue();
                            if (legacyNode) legacyNodeShapes.add(binds.get(5) + "/" + binds.get(6) + "/" + binds.get(8)
                                + "/" + (binds.get(4) == null ? "root" : "child"));
                            snapshotMutations++;
                        }
                        else if (sql.startsWith("UPDATE KC_MANUAL_OUTLINE SET CURRENT_OUTLINE_VERSION_ID =")) {
                            if (!Long.valueOf(101L).equals(binds.get(1)) || !Long.valueOf(6L).equals(binds.get(2)))
                                throw new AssertionError("snapshot pointer targeted another manual");
                            snapshotMutations++;
                            snapshotPointerWrites++;
                        }
                        else if (!sql.startsWith("DELETE FROM KC_TEAM_GROUP_MEMBER")) throw new AssertionError("unexpected update: " + sql);
                        return 1;
                    }
                    return null;
                });
            }
            return null;
        });
    }

    private static ResultSet singleRow() {
        int[] cursor = {0};
        return proxy(ResultSet.class, (self, method, args) -> method.getName().equals("next") ? ++cursor[0] == 1 : null);
    }

    private static HttpResponse<String> request(HttpClient client, URI base, String method, String path) throws Exception {
        return client.send(HttpRequest.newBuilder(base.resolve(path)).method(method, HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
    }

    private static HttpResponse<String> write(HttpClient client, URI base, String method, String path, String body, String version) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(base.resolve(path)).header("Idempotency-Key", "team-fixture");
        if (version != null) builder.header("If-Match", version);
        return client.send(builder.method(method, HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }

    private static void expect(HttpResponse<String> response, int status, String fragment) {
        if (response.statusCode() != status || !response.body().contains(fragment))
            throw new AssertionError(status + "/" + fragment + " expected, got " + response.statusCode() + "/" + response.body());
    }

    public static void main(String[] args) throws Exception {
        DriverManager.registerDriver(new Driver() {
            public boolean acceptsURL(String url) { return url.startsWith("jdbc:fixture:business"); }
            public Connection connect(String url, Properties properties) { return acceptsURL(url) ? connection() : null; }
            public DriverPropertyInfo[] getPropertyInfo(String url, Properties properties) { return new DriverPropertyInfo[0]; }
            public int getMajorVersion() { return 1; }
            public int getMinorVersion() { return 0; }
            public boolean jdbcCompliant() { return false; }
            public Logger getParentLogger() { return Logger.getGlobal(); }
        });
        Constructor<Main> constructor = Main.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        Main application = constructor.newInstance();
        Method domains = Main.class.getDeclaredMethod("techDomains", HttpExchange.class);
        Method tasks = Main.class.getDeclaredMethod("buildTasks", HttpExchange.class);
        domains.setAccessible(true);
        tasks.setAccessible(true);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/domain/tech-domains", exchange -> {
            try { domains.invoke(application, exchange); } catch (ReflectiveOperationException error) { throw new IOException(error); }
        });
        server.createContext("/v1/domain/build-tasks", exchange -> {
            try { tasks.invoke(application, exchange); } catch (ReflectiveOperationException error) { throw new IOException(error); }
        });
        Method teams = Main.class.getDeclaredMethod("teamGroups", HttpExchange.class);
        teams.setAccessible(true);
        server.createContext("/v1/platform/team-groups", exchange -> {
            try { teams.invoke(application, exchange); } catch (ReflectiveOperationException error) { throw new IOException(error); }
        });
        Method outlines = Main.class.getDeclaredMethod("domainOutlines", HttpExchange.class);
        outlines.setAccessible(true);
        server.createContext("/v1/domain/outlines", exchange -> {
            try { outlines.invoke(application, exchange); } catch (ReflectiveOperationException error) {
                Throwable cause = error.getCause() == null ? error : error.getCause();
                cause.printStackTrace();
                throw new IOException(cause);
            }
        });
        server.start();
        URI base = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        HttpClient client = HttpClient.newHttpClient();
        try {
            expect(request(client, base, "GET", "/v1/domain/tech-domains"), 200, "\"techDomains\":[]");
            expect(request(client, base, "GET", "/v1/domain/build-tasks"), 200, "\"tasks\":[]");
            expect(request(client, base, "GET", "/v1/platform/team-groups"), 200, "\"total\":0");
            HttpResponse<String> emptyCatalog = request(client, base, "GET", "/v1/domain/outlines/catalog");
            expect(emptyCatalog, 200, "\"items\":[]");
            if (emptyCatalog.headers().firstValue("Server-Timing").isEmpty()) throw new AssertionError("outline catalog timing missing");
            expect(request(client, base, "GET", "/v1/domain/outlines"), 200, "\"outlines\":[]");
            expect(request(client, base, "GET", "/v1/domain/outlines/missing/directory"), 404, "OUTLINE_NOT_FOUND");
            expect(request(client, base, "GET", "/v1/domain/outlines/999/directory"), 404, "OUTLINE_NOT_FOUND");
            populated = true;
            int beforeMissingHeaderCommits = commits;
            missingOutlineHeader = true;
            try {
                expect(request(client, base, "GET", "/v1/domain/outlines/outline-public/governance"), 404, "OUTLINE_NOT_FOUND");
                if (commits != beforeMissingHeaderCommits) throw new AssertionError("missing outline header committed");
            } finally {
                missingOutlineHeader = false;
            }
            int beforeNodeFailureCommits = commits;
            failNodeRead = true;
            try {
                expect(request(client, base, "GET", "/v1/domain/outlines"), 503, "DATABASE_UNAVAILABLE");
                expect(request(client, base, "GET", "/v1/domain/outlines/outline-public/governance"), 503, "DATABASE_UNAVAILABLE");
                if (commits != beforeNodeFailureCommits) throw new AssertionError("node read failure committed");
            } finally {
                failNodeRead = false;
            }
            expect(request(client, base, "GET", "/v1/domain/outlines"), 200, "\"outlineId\":\"outline-public\"");
            HttpResponse<String> directory = request(client, base, "GET", "/v1/domain/outlines/outline-public/directory");
            expect(directory, 200, "\"outlineId\":\"outline-public\"");
            expect(directory, 200, "\"title\":\"连接管理\"");
            expect(directory, 200, "\"assigneeName\":\"何阳\"");
            expect(directory, 200, "\"domainRole\":\"PRIMARY\"");
            if (directory.headers().firstValue("Server-Timing").isEmpty()) throw new AssertionError("outline directory timing missing");
            HttpResponse<String> cachedDirectory = request(client, base, "GET", "/v1/domain/outlines/outline-public/directory");
            expect(cachedDirectory, 200, "\"assigneeName\":\"何阳\"");
            HttpResponse<String> governance = request(client, base, "GET", "/v1/domain/outlines/outline-public/governance");
            expect(governance, 200, "\"totalDocuments\":1");
            expect(governance, 200, "\"assignedDocuments\":1");
            expect(governance, 200, "\"techDomainName\":\"SQL领域\"");
            expect(governance, 200, "\"assigneeName\":\"何阳\"");
            expect(governance, 200, "\"status\":\"assigned\"");
            int beforeLegacyReadCommits = commits;
            int beforeLegacyReadMutations = governanceMutations + snapshotMutations;
            HttpResponse<String> numericGovernance = request(client, base, "GET", "/v1/domain/outlines/101/governance");
            expect(numericGovernance, 200, "\"outlineId\":\"101\"");
            expect(numericGovernance, 200, "\"outlineVersionId\":\"outline-public\"");
            expect(numericGovernance, 200, "\"assigneeName\":\"何阳\"");
            expect(numericGovernance, 200, "\"totalDocuments\":1");
            expect(request(client, base, "GET", "/v1/domain/outlines/999/governance"), 404, "OUTLINE_NOT_FOUND");
            expect(request(client, base, "GET", "/v1/domain/outlines/%20/governance"), 404, "OUTLINE_NOT_FOUND");
            if (commits != beforeLegacyReadCommits || governanceMutations + snapshotMutations != beforeLegacyReadMutations)
                throw new AssertionError("legacy outline ID reads changed persistent state");
            String effectiveAssignments = governance.body().substring(governance.body().indexOf("\"effectiveDocumentAssignments\""));
            if (!effectiveAssignments.contains("\"techDomainIds\":[\"7\"]")
                    || !effectiveAssignments.contains("\"taskId\":\"build-task_")
                    || !effectiveAssignments.contains("\"assigneeName\":\"何阳\""))
                throw new AssertionError("governance ownership did not merge task assignee: " + governance.body());
            String governancePath = "/v1/domain/outlines/outline-public/governance";
            expect(write(client, base, "PUT", governancePath, "{}", null), 422, "PUBLISHED_ASSIGNMENT_REQUIRED");
            expect(write(client, base, "PUT", governancePath, "{\"editVersion\":1,\"assignments\":[]}", null), 409, "OUTLINE_VERSION_CONFLICT");
            expect(write(client, base, "PUT", governancePath, "{\"descriptions\":[{\"nodeId\":\"missing\",\"description\":\"x\"}],\"assignments\":[]}", null), 422, "INVALID_DOMAIN_PAYLOAD");
            expect(write(client, base, "PUT", governancePath, "{\"descriptions\":[{\"nodeId\":\"doc-1\",\"description\":\"changed\"}],\"assignments\":[]}", null), 409, "PUBLISHED_CONTENT_LOCKED");
            expect(write(client, base, "PUT", governancePath, "{\"assignments\":[{\"nodeId\":\"missing\",\"techDomainIds\":[\"7\"]}]}", null), 422, "INVALID_DOMAIN_PAYLOAD");
            expect(write(client, base, "PUT", governancePath, "{\"assignments\":[{\"nodeId\":\"doc-1\",\"techDomainIds\":[\"bad\"]}]}", null), 422, "INVALID_DOMAIN_PAYLOAD");
            HttpResponse<String> emptyAssignments = write(client, base, "PUT", governancePath, "{\"assignments\":[]}", null);
            expect(emptyAssignments, 422, "PUBLISHED_ASSIGNMENT_REQUIRED");
            expect(emptyAssignments, 422, "\"nodeId\":\"doc-1\"");
            HttpResponse<String> savedGovernance = write(client, base, "PUT", governancePath,
                "{\"editVersion\":3,\"assignedBy\":\"fixture-admin\",\"assignments\":[{\"nodeId\":\"doc-1\",\"techDomainIds\":[\"7\"]}]}", null);
            expect(savedGovernance, 200, "\"editVersion\":4");
            expect(savedGovernance, 200, "\"assigneeName\":\"何阳\"");
            if (governanceMutations != 4) throw new AssertionError("governance SQL writes incomplete: " + governanceMutations);
            HttpResponse<String> savedReadback = request(client, base, "GET", governancePath);
            expect(savedReadback, 200, "\"editVersion\":4");
            expect(savedReadback, 200, "\"techDomainIds\":[\"7\"]");
            HttpResponse<String> catalog = request(client, base, "GET", "/v1/domain/outlines/catalog");
            expect(catalog, 200, "\"outlineId\":\"outline-public\"");
            expect(catalog, 200, "\"handbookId\":\"HB-1\"");
            expect(catalog, 200, "\"kp_count\":2");
            expect(catalog, 200, "\"state\":\"published\"");
            if (catalog.headers().firstValue("Server-Timing").isEmpty()) throw new AssertionError("outline catalog timing missing");
            HttpResponse<String> outlinesList = request(client, base, "GET", "/v1/domain/outlines");
            expect(outlinesList, 200, "\"outlineId\":\"outline-public\"");
            expect(outlinesList, 200, "\"currentOutlineVersionId\":\"outline-public\"");
            expect(outlinesList, 200, "\"state\":\"published\"");
            expect(outlinesList, 200, "\"title\":\"连接管理\"");
            expect(outlinesList, 200, "\"path\":\"连接管理\"");
            expect(outlinesList, 200, "\"kp_count\":1");
            expect(outlinesList, 200, "\"published_at\":\"2026-");
            expect(outlinesList, 200, "\"handbookId\":\"HB-legacy\"");
            expect(outlinesList, 200, "\"outlineId\":\"10\",\"handbookId\":\"HB-legacy\"");
            String legacyProjection = outlinesList.body().substring(outlinesList.body().indexOf("\"handbookId\":\"HB-legacy\""));
            if (!legacyProjection.contains("\"currentOutlineVersionId\":null")
                    || !legacyProjection.contains("\"state\":\"draft\"")
                    || !legacyProjection.contains("\"nodes\":[]"))
                throw new AssertionError("legacy outline projection incomplete: " + outlinesList.body());
            expect(request(client, base, "GET", "/v1/domain/tech-domains"), 200, "\"name\":\"SQL领域\"");
            expect(request(client, base, "GET", "/v1/domain/tech-domains"), 200, "\"name\":\"何阳\"");
            HttpResponse<String> list = request(client, base, "GET", "/v1/domain/build-tasks");
            expect(list, 200, "\"manualId\":\"HB-1\"");
            // The actual opaque task ID is read from the response; only its prefix is contractual here.
            java.util.regex.Matcher match = java.util.regex.Pattern.compile("\\\"id\\\":\\\"(build-task_[^\\\"]+)\\\"").matcher(list.body());
            if (!match.find()) throw new AssertionError("task id missing: " + list.body());
            expect(request(client, base, "GET", "/v1/domain/build-tasks/" + match.group(1)), 200, "\"outlineVersionId\":\"outline-public\"");
            String taskPath = "/v1/domain/build-tasks/" + match.group(1);
            java.util.regex.Matcher itemMatch = java.util.regex.Pattern.compile("\\\"id\\\":\\\"(build-item_[^\\\"]+)\\\"").matcher(list.body());
            if (!itemMatch.find()) throw new AssertionError("task item id missing: " + list.body());
            String itemPath = taskPath + "/items/" + itemMatch.group(1);
            expect(write(client, base, "PATCH", taskPath + "/items/missing", "{}", null), 404, "BUILD_TASK_ITEM_NOT_FOUND");
            int beforeRejectedTaskCommit = commits;
            int beforeRejectedTaskWrites = itemMutations;
            expect(write(client, base, "PATCH", "/v1/domain/build-tasks/missing/items/missing", "{}", null), 404, "BUILD_TASK_NOT_FOUND");
            teamBindingAvailable = false;
            expect(write(client, base, "PATCH", itemPath, "{\"assigneeId\":11}", null), 422, "BUILD_TASK_TEAM_BINDING_REQUIRED");
            teamBindingAvailable = true;
            if (commits != beforeRejectedTaskCommit || itemMutations != beforeRejectedTaskWrites)
                throw new AssertionError("rejected task assignment changed committed state");
            expect(write(client, base, "PATCH", itemPath, "{\"assigneeId\":99}", null), 422, "BUILD_TASK_ASSIGNEE_INVALID");
            expect(write(client, base, "PATCH", itemPath, "{\"assigneeId\":12,\"assignedBy\":\"fixture-admin\"}", null), 200, "\"assigneeName\":\"乙\"");
            if (itemMutations != 1 || !Long.valueOf(12L).equals(itemAssigneeId) || !"fixture-admin".equals(itemAssignedBy))
                throw new AssertionError("task item assignment was not persisted");
            expect(request(client, base, "GET", taskPath), 200, "\"assigneeId\":\"12\"");
            expect(write(client, base, "PATCH", itemPath, "{}", null), 200, "\"status\":\"unassigned\"");
            if (itemMutations != 2 || itemAssigneeId != null) throw new AssertionError("task item assignment was not cleared");
            expect(request(client, base, "GET", taskPath), 200, "\"assigneeId\":null");
            expect(request(client, base, "GET", "/v1/domain/build-tasks/missing"), 404, "BUILD_TASK_NOT_FOUND");
            String publishPath = "/v1/domain/outlines/outline-public/publish";
            expect(write(client, base, "POST", publishPath, "{}", null), 200, "\"state\":\"PUBLISHED\"");
            if (publishMutations != 0) throw new AssertionError("published outline was written again");
            int beforePublishImmutableCommit = commits;
            for (String state : List.of("ARCHIVED", "SUPERSEDED")) {
                outlineState = state;
                expect(write(client, base, "POST", publishPath, "{}", null), 409, "OUTLINE_IMMUTABLE");
            }
            if (commits != beforePublishImmutableCommit || publishMutations != 0)
                throw new AssertionError("immutable publication changed committed state");
            outlineState = "READY";
            expect(write(client, base, "POST", publishPath, "{\"editVersion\":1}", null), 409, "OUTLINE_VERSION_CONFLICT");
            hasDocumentAssignment = false;
            HttpResponse<String> missingOwnership = write(client, base, "POST", publishPath, "{\"editVersion\":4}", null);
            expect(missingOwnership, 422, "OUTLINE_RESPONSIBILITY_REQUIRED");
            expect(missingOwnership, 422, "\"nodeId\":\"doc-1\"");
            if (publishMutations != 0) throw new AssertionError("failed publish wrote database state");
            hasDocumentAssignment = true;
            expect(write(client, base, "POST", publishPath, "{\"editVersion\":4,\"publishedBy\":\"fixture-admin\"}", null), 200, "\"state\":\"PUBLISHED\"");
            if (publishMutations != 4 || !"PUBLISHED".equals(outlineState))
                throw new AssertionError("publish did not update version, responsibility and current pointer");
            expect(request(client, base, "GET", governancePath), 200, "\"state\":\"PUBLISHED\"");
            expect(request(client, base, "GET", "/v1/platform/team-groups"), 200, "\"groupName\":\"SQL小组\"");
            expect(request(client, base, "GET", "/v1/platform/team-groups/3"), 200, "\"displayName\":\"何阳\"");
            expect(request(client, base, "GET", "/v1/platform/team-groups/5"), 404, "TEAM_GROUP_NOT_FOUND");
            expect(request(client, base, "POST", "/v1/platform/team-groups"), 400, "IDEMPOTENCY_KEY_REQUIRED");
            expect(request(client, base, "PUT", "/v1/platform/team-groups/3/roster"), 400, "IDEMPOTENCY_KEY_REQUIRED");
            expect(write(client, base, "POST", "/v1/platform/team-groups", "{}", null), 422, "TEAM_GROUP_NAME_REQUIRED");
            int beforeMissingTeamCommits = commits;
            missingCreatedTeamLookup = true;
            try {
                expect(write(client, base, "POST", "/v1/platform/team-groups", "{\"groupName\":\"新小组\",\"groupCode\":\"new-team\"}", null), 404, "TEAM_GROUP_NOT_FOUND");
                if (commits != beforeMissingTeamCommits) throw new AssertionError("missing team readback committed");
            } finally {
                missingCreatedTeamLookup = false;
                createdTeam = false;
            }
            expect(write(client, base, "POST", "/v1/platform/team-groups", "{\"groupName\":\"新小组\",\"groupCode\":\"new-team\"}", null), 201, "\"groupName\":\"新小组\"");
            expect(write(client, base, "POST", "/v1/platform/team-groups", "{\"groupName\":\"新小组\",\"groupCode\":\"new-team\"}", null), 409, "TEAM_GROUP_NAME_DUPLICATED");
            expect(write(client, base, "PUT", "/v1/platform/team-groups/3/roster", "{}", "1"), 422, "TEAM_GROUP_LEADER_REQUIRED");
            expect(write(client, base, "PUT", "/v1/platform/team-groups/3/roster", "{\"leaderPrincipalId\":12,\"memberPrincipalIds\":[11]}", "1"), 200, "\"rowVersion\":2");
            expect(request(client, base, "GET", "/v1/platform/team-groups/3"), 200, "\"displayName\":\"乙\"");
            expect(write(client, base, "PUT", "/v1/platform/team-groups/3/roster", "{\"leaderPrincipalId\":11}", "1"), 409, "TEAM_GROUP_VERSION_CONFLICT");
            expect(request(client, base, "GET", "/v1/platform/team-groups/invalid"), 400, "TEAM_GROUP_ID_INVALID");
            expect(write(client, base, "POST", "/v1/platform/team-groups", "{broken", null), 400, "INVALID_JSON");
            expect(write(client, base, "PUT", "/v1/platform/team-groups/3/roster", "{\"leaderPrincipalId\":11}", "invalid"), 400, "INVALID_ROW_VERSION");
            expect(write(client, base, "PUT", "/v1/platform/team-groups/5/roster", "{\"leaderPrincipalId\":11}", null), 404, "TEAM_GROUP_NOT_FOUND");
            expect(write(client, base, "PUT", "/v1/platform/team-groups/3/roster", "{\"leaderPrincipalId\":11,\"memberPrincipalIds\":[\"bad\"]}", "2"), 422, "TEAM_GROUP_MEMBER_INVALID");
            expect(write(client, base, "PUT", "/v1/platform/team-groups/3/roster", "{\"leaderPrincipalId\":99}", "2"), 422, "TEAM_GROUP_MEMBER_INVALID");
            expect(request(client, base, "DELETE", "/v1/platform/team-groups/3"), 405, "METHOD_NOT_ALLOWED");
            expect(request(client, base, "POST", "/v1/domain/tech-domains"), 405, "METHOD_NOT_ALLOWED");
            expect(request(client, base, "POST", "/v1/domain/build-tasks"), 405, "METHOD_NOT_ALLOWED");
            String snapshot = "{\"outlines\":[{\"id\":\"outline-public\",\"handbookId\":\"HB-1\",\"state\":\"published\","
                + "\"governance\":{\"assignments\":[{\"nodeId\":\"doc-1\",\"techDomainIds\":[\"7\"]},"
                + "{\"nodeId\":\"ghost\",\"techDomainIds\":[\"7\"]}]},"
                + "\"content\":{\"nodes\":[{\"id\":\"doc-1\",\"kind\":\"document\",\"title\":\"连接管理\","
                + "\"level\":1,\"order\":1,\"techDomainIds\":[\"7\"]}]}}]}";
            int commitsBeforeSnapshot = commits;
            expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot", snapshot, null), 200, "\"outlineId\":\"outline-public\"");
            if (snapshotMutations != 9 || snapshotAssignmentWrites != 1 || outlineEditVersion != 5 || commits != commitsBeforeSnapshot + 1)
                throw new AssertionError("snapshot version, children or pointer writes incomplete: " + snapshotMutations);
            expect(request(client, base, "GET", "/v1/domain/outlines"), 200, "\"editVersion\":5");
            int commitsBeforeConflict = commits;
            expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot", snapshot.replace("{\"outlines\"", "{\"insertOnly\":true,\"outlines\""), null),
                409, "OUTLINE_VERSION_CONFLICT");
            if (snapshotMutations != 9 || outlineEditVersion != 5 || commits != commitsBeforeConflict)
                throw new AssertionError("conflicting snapshot changed committed outline state");
            String candidate = "{\"insertOnly\":true,\"outlines\":[{\"id\":\"outline-candidate\",\"handbookId\":\"HB-1\","
                + "\"state\":\"draft\",\"outlineStructureVersion\":\"candidate-v1\",\"content\":{\"nodes\":[{\"id\":\"doc-new\","
                + "\"kind\":\"document\",\"title\":\"候选文档\",\"level\":1,\"order\":1}]}}]}";
            int commitsBeforeCandidate = commits;
            int mutationsBeforeCandidate = snapshotMutations;
            expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot",
                candidate.replace("\"handbookId\":\"HB-1\"", "\"handbookId\":\"HB-missing\""), null), 404, "OUTLINE_HANDBOOK_NOT_FOUND");
            expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot",
                candidate.replace("\"handbookId\":\"HB-1\"", "\"handbookId\":\"\""), null), 404, "OUTLINE_HANDBOOK_NOT_FOUND");
            missingOutlineSubject = true;
            try {
                expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot", candidate, null), 503, "DATABASE_UNAVAILABLE");
            } finally {
                missingOutlineSubject = false;
            }
            if (candidateCreated || commits != commitsBeforeCandidate || snapshotMutations != mutationsBeforeCandidate)
                throw new AssertionError("invalid candidate handbook wrote or committed outline state");
            missingOutlineSequence = true;
            try {
                expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot", candidate, null), 503, "DATABASE_UNAVAILABLE");
                if (candidateCreated || commits != commitsBeforeCandidate || snapshotMutations != mutationsBeforeCandidate)
                    throw new AssertionError("failed ID allocation wrote or committed candidate");
            } finally {
                missingOutlineSequence = false;
            }
            expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot", candidate, null), 200, "\"outlineId\":\"outline-candidate\"");
            if (!candidateCreated || candidateVersionId <= 0 || candidateNodeId != candidateVersionId + 1
                    || snapshotMutations != 11 || snapshotPointerWrites != 1 || commits != commitsBeforeCandidate + 1)
                throw new AssertionError("insert-only candidate changed current outline or omitted version and node writes");
            expect(request(client, base, "GET", "/v1/domain/outlines"), 200, "\"outlineId\":\"outline-candidate\"");
            int commitsBeforeDuplicate = commits;
            expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot", candidate, null), 409, "OUTLINE_VERSION_CONFLICT");
            if (snapshotMutations != 11 || snapshotPointerWrites != 1 || commits != commitsBeforeDuplicate)
                throw new AssertionError("duplicate candidate changed committed outline state");
            String candidatePath = "/v1/domain/outlines/outline-candidate";
            expect(request(client, base, "GET", candidatePath + "/purge-preflight"), 200, "\"canPurge\":false");
            expect(write(client, base, "POST", candidatePath + "/purge", "{}", null), 422, "OUTLINE_PURGE_CONFIRM_REQUIRED");
            int beforeDelete = commits;
            expect(write(client, base, "DELETE", candidatePath, "{\"reason\":\"obsolete\"}", null), 200, "\"deleted\":true");
            if (candidateDeletedAt == null || lifecycleDeletes != 1 || lifecycleAudits != 1 || commits != beforeDelete + 1)
                throw new AssertionError("candidate delete did not persist and audit");
            expect(write(client, base, "DELETE", candidatePath, "{}", null), 200, "\"deleted\":true");
            if (lifecycleDeletes != 1 || lifecycleAudits != 1) throw new AssertionError("duplicate delete was not idempotent");
            expect(request(client, base, "GET", candidatePath + "/purge-preflight"), 200, "\"canPurge\":true");
            candidateReferenced = true;
            expect(request(client, base, "GET", candidatePath + "/purge-preflight"), 200, "\"references\":1");
            expect(write(client, base, "POST", candidatePath + "/purge",
                "{\"confirmId\":\"outline-candidate\",\"reason\":\"obsolete\"}", null), 409, "OUTLINE_PURGE_REFERENCED");
            if (candidatePurged || lifecycleAudits != 1) throw new AssertionError("referenced candidate was purged");
            candidateReferenced = false;
            int beforeRestore = commits;
            expect(write(client, base, "POST", candidatePath + "/restore", "{}", null), 200, "\"restored\":true");
            if (candidateDeletedAt != null || lifecycleRestores != 1 || lifecycleAudits != 2 || commits != beforeRestore + 1)
                throw new AssertionError("candidate restore did not persist and audit");
            expect(request(client, base, "GET", "/v1/domain/outlines"), 200, "\"outlineId\":\"outline-candidate\"");
            expect(write(client, base, "POST", candidatePath + "/restore", "{}", null), 200, "\"restored\":true");
            if (lifecycleRestores != 1 || lifecycleAudits != 2) throw new AssertionError("duplicate restore was not idempotent");
            expect(write(client, base, "DELETE", candidatePath, "{}", null), 200, "\"deleted\":true");
            if (lifecycleDeletes != 2 || lifecycleAudits != 3) throw new AssertionError("second delete was not audited");
            expect(write(client, base, "POST", candidatePath + "/purge",
                "{\"confirmId\":\"wrong-id\",\"reason\":\"obsolete\"}", null), 422, "OUTLINE_PURGE_CONFIRM_REQUIRED");
            int beforePurge = commits;
            expect(write(client, base, "POST", candidatePath + "/purge",
                "{\"confirmId\":\"outline-candidate\",\"reason\":\"obsolete\"}", null), 200, "\"purged\":true");
            if (!candidatePurged || lifecyclePurges != 8 || lifecycleAudits != 4 || commits != beforePurge + 1)
                throw new AssertionError("candidate purge did not clear version, children and audit: " + lifecyclePurges);
            expect(request(client, base, "GET", candidatePath + "/purge-preflight"), 404, "OUTLINE_NOT_FOUND");
            String publicPath = "/v1/domain/outlines/outline-public";
            expect(request(client, base, "GET", publicPath + "/restore"), 405, "METHOD_NOT_ALLOWED");
            expect(write(client, base, "POST", publicPath + "/restore", "{broken", null), 400, "INVALID_JSON");
            expect(write(client, base, "DELETE", publicPath, "{\"reason\":\"retired\"}", null), 200, "\"deleted\":true");
            if (publicDeletedAt == null || currentOutlineVersionId != null || !publicWasCurrent || lifecycleAudits != 5)
                throw new AssertionError("current outline delete did not clear and record current pointer");
            int beforeDeletedPublish = commits;
            int beforeDeletedPublishWrites = publishMutations;
            expect(write(client, base, "POST", publicPath + "/publish", "{}", null), 409, "OUTLINE_DELETED");
            if (commits != beforeDeletedPublish || publishMutations != beforeDeletedPublishWrites || publicDeletedAt == null)
                throw new AssertionError("deleted publication changed committed state");
            currentOutlineVersionId = 999L;
            int auditsBeforeConflict = lifecycleAudits;
            expect(write(client, base, "POST", publicPath + "/restore", "{}", null), 409, "OUTLINE_RESTORE_CONFLICT");
            if (currentOutlineVersionId != 999L || publicDeletedAt == null || lifecycleAudits != auditsBeforeConflict)
                throw new AssertionError("conflicting restore changed pointer or audit state");
            currentOutlineVersionId = null;
            expect(write(client, base, "POST", publicPath + "/restore", "{}", null), 200, "\"restored\":true");
            if (publicDeletedAt != null || currentOutlineVersionId != 101L || publicWasCurrent || lifecycleAudits != 6)
                throw new AssertionError("current outline restore did not restore pointer and audit");
            outlineState = "READY";
            int beforeDescriptionCommit = commits;
            expect(write(client, base, "PUT", governancePath,
                "{\"editVersion\":5,\"assignedBy\":\"fixture-admin\",\"descriptions\":[{\"nodeId\":\"doc-1\",\"description\":\"待发布说明\"}]}", null),
                200, "\"description\":\"待发布说明\"");
            if (nodeDescriptionWrites != 1 || !"待发布说明".equals(nodeDescription)
                    || outlineEditVersion != 6 || commits != beforeDescriptionCommit + 1)
                throw new AssertionError("draft description update did not persist once");
            expect(request(client, base, "GET", governancePath), 200, "\"description\":\"待发布说明\"");
            responsibilityVersionId = null;
            domainLeaderAvailable = false;
            int beforeResponsibilityCommit = commits;
            String assignmentBody = "{\"assignedBy\":\"fixture-admin\",\"assignments\":[{\"nodeId\":\"doc-1\",\"techDomainIds\":[\"7\"]}]}";
            expect(write(client, base, "PUT", governancePath, assignmentBody, null), 200, "\"editVersion\":7");
            if (responsibilityVersionsCreated != 1 || responsibilityPointerWrites != 1
                    || !Long.valueOf(302L).equals(responsibilityVersionId) || pendingResponsibilityWrites != 1
                    || commits != beforeResponsibilityCommit + 1)
                throw new AssertionError("first responsibility assignment did not create one version and pending binding");
            expect(write(client, base, "PUT", governancePath, assignmentBody, null), 200, "\"editVersion\":8");
            if (responsibilityVersionsCreated != 1 || responsibilityPointerWrites != 1
                    || pendingResponsibilityWrites != 2 || commits != beforeResponsibilityCommit + 2)
                throw new AssertionError("subsequent assignment failed to reuse the responsibility version");
            domainLeaderAvailable = true;
            String legacySnapshot = """
                {"outlines":[{"id":"outline-public","handbookId":"HB-1","state":"published","content":{"parts":[
                  {"part":"第一部分","documents":[{"id":"intro","name":"概览"}],
                   "chapters":[{"name":"第一章","documents":[{"id":"guide","title":"指南"}],
                     "children":[{"name":"第一节","documents":[{"id":"leaf","title":"正文"}]}]}],
                   "children":[{"name":"补充","documents":[{"id":"extra","title":"附录"}]}]}
                ]}}]}
                """;
            legacySnapshotMode = true;
            int beforeLegacyCommit = commits;
            expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot", legacySnapshot, null), 200, "\"outlineId\":\"outline-public\"");
            if (commits != beforeLegacyCommit + 1 || legacyNodeShapes.size() != 8
                    || !legacyNodeShapes.containsAll(List.of("DIRECTORY/第一部分/1/root", "DOCUMENT/概览/2/child",
                        "DIRECTORY/第一章/2/child", "DOCUMENT/指南/3/child", "DIRECTORY/第一节/3/child",
                        "DOCUMENT/正文/4/child", "DIRECTORY/补充/2/child", "DOCUMENT/附录/3/child")))
                throw new AssertionError("legacy outline hierarchy was not saved: " + legacyNodeShapes);
            legacySnapshotMode = false;
            int beforeRejectedSnapshot = commits;
            int beforeRejectedMutations = snapshotMutations;
            for (String content : List.of("{}", "\"{broken\"", "\"[]\"", "\" \"")) {
                expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot",
                    "{\"outlines\":[{\"id\":\"outline-public\",\"handbookId\":\"HB-1\",\"content\":" + content + "}]}", null),
                    422, "OUTLINE_DOCUMENT_REQUIRED");
            }
            String documentContent = "{\"nodes\":[{\"id\":\"doc-1\",\"kind\":\"document\",\"title\":\"连接管理\",\"level\":1,\"order\":1}]}";
            expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot",
                "{\"outlines\":[{\"handbookId\":\"HB-1\",\"content\":" + documentContent + "}]}", null),
                503, "DATABASE_UNAVAILABLE");
            expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot",
                "{\"outlines\":[{\"id\":\"outline-public\",\"handbookId\":\"missing-handbook\",\"content\":" + documentContent + "}]}", null),
                404, "OUTLINE_HANDBOOK_NOT_FOUND");
            if (commits != beforeRejectedSnapshot || snapshotMutations != beforeRejectedMutations)
                throw new AssertionError("rejected snapshot changed committed state");
            String[] states = {"ready", "superseded", "archived", "unexpected"};
            String[] sources = {"import", "reverse_extract", "migration", "unexpected"};
            String[] normalizedStates = {"READY", "SUPERSEDED", "ARCHIVED", "DRAFT"};
            String[] normalizedSources = {"IMPORT", "REVERSE_EXTRACT", "MIGRATION", "MANUAL"};
            publishedPointerAvailable = false;
            deletedPointerBoundary = NOW;
            for (int index = 0; index < states.length; index++) {
                int beforeCompatibleCommit = commits;
                int beforeCompatiblePointer = snapshotPointerWrites;
                // String content is a supported legacy persisted representation.
                String encodedContent = "\"" + documentContent.replace("\"", "\\\"") + "\"";
                String compatible = "{\"outlines\":[{\"id\":\"outline-public\",\"handbookId\":\"HB-1\",\"state\":\"" + states[index]
                    + "\",\"sourceType\":\"" + sources[index] + "\",\"content\":" + encodedContent + "}]}";
                expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot", compatible, null), 200, "\"outlineId\":\"outline-public\"");
                if (!normalizedStates[index].equals(snapshotState) || !normalizedSources[index].equals(snapshotSource)
                        || commits != beforeCompatibleCommit + 1 || snapshotPointerWrites != beforeCompatiblePointer + 1)
                    throw new AssertionError("legacy snapshot normalization or fallback pointer failed: " + snapshotState + "/" + snapshotSource);
            }
            for (String immutableState : List.of("ARCHIVED", "SUPERSEDED")) {
                outlineState = immutableState;
                int beforeImmutableCommit = commits;
                long beforeImmutableVersion = outlineEditVersion;
                expect(write(client, base, "PUT", governancePath, "{\"assignments\":[]}", null), 409, "OUTLINE_IMMUTABLE");
                if (commits != beforeImmutableCommit || outlineEditVersion != beforeImmutableVersion)
                    throw new AssertionError("immutable outline governance mutated state");
            }
            expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot", "[]", null), 400, "INVALID_JSON");
            outlineState = "DRAFT";
            directoryAssignments = true;
            expect(request(client, base, "GET", governancePath), 200, "\"kind\":\"directory\"");
            int beforeInheritedCommit = commits;
            long beforeInheritedVersion = outlineEditVersion;
            int beforeInheritedWrites = snapshotAssignmentWrites;
            HttpResponse<String> inherited = write(client, base, "PUT", governancePath,
                "{\"assignments\":[{\"nodeId\":\"dir-1\",\"techDomainIds\":[\"7\"]},{\"nodeId\":\"doc-1\",\"techDomainIds\":[\"7\"]}]}", null);
            expect(inherited, 200, "\"techDomainIds\":[\"7\"]");
            if (inherited.body().contains("\"techDomainIds\":[\"7\",\"7\"]") || commits != beforeInheritedCommit + 1
                    || outlineEditVersion != beforeInheritedVersion + 1 || snapshotAssignmentWrites != beforeInheritedWrites + 1)
                throw new AssertionError("inherited domain assignments were not deduplicated into one document responsibility");
            directoryAssignments = false;
            String contentOnly = "{\"outlines\":[{\"id\":\"outline-public\",\"handbookId\":\"HB-1\",\"content\":"
                + documentContent.replace("\"order\":1", "\"order\":1,\"techDomainIds\":[\"7\"]") + "}]}";
            int beforeContentCommit = commits;
            int beforeContentWrites = snapshotAssignmentWrites;
            expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot", contentOnly, null), 200, "\"outlineId\":\"outline-public\"");
            if (commits != beforeContentCommit + 1 || snapshotAssignmentWrites != beforeContentWrites + 1)
                throw new AssertionError("content-only assignments did not write one document responsibility");
            directoryAssignments = true;
            int beforeScalarCommit = commits;
            int beforeScalarWrites = snapshotAssignmentWrites;
            try {
                expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot",
                    contentOnly.replace("[\"7\"]", "\"7\""), null), 200, "\"outlineId\":\"outline-public\"");
                if (commits != beforeScalarCommit + 1 || snapshotAssignmentWrites != beforeScalarWrites + 1)
                    throw new AssertionError("scalar content domain or directory filtering lost document responsibility");
            } finally {
                directoryAssignments = false;
            }
            int beforeEmptyDomainCommit = commits;
            int beforeEmptyDomainWrites = snapshotAssignmentWrites;
            String missingAssignmentDomain = "{\"outlines\":[{\"id\":\"outline-public\",\"handbookId\":\"HB-1\","
                + "\"governance\":{\"assignments\":[{\"nodeId\":\"doc-1\"}]},\"content\":" + documentContent + "}]}";
            expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot", missingAssignmentDomain, null),
                200, "\"outlineId\":\"outline-public\"");
            if (commits != beforeEmptyDomainCommit + 1 || snapshotAssignmentWrites != beforeEmptyDomainWrites)
                throw new AssertionError("missing compatible assignment domain created a responsibility item");
            int beforeInvalidDomainCommit = commits;
            int beforeInvalidDomainWrites = snapshotAssignmentWrites;
            expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot", contentOnly.replace("[\"7\"]", "[\"99\"]"), null),
                422, "INVALID_DOMAIN_PAYLOAD");
            if (commits != beforeInvalidDomainCommit || snapshotAssignmentWrites != beforeInvalidDomainWrites)
                throw new AssertionError("invalid content domain committed or wrote a responsibility item");
            legacySnapshotMode = true;
            String legacyContentOnly = "{\"outlines\":[{\"id\":\"outline-public\",\"handbookId\":\"HB-1\",\"content\":{\"parts\":["
                + "{\"part\":\"第一部分\",\"documents\":[{\"id\":\"intro\",\"stableId\":\"doc-1\",\"name\":\"概览\",\"techDomainIds\":[\"7\"]}],"
                + "\"chapters\":[{\"name\":\"第一章\",\"documents\":[{\"id\":\"guide\",\"title\":\"指南\"}]}]}]}}]}";
            int beforeLegacyAssignmentCommit = commits;
            int beforeLegacyAssignmentWrites = snapshotAssignmentWrites;
            expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot", legacyContentOnly, null), 200, "\"outlineId\":\"outline-public\"");
            if (commits != beforeLegacyAssignmentCommit + 1 || snapshotAssignmentWrites != beforeLegacyAssignmentWrites + 1)
                throw new AssertionError("legacy document content assignments were not restored");
            legacyNodeShapes.clear();
            String legacyAliases = """
                {"outlines":[{"id":"outline-public","handbookId":"HB-1","content":{"parts":[
                  {"part":"历史部分","chapters":[
                    {"name":"旧知识点","kps":[{"id":"kp","title":"兼容叶子","outlineLevel":6}]},
                    {"name":"知识点别名","knowledgePoints":[{"id":"knowledge","title":"别名叶子","outlineLevel":7}]},
                    {"name":"空章节"}
                  ]}
                ]}}]}
                """;
            int beforeAliasesCommit = commits;
            int beforeAliasesWrites = snapshotAssignmentWrites;
            expect(write(client, base, "PUT", "/v1/domain/outlines/snapshot", legacyAliases, null), 200, "\"outlineId\":\"outline-public\"");
            if (commits != beforeAliasesCommit + 1 || snapshotAssignmentWrites != beforeAliasesWrites
                    || legacyNodeShapes.size() != 6 || !legacyNodeShapes.containsAll(List.of(
                        "DIRECTORY/历史部分/1/root", "DIRECTORY/旧知识点/2/child", "DOCUMENT/兼容叶子/6/child",
                        "DIRECTORY/知识点别名/2/child", "DOCUMENT/别名叶子/7/child", "DIRECTORY/空章节/2/child")))
                throw new AssertionError("legacy leaf aliases or explicit outline levels were not preserved: " + legacyNodeShapes);
            legacySnapshotMode = false;
            Field capacityField = Main.class.getDeclaredField("DIRECTORY_CACHE_MAX_ENTRIES");
            capacityField.setAccessible(true);
            int capacity = capacityField.getInt(null);
            long savedEditVersion = outlineEditVersion;
            long firstCacheRevision = savedEditVersion + 1000;
            int beforeCacheCommits = commits;
            int beforeCacheReads = nodeReadQueries;
            try {
                for (int index = 0; index <= capacity; index++) {
                    outlineEditVersion = firstCacheRevision + index;
                    expect(request(client, base, "GET", "/v1/domain/outlines/outline-public/directory"), 200,
                        "\"editVersion\":" + outlineEditVersion);
                }
                if (nodeReadQueries != beforeCacheReads + capacity + 1)
                    throw new AssertionError("directory revision changes did not rebuild their projections");
                expect(request(client, base, "GET", "/v1/domain/outlines/outline-public/directory"), 200,
                    "\"editVersion\":" + outlineEditVersion);
                if (nodeReadQueries != beforeCacheReads + capacity + 1)
                    throw new AssertionError("newest directory revision missed cache");
                outlineEditVersion = firstCacheRevision;
                expect(request(client, base, "GET", "/v1/domain/outlines/outline-public/directory"), 200,
                    "\"editVersion\":" + firstCacheRevision);
                if (nodeReadQueries != beforeCacheReads + capacity + 2 || commits != beforeCacheCommits)
                    throw new AssertionError("oldest directory projection was not evicted or GET committed writes");
            } finally {
                outlineEditVersion = savedEditVersion;
            }
        } finally {
            server.stop(0);
            Field poolField = Main.class.getDeclaredField("connectionPool");
            poolField.setAccessible(true);
            Object pool = poolField.get(application);
            Method close = pool.getClass().getDeclaredMethod("closeAll");
            close.setAccessible(true);
            close.invoke(pool);
        }
        System.out.println("PASS: domain and build task HTTP read projections");
    }
}

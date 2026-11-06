import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.security.Provider;
import java.security.Security;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class PlatformGitLabRepositoryCheck {
    private static final class Link {
        long id;
        String key;
        String name;
        String url;
        String project;
        String prefix;
        String branch;
        String mode;
        String auth;
        String credential;
        String purpose;
        String state;
        long version = 1;
        Timestamp createdAt = Timestamp.from(Instant.now());
        Timestamp updatedAt = createdAt;
    }

    private static final class Mapping {
        long id = 101;
        long manualId = 1;
        long connectionId;
        String fingerprint;
        long version = 1;
        Timestamp createdAt = Timestamp.from(Instant.now());
        Timestamp updatedAt = createdAt;
        final List<Object[]> branches = new ArrayList<>();
        final List<Object[]> paths = new ArrayList<>();
    }

    static final class Database {
        final Map<String, Link> links = new LinkedHashMap<>();
        Mapping mapping;
        long nextLinkId = 1;
        boolean failUpdate;

        @SuppressWarnings("unchecked")
        <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
            return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler);
        }

        ResultSet rows(List<Object[]> values) {
            int[] position = {-1};
            return proxy(ResultSet.class, (object, method, args) -> {
                if (method.getName().equals("next")) return ++position[0] < values.size();
                if (method.getName().startsWith("get")) {
                    Object value = values.get(position[0])[(Integer) args[0] - 1];
                    if (method.getName().equals("getLong")) return value == null ? 0L : ((Number) value).longValue();
                    if (method.getName().equals("getString")) return value == null ? null : String.valueOf(value);
                    return value;
                }
                return null;
            });
        }

        Link link(Object keyOrName) {
            return links.values().stream().filter(item -> item.key.equals(keyOrName) || item.name.equals(keyOrName))
                .findFirst().orElse(null);
        }

        Object[] linkRow(Link link) {
            return new Object[]{link.id, link.key, link.name, link.url, link.project, link.prefix, link.branch,
                link.mode, link.auth, link.credential, link.purpose, link.state, link.version, link.createdAt,
                link.updatedAt, mapping != null && mapping.connectionId == link.id ? 1L : 0L};
        }

        List<Object[]> select(String sql, Map<Integer, Object> binds) {
            if (sql.startsWith("SELECT C.GITLAB_CONNECTION_ID")) {
                if (sql.contains("WHERE C.CONNECTION_KEY")) {
                    Link item = link(binds.get(1));
                    return item == null ? List.of() : List.<Object[]>of(linkRow(item));
                }
                return links.values().stream().map(this::linkRow).toList();
            }
            if (sql.startsWith("SELECT MANUAL_ID FROM KC_MANUAL")) return "HB-1".equals(binds.get(1)) ?
                List.<Object[]>of(new Object[]{1L}) : List.of();
            if (sql.startsWith("SELECT GITLAB_CONNECTION_ID FROM")) {
                Link item = link(binds.get(1));
                return item == null ? List.of() : List.<Object[]>of(new Object[]{item.id});
            }
            if (sql.startsWith("SELECT GITLAB_MAPPING_ID,ROW_VERSION")) return mapping == null ?
                List.of() : List.<Object[]>of(new Object[]{mapping.id, mapping.version});
            if (sql.startsWith("SELECT GITLAB_MAPPING_ID FROM")) return mapping == null ?
                List.of() : List.<Object[]>of(new Object[]{mapping.id});
            if (sql.startsWith("SELECT GM.GITLAB_MAPPING_ID")) {
                if (mapping == null || !"HB-1".equals(binds.get(1))) return List.of();
                Link item = links.values().stream().filter(value -> value.id == mapping.connectionId).findFirst().orElseThrow();
                return List.<Object[]>of(new Object[]{mapping.id, "HB-1", item.key, mapping.fingerprint, "ACTIVE",
                    mapping.version, mapping.createdAt, mapping.updatedAt});
            }
            if (sql.startsWith("SELECT BRANCH_NAME,IS_DEFAULT")) return new ArrayList<>(mapping.branches);
            if (sql.startsWith("SELECT LANGUAGE_CODE,REPOSITORY_PATH")) return new ArrayList<>(mapping.paths);
            throw new AssertionError("unexpected query: " + sql);
        }

        int mutate(String sql, Map<Integer, Object> binds) {
            if (sql.startsWith("INSERT INTO KC_GITLAB_CONNECTION")) {
                Link item = new Link();
                item.id = nextLinkId++;
                item.key = String.valueOf(binds.get(1)); item.name = String.valueOf(binds.get(2));
                item.url = String.valueOf(binds.get(3)); item.project = String.valueOf(binds.get(4));
                item.prefix = (String) binds.get(5); item.branch = String.valueOf(binds.get(6));
                item.mode = String.valueOf(binds.get(7)); item.auth = String.valueOf(binds.get(8));
                item.credential = (String) binds.get(9); item.purpose = String.valueOf(binds.get(10));
                item.state = String.valueOf(binds.get(12));
                links.put(item.key, item);
                return 1;
            }
            if (sql.startsWith("UPDATE KC_GITLAB_CONNECTION SET CONNECTION_NAME")) {
                Link item = link(binds.get(13));
                if (failUpdate || item == null || item.version != ((Number) binds.get(14)).longValue()) {
                    failUpdate = false;
                    return 0;
                }
                item.name = String.valueOf(binds.get(1)); item.url = String.valueOf(binds.get(2));
                item.project = String.valueOf(binds.get(3)); item.prefix = (String) binds.get(4);
                item.branch = String.valueOf(binds.get(5)); item.mode = String.valueOf(binds.get(6));
                item.auth = String.valueOf(binds.get(7)); item.credential = (String) binds.get(8);
                item.purpose = String.valueOf(binds.get(9)); item.state = String.valueOf(binds.get(11));
                item.version++; item.updatedAt = Timestamp.from(Instant.now());
                return 1;
            }
            if (sql.startsWith("UPDATE KC_GITLAB_CONNECTION SET STATE")) {
                Link item = link(binds.get(3));
                if (item == null || item.version != ((Number) binds.get(4)).longValue()) return 0;
                item.state = String.valueOf(binds.get(1)); item.version++;
                return 1;
            }
            if (sql.startsWith("INSERT INTO KC_GITLAB_MANUAL_MAPPING")) {
                mapping = new Mapping();
                mapping.connectionId = ((Number) binds.get(2)).longValue();
                mapping.fingerprint = String.valueOf(binds.get(3));
                return 1;
            }
            if (sql.startsWith("UPDATE KC_GITLAB_MANUAL_MAPPING")) {
                if (mapping == null || mapping.version != ((Number) binds.get(5)).longValue() || failUpdate) {
                    failUpdate = false;
                    return 0;
                }
                mapping.connectionId = ((Number) binds.get(1)).longValue();
                mapping.fingerprint = String.valueOf(binds.get(2));
                mapping.version++; mapping.updatedAt = Timestamp.from(Instant.now());
                return 1;
            }
            if (sql.startsWith("DELETE FROM KC_GITLAB_MAPPING_BRANCH")) { mapping.branches.clear(); return 1; }
            if (sql.startsWith("DELETE FROM KC_GITLAB_MAPPING_PATH")) { mapping.paths.clear(); return 1; }
            throw new AssertionError("unexpected mutation: " + sql);
        }

        Connection connection() {
            return proxy(Connection.class, (object, method, args) -> {
                if (method.getName().equals("isClosed")) return false;
                if (method.getName().equals("createStatement")) return proxy(java.sql.Statement.class, (statement, call, values) -> {
                    if (call.getName().equals("executeQuery")) return rows(List.<Object[]>of(new Object[]{1L}));
                    return null;
                });
                if (!method.getName().equals("prepareStatement")) return null;
                String sql = String.valueOf(args[0]);
                Map<Integer, Object> binds = new HashMap<>();
                List<Map<Integer, Object>> batches = new ArrayList<>();
                return proxy(PreparedStatement.class, (statement, call, values) -> {
                    if (call.getName().startsWith("set")) {
                        binds.put((Integer) values[0], call.getName().equals("setNull") ? null : values[1]);
                        return null;
                    }
                    if (call.getName().equals("executeQuery")) return rows(select(sql, binds));
                    if (call.getName().equals("executeUpdate")) return mutate(sql, binds);
                    if (call.getName().equals("addBatch")) { batches.add(new HashMap<>(binds)); return null; }
                    if (call.getName().equals("executeBatch")) {
                        for (Map<Integer, Object> batch : batches) {
                            if (sql.startsWith("INSERT INTO KC_GITLAB_MAPPING_BRANCH"))
                                mapping.branches.add(new Object[]{batch.get(2), batch.get(3)});
                            else if (sql.startsWith("INSERT INTO KC_GITLAB_MAPPING_PATH"))
                                mapping.paths.add(new Object[]{batch.get(2), batch.get(3)});
                            else throw new AssertionError("unexpected batch: " + sql);
                        }
                        return new int[batches.size()];
                    }
                    return null;
                });
            });
        }
    }

    private interface SqlCall { void run() throws Exception; }

    private static void rejected(String code, SqlCall call) throws Exception {
        try { call.run(); throw new AssertionError("accepted: " + code); }
        catch (SQLException expected) { if (!code.equals(expected.getMessage())) throw expected; }
    }

    private static Map<String, Object> connectionInput() {
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("id", "conn-1"); input.put("name", "手册仓库");
        input.put("baseUrl", "https://gitlab.example"); input.put("projectPath", "team/docs");
        input.put("pathPrefix", "docs"); input.put("defaultBranch", "main");
        input.put("mode", "sandbox"); input.put("authMode", "service_account");
        input.put("purpose", "read_write"); input.put("credentialRef", "fixture"); input.put("status", "active");
        return input;
    }

    private static Map<String, Object> mappingInput() {
        return Map.of("connectionId", "conn-1", "defaultBranch", "main",
            "enabledBranches", List.of("dev"), "zhPaths", List.of("/docs/zh/"), "enPaths", List.of("docs/en"));
    }

    public static void main(String[] args) throws Exception {
        Database database = new Database();
        Connection connection = database.connection();
        PlatformGitLabRepository repository = new PlatformGitLabRepository();
        if (!Integer.valueOf(0).equals(repository.listConnections(connection).get("total")) ||
            repository.findConnection(connection, "missing") != null || repository.findMapping(connection, "HB-1") != null)
            throw new AssertionError("empty GitLab configuration projection failed");

        Map<String, Object> input = connectionInput();
        Map<String, Object> missingName = new LinkedHashMap<>(input); missingName.put("name", " ");
        rejected("GITLAB_CONNECTION_NAME_REQUIRED", () -> repository.upsertConnection(connection, missingName, null, "tester"));
        Map<String, Object> invalidMode = new LinkedHashMap<>(input); invalidMode.put("mode", "unknown");
        rejected("GITLAB_RUN_MODE_INVALID", () -> repository.upsertConnection(connection, invalidMode, null, "tester"));
        Map<String, Object> missingUrl = new LinkedHashMap<>(input); missingUrl.put("baseUrl", " ");
        rejected("GITLAB_BASE_URL_REQUIRED", () -> repository.upsertConnection(connection, missingUrl, null, "tester"));
        Map<String, Object> missingProject = new LinkedHashMap<>(input); missingProject.put("projectPath", " ");
        rejected("GITLAB_PROJECT_REQUIRED", () -> repository.upsertConnection(connection, missingProject, null, "tester"));
        Map<String, Object> invalidAuth = new LinkedHashMap<>(input); invalidAuth.put("authMode", "unknown");
        rejected("GITLAB_AUTH_MODE_INVALID", () -> repository.upsertConnection(connection, invalidAuth, null, "tester"));
        Map<String, Object> invalidPurpose = new LinkedHashMap<>(input); invalidPurpose.put("purpose", "unknown");
        rejected("GITLAB_PURPOSE_INVALID", () -> repository.upsertConnection(connection, invalidPurpose, null, "tester"));
        rejected("ROW_VERSION_CONFLICT", () -> repository.upsertConnection(connection, input, 1L, "tester"));

        Map<String, Object> created = repository.upsertConnection(connection, input, null, "tester");
        if (!"conn-1".equals(created.get("id")) || !"sandbox".equals(created.get("mode")) ||
            !"read_write".equals(created.get("purpose")) || !Integer.valueOf(1).equals(repository.listConnections(connection).get("total")))
            throw new AssertionError("connection projection failed: " + created);
        rejected("ROW_VERSION_CONFLICT", () -> repository.upsertConnection(connection, input, null, "tester"));
        rejected("ROW_VERSION_CONFLICT", () -> repository.upsertConnection(connection, input, 0L, "tester"));
        Map<String, Object> editedInput = new LinkedHashMap<>(input); editedInput.put("name", "修订仓库");
        editedInput.put("pathPrefix", ""); editedInput.put("credentialRef", "");
        Map<String, Object> edited = repository.upsertConnection(connection, editedInput, 1L, "tester");
        if (!"修订仓库".equals(edited.get("name")) || ((Number) edited.get("rowVersion")).longValue() != 2)
            throw new AssertionError("connection update failed");
        database.failUpdate = true;
        rejected("ROW_VERSION_CONFLICT", () -> repository.upsertConnection(connection, editedInput, 2L, "tester"));
        rejected("GITLAB_CONNECTION_NOT_FOUND", () -> repository.setConnectionState(connection, "missing", "active", 1, "tester"));
        rejected("ROW_VERSION_CONFLICT", () -> repository.setConnectionState(connection, "conn-1", "active", 1, "tester"));
        rejected("GITLAB_STATE_INVALID", () -> repository.setConnectionState(connection, "conn-1", "unknown", 2, "tester"));
        Map<String, Object> inactive = repository.setConnectionState(connection, "conn-1", "inactive", 2, "tester");
        if (!"inactive".equals(inactive.get("status"))) throw new AssertionError("state update failed");
        Map<String, Object> generatedInput = connectionInput();
        generatedInput.remove("id"); generatedInput.remove("baseUrl"); generatedInput.remove("projectPath");
        generatedInput.put("name", "第二仓库"); generatedInput.put("host", "https://fallback.example");
        generatedInput.put("project", "team/fallback"); generatedInput.put("pathPrefix", "");
        generatedInput.put("credentialRef", ""); generatedInput.put("authMode", "user_oauth");
        Map<String, Object> generated = repository.upsertConnection(connection, generatedInput, null, "tester");
        if (!String.valueOf(generated.get("id")).startsWith("gitlab-") ||
            !"https://fallback.example".equals(generated.get("baseUrl")) ||
            !"".equals(generated.get("pathPrefix"))) throw new AssertionError("fallback connection invalid: " + generated);

        rejected("ASSET_NOT_FOUND", () -> repository.replaceMapping(connection, "missing", mappingInput(), null, "tester"));
        Map<String, Object> absentConnection = new LinkedHashMap<>(mappingInput()); absentConnection.put("connectionId", "missing");
        rejected("GITLAB_CONNECTION_NOT_FOUND", () -> repository.replaceMapping(connection, "HB-1", absentConnection, null, "tester"));
        Map<String, Object> noPaths = new LinkedHashMap<>(mappingInput()); noPaths.put("zhPaths", List.of()); noPaths.put("enPaths", List.of());
        rejected("MAPPING_VALIDATION_FAILED", () -> repository.replaceMapping(connection, "HB-1", noPaths, null, "tester"));
        Map<String, Object> absentPaths = new LinkedHashMap<>(mappingInput());
        absentPaths.remove("zhPaths"); absentPaths.remove("enPaths");
        rejected("MAPPING_VALIDATION_FAILED", () -> repository.replaceMapping(connection, "HB-1", absentPaths, null, "tester"));
        Map<String, Object> unsafePath = new LinkedHashMap<>(mappingInput()); unsafePath.put("zhPaths", List.of("../private"));
        rejected("MAPPING_VALIDATION_FAILED", () -> repository.replaceMapping(connection, "HB-1", unsafePath, null, "tester"));
        for (String path : List.of("docs/../private", "docs/..", "/")) {
            Map<String, Object> invalidPath = new LinkedHashMap<>(mappingInput());
            invalidPath.put("zhPaths", List.of(path));
            rejected("MAPPING_VALIDATION_FAILED", () -> repository.replaceMapping(connection, "HB-1", invalidPath, null, "tester"));
        }
        Map<String, Object> nullPath = new LinkedHashMap<>(mappingInput());
        nullPath.put("zhPaths", java.util.Arrays.asList((String) null));
        rejected("MAPPING_VALIDATION_FAILED", () -> repository.replaceMapping(connection, "HB-1", nullPath, null, "tester"));
        Map<String, Object> selectedBranch = new LinkedHashMap<>(mappingInput());
        selectedBranch.put("defaultBranch", " "); selectedBranch.put("selectedBranch", "main");
        selectedBranch.put("zhPaths", List.of()); selectedBranch.put("enPaths", List.of());
        rejected("MAPPING_VALIDATION_FAILED", () -> repository.replaceMapping(connection, "HB-1", selectedBranch, null, "tester"));
        rejected("ROW_VERSION_CONFLICT", () -> repository.replaceMapping(connection, "HB-1", mappingInput(), 1L, "tester"));

        Map<String, Object> mapping = repository.replaceMapping(connection, "HB-1", mappingInput(), null, "tester");
        if (!"conn-1".equals(mapping.get("connectionId")) || !"main".equals(mapping.get("defaultBranch")) ||
            !((List<?>) mapping.get("enabledBranches")).containsAll(List.of("dev", "main")) ||
            !List.of("docs/zh").equals(mapping.get("zhPaths")) || !List.of("docs/en").equals(mapping.get("enPaths")))
            throw new AssertionError("mapping projection failed: " + mapping);
        if (((Number) repository.findConnection(connection, "conn-1").get("linkedHandbookCount")).longValue() != 1)
            throw new AssertionError("linked handbook count failed");
        rejected("ROW_VERSION_CONFLICT", () -> repository.replaceMapping(connection, "HB-1", mappingInput(), null, "tester"));
        rejected("ROW_VERSION_CONFLICT", () -> repository.replaceMapping(connection, "HB-1", mappingInput(), 0L, "tester"));
        Map<String, Object> nextMapping = new LinkedHashMap<>(mappingInput());
        nextMapping.put("enabledBranches", List.of("release")); nextMapping.put("zhPaths", List.of("docs/new"));
        nextMapping.put("enPaths", List.of());
        Map<String, Object> changed = repository.replaceMapping(connection, "HB-1", nextMapping, 1L, "tester");
        if (((Number) changed.get("rowVersion")).longValue() != 2 ||
            !List.of("docs/new").equals(changed.get("zhPaths")) || !((List<?>) changed.get("enPaths")).isEmpty())
            throw new AssertionError("mapping replacement failed: " + changed);
        database.failUpdate = true;
        rejected("ROW_VERSION_CONFLICT", () -> repository.replaceMapping(connection, "HB-1", nextMapping, 2L, "tester"));
        Provider[] providers = Security.getProviders();
        try {
            for (Provider provider : providers) Security.removeProvider(provider.getName());
            try {
                repository.upsertConnection(connection, input, 3L, "tester");
                throw new AssertionError("missing SHA-256 provider was ignored");
            } catch (IllegalStateException expected) {
                if (!(expected.getCause() instanceof java.security.NoSuchAlgorithmException)) throw expected;
            }
        } finally {
            for (Provider provider : providers) Security.addProvider(provider);
        }
        System.out.println("PASS: GitLab connections, mappings, versions and path validation");
    }
}

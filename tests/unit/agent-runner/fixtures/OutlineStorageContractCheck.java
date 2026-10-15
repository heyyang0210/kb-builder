import java.lang.reflect.*;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import javax.sql.rowset.serial.SerialClob;

/** 确定性 JDBC 替身：不加载 JDBC 驱动、不连接任何数据库。 */
public final class OutlineStorageContractCheck {
    private static final class Fixture {
        final List<String> sql = new ArrayList<>();
        final List<Map<Integer, Object>> inserts = new ArrayList<>();
        long sequence = 1000;
        boolean existingVersion;
        Timestamp deletedAt;

        Connection connection() {
            return proxy(Connection.class, (object, method, args) -> {
                if (method.getName().equals("prepareStatement")) return statement((String) args[0]);
                return defaultValue(method.getReturnType());
            });
        }

        PreparedStatement statement(String query) {
            sql.add(query);
            Map<Integer, Object> binds = new LinkedHashMap<>();
            return proxy(PreparedStatement.class, (object, method, args) -> {
                String name = method.getName();
                if (name.startsWith("set")) {
                    Object value = name.equals("setNull") ? null : args[1];
                    if (value instanceof java.io.Reader reader) {
                        java.io.StringWriter text = new java.io.StringWriter();
                        reader.transferTo(text);
                        value = text.toString();
                    }
                    binds.put((Integer) args[0], value);
                    return null;
                }
                if (name.equals("executeUpdate")) {
                    check(query.startsWith("INSERT INTO KC_MANUAL_OUTLINE_NODE"), "unexpected mutation: " + query);
                    inserts.add(new LinkedHashMap<>(binds));
                    return 1;
                }
                if (name.equals("executeQuery")) {
                    if (query.contains("NEXTVAL")) return rows(Collections.singletonList(new Object[]{++sequence}));
                    if (query.startsWith("SELECT OUTLINE_ID FROM KC_MANUAL_OUTLINE")) return rows(Collections.singletonList(new Object[]{10L}));
                    if (query.startsWith("SELECT OUTLINE_VERSION_ID")) return rows(existingVersion ? Collections.singletonList(new Object[]{42L, 1L, deletedAt}) : List.of());
                    if (query.startsWith("SELECT N.NODE_KEY")) {
                        List<Object[]> values = new ArrayList<>();
                        Map<Object, Object> keys = new HashMap<>();
                        inserts.forEach(node -> keys.put(node.get(1), node.get(3)));
                        for (Map<Integer, Object> node : inserts) values.add(new Object[]{node.get(3), keys.get(node.get(4)), node.get(5), node.get(3), node.get(6), node.get(7), node.get(8), node.get(9)});
                        return rows(values);
                    }
                    throw new AssertionError("unexpected query: " + query);
                }
                return defaultValue(method.getReturnType());
            });
        }

        ResultSet rows(List<Object[]> values) {
            int[] current = {-1};
            return proxy(ResultSet.class, (object, method, args) -> {
                if (method.getName().equals("next")) return ++current[0] < values.size();
                if (method.getName().startsWith("get")) {
                    Object value = values.get(current[0])[(Integer) args[0] - 1];
                    return switch (method.getName()) {
                        case "getLong" -> value == null ? 0L : ((Number) value).longValue();
                        case "getString" -> value == null ? null : value.toString();
                        case "getClob" -> value == null ? null : new SerialClob(value.toString().toCharArray());
                        default -> value;
                    };
                }
                return defaultValue(method.getReturnType());
            });
        }
    }

    @SuppressWarnings("unchecked")
    static <T> T proxy(Class<T> type, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler);
    }

    static Object defaultValue(Class<?> type) {
        if (type == boolean.class) return false;
        if (type == int.class) return 0;
        if (type == long.class) return 0L;
        return null;
    }

    static Object invoke(Object target, String name, Class<?>[] types, Object... args) throws Exception {
        Method method = target.getClass().getDeclaredMethod(name, types);
        method.setAccessible(true);
        try { return method.invoke(target, args); }
        catch (InvocationTargetException error) { throw (Exception) error.getCause(); }
    }

    static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }

    @SuppressWarnings("unchecked")
    public static void main(String[] args) throws Exception {
        Class<?> json = Class.forName("Main$Json");
        Method parse = json.getDeclaredMethod("parse", String.class);
        parse.setAccessible(true);
        Map<String, Object> content = (Map<String, Object>) parse.invoke(null, Files.readString(Path.of(args[0])));
        List<Map<String, Object>> nodes = (List<Map<String, Object>>) content.get("nodes");
        List<Map<String, Object>> normalized = OutlineNodeSnapshot.normalize(nodes);
        check(normalized.size() == nodes.size(), "node count");
        Constructor<Main> constructor = Main.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        Main main = constructor.newInstance();
        check((int) invoke(main, "countLeafDocuments", new Class<?>[]{Object.class}, content) == 501, "document count");
        List<?> assignments = (List<?>) invoke(main, "assignmentsFromContent", new Class<?>[]{Object.class, String.class}, content, "new-version");
        check(assignments.size() == 501, "domain assignments");
        Map<String, Object> outline = new LinkedHashMap<>(Map.of("id", "new-version", "handbookId", "DB-004", "content", content));
        Fixture fixture = new Fixture();
        invoke(main, "rebuildOutlineChildren", new Class<?>[]{Connection.class, long.class, String.class, Map.class, boolean.class}, fixture.connection(), 99L, "new-version", outline, false);
        check(fixture.inserts.size() == nodes.size(), "insert count");
        Map<Object, Object> keys = new HashMap<>();
        for (int index = 0; index < nodes.size(); index++) {
            Map<String, Object> node = nodes.get(index);
            Map<Integer, Object> insert = fixture.inserts.get(index);
            check(node.get("id").equals(insert.get(3)), "node identity");
            check(Objects.equals(node.get("parentId"), keys.get(insert.get(4))), "parent identity");
            check(node.get("title").equals(insert.get(6)), "filename title");
            check(node.get("description").equals(insert.get(7)), "description");
            check(((Number) node.get("level")).longValue() == ((Number) insert.get(8)).longValue(), "depth");
            check(((Number) node.get("order")).longValue() == ((Number) insert.get(9)).longValue(), "row order");
            keys.put(insert.get(1), insert.get(3));
        }
        List<Map<String, Object>> reread = (List<Map<String, Object>>) invoke(main, "outlineNodes", new Class<?>[]{Connection.class, long.class}, fixture.connection(), 99L);
        for (int index = 0; index < nodes.size(); index++) check(nodes.get(index).get("path").equals(reread.get(index).get("path")), "read path");
        check(fixture.sql.stream().noneMatch(query -> query.startsWith("DELETE") || query.startsWith("UPDATE")), "new nodes must be insert-only");

        Fixture conflict = new Fixture();
        conflict.existingVersion = true;
        try {
            invoke(main, "saveOutlinesSnapshot", new Class<?>[]{Connection.class, Map.class}, conflict.connection(), Map.of("outlines", List.of(outline), "insertOnly", true));
            throw new AssertionError("existing version overwritten");
        } catch (SQLException expected) { check(expected.getMessage().equals("OUTLINE_VERSION_CONFLICT"), "conflict code"); }
        check(conflict.sql.size() == 1 && conflict.sql.get(0).startsWith("SELECT"), "conflict must precede mutations");
        try {
            invoke(main, "upsertOutlineVersion", new Class<?>[]{Connection.class, long.class, String.class, Map.class, Map.class}, conflict.connection(), 7L, "new-version", outline, Map.of("insertOnly", true));
            throw new AssertionError("locked version overwritten");
        } catch (SQLException expected) { check(expected.getMessage().equals("OUTLINE_VERSION_CONFLICT"), "locked conflict code"); }
        check(conflict.sql.stream().allMatch(query -> query.startsWith("SELECT")), "locked conflict must not mutate");
        conflict.deletedAt = Timestamp.from(java.time.Instant.now());
        for (Map<String, Object> snapshot : List.of(Map.<String, Object>of(), Map.<String, Object>of("insertOnly", true))) {
            try {
                invoke(main, "upsertOutlineVersion", new Class<?>[]{Connection.class, long.class, String.class, Map.class, Map.class}, conflict.connection(), 7L, "new-version", outline, snapshot);
                throw new AssertionError("deleted version overwritten");
            } catch (SQLException expected) { check(expected.getMessage().equals("OUTLINE_DELETED"), "deleted version code"); }
        }
        check(conflict.sql.stream().allMatch(query -> query.startsWith("SELECT")), "deleted version must not mutate");
        Map<String, Object> invalid = new LinkedHashMap<>(nodes.get(0));
        invalid.put("parentId", "missing-parent");
        try { OutlineNodeSnapshot.normalize(List.of(invalid)); throw new AssertionError("missing parent accepted"); }
        catch (SQLException expected) { check(expected.getMessage().equals("INVALID_DIRECTORY_HIERARCHY"), "hierarchy validation"); }
        System.out.println("PASS: 501 documents, node insertion/readback/order/assignments, insert-only conflict protection");
    }
}

import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import javax.sql.rowset.serial.SerialClob;

public final class HandbookProjectionCheck {
    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler);
    }

    private static Connection connection(Object[][] rows, Throwable failure) {
        int[] position = {-1};
        ResultSet result = proxy(ResultSet.class, (object, method, args) -> {
            if (method.getName().equals("next")) return ++position[0] < rows.length;
            if (method.getName().startsWith("get")) {
                Object value = rows[position[0]][(Integer) args[0] - 1];
                if (method.getName().equals("getLong")) return ((Number) value).longValue();
                return value;
            }
            return null;
        });
        PreparedStatement query = proxy(PreparedStatement.class, (object, method, args) ->
            method.getName().equals("executeQuery") ? result : null);
        return proxy(Connection.class, (object, method, args) -> {
            if (method.getName().equals("prepareStatement")) {
                if (!HandbookProjectionRepository.LIST_SQL.equals(args[0])) throw new AssertionError("wrong projection query");
                if (failure != null) throw failure;
                return query;
            }
            return null;
        });
    }

    public static void main(String[] args) throws Exception {
        HandbookProjectionRepository repository = new HandbookProjectionRepository();
        HandbookProjectionRepository.Projection empty = repository.list(connection(new Object[0][], null));
        if (!empty.rows().isEmpty() || empty.queryMs() < 0 || empty.mappingMs() < 0)
            throw new AssertionError("empty projection or timing invalid");

        Timestamp now = Timestamp.valueOf("2026-11-05 00:00:00");
        Object[][] rows = {
            { 101L, "HB-1", "手册一", 1L, "产品", "org", "outline-1", "ACTIVE", "PUBLISHED", null,
              2L, new SerialClob("跨段摘要".toCharArray()), "manual", "Y", now, now, "owner-1", "甲", "deputy-1", "乙" },
            { 102L, "HB-2", "手册二", 2L, "产品", "org", null, "ACTIVE", null, null,
              1L, null, "manual", "N", now, now, null, null, null, null },
        };
        List<HandbookProjectionRepository.HandbookRow> projected = repository.list(connection(rows, null)).rows();
        if (projected.size() != 2 || !"跨段摘要".equals(projected.get(0).summary()) ||
            !projected.get(0).externallyVisible() || projected.get(1).summary() != null ||
            projected.get(1).externallyVisible() || projected.get(0).manualId() != 101L ||
            !"乙".equals(projected.get(0).deputyOwnerName()))
            throw new AssertionError("handbook row mapping invalid: " + projected);

        try {
            repository.list(connection(rows, new SQLException("read failed")));
            throw new AssertionError("SQL failure was ignored");
        } catch (SQLException expected) {
            if (!"read failed".equals(expected.getMessage())) throw expected;
        }
        try {
            repository.list(connection(rows, new IllegalStateException("driver failed")));
            throw new AssertionError("driver failure was ignored");
        } catch (SQLException expected) {
            if (!"读取手册投影失败".equals(expected.getMessage()) ||
                !(expected.getCause() instanceof IllegalStateException)) throw expected;
        }
        System.out.println("PASS: handbook projection row mapping, timing and error boundaries");
    }
}

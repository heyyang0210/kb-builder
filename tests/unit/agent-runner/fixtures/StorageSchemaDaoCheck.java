import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public final class StorageSchemaDaoCheck {
    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler);
    }

    private static Connection connection(long existing, List<String> executed) {
        return connection(existing, executed, false);
    }

    private static Connection connection(long existing, List<String> executed, boolean failCleanup) {
        ResultSet result = proxy(ResultSet.class, (object, method, args) -> {
            if (method.getName().equals("next")) {
                if (failCleanup) throw new SQLException("result read failed");
                return true;
            }
            if (method.getName().equals("getLong")) return existing;
            if (method.getName().equals("close") && failCleanup) throw new SQLException("result close failed");
            return null;
        });
        PreparedStatement query = proxy(PreparedStatement.class, (object, method, args) -> {
            if (method.getName().equals("setString") &&
                (!Integer.valueOf(1).equals(args[0]) || !"IDX".equals(args[1]))) throw new AssertionError("wrong index lookup");
            if (method.getName().equals("executeQuery")) return result;
            if (method.getName().equals("close") && failCleanup) throw new SQLException("query close failed");
            return null;
        });
        Statement statement = proxy(Statement.class, (object, method, args) -> {
            if (method.getName().equals("execute")) {
                executed.add((String) args[0]);
                return true;
            }
            return null;
        });
        return proxy(Connection.class, (object, method, args) -> {
            if (method.getName().equals("prepareStatement")) {
                if (!String.valueOf(args[0]).contains("USER_INDEXES")) throw new AssertionError("wrong catalog query");
                return query;
            }
            if (method.getName().equals("createStatement")) return statement;
            return null;
        });
    }

    public static void main(String[] args) throws Exception {
        List<String> executed = new ArrayList<>();
        StorageSchemaDao.createIndexIfMissing(connection(1, executed), "IDX", "CREATE INDEX IDX ON T (ID);");
        if (!executed.isEmpty()) throw new AssertionError("existing index executed DDL");
        StorageSchemaDao.createIndexIfMissing(connection(0, executed), "IDX", " CREATE INDEX IDX ON T (ID); ");
        StorageSchemaDao.createIndexIfMissing(connection(0, executed), "IDX", " CREATE INDEX IDX ON T (ID) ");
        if (!executed.equals(List.of("CREATE INDEX IDX ON T (ID)", "CREATE INDEX IDX ON T (ID)")))
            throw new AssertionError("incorrect DDL: " + executed);
        try {
            StorageSchemaDao.createIndexIfMissing(connection(0, executed, true), "IDX", "CREATE INDEX IDX ON T (ID)");
            throw new AssertionError("catalog read failure was ignored");
        } catch (SQLException expected) {
            if (!"result read failed".equals(expected.getMessage()) || expected.getSuppressed().length != 2)
                throw new AssertionError("catalog failure or cleanup errors were lost", expected);
        }
        System.out.println("PASS: existing index skipped and DDL terminator normalized");
    }
}

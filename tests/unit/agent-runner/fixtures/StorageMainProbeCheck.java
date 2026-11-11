import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.Driver;
import java.sql.DriverManager;
import java.sql.DriverPropertyInfo;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Properties;
import java.util.logging.Logger;

/** Runs the real one-shot probe command with a deterministic JDBC driver. */
public final class StorageMainProbeCheck {
    private static String resultMode = "success";
    private static int closedConnections;

    private static Object defaultValue(Class<?> type) {
        if (!type.isPrimitive()) return null;
        if (type == boolean.class) return false;
        if (type == int.class) return 0;
        if (type == long.class) return 0L;
        if (type == double.class) return 0d;
        if (type == float.class) return 0f;
        if (type == short.class) return (short) 0;
        if (type == byte.class) return (byte) 0;
        if (type == char.class) return '\0';
        return null;
    }

    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler));
    }

    private static ResultSet resultSet() {
        int[] cursor = {0};
        return proxy(ResultSet.class, (self, method, args) -> switch (method.getName()) {
            case "next" -> !"empty".equals(resultMode) && cursor[0]++ == 0;
            case "getInt" -> "wrong-value".equals(resultMode) ? 0 : 1;
            default -> defaultValue(method.getReturnType());
        });
    }

    private static Statement statement() {
        return proxy(Statement.class, (self, method, args) -> switch (method.getName()) {
            case "executeQuery" -> resultSet();
            default -> defaultValue(method.getReturnType());
        });
    }

    private static Connection connection() {
        return proxy(Connection.class, (self, method, args) -> {
            if (method.getName().equals("createStatement")) return statement();
            if (method.getName().equals("close")) { closedConnections++; return null; }
            return defaultValue(method.getReturnType());
        });
    }

    public static void main(String[] args) throws Exception {
        resultMode = args.length == 0 ? "success" : args[0];
        if (!"success".equals(resultMode) && !"empty".equals(resultMode) && !"wrong-value".equals(resultMode))
            throw new IllegalArgumentException("unknown fixture result mode: " + resultMode);
        DriverManager.registerDriver(new Driver() {
            public boolean acceptsURL(String url) { return url.startsWith("jdbc:fixture:business"); }
            public Connection connect(String url, Properties properties) { return acceptsURL(url) ? connection() : null; }
            public DriverPropertyInfo[] getPropertyInfo(String url, Properties properties) { return new DriverPropertyInfo[0]; }
            public int getMajorVersion() { return 1; }
            public int getMinorVersion() { return 0; }
            public boolean jdbcCompliant() { return false; }
            public Logger getParentLogger() { return Logger.getGlobal(); }
        });
        try {
            Main.main(new String[]{"probe"});
        } catch (java.sql.SQLException error) {
            if ("success".equals(resultMode) || !"数据库最小探测未返回预期结果".equals(error.getMessage()) || closedConnections == 0)
                throw error;
            System.out.println("PASS: probe rejected " + resultMode + " result and closed JDBC resources");
            return;
        }
        throw new AssertionError("probe should exit after printing its result");
    }
}

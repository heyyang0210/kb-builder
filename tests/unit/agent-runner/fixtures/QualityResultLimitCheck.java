import java.lang.reflect.Proxy;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.util.List;
import java.util.Map;

public final class QualityResultLimitCheck {
    private static ResultSet rows(int count) {
        ResultSetMetaData meta = (ResultSetMetaData) Proxy.newProxyInstance(
            QualityResultLimitCheck.class.getClassLoader(), new Class<?>[] { ResultSetMetaData.class },
            (proxy, method, args) -> switch (method.getName()) {
                case "getColumnCount" -> 1;
                case "getColumnLabel" -> "C1";
                default -> throw new UnsupportedOperationException(method.getName());
            });
        final int[] cursor = { 0 };
        return (ResultSet) Proxy.newProxyInstance(QualityResultLimitCheck.class.getClassLoader(),
            new Class<?>[] { ResultSet.class }, (proxy, method, args) -> switch (method.getName()) {
                case "getMetaData" -> meta;
                case "next" -> ++cursor[0] <= count;
                case "getObject" -> cursor[0];
                default -> throw new UnsupportedOperationException(method.getName());
            });
    }

    public static void main(String[] args) throws Exception {
        Map<String, Object> exact = Main.qualityResult(rows(2), 2, "test-version");
        Map<String, Object> overflow = Main.qualityResult(rows(3), 2, "test-version");
        if (!Boolean.FALSE.equals(exact.get("truncated")) || !Boolean.TRUE.equals(overflow.get("truncated"))) {
            throw new AssertionError("质量检查截断状态错误");
        }
        if (((List<?>) exact.get("rows")).size() != 2 || ((List<?>) overflow.get("rows")).size() != 2
            || !"test-version".equals(exact.get("databaseVersion"))) {
            throw new AssertionError("质量检查结果投影错误");
        }
        System.out.println("PASS: exact limit and overflow");
    }
}

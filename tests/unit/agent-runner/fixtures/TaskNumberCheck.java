import java.sql.SQLException;

public final class TaskNumberCheck {
    public static void main(String[] args) throws Exception {
        TaskNumber task = TaskNumber.parse("KC-PLATFORM-123");
        if (!"KC-PLATFORM".equals(task.prefix) || task.value != 123)
            throw new AssertionError("任务编号拆分错误");
        if (TaskNumber.sr("YDBRD-42") != 42 || TaskNumber.ir("YASHAN-7") != 7)
            throw new AssertionError("Pingcode 编号拆分错误");
        if (!"YDBRD-42".equals(TaskNumber.sr(42)) || !"YASHAN-7".equals(TaskNumber.ir(7)))
            throw new AssertionError("外部编号组装错误");
        for (String value : new String[] { "YDBRD-01", "YDBRD-9223372036854775808", "YDBRD-X", "-1" }) {
            try {
                TaskNumber.parse(value);
                throw new AssertionError("非法编号未拒绝：" + value);
            } catch (SQLException expected) {
                if (!"DOCUMENT_TASK_NUMBER_INVALID".equals(expected.getMessage())) throw expected;
            }
        }
        System.out.println("PASS: numeric task numbers");
    }
}

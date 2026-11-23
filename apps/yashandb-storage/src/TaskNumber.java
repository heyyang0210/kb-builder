import java.sql.SQLException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Numeric database identity for an externally formatted task number. */
final class TaskNumber {
    final String prefix;
    final long value;

    private TaskNumber(String prefix, long value) {
        this.prefix = prefix;
        this.value = value;
    }

    static TaskNumber parse(String external) throws SQLException {
        if (external == null) throw new SQLException("DOCUMENT_TASK_NUMBER_INVALID");
        int separator = external.lastIndexOf('-');
        if (separator < 1 || separator > 16 || separator == external.length() - 1)
            throw new SQLException("DOCUMENT_TASK_NUMBER_INVALID");
        String prefix = external.substring(0, separator);
        String digits = external.substring(separator + 1);
        if (!prefix.matches("[A-Za-z][A-Za-z0-9_-]*") || !digits.matches("0|[1-9][0-9]*"))
            throw new SQLException("DOCUMENT_TASK_NUMBER_INVALID");
        try {
            return new TaskNumber(prefix, Long.parseLong(digits));
        } catch (NumberFormatException error) {
            throw new SQLException("DOCUMENT_TASK_NUMBER_INVALID", error);
        }
    }

    static long sr(String external) throws SQLException {
        TaskNumber parsed = parse(external);
        if (!"YDBRD".equals(parsed.prefix)) throw new SQLException("PINGCODE_SR_NUMBER_INVALID");
        return parsed.value;
    }

    static long ir(String external) throws SQLException {
        TaskNumber parsed = parse(external);
        if (!"YASHAN".equals(parsed.prefix)) throw new SQLException("PINGCODE_IR_NUMBER_INVALID");
        return parsed.value;
    }

    static TaskNumber parseTask(String external) throws SQLException {
        try {
            return parse(external);
        } catch (SQLException invalidNumericIdentity) {
            if (external == null || external.isBlank() || external.length() > 256)
                throw invalidNumericIdentity;
            try {
                byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(external.getBytes(StandardCharsets.UTF_8));
                long value = ByteBuffer.wrap(digest).getLong() & Long.MAX_VALUE;
                return new TaskNumber("LEGACY", value);
            } catch (java.security.NoSuchAlgorithmException impossible) {
                throw new IllegalStateException(impossible);
            }
        }
    }

    static String sr(long value) { return "YDBRD-" + value; }
    static String ir(long value) { return "YASHAN-" + value; }

}

public final class PingcodeTaskSourceUrlCheck {
    public static void main(String[] args) {
        expect("REQUIREMENT", "https://pingcode.yasdb.com/ship/products/YASHAN/baselines/y28FbpmM/ideas?category=all", true);
        expect("TICKET", "https://pingcode.yasdb.com/pjm/projects/YDBRD/defect/nGn-Krlo", true);
        expect("TICKET", "https://pingcode.yasdb.com/pjm/projects/YDBRD/defect/nGn-Krlo?other=1", false);
        expect("TICKET", "https://pingcode.yasdb.com.evil.example/pjm/projects/YDBRD/defect/nGn-Krlo", false);
        expect("REQUIREMENT", "https://person@pingcode.yasdb.com/ship/products/YASHAN/baselines/a/ideas", false);
        expect("REQUIREMENT", "http://pingcode.yasdb.com/ship/products/YASHAN/baselines/a/ideas", false);
        expect("TICKET", "https://pingcode.yasdb.com/pjm/projects/OTHER/defect/nGn-Krlo", false);
    }

    private static void expect(String type, String url, boolean accepted) {
        if (PingcodeTaskRepository.validSourceUrl(type, url) != accepted) {
            throw new AssertionError("Unexpected URL validation result: " + url);
        }
    }
}

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class PingcodeTaskPayloadCheck {
    public static void main(String[] args) {
        Map<String, Object> original = new LinkedHashMap<>();
        original.put("number", "YDBRD-101");
        original.put("description", "旧标题");
        original.put("ownerId", "person-1");
        original.put("revision", 7);
        original.put("decomposition", Map.of("confirmed", true, "handbooks", List.of(Map.of("id", "book-1"))));
        original.put("source", Map.of("sourceOwner", "上游负责人", "description", "旧标题"));
        Map<String, String> latest = Map.of("title", "新标题", "type", "REQUIREMENT",
            "url", "https://pingcode.yasdb.com/ship/products/YASHAN/baselines/test/ideas");
        Map<String, Object> merged = PingcodeTaskRepository.mergeTaskSource(original, latest, "source-1");
        if (!"新标题".equals(merged.get("description")) || !"REQUIREMENT".equals(merged.get("sourceType"))
            || !"source-1".equals(merged.get("primarySourceId"))) throw new AssertionError("来源字段未更新");
        if (!"person-1".equals(merged.get("ownerId")) || !Integer.valueOf(7).equals(merged.get("revision"))
            || !original.get("decomposition").equals(merged.get("decomposition")))
            throw new AssertionError("业务任务事实被覆盖");
        Map<?, ?> source = (Map<?, ?>) merged.get("source");
        if (!"新标题".equals(source.get("description")) || !latest.get("url").equals(source.get("sourceUrl"))
            || !"上游负责人".equals(source.get("sourceOwner"))) throw new AssertionError("详情来源不一致");
        if (!"旧标题".equals(original.get("description"))) throw new AssertionError("原始快照被修改");
    }
}

import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class OutlineNodeSnapshotTest {
    private static Map<String, Object> node(String id, String title, String kind, String parentId, long level, long order) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("id", id);
        node.put("title", title);
        node.put("kind", kind);
        node.put("parentId", parentId);
        node.put("level", level);
        node.put("order", order);
        return node;
    }

    private static void expectError(String expected, List<Map<String, Object>> nodes) throws Exception {
        try {
            OutlineNodeSnapshot.normalize(nodes);
            throw new AssertionError("expected " + expected);
        } catch (SQLException error) {
            if (!expected.equals(error.getMessage())) throw error;
        }
    }

    public static void main(String[] args) throws Exception {
        var valid = OutlineNodeSnapshot.normalize(List.of(
            node("dir", "目录", "directory", null, 1, 1),
            node("doc", "文档.md", "document", "dir", 2, 2)
        ));
        if (!"目录/文档.md".equals(valid.get(1).get("path"))) throw new AssertionError("path normalization failed");

        expectError("INVALID_OUTLINE_NODE", List.of(
            node("doc", "文档.md", "document", null, 1, 1),
            node("doc", "重复.md", "document", null, 1, 2)
        ));
        expectError("INVALID_OUTLINE_PATH", List.of(node("bad", "../escape.md", "document", null, 1, 1)));
        expectError("INVALID_DIRECTORY_HIERARCHY", List.of(node("doc", "文档.md", "document", "missing", 2, 1)));
        expectError("OUTLINE_DOCUMENT_REQUIRED", List.of(node("dir", "空目录", "directory", null, 1, 1)));
    }
}

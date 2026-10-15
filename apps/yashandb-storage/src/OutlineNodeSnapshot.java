import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 新模板的纯节点转换；无数据库访问，旧 parts/chapters 路径仍由 Main 兼容。 */
public final class OutlineNodeSnapshot {
    private OutlineNodeSnapshot() {}

    public static List<Map<String, Object>> normalize(List<Map<String, Object>> source) throws SQLException {
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        Map<String, String> paths = new LinkedHashMap<>();
        List<Map<String, Object>> result = new ArrayList<>();
        long previousOrder = 0;
        for (Map<String, Object> node : source) {
            String id = text(node.get("id"));
            String title = text(node.get("title"));
            String kind = text(node.get("kind"));
            String parentId = text(node.get("parentId"));
            if (id == null || title == null || byId.containsKey(id) || !("directory".equals(kind) || "document".equals(kind))) {
                throw new SQLException("INVALID_OUTLINE_NODE");
            }
            if (title.contains("/") || title.contains("\\") || title.equals(".") || title.equals("..")) throw new SQLException("INVALID_OUTLINE_PATH");
            Map<String, Object> parent = parentId == null ? null : byId.get(parentId);
            if (parentId != null && (parent == null || !"directory".equals(parent.get("kind")))) throw new SQLException("INVALID_DIRECTORY_HIERARCHY");
            long level = parent == null ? 1 : ((Number) parent.get("level")).longValue() + 1;
            long order = node.get("order") instanceof Number number ? number.longValue() : 0;
            if (order <= previousOrder || !(node.get("level") instanceof Number number) || number.longValue() != level) throw new SQLException("INVALID_OUTLINE_ORDER_OR_LEVEL");
            String path = parent == null ? title : parent.get("path") + "/" + title;
            if (paths.containsKey(path)) throw new SQLException("DUPLICATE_OUTLINE_PATH");
            Map<String, Object> normalized = new LinkedHashMap<>(node);
            normalized.put("path", path);
            normalized.put("level", level);
            normalized.put("parentId", parentId);
            byId.put(id, normalized);
            paths.put(path, id);
            result.add(normalized);
            previousOrder = order;
        }
        if (result.stream().noneMatch(node -> "document".equals(node.get("kind")))) throw new SQLException("OUTLINE_DOCUMENT_REQUIRED");
        return result;
    }

    private static String text(Object value) {
        return value == null || String.valueOf(value).isBlank() ? null : String.valueOf(value);
    }
}

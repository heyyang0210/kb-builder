import java.lang.reflect.Method;
import java.util.*;

public final class ProductionReferenceChangesCheck {
    public static void main(String[] args) throws Exception {
        Method collect = Main.class.getDeclaredMethod("collectChangedOutlineReferences", Object.class, Object.class, String.class, Set.class);
        collect.setAccessible(true);
        Map<String,Object> oldEntity = Map.of("outlineVersionId", "outline_deleted", "markdown", "历史正文");
        Map<String,Object> before = Map.of("drafts", Map.of("old", oldEntity), "aiJobs", Map.of());
        Map<String,Object> after = Map.of("drafts", Map.of("old", oldEntity), "aiJobs", Map.of("new", Map.of("outlineVersionId", "outline_active", "status", "queued")));
        check(collect, before, after, Set.of("outline_active"));
        check(collect, before, Map.of("drafts", Map.of("old", Map.of("outlineVersionId", "outline_deleted", "markdown", "修改历史"))), Set.of("outline_deleted"));
        check(collect, before, Map.of("drafts", Map.of("copied", oldEntity)), Set.of("outline_deleted"));
        check(collect, null, before, Set.of("outline_deleted"));
        check(collect, before, Map.of("drafts", Map.of()), Set.of());
        check(collect, List.of(oldEntity), List.of(oldEntity, Map.of("outlineVersionId", "outline_active")), Set.of("outline_deleted", "outline_active"));
        check(collect, Map.of("x", Map.of("outlineVersionId", "outline_deleted", "children", List.of())), Map.of("x", Map.of("outlineVersionId", "outline_deleted", "children", List.of("changed"))), Set.of("outline_deleted"));
        System.out.println("PASS: unchanged history, changed entity, copied reference, resurrection, deletion and conservative list validation");
    }
    private static void check(Method method, Object before, Object after, Set<String> expected) throws Exception {
        Set<String> ids = new TreeSet<>(); method.invoke(null, before, after, "", ids);
        if (!ids.equals(expected)) throw new AssertionError(ids + " != " + expected);
    }
}

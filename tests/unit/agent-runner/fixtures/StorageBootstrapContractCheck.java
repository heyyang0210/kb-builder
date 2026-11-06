import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

/** Exercises startup argument and environment parsing without starting services. */
public final class StorageBootstrapContractCheck {
    private static Object invoke(String name, Class<?>[] types, Object... args) throws Exception {
        Method method = Main.class.getDeclaredMethod(name, types);
        method.setAccessible(true);
        try { return method.invoke(null, args); }
        catch (InvocationTargetException error) {
            Throwable cause = error.getCause();
            if (cause instanceof Exception exception) throw exception;
            throw error;
        }
    }

    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }

    private static void rejects(Class<? extends Exception> type, ThrowingAction action, String message) throws Exception {
        try { action.run(); throw new AssertionError("expected " + type.getSimpleName()); }
        catch (Exception error) { check(type.isInstance(error), message + ": " + error); }
    }

    @FunctionalInterface
    private interface ThrowingAction { void run() throws Exception; }

    public static void main(String[] args) throws Exception {
        rejects(IllegalArgumentException.class, () -> Main.main(new String[]{"unknown"}), "unknown command guard");
        rejects(IllegalArgumentException.class, () -> Main.main(new String[]{"serve", "extra"}), "argument count guard");
        check("reader".equals(invoke("env", new Class<?>[]{String.class, String.class}, "YASDB_QUALITY_USERNAME", "fallback")),
            "configured environment value");
        check("fallback".equals(invoke("env", new Class<?>[]{String.class, String.class}, "KC_FIXTURE_UNSET", "fallback")),
            "missing environment fallback");
        check("reader".equals(invoke("required", new Class<?>[]{String.class}, "YASDB_QUALITY_USERNAME")), "required value");
        rejects(IllegalStateException.class, () -> invoke("required", new Class<?>[]{String.class}, "KC_FIXTURE_UNSET"),
            "missing required value");
        check(((Integer) invoke("integer", new Class<?>[]{String.class, int.class}, "YASDB_QUALITY_MAX_ROWS", 5)) == 2,
            "configured integer");
        check(((Integer) invoke("integer", new Class<?>[]{String.class, int.class}, "KC_FIXTURE_UNSET", 5)) == 5,
            "integer fallback");
        rejects(NumberFormatException.class, () -> invoke("integer", new Class<?>[]{String.class, int.class}, "YASDB_QUALITY_USERNAME", 5),
            "invalid integer");
        System.out.println("PASS: startup command and environment parsing boundaries");
    }
}

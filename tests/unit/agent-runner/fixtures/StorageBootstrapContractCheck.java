import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Constructor;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

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

    private static Object parseJson(String value) throws Exception {
        Class<?> parser = Class.forName("Main$Json");
        Method parse = parser.getDeclaredMethod("parse", String.class);
        parse.setAccessible(true);
        try { return parse.invoke(null, value); }
        catch (InvocationTargetException error) {
            Throwable cause = error.getCause();
            if (cause instanceof Exception exception) throw exception;
            throw error;
        }
    }

    private static void checkJsonNumber(String source, Object expected, Class<?> type) throws Exception {
        Object value = parseJson(source);
        check(type.isInstance(value) && expected.equals(value), "JSON number " + source + ": " + value);
    }

    private static void checkJsonFailure(String source) throws Exception {
        try { parseJson(source); throw new AssertionError("invalid JSON was accepted: " + source); }
        catch (Exception error) { check(error.getClass().getSimpleName().equals("JsonParseException"), "JSON failure type: " + error); }
    }

    @FunctionalInterface
    private interface ThrowingAction { void run() throws Exception; }

    private static void checkServerRoutes() {
        try {
            Constructor<Main> constructor = Main.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            Main application = constructor.newInstance();
            Method start = Main.class.getDeclaredMethod("start");
            start.setAccessible(true);
            start.invoke(application);
            URI base = URI.create("http://127.0.0.1:" + System.getenv("YASDB_STORAGE_PORT"));
            HttpClient client = HttpClient.newHttpClient();
            HttpResponse<String> health = client.send(HttpRequest.newBuilder(base.resolve("/health"))
                .header("X-Request-ID", "startup-fixture").GET().build(), HttpResponse.BodyHandlers.ofString());
            check(health.statusCode() == 503 && health.body().contains("DATABASE_UNAVAILABLE"), "health route response");
            check(health.headers().firstValue("X-Request-ID").orElse("").equals("startup-fixture"), "request ID propagation");
            HttpResponse<String> invalidRecord = client.send(HttpRequest.newBuilder(base.resolve("/v1/records"))
                .GET().build(), HttpResponse.BodyHandlers.ofString());
            check(invalidRecord.statusCode() == 400 && invalidRecord.body().contains("INVALID_RECORD_PATH"), "record route registration");
            checkHttpFailure(client, base, "GET", "/v1/records/bad%20namespace/key", null, 400, "INVALID_RECORD_ID", "record identifier");
            checkHttpFailure(client, base, "GET", "/v1/quality/execute", null, 405, "METHOD_NOT_ALLOWED", "quality method");
            checkHttpFailure(client, base, "POST", "/v1/export", null, 405, "METHOD_NOT_ALLOWED", "export method");
            checkHttpFailure(client, base, "POST", "/v1/domain/tech-domains", null, 405, "METHOD_NOT_ALLOWED", "domain method");
            checkHttpFailure(client, base, "POST", "/v1/domain/handbooks", null, 405, "METHOD_NOT_ALLOWED", "handbook method");
            checkHttpFailure(client, base, "PUT", "/v1/domain/handbooks/snapshot", "{bad", 400, "INVALID_JSON", "handbook snapshot JSON");
            checkHttpFailure(client, base, "POST", "/v1/domain/outlines", null, 405, "METHOD_NOT_ALLOWED", "outline method");
            checkHttpFailure(client, base, "PUT", "/v1/domain/outlines/snapshot", "{bad", 400, "INVALID_JSON", "outline snapshot JSON");
            checkHttpFailure(client, base, "GET", "/v1/domain/build-tasks/task/items/item", null, 405, "METHOD_NOT_ALLOWED", "build task item method");
            checkHttpFailure(client, base, "PATCH", "/v1/domain/build-tasks//items/", "{}", 400, "INVALID_TASK_ITEM_PATH", "build task item path");
            checkHttpFailure(client, base, "POST", "/v1/platform/team-groups", "{}", 400, "IDEMPOTENCY_KEY_REQUIRED", "team group idempotency");
            checkHttpFailure(client, base, "GET", "/v1/platform/team-groups/abc/roster", null, 405, "METHOD_NOT_ALLOWED", "team roster method");
            checkHttpFailure(client, base, "GET", "/v1/platform/team-groups/not-a-number", null, 400, "TEAM_GROUP_ID_INVALID", "team group id");
            System.out.println("PASS: storage server startup and HTTP routes");
            System.exit(0);
        } catch (Throwable failure) {
            failure.printStackTrace();
            System.exit(1);
        }
    }

    private static void checkHttpFailure(HttpClient client, URI base, String method, String path, String body,
            int status, String code, String label) throws Exception {
        String requestId = "startup-" + label.replace(' ', '-');
        HttpRequest.BodyPublisher publisher = body == null
            ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body);
        HttpRequest request = HttpRequest.newBuilder(base.resolve(path))
            .header("X-Request-ID", requestId)
            .header("Content-Type", "application/json")
            .method(method, publisher)
            .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        check(response.statusCode() == status && response.body().contains("\"code\":\"" + code + "\""),
            label + " response: " + response.statusCode() + " " + response.body());
        check(response.body().contains("\"requestId\":\"" + requestId + "\""), label + " request ID");
    }

    public static void main(String[] args) throws Exception {
        if (args.length > 0 && "server-http".equals(args[0])) { checkServerRoutes(); return; }
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
        checkJsonNumber("-1", -1, Integer.class);
        checkJsonNumber("-2147483648", Integer.MIN_VALUE, Integer.class);
        checkJsonNumber("2147483647", Integer.MAX_VALUE, Integer.class);
        checkJsonNumber("2147483648", 2147483648L, Long.class);
        checkJsonNumber("-2147483649", -2147483649L, Long.class);
        checkJsonNumber("1.25", 1.25d, Double.class);
        checkJsonNumber("1e+2", 100d, Double.class);
        checkJsonNumber("1E-2", .01d, Double.class);
        check("😀".equals(parseJson("\"\\uD83D\\uDE00\"")), "JSON surrogate-pair escape");
        check(Boolean.TRUE.equals(parseJson("true")) && Boolean.FALSE.equals(parseJson("false"))
            && parseJson("null") == null, "JSON primitive literals");
        for (String invalid : new String[]{"1e", "1e+", "9223372036854775808", "tru", "true false", "\"unterminated"})
            checkJsonFailure(invalid);
        System.out.println("PASS: startup command and environment parsing boundaries");
    }
}

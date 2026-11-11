import java.lang.reflect.*;
import java.sql.*;
import java.util.Properties;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.logging.Logger;

public class JdbcPoolReuseCheck {
    static final CountDownLatch entered = new CountDownLatch(2);
    static final CountDownLatch release = new CountDownLatch(1);
    static final AtomicInteger failures = new AtomicInteger();
    static final AtomicInteger initialization = new AtomicInteger(), closed = new AtomicInteger();
    static final CopyOnWriteArrayList<ConnectionState> states = new CopyOnWriteArrayList<>();
    static class ConnectionState {
        boolean closed, disconnected, rollbackFailure, emptyValidation, resultCloseFailure, statementCloseFailure;
        int resultsClosed, statementsClosed;
    }
    public static void main(String[] args) throws Exception {
        AtomicInteger connections = new AtomicInteger();
        DriverManager.registerDriver(new Driver() {
            public Connection connect(String url, Properties properties) throws SQLException {
                if (!acceptsURL(url)) return null;
                connections.incrementAndGet();
                if (url.endsWith("fail") && failures.getAndIncrement() == 0) throw new SQLException("expected fixture failure");
                if (url.endsWith("parallel")) {
                    entered.countDown();
                    try { if (!release.await(5, TimeUnit.SECONDS)) throw new SQLException("parallel creation blocked"); }
                    catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new SQLException(error); }
                }
                ConnectionState state = new ConnectionState();
                states.add(state);
                return (Connection) Proxy.newProxyInstance(Connection.class.getClassLoader(), new Class[]{Connection.class},
                    (proxy, method, values) -> {
                        if (method.getName().equals("setAutoCommit") && url.endsWith("init") && initialization.getAndIncrement() == 0)
                            throw new SQLException("expected initialization failure");
                        if (method.getName().equals("close")) { closed.incrementAndGet(); state.closed = true; }
                        if (method.getName().equals("isClosed")) return state.closed;
                        if (method.getName().equals("rollback") && state.rollbackFailure) throw new SQLException("rollback socket closed");
                        if (method.getName().equals("createStatement")) {
                            if (state.disconnected) throw new SQLException("This socket has been closed.");
                            return Proxy.newProxyInstance(Statement.class.getClassLoader(), new Class[]{Statement.class}, (s, m, a) -> {
                                if (m.getName().equals("close")) {
                                    state.statementsClosed++;
                                    if (state.statementCloseFailure) throw new SQLException("statement close failed");
                                }
                                if (m.getName().equals("executeQuery")) {
                                    AtomicInteger rows = new AtomicInteger();
                                    return Proxy.newProxyInstance(ResultSet.class.getClassLoader(), new Class[]{ResultSet.class},
                                        (r, rm, ra) -> {
                                            if (rm.getName().equals("next")) return !state.emptyValidation && rows.getAndIncrement() == 0;
                                            if (rm.getName().equals("close")) {
                                                state.resultsClosed++;
                                                if (state.resultCloseFailure) throw new SQLException("result close failed");
                                            }
                                            return null;
                                        });
                                }
                                return null;
                            });
                        }
                        return method.getReturnType() == boolean.class ? false : null;
                    });
            }
            public boolean acceptsURL(String url) { return url.startsWith("jdbc:pool-reuse:"); }
            public DriverPropertyInfo[] getPropertyInfo(String u, Properties p) { return new DriverPropertyInfo[0]; }
            public int getMajorVersion() { return 1; }
            public int getMinorVersion() { return 0; }
            public boolean jdbcCompliant() { return false; }
            public Logger getParentLogger() { return Logger.getGlobal(); }
        });
        Class<?> type = Class.forName("Main$JdbcConnectionPool");
        Constructor<?> constructor = type.getDeclaredConstructors()[0]; constructor.setAccessible(true);
        Object pool = constructor.newInstance("jdbc:pool-reuse:test", "test", "test", 4, 1);
        Method start = type.getDeclaredMethod("start"); start.setAccessible(true); start.invoke(pool);
        Method borrow = type.getDeclaredMethod("borrow"); borrow.setAccessible(true);
        Connection first = (Connection) borrow.invoke(pool);
        FutureTask<Connection> task = new FutureTask<>(() -> (Connection) borrow.invoke(pool));
        Thread borrower = new Thread(task);
        try {
            synchronized (pool) {
                borrower.start();
                long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
                while (borrower.getState() != Thread.State.BLOCKED && System.nanoTime() < deadline) Thread.yield();
                if (borrower.getState() != Thread.State.BLOCKED) throw new AssertionError("borrower did not wait for creation lock");
                first.close();
            }
            Connection second = task.get(5, TimeUnit.SECONDS);
            second.close(); second.close();
            if (connections.get() != 1) throw new AssertionError("created unnecessary connections: " + connections.get());
            System.out.println("PASS: reuse connection returned while waiting for creation lock");
        } finally {
            Method close = type.getDeclaredMethod("closeAll"); close.setAccessible(true); close.invoke(pool);
        }
        Object parallel = constructor.newInstance("jdbc:pool-reuse:parallel", "test", "test", 2, 0);
        ExecutorService workers = Executors.newFixedThreadPool(3);
        try {
            int before = connections.get();
            Future<Connection> a = workers.submit(() -> (Connection) borrow.invoke(parallel));
            Future<Connection> b = workers.submit(() -> (Connection) borrow.invoke(parallel));
            if (!entered.await(3, TimeUnit.SECONDS)) throw new AssertionError("connection creation serialized under lock");
            Future<Connection> c = workers.submit(() -> (Connection) borrow.invoke(parallel));
            release.countDown();
            Connection ca = a.get(5, TimeUnit.SECONDS), cb = b.get(5, TimeUnit.SECONDS);
            try {
                try { c.get(150, TimeUnit.MILLISECONDS); throw new AssertionError("pool capacity exceeded"); }
                catch (TimeoutException expected) { }
                if (connections.get() - before != 2) throw new AssertionError("reservation exceeded max");
                ca.close();
                c.get(5, TimeUnit.SECONDS).close();
            } finally { ca.close(); cb.close(); }
            System.out.println("PASS: parallel creation and bounded capacity");
        } finally {
            release.countDown(); workers.shutdownNow(); workers.awaitTermination(5, TimeUnit.SECONDS);
            Method close = type.getDeclaredMethod("closeAll"); close.setAccessible(true); close.invoke(parallel);
        }
        Object init = constructor.newInstance("jdbc:pool-reuse:init", "test", "test", 1, 0);
        try {
            int beforeClose = closed.get();
            try { borrow.invoke(init); throw new AssertionError("expected initialization failure"); }
            catch (InvocationTargetException error) { if (!(error.getCause() instanceof SQLException)) throw error; }
            if (closed.get() != beforeClose + 1) throw new AssertionError("failed raw connection leaked");
            ((Connection) borrow.invoke(init)).close();
            System.out.println("PASS: initialization failure closes raw connection and releases capacity");
        } finally {
            Method close = type.getDeclaredMethod("closeAll"); close.setAccessible(true); close.invoke(init);
        }
        Object failed = constructor.newInstance("jdbc:pool-reuse:fail", "test", "test", 1, 0);
        try {
            try { borrow.invoke(failed); throw new AssertionError("expected creation failure"); }
            catch (InvocationTargetException error) { if (!(error.getCause() instanceof SQLException)) throw error; }
            ((Connection) borrow.invoke(failed)).close();
            System.out.println("PASS: failed creation releases capacity");
        } finally {
            Method close = type.getDeclaredMethod("closeAll"); close.setAccessible(true); close.invoke(failed);
        }
        for (String scenario : new String[]{"empty", "result-close", "statement-close", "validation-rollback", "closed"}) {
            Object validation = constructor.newInstance("jdbc:pool-reuse:validation", "test", "test", 1, 0);
            try {
                Connection lease = (Connection) borrow.invoke(validation);
                ConnectionState invalid = states.get(states.size() - 1);
                lease.close();
                invalid.emptyValidation = scenario.equals("empty");
                invalid.resultCloseFailure = scenario.equals("result-close");
                invalid.statementCloseFailure = scenario.equals("statement-close");
                invalid.rollbackFailure = scenario.equals("validation-rollback");
                invalid.closed = scenario.equals("closed");
                int before = connections.get();
                Connection replacement = (Connection) borrow.invoke(validation);
                if (!invalid.closed || connections.get() != before + 1)
                    throw new AssertionError("invalid validation connection not replaced: " + scenario);
                if (!scenario.equals("closed") && (invalid.resultsClosed != 1 || invalid.statementsClosed != 1))
                    throw new AssertionError("validation resources leaked: " + scenario);
                replacement.close();
                ((Connection) borrow.invoke(validation)).close();
                if (connections.get() != before + 1)
                    throw new AssertionError("replacement was not reused: " + scenario);
                System.out.println("PASS: validation failure cleanup and recovery: " + scenario);
            } finally {
                Method close = type.getDeclaredMethod("closeAll"); close.setAccessible(true); close.invoke(validation);
            }
        }
        Object recovery = constructor.newInstance("jdbc:pool-reuse:recovery", "test", "test", 1, 0);
        try {
            Connection old = (Connection) borrow.invoke(recovery);
            ConnectionState stale = states.get(states.size() - 1);
            old.close();
            stale.disconnected = true; // Driver still reports isClosed=false after a network loss.
            int before = connections.get();
            Connection replacement = (Connection) borrow.invoke(recovery);
            if (!stale.closed || connections.get() != before + 1) throw new AssertionError("stale connection not replaced");
            if (!old.isClosed()) throw new AssertionError("returned lease is still usable");
            try { old.commit(); throw new AssertionError("returned lease allowed commit"); }
            catch (SQLException expected) { }
            ConnectionState badReturn = states.get(states.size() - 1);
            badReturn.rollbackFailure = true;
            try { replacement.close(); throw new AssertionError("expected rollback failure"); }
            catch (SQLException expected) { }
            if (!badReturn.closed) throw new AssertionError("rollback failure leaked raw connection");
            replacement.close(); // Double close must not release capacity twice.
            Connection recovered = (Connection) borrow.invoke(recovery);
            recovered.close();
            Connection reused = (Connection) borrow.invoke(recovery);
            reused.close();
            if (connections.get() != before + 2) throw new AssertionError("capacity or reuse not recovered");
            System.out.println("PASS: disconnected idle and rollback failure recover capacity without restart");
        } finally {
            Method close = type.getDeclaredMethod("closeAll"); close.setAccessible(true); close.invoke(recovery);
        }
    }
}

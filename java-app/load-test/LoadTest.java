///usr/bin/env java --enable-preview --source 21 "$0" "$@"; exit $?
/**
 * Load test for the TechEd 2026 RA160 Java agent.
 *
 * Runs exercises 1–3 in sequence as a single "scenario" across N parallel slots.
 * When a slot finishes (success or failure) it immediately restarts with a fresh session,
 * so all slots stay busy for the full duration. On Ctrl+C, waits for in-flight scenarios
 * to finish (or timeout) then prints a summary.
 *
 * Usage:
 *   java LoadTest.java [--slots 40] [--url http://localhost:3143] [--timeout 180]
 *
 * Options:
 *   --slots N       Number of parallel slots (default: 40)
 *   --url URL       Agent base URL (default: http://localhost:3143)
 *   --timeout SECS  Per-scenario timeout in seconds (default: 180)
 *   --ramp SECS     Ramp-up: stagger slot starts over this many seconds (default: 10)
 */

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public class LoadTest {

    // ── Exercise prompts (exact text from the web UI demo buttons) ────────────
    static final String[] PROMPTS = {
        // Exercise 1 — plain LLM call, no tools needed
        "What financial planning data is available?",
        // Exercise 2 — OData + SQL tools
        "Show me the monthly actual spend for cost center A1000 for fiscal year 2025.",
        // Exercise 3 — RPT forecast + ground-truth comparison
        "For cost center A1000, use journal entries from fiscal years 2022 through 2025 as signed actuals"
            + " and forecast the monthly amount for fiscal year 2026. Summarize all 12 fiscal periods.",
    };

    // ── Per-step labels for readable output ───────────────────────────────────
    static final String[] STEP_LABELS = {
        "ex1-llm-only",
        "ex2-odata-sql",
        "ex3-rpt-forecast",
    };

    // ── Counters ──────────────────────────────────────────────────────────────
    static final AtomicInteger scenariosStarted   = new AtomicInteger();
    static final AtomicInteger scenariosSuccess   = new AtomicInteger();
    static final AtomicInteger scenariosFailed    = new AtomicInteger();
    static final AtomicInteger stepSuccess        = new AtomicInteger();
    static final AtomicInteger stepFailed         = new AtomicInteger();
    static final AtomicLong    totalStepMs        = new AtomicLong();

    // Per-step counters: index = step index (0–2)
    static final AtomicInteger[] stepSuccessByIdx = {
        new AtomicInteger(), new AtomicInteger(), new AtomicInteger()
    };
    static final AtomicInteger[] stepFailedByIdx  = {
        new AtomicInteger(), new AtomicInteger(), new AtomicInteger()
    };
    static final AtomicLong[]    stepMsByIdx      = {
        new AtomicLong(), new AtomicLong(), new AtomicLong()
    };

    // Failure details (bounded ring — keep last 200)
    record Failure(String slot, String step, String reason, Instant when) {}
    static final ArrayBlockingQueue<Failure> failures = new ArrayBlockingQueue<>(200);

    // ── Shutdown flag ─────────────────────────────────────────────────────────
    static final AtomicBoolean shutdown = new AtomicBoolean(false);

    // ── Slot state map (slotId → current step label) for progress display ─────
    static final ConcurrentHashMap<Integer, String> slotState = new ConcurrentHashMap<>();

    // ── Entry point ───────────────────────────────────────────────────────────
    public static void main(String[] args) throws Exception {

        // Parse CLI args
        int slots       = 40;
        String baseUrl  = "http://localhost:3143";
        int timeoutSecs = 180;
        int rampSecs    = 10;

        for (int i = 0; i < args.length - 1; i++) {
            switch (args[i]) {
                case "--slots"   -> slots       = Integer.parseInt(args[i + 1]);
                case "--url"     -> baseUrl      = args[i + 1];
                case "--timeout" -> timeoutSecs = Integer.parseInt(args[i + 1]);
                case "--ramp"    -> rampSecs    = Integer.parseInt(args[i + 1]);
            }
        }

        final String finalBaseUrl  = baseUrl;
        final int    finalTimeout  = timeoutSecs;
        final int    finalSlots    = slots;
        final int    finalRamp     = rampSecs;

        System.out.printf("""
            ╔══════════════════════════════════════════════════════════╗
            ║  TechEd 2026 RA160 — Java Agent Load Test               ║
            ╠══════════════════════════════════════════════════════════╣
            ║  Target  : %-46s ║
            ║  Slots   : %-46d ║
            ║  Timeout : %-42d secs ║
            ║  Ramp-up : %-42d secs ║
            ╚══════════════════════════════════════════════════════════╝
            %n""",
            finalBaseUrl, finalSlots, finalTimeout, finalRamp);

        // Shared HTTP client — virtual threads + connection pooling
        final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .executor(Executors.newVirtualThreadPerTaskExecutor())
            .build();

        // Executor for slot tasks — virtual threads, bounded by slot count
        final var slotExecutor = Executors.newVirtualThreadPerTaskExecutor();

        // Latch to wait for all slots to finish on shutdown
        final CountDownLatch allDone = new CountDownLatch(finalSlots);

        final Instant startTime = Instant.now();

        // Install shutdown hook for Ctrl+C
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            shutdown.set(true);
            System.out.println("\n[SIGINT] Waiting for in-flight scenarios to finish…");
            try {
                if (!allDone.await(finalTimeout + 30L, TimeUnit.SECONDS)) {
                    System.out.println("[WARN] Some slots did not finish within the grace period.");
                }
            } catch (InterruptedException ignored) {}
            printSummary(startTime);
        }));

        // Progress reporter
        final ScheduledExecutorService reporter = Executors.newSingleThreadScheduledExecutor(r -> {
            final Thread t = new Thread(r, "reporter");
            t.setDaemon(true);
            return t;
        });
        reporter.scheduleAtFixedRate(() -> printProgress(startTime), 15, 15, TimeUnit.SECONDS);

        // Stagger slot starts over rampSecs to avoid thundering herd
        final long rampDelayMs = finalSlots > 1 ? (finalRamp * 1000L) / (finalSlots - 1) : 0;

        for (int s = 0; s < finalSlots; s++) {
            final int slotId = s;
            final long delay = s * rampDelayMs;
            slotExecutor.submit(() -> {
                if (delay > 0) {
                    try { Thread.sleep(delay); } catch (InterruptedException ignored) {}
                }
                slotState.put(slotId, "starting");
                try {
                    runSlot(slotId, finalBaseUrl, http, finalTimeout);
                } finally {
                    slotState.remove(slotId);
                    allDone.countDown();
                }
            });
        }

        // Main thread blocks until JVM exits via shutdown hook
        allDone.await();
        reporter.shutdown();
    }

    // Minimum ms a failed scenario waits before retrying (avoids spin-flooding a down server)
    static final long FAIL_BACKOFF_MS = 2_000;

    // ── Slot runner: loops scenarios until shutdown ───────────────────────────
    static void runSlot(
            final int slotId,
            final String baseUrl,
            final HttpClient http,
            final int timeoutSecs) {

        int consecutiveFails = 0;

        while (!shutdown.get()) {
            final int scenarioNum = scenariosStarted.incrementAndGet();
            slotState.put(slotId, "scenario-" + scenarioNum + " starting");

            final Instant scenarioStart = Instant.now();
            try {
                runScenario(slotId, scenarioNum, baseUrl, http, timeoutSecs);
                consecutiveFails = 0;
            } catch (Exception e) {
                // Scenario-level error (e.g. session creation failed)
                scenariosFailed.incrementAndGet();
                offerFailure(new Failure(
                    "slot-" + slotId, "session-setup",
                    e.getClass().getSimpleName() + ": " + truncate(e.getMessage(), 120),
                    Instant.now()));
                consecutiveFails++;
            }

            // If the scenario finished very quickly (e.g. server is down), back off
            // to avoid flooding logs/CPU. Backoff grows with consecutive failures up to 30s.
            final long elapsed = Duration.between(scenarioStart, Instant.now()).toMillis();
            if (elapsed < FAIL_BACKOFF_MS && consecutiveFails > 0) {
                final long wait = Math.min(FAIL_BACKOFF_MS * consecutiveFails, 30_000);
                try { Thread.sleep(wait); } catch (InterruptedException ignored) {}
            }
        }
    }

    // ── Single scenario: create session + run all 3 prompts sequentially ──────
    static void runScenario(
            final int slotId,
            final int scenarioNum,
            final String baseUrl,
            final HttpClient http,
            final int timeoutSecs) throws Exception {

        final String sessionId = createSession(baseUrl, http);
        boolean scenarioOk = true;

        for (int stepIdx = 0; stepIdx < PROMPTS.length && !shutdown.get(); stepIdx++) {
            final String label = STEP_LABELS[stepIdx];
            slotState.put(slotId, "s" + scenarioNum + "/" + label);

            final Instant stepStart = Instant.now();
            boolean stepOk = false;
            String failReason = null;

            try {
                runStep(sessionId, PROMPTS[stepIdx], baseUrl, http, timeoutSecs);
                stepOk = true;
            } catch (Exception e) {
                failReason = e.getClass().getSimpleName() + ": " + truncate(e.getMessage(), 120);
            }

            final long elapsedMs = Duration.between(stepStart, Instant.now()).toMillis();

            if (stepOk) {
                stepSuccess.incrementAndGet();
                stepSuccessByIdx[stepIdx].incrementAndGet();
                stepMsByIdx[stepIdx].addAndGet(elapsedMs);
                totalStepMs.addAndGet(elapsedMs);
                log(slotId, scenarioNum, label, "OK  (%d ms)".formatted(elapsedMs));
            } else {
                stepFailed.incrementAndGet();
                stepFailedByIdx[stepIdx].incrementAndGet();
                scenarioOk = false;
                offerFailure(new Failure("slot-" + slotId, label, failReason, Instant.now()));
                log(slotId, scenarioNum, label, "FAIL — " + failReason);
                // Don't abort the whole scenario — try remaining steps
            }
        }

        if (scenarioOk) {
            scenariosSuccess.incrementAndGet();
        } else {
            scenariosFailed.incrementAndGet();
        }
    }

    // ── Create a new agent session ────────────────────────────────────────────
    static String createSession(final String baseUrl, final HttpClient http) throws Exception {
        final HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/session"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.noBody())
            .timeout(Duration.ofSeconds(10))
            .build();

        final HttpResponse<String> resp =
            http.send(req, HttpResponse.BodyHandlers.ofString());

        if (resp.statusCode() != 200) {
            throw new RuntimeException("session creation HTTP " + resp.statusCode());
        }
        // Parse {"sessionId":"<uuid>"} — no library needed
        final String body = resp.body();
        final int start = body.indexOf('"', body.indexOf("sessionId") + 10) + 1;
        final int end   = body.indexOf('"', start);
        return body.substring(start, end);
    }

    // ── Send one prompt and consume the SSE stream ────────────────────────────
    static void runStep(
            final String sessionId,
            final String prompt,
            final String baseUrl,
            final HttpClient http,
            final int timeoutSecs) throws Exception {

        final String body = """
            {"prompt":%s,"sessionId":%s}""".formatted(jsonString(prompt), jsonString(sessionId));

        final HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/agent/run"))
            .header("Content-Type", "application/json")
            .header("Accept", "text/event-stream")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .timeout(Duration.ofSeconds(timeoutSecs + 10)) // slight over-budget
            .build();

        final HttpResponse<java.io.InputStream> resp =
            http.send(req, HttpResponse.BodyHandlers.ofInputStream());

        if (resp.statusCode() != 200) {
            resp.body().close();
            throw new RuntimeException("agent/run HTTP " + resp.statusCode());
        }

        // Consume SSE stream
        boolean sawDone  = false;
        boolean sawError = false;
        String  errorMsg = null;

        final Instant deadline = Instant.now().plusSeconds(timeoutSecs);

        try (final BufferedReader reader =
                 new BufferedReader(new InputStreamReader(resp.body()))) {

            String line;
            while ((line = reader.readLine()) != null) {
                if (Instant.now().isAfter(deadline)) {
                    throw new RuntimeException("step timeout after " + timeoutSecs + "s");
                }
                if (line.startsWith("event:")) {
                    final String event = line.substring(6).strip();
                    if ("done".equals(event)) {
                        sawDone = true;
                    } else if ("error".equals(event)) {
                        sawError = true;
                    }
                } else if (line.startsWith("data:") && sawError) {
                    errorMsg = truncate(line.substring(5).strip(), 160);
                }
            }
        }

        if (sawError) {
            throw new RuntimeException("agent error event: " + (errorMsg != null ? errorMsg : "(no data)"));
        }
        if (!sawDone) {
            throw new RuntimeException("SSE stream ended without 'done' event");
        }
    }

    // ── Progress display ──────────────────────────────────────────────────────
    static void printProgress(final Instant startTime) {
        final long elapsed = Duration.between(startTime, Instant.now()).toSeconds();
        final int ok   = scenariosSuccess.get();
        final int fail = scenariosFailed.get();
        final int tot  = ok + fail;
        System.out.printf("[%4ds] scenarios: %d total (%d ok / %d fail)  |  "
            + "steps: %d ok / %d fail%n",
            elapsed, tot, ok, fail, stepSuccess.get(), stepFailed.get());
    }

    // ── Final summary ─────────────────────────────────────────────────────────
    static void printSummary(final Instant startTime) {
        final long elapsed = Duration.between(startTime, Instant.now()).toSeconds();

        System.out.println("""

            ╔══════════════════════════════════════════════════════════╗
            ║                   LOAD TEST SUMMARY                     ║
            ╚══════════════════════════════════════════════════════════╝""");

        System.out.printf("  Duration : %d s%n", elapsed);
        System.out.printf("  Scenarios: %d completed (%d ok / %d failed)%n",
            scenariosSuccess.get() + scenariosFailed.get(),
            scenariosSuccess.get(), scenariosFailed.get());
        System.out.printf("  Steps    : %d ok / %d failed%n%n",
            stepSuccess.get(), stepFailed.get());

        System.out.println("  Per-step breakdown:");
        for (int i = 0; i < PROMPTS.length; i++) {
            final int ok   = stepSuccessByIdx[i].get();
            final int fail = stepFailedByIdx[i].get();
            final long ms  = stepMsByIdx[i].get();
            final long avg = ok > 0 ? ms / ok : 0;
            System.out.printf("    [%s]  ok=%d  fail=%d  avg=%d ms%n",
                STEP_LABELS[i], ok, fail, avg);
        }

        final List<Failure> snap = new ArrayList<>(failures);
        if (snap.isEmpty()) {
            System.out.println("\n  No failures recorded.");
        } else {
            System.out.printf("%n  Last %d failure(s) (most recent first):%n", snap.size());
            // Print in reverse (most recent last inserted = last in queue)
            for (int i = Math.max(0, snap.size() - 20); i < snap.size(); i++) {
                final Failure f = snap.get(i);
                System.out.printf("    %s  [%s / %s]  %s%n",
                    f.when().toString().substring(11, 19), f.slot(), f.step(), f.reason());
            }
        }
        System.out.println();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    static void offerFailure(final Failure f) {
        if (failures.remainingCapacity() == 0) failures.poll(); // drop oldest
        failures.offer(f);
    }

    static void log(final int slotId, final int scenarioNum, final String step, final String msg) {
        System.out.printf("[slot-%02d] s%d/%s: %s%n", slotId, scenarioNum, step, msg);
    }

    static String truncate(final String s, final int max) {
        if (s == null) return "(null)";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    /** Minimal JSON string escaping — no external library needed. */
    static String jsonString(final String s) {
        return '"' + s
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
            + '"';
    }
}

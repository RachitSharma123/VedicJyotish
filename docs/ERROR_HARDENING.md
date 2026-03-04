# Error Hardening Guide (502 / non-JSON / noisy console)

This app is currently failing in a common production pattern:
- Frontend expects JSON.
- Upstream (or load balancer) intermittently returns HTML error pages (`502 Bad Gateway`).
- Client still tries to parse as JSON and throws `JSON.parse` errors.

## 1) Harden API calls on the client

Create a single `fetchJson` helper and stop calling `res.json()` directly in feature code.

### Recommended behavior
- Set an explicit timeout (8-15s).
- Retry transient failures (`502`, `503`, `504`, network errors) with exponential backoff.
- Validate content type before JSON parse.
- Include request ID in error output.
- Return user-safe message and technical detail separately.

### Drop-in helper example

```ts
export async function fetchJson<T>(input: RequestInfo, init: RequestInit = {}, opts?: {
  timeoutMs?: number;
  retries?: number;
}) {
  const timeoutMs = opts?.timeoutMs ?? 12_000;
  const retries = opts?.retries ?? 2;

  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(input, {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") ?? "";
      const requestId = res.headers.get("x-request-id") ?? "n/a";

      if (!contentType.includes("application/json")) {
        const raw = await res.text();
        throw new Error(
          `Expected JSON but got '${contentType || "unknown"}' (status ${res.status}, requestId ${requestId}). Body: ${raw.slice(0, 300)}`
        );
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(`API error ${res.status} (requestId ${requestId}): ${JSON.stringify(json).slice(0, 300)}`);
      }
      return json as T;
    } catch (err) {
      attempt += 1;
      const retriable = err instanceof DOMException || /\b(502|503|504|timeout|network)\b/i.test(String(err));
      if (!retriable || attempt > retries) throw err;
      await new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
}
```

## 2) Fix server/API error contract

Every API route should always return JSON, even on failures.

```ts
return Response.json(
  {
    ok: false,
    code: "UPSTREAM_BAD_GATEWAY",
    message: "Unable to compute chart right now. Please retry.",
    requestId,
  },
  { status: 502 }
);
```

Avoid leaking raw HTML to clients; log it server-side only.

## 3) Add an app-level proxy endpoint

If browser hits a 3rd-party directly, move that call server-side:
- Browser -> `/api/birth-chart`
- Server route -> upstream astrology provider

This allows:
- Secret/key protection
- Normalized JSON errors
- Central retries/circuit-breaker
- Better logs and metrics

## 4) Improve user experience during transient failures

- Show a clear retry banner: “Service is temporarily unavailable (502). Please retry in a few seconds.”
- Add "Retry" button that replays the last payload.
- Keep form input state so users do not lose entered birth data.

## 5) Reduce console noise and distinguish signal vs noise

From your logs:
- `Feature Policy: Skipping unsupported feature...` -> mostly browser capability warnings.
- `SES Removing unpermitted intrinsics...` -> framework/runtime hardening noise.
- 3rd-party SDK aborted fetches -> likely non-critical telemetry issues.

Action:
- Filter these in observability tooling (Sentry/Datadog/etc.).
- Alert only on:
  - failed API response ratio
  - `UPSTREAM_BAD_GATEWAY`
  - JSON parse failures in first-party code

## 6) Add observability and correlation IDs

For each request:
- Generate `x-request-id` (if missing).
- Include it in server logs, response headers, and client error state.

This turns “it failed” into a traceable path across client, API route, and upstream provider.

## 7) Production safeguards

- Health check endpoint for upstream dependency.
- Circuit breaker: after N failures, fail fast for a short cool-off window.
- Cache successful chart responses for identical inputs (short TTL).
- Rate limit expensive operations.

## 8) Priority implementation order

1. **Central `fetchJson` helper** + replace direct `res.json()` usage.
2. **API route normalization** so all errors are valid JSON.
3. **Retries + timeout** for transient 5xx/network failures.
4. **Request ID + logging improvements**.
5. **Alerting and dashboard** on 5xx/error ratio.

---

If you want, the next step is to implement this in your existing `handleBirthChart` path and add a small typed error model (`ApiError`) so UI can show friendly messages while preserving debug details.

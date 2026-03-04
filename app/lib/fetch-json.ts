export class ApiError extends Error {
  status?: number;
  requestId?: string;

  constructor(message: string, status?: number, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
  }
}

export async function fetchJson<T>(
  input: RequestInfo,
  init: RequestInit = {},
  opts?: { timeoutMs?: number; retries?: number }
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? 12000;
  const retries = opts?.retries ?? 2;

  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(input, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type') ?? '';
      const requestId = res.headers.get('x-request-id') ?? 'n/a';

      if (!contentType.toLowerCase().includes('application/json')) {
        const raw = await res.text();
        throw new ApiError(
          `Expected JSON but got ${contentType || 'unknown'} (status ${res.status}). Body preview: ${raw.slice(0, 200)}`,
          res.status,
          requestId
        );
      }

      const json = await res.json();
      if (!res.ok) {
        const message = typeof json?.message === 'string' ? json.message : `API request failed (${res.status})`;
        throw new ApiError(message, res.status, requestId);
      }

      return json as T;
    } catch (error) {
      attempt += 1;
      const msg = String(error);
      const retryable =
        error instanceof DOMException ||
        /\b(502|503|504|timeout|network|abort)\b/i.test(msg) ||
        (error instanceof ApiError && [502, 503, 504].includes(error.status ?? 0));

      if (!retryable || attempt > retries) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** (attempt - 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
}

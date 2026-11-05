export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

interface FetchJsonOptions extends RequestInit {
  timeoutMs?: number;
}

/** fetch() + JSON decoding with a timeout, honouring an outer AbortSignal (e.g. React Query's). */
export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 20_000, signal, ...init } = options;
  // One controller for both the timeout and the caller's signal. (AbortSignal.timeout() and
  // AbortSignal.any() would be shorter, but phones with older browsers, such as Safari before
  // iOS 17.4, don't have them, and every request would fail.)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const forward = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', forward);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new HttpError(res.status, `${res.status} ${res.statusText}`.trim());
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forward);
  }
}

/** Tries each URL in turn, returning the first successful response. */
export async function fetchJsonFirst<T>(urls: string[], options?: FetchJsonOptions): Promise<T> {
  let lastError: unknown;
  for (const url of urls) {
    try {
      return await fetchJson<T>(url, options);
    } catch (err) {
      if (options?.signal?.aborted) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

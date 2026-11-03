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
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const res = await fetch(url, { ...init, signal: combined });
  if (!res.ok) throw new HttpError(res.status, `${res.status} ${res.statusText}`.trim());
  return (await res.json()) as T;
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

export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

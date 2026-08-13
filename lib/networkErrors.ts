const ABORT_ERROR_NAMES = new Set(["AbortError"]);
const ABORT_ERROR_CODES = new Set(["ABORT_ERR", "ERR_CANCELED"]);
const ABORT_ERROR_MESSAGE =
  /(?:fetch request has been cancel(?:ed|led)|operation was aborted)/i;
const TRANSIENT_NETWORK_MESSAGE =
  /(?:network (?:connection )?(?:was )?lost|network request failed|could not connect|failed to connect|unable to resolve host|unknown host|name or service not known|temporary failure in name resolution|request timed out|timed out acquiring connection|error code:\s*50[234]|http\s*50[234]|pgrst003|statement timeout|canceling statement due to statement timeout)/i;
const TRANSIENT_NETWORK_CODES = new Set([
  "ETIMEDOUT",
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETDOWN",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "PGRST003",
  "57014",
]);

type ErrorLike = {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  cause?: unknown;
};

function isErrorLike(value: unknown): value is ErrorLike {
  return value !== null && typeof value === "object";
}

/**
 * Expo SDK 57's native fetch can wrap an AbortController cancellation in a
 * generic FetchError instead of preserving the standard AbortError name.
 */
export function isFetchCancellation(
  error: unknown,
  signal?: AbortSignal | null
): boolean {
  if (signal?.aborted) return true;

  const seen = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; depth < 5 && isErrorLike(current); depth += 1) {
    if (seen.has(current)) break;
    seen.add(current);

    if (
      (typeof current.name === "string" &&
        ABORT_ERROR_NAMES.has(current.name)) ||
      (typeof current.code === "string" &&
        ABORT_ERROR_CODES.has(current.code)) ||
      (typeof current.message === "string" &&
        ABORT_ERROR_MESSAGE.test(current.message))
    ) {
      return true;
    }
    current = current.cause;
  }

  return false;
}

/** Expected connectivity and temporary server-capacity failures. */
export function isTransientNetworkError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; depth < 5 && isErrorLike(current); depth += 1) {
    if (seen.has(current)) break;
    seen.add(current);

    if (
      (typeof current.code === "string" &&
        TRANSIENT_NETWORK_CODES.has(current.code.toUpperCase())) ||
      (typeof current.message === "string" &&
        TRANSIENT_NETWORK_MESSAGE.test(current.message))
    ) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

export function createFetchTimeoutError(
  message: string,
  cause: unknown
): Error & { code: "ETIMEDOUT" } {
  const error = new Error(message, { cause }) as Error & { code: "ETIMEDOUT" };
  error.name = "FetchTimeoutError";
  error.code = "ETIMEDOUT";
  return error;
}

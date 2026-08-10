import * as Sentry from "@sentry/react-native";
import { supabase } from "./supabase";

const DEFAULT_SENTRY_DSN =
  "https://715d2f2c3d467181244cf2004f289823@o4511883300765696.ingest.de.sentry.io/4511883303125072";
const SENSITIVE_KEY =
  /authorization|cookie|password|secret|token|api[-_]?key|apikey|x-wilma-session/i;
const MAX_CONTEXT_DEPTH = 4;
const MAX_STRING_LENGTH = 1_000;

type UnknownRecord = Record<string, unknown>;
type FetchInput = string | Request | URL;

export type SentryErrorContext = {
  area: string;
  operation: string;
  level?: "fatal" | "error" | "warning" | "info";
  tags?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, unknown>;
};

function sanitizeText(value: string): string {
  return value
    .replace(
      /(authorization|cookie|password|secret|token|api[-_]?key|apikey|x-wilma-session)(["'=:\s]+)[^\s,;}]+/gi,
      "$1$2[Filtered]"
    )
    .slice(0, MAX_STRING_LENGTH);
}

function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, MAX_STRING_LENGTH);
  } catch {
    return value.split(/[?#]/, 1)[0].slice(0, MAX_STRING_LENGTH);
  }
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth >= MAX_CONTEXT_DEPTH) return "[Truncated]";
  if (typeof value === "string") return sanitizeText(value);
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => sanitizeValue(item, depth + 1));
  }

  const sanitized: UnknownRecord = {};
  for (const [key, item] of Object.entries(value as UnknownRecord)) {
    if (SENSITIVE_KEY.test(key)) {
      sanitized[key] = "[Filtered]";
    } else if (/url|uri/i.test(key) && typeof item === "string") {
      sanitized[key] = sanitizeUrl(item);
    } else {
      sanitized[key] = sanitizeValue(item, depth + 1);
    }
  }
  return sanitized;
}

function sanitizeEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request) {
    if (event.request.url) event.request.url = sanitizeUrl(event.request.url);
    event.request.data = undefined;
    event.request.cookies = undefined;
    event.request.headers = sanitizeValue(event.request.headers) as
      | Record<string, string>
      | undefined;
  }
  if (event.extra) {
    event.extra = sanitizeValue(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = sanitizeValue(event.contexts) as Sentry.ErrorEvent["contexts"];
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
      ...breadcrumb,
      data: sanitizeValue(breadcrumb.data) as Record<string, unknown> | undefined,
    }));
  }
  return event;
}

function isSentryRequest(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "sentry.io" || hostname.endsWith(".sentry.io");
  } catch {
    return url.includes("sentry.io");
  }
}

function requestUrl(input: FetchInput): string {
  if (typeof input === "string") return input;
  if (typeof URL !== "undefined" && input instanceof URL) return input.toString();
  if (input && typeof input === "object" && "url" in input) {
    return String(input.url);
  }
  return "unknown";
}

function requestMethod(
  input: FetchInput,
  init?: Parameters<typeof fetch>[1]
): string {
  if (init?.method) return init.method.toUpperCase();
  if (input && typeof input === "object" && "method" in input) {
    return String(input.method || "GET").toUpperCase();
  }
  return "GET";
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  if (error && typeof error === "object" && "message" in error) {
    return new Error(String(error.message));
  }
  return new Error("Unknown application error");
}

export function reportHandledError(
  error: unknown,
  context: SentryErrorContext
): string | undefined {
  return Sentry.withScope((scope) => {
    scope.setLevel(context.level ?? "error");
    scope.setTag("error.area", context.area);
    scope.setTag("error.operation", context.operation);
    for (const [key, value] of Object.entries(context.tags ?? {})) {
      if (value !== null && value !== undefined) scope.setTag(key, String(value));
    }
    if (context.extra) {
      scope.setContext(
        "handled_error",
        sanitizeValue(context.extra) as Record<string, unknown>
      );
    }
    return Sentry.captureException(normalizeError(error));
  });
}

export function reportHandledMessage(
  message: string,
  context: SentryErrorContext
): string | undefined {
  return Sentry.withScope((scope) => {
    scope.setLevel(context.level ?? "warning");
    scope.setTag("error.area", context.area);
    scope.setTag("error.operation", context.operation);
    for (const [key, value] of Object.entries(context.tags ?? {})) {
      if (value !== null && value !== undefined) scope.setTag(key, String(value));
    }
    if (context.extra) {
      scope.setContext(
        "handled_error",
        sanitizeValue(context.extra) as Record<string, unknown>
      );
    }
    return Sentry.captureMessage(message.slice(0, MAX_STRING_LENGTH));
  });
}

export function setSentryUser(
  user: { id: string; email?: string | null } | null
): void {
  Sentry.setUser(user ? { id: user.id, email: user.email ?? undefined } : null);
}

function installRejectedFetchTracking(): void {
  const globalWithMarker = globalThis as typeof globalThis & {
    __otamapsSentryFetchInstalled?: boolean;
  };
  if (globalWithMarker.__otamapsSentryFetchInstalled || !globalThis.fetch) return;
  globalWithMarker.__otamapsSentryFetchInstalled = true;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const url = requestUrl(input);
    const method = requestMethod(input, init);
    const startedAt = Date.now();
    try {
      return await originalFetch(input, init);
    } catch (error) {
      if (!isSentryRequest(url)) {
        reportHandledError(error, {
          area: "network",
          operation: "fetch",
          tags: {
            "http.method": method,
            "network.failure": true,
          },
          extra: {
            url: sanitizeUrl(url),
            durationMs: Date.now() - startedAt,
          },
        });
      }
      throw error;
    }
  }) as typeof globalThis.fetch;
}

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || DEFAULT_SENTRY_DSN,
  environment:
    process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ||
    (__DEV__ ? "development" : "production"),
  sendDefaultPii: true,
  enableLogs: true,
  attachStacktrace: true,
  enableNativeCrashHandling: true,
  enableAutoSessionTracking: true,
  enableAppHangTracking: true,
  enableWatchdogTerminationTracking: true,
  enableTombstone: true,
  patchGlobalPromise: true,
  tracesSampleRate: __DEV__ ? 1 : 0.2,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [
    Sentry.mobileReplayIntegration(),
    Sentry.feedbackIntegration(),
    Sentry.httpClientIntegration({
      failedRequestStatusCodes: [[400, 599]],
      failedRequestTargets: [/.*/],
    }),
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
    Sentry.supabaseIntegration({ supabaseClient: supabase }),
  ],
  beforeSend: sanitizeEvent,
  beforeBreadcrumb(breadcrumb) {
    return {
      ...breadcrumb,
      data: sanitizeValue(breadcrumb.data) as Record<string, unknown> | undefined,
    };
  },
  beforeSendLog(log) {
    return {
      ...log,
      message:
        typeof log.message === "string"
          ? sanitizeText(log.message)
          : log.message,
      attributes: sanitizeValue(log.attributes) as
        | Record<string, unknown>
        | undefined,
    };
  },
});

installRejectedFetchTracking();

export { Sentry };

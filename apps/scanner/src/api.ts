import type { LoginInput, User, ValidationScanResponse, ValidatorEvent } from "@ticket-chain/shared";

type ApiErrorBody = {
  code?: string;
  message?: string;
  fields?: Record<string, string>;
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

function parseCookiePairs(raw: string): Array<[string, string]> {
  return raw
    .split(/,(?=\s*[^=\s;,]+=)/g)
    .map((chunk) => chunk.split(";")[0]?.trim() ?? "")
    .map((pair) => pair.split("="))
    .filter((entry): entry is [string, string] => entry.length >= 2)
    .map(([name, ...valueParts]) => [name.trim(), valueParts.join("=").trim()]);
}

function extractBodyError(body: unknown): ApiErrorBody {
  if (!body || typeof body !== "object") return {};
  const value = body as Record<string, unknown>;
  const code = typeof value.code === "string" ? value.code : undefined;
  const message = typeof value.message === "string" ? value.message : undefined;
  const fields = value.fields && typeof value.fields === "object" ? (value.fields as Record<string, string>) : undefined;
  return { code, message, fields };
}

export function createScannerApiClient(baseUrl: string) {
  const cookies = new Map<string, string>();
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  function cookieHeader(): string | undefined {
    if (!cookies.size) return undefined;
    return Array.from(cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  function captureCookies(response: Response): void {
    const raw = response.headers.get("set-cookie") ?? response.headers.get("Set-Cookie");
    if (!raw) return;

    for (const [name, value] of parseCookiePairs(raw)) {
      cookies.set(name, value);
    }
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (cookieHeader()) headers.set("Cookie", cookieHeader() ?? "");
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

    const response = await fetch(`${normalizedBaseUrl}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });

    captureCookies(response);

    const raw = await response.text();
    let body: unknown = null;
    if (raw) {
      try {
        body = JSON.parse(raw) as unknown;
      } catch {
        body = null;
      }
    }

    if (!response.ok) {
      const error = extractBodyError(body);
      throw new ApiClientError(error.message ?? `Erro HTTP ${response.status}`, response.status, error.code, error.fields);
    }

    return body as T;
  }

  return {
    clearSession() {
      cookies.clear();
    },
    async login(input: LoginInput): Promise<{ user: User }> {
      return request<{ user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    async me(): Promise<{ user: User }> {
      return request<{ user: User }>("/auth/me");
    },
    async events(): Promise<{ items: ValidatorEvent[] }> {
      return request<{ items: ValidatorEvent[] }>("/validator/events");
    },
    async scan(eventId: string, payload: string): Promise<ValidationScanResponse> {
      return request<ValidationScanResponse>(`/validator/events/${eventId}/scans`, {
        method: "POST",
        body: JSON.stringify({ payload }),
      });
    },
    async logout(): Promise<void> {
      await request<{ ok: true }>("/auth/logout", { method: "POST" });
      cookies.clear();
    },
  };
}

export function getScannerApiBaseUrl(): string {
  return normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:4000");
}

export function isSessionError(error: unknown): boolean {
  return error instanceof ApiClientError && (error.status === 401 || error.status === 403);
}

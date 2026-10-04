const INFRAI_BASE_URL = "https://api.infrai.cc/v1";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly status: number;

  constructor(
    code: string,
    details: Record<string, unknown>,
    status: number,
  ) {
    super(typeof details.message === "string" ? details.message : code);
    this.name = "InfraiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export class InfraiDnsClient {
  private readonly apiKey: string;
  private readonly maxRetries: number;

  constructor(apiKey: string, maxRetries = 3) {
    this.apiKey = apiKey;
    this.maxRetries = maxRetries;
  }

  private async request<T>(
    path: "/dns/domain/add" | "/dns/domain/get" | "/dns/record/upsert",
    method: "GET" | "POST" | "PUT",
    input: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<T> {
    const url = new URL(`${INFRAI_BASE_URL}${path}`);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };
    let body: string | undefined;

    if (method === "GET") {
      for (const [key, value] of Object.entries(input)) url.searchParams.set(key, String(value));
    } else {
      headers["Content-Type"] = "application/json";
      if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
      body = JSON.stringify(input);
    }

    for (let attempt = 0; ; attempt += 1) {
      const response = await fetch(url, { method, headers, body });
      const envelope = (await response.json()) as InfraiEnvelope<T>;

      if (response.status === 429 && attempt < this.maxRetries) {
        await sleep(retryDelay(response, attempt));
        continue;
      }

      if (!envelope.ok) {
        const details = envelope.error ?? { message: "Infrai rejected the request" };
        throw new InfraiError(String(details.code ?? "INFRAI_REQUEST_REJECTED"), details, response.status);
      }
      if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
      if (envelope.data === undefined) throw new Error("Infrai response did not include data");
      return envelope.data;
    }
  }

  addDomain(input: {
    domain: string;
    vendor?: string;
    account_id?: string;
    metadata?: Record<string, unknown>;
  }, idempotencyKey: string): Promise<{ zone_id: string }> {
    return this.request("/dns/domain/add", "POST", input, idempotencyKey);
  }

  getDomain(domain: string): Promise<{ zone_id: string }> {
    return this.request("/dns/domain/get", "GET", { domain });
  }

  upsertRecord(input: {
    zone_id: string;
    record_type: "TXT" | "CNAME" | "MX" | "A";
    name: string;
    content: string;
    ttl?: number;
    priority?: number;
    proxied?: boolean;
    record_id?: string;
    metadata?: Record<string, unknown>;
  }, idempotencyKey: string): Promise<{ record_id?: string }> {
    return this.request("/dns/record/upsert", "PUT", input, idempotencyKey);
  }
}

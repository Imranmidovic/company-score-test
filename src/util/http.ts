import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly headers: Headers,
  ) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = "HttpError";
  }

  get isRateLimited(): boolean {
    return (
      this.status === 403 &&
      this.headers.get("x-ratelimit-remaining") === "0"
    );
  }
}

export async function fetchJson<T>(
  url: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, response.headers);
  }

  const json: unknown = await response.json();
  return schema.parse(json);
}

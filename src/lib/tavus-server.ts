import "server-only";

const API = "https://tavusapi.com/v2";

export async function tavusFetch<T = unknown>(method: string, route: string, body?: unknown): Promise<T> {
  const key = process.env.TAVUS_API_KEY;
  if (!key) throw new Error("TAVUS_API_KEY is not set");
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Tavus ${method} ${route} failed (${res.status}): ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

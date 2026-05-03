// ============================================================
// lib/api-fetch.ts
// Wrapper fetch qui utilise credentials: "include" pour envoyer
// le cookie httpOnly belo_token automatiquement.
// Plus besoin d'ajouter Authorization: Bearer manuellement.
// ============================================================

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body && typeof options.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
}

export async function apiFetchJSON<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await apiFetch(url, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as any)?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

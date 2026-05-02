export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = 1
): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 503 && retries > 0) {
    await new Promise(r => setTimeout(r, 1000));
    return fetchWithRetry(url, options, retries - 1);
  }
  return res;
}

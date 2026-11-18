const cache = new Map<string, { lat: number; lng: number } | null>();
let tail: Promise<void> = Promise.resolve();

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lookup(query: string) {
  const run = tail.then(async () => {
    if (cache.has(query)) return cache.get(query) ?? null;
    await wait(1100);
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("q", query);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "YalePaths/0.1 (student demo)",
      },
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as { lat?: string; lon?: string }[];
    const first = rows[0];
    const point = first?.lat && first.lon ? { lat: Number(first.lat), lng: Number(first.lon) } : null;
    if (!point || Number.isNaN(point.lat) || Number.isNaN(point.lng)) {
      cache.set(query, null);
      return null;
    }
    cache.set(query, point);
    return point;
  });
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query || query.length > 180) return Response.json({ lat: null, lng: null });
  if (cache.has(query)) return Response.json(cache.get(query) ?? { lat: null, lng: null });
  try {
    const point = await lookup(query);
    return Response.json(point ?? { lat: null, lng: null });
  } catch {
    return Response.json({ lat: null, lng: null });
  }
}

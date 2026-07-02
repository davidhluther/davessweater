// Tiny proxy to the US Census geocoder for the /fireworks sightline checker —
// the Census API serves no CORS headers, so the browser can't call it
// directly. We forward exactly one field each way and store nothing; the
// terrain tiles (which DO serve CORS) are fetched browser-direct.
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address")?.slice(0, 200);
  if (!address) {
    return Response.json({ error: "address required" }, { status: 400 });
  }
  const url =
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress" +
    `?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
  let payload: unknown;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "davessweater.com/fireworks sightline checker" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`census ${res.status}`);
    payload = await res.json();
  } catch {
    return Response.json({ error: "geocoder unavailable" }, { status: 502 });
  }
  const match = (payload as {
    result?: { addressMatches?: { coordinates: { x: number; y: number }; matchedAddress: string }[] };
  })?.result?.addressMatches?.[0];
  if (!match) {
    return Response.json({ error: "no match" }, { status: 404 });
  }
  return Response.json({
    lat: match.coordinates.y,
    lon: match.coordinates.x,
    matched: match.matchedAddress,
  });
}

// Shared response plumbing for /api/v1/* route handlers: permissive CORS (the
// data is CC BY 4.0 — meant to be fetched from anywhere), a Cache-Control tuned
// to the once-a-day pipeline cadence, and the license/attribution stamp every
// response carries.

import { LICENSE_FIELDS } from "@/lib/publicFeed";

// The datasets refresh once daily (GitHub Actions → commit → Vercel rebuild).
// A one-hour shared edge cache keeps the API cheap without ever serving day-old
// data long past a refresh; stale-while-revalidate covers the rebuild window.
const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function baseHeaders(): Record<string, string> {
  return { ...CORS_HEADERS, "Cache-Control": CACHE_CONTROL };
}

/** 200 JSON with CORS + cache + the license/attribution fields merged in. */
export function jsonOk(data: Record<string, unknown>): Response {
  return Response.json({ ...data, ...LICENSE_FIELDS }, { headers: baseHeaders() });
}

/** Error JSON ({ error, ...extra }) at the given status, still CORS-enabled so
 *  a browser client can read the message. `extra` carries e.g. valid_towns. */
export function jsonError(status: number, error: string, extra?: Record<string, unknown>): Response {
  return Response.json({ error, ...extra }, { status, headers: { ...CORS_HEADERS } });
}

/** CORS preflight — handlers export this as OPTIONS. */
export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: baseHeaders() });
}

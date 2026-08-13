// The whole public v1 API behind a single route.
//
// /api/v1/forecast, /scores, /today, /towns and /verdict used to be five route
// files. Vercel emits one Serverless Function per route directory, and this repo
// deploys on Vercel Hobby with a hard cap of 12 — five endpoints meant five
// functions for what is really one small read-only API. Folding them into one
// catch-all costs a single function and leaves every public URL byte-identical,
// so no consumer sees a change. The handlers themselves live in src/lib/apiV1/.
// See CHECKLIST.md for the function budget.
//
// Vercel data-tracing: these handlers read committed data/ JSON at request time
// and use searchParams, so they cannot be force-static. next.config.ts's
// outputFileTracingIncludes ships data/**/*.json into this Lambda under the
// "/api/v1/[...path]" key — keep that key in sync with this route's path.
export const dynamic = "force-dynamic";

import { jsonError, corsPreflight } from "@/lib/apiResponse";
import { forecast } from "@/lib/apiV1/forecast";
import { scores } from "@/lib/apiV1/scores";
import { today } from "@/lib/apiV1/today";
import { towns } from "@/lib/apiV1/towns";
import { verdict } from "@/lib/apiV1/verdict";

const HANDLERS: Record<string, (request: Request) => Promise<Response>> = {
  forecast,
  scores,
  today,
  towns,
  verdict,
};

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  // Exactly one segment: /api/v1/forecast is an endpoint, /api/v1/forecast/x is not.
  const handler = path?.length === 1 ? HANDLERS[path[0]] : undefined;
  if (!handler) {
    return jsonError(404, `Unknown endpoint: "/api/v1/${(path ?? []).join("/")}"`, {
      endpoints: Object.keys(HANDLERS).map((name) => `/api/v1/${name}`),
    });
  }
  return handler(request);
}

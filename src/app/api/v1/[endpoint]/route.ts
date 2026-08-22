// The whole public JSON API behind one route file, dispatching on the endpoint
// segment: /api/v1/forecast, /api/v1/today, /api/v1/scores, /api/v1/verdict,
// /api/v1/towns. Every public URL is exactly what it was when these were five
// sibling route files.
//
// WHY ONE FILE INSTEAD OF FIVE
// Vercel Hobby refuses a deployment carrying more than 12 Serverless Functions,
// and the refusal lands AFTER "Build Completed" - green build, frozen
// production. Route files are the unit that costs a function. These five used
// to share one Lambda because the Vercel builder grouped them, but grouping is
// the builder's decision, not ours: on 2026-08-21 it stopped grouping them, the
// count went 9 -> 14, and three days of pipeline commits failed to deploy. A
// catch-all is one route file, so it is one function no matter what the builder
// decides. See scripts/check_function_budget.py.
//
// Vercel data-tracing: these handlers read committed data/ JSON at request
// time. They use searchParams, so the route CANNOT be `force-static`
// (force-static can't read query params) - it is dynamic, and next.config.ts's
// outputFileTracingIncludes ships data/**/*.json into the serverless bundle so
// the reads resolve in the Lambda. That entry is keyed on THIS route's path.
export const dynamic = "force-dynamic";

import { jsonError, corsPreflight } from "@/lib/apiResponse";
import { forecast } from "@/lib/api/v1/forecast";
import { scores } from "@/lib/api/v1/scores";
import { today } from "@/lib/api/v1/today";
import { towns } from "@/lib/api/v1/towns";
import { verdict } from "@/lib/api/v1/verdict";

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

export async function GET(request: Request, ctx: { params: Promise<{ endpoint: string }> }) {
  const { endpoint } = await ctx.params;
  const handler = HANDLERS[endpoint];
  if (!handler) {
    return jsonError(404, `No such endpoint "${endpoint}" in the v1 API`, {
      valid_endpoints: Object.keys(HANDLERS).sort(),
    });
  }
  return handler(request);
}

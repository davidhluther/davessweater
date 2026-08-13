import { makeRouteHandler } from "@keystatic/next/route-handler";
import config from "../../../../../keystatic.config";

// Until the one-time GitHub App setup is done (docs/cms.md), GitHub storage mode
// has no credentials and makeRouteHandler throws at import time — which would
// fail the whole build. Degrade to a 503 on the editor API instead; the public
// site never touches this route, so it stays unaffected either way.
function unavailable(): Response {
  return new Response(
    "The content editor isn't configured on this deployment yet. See docs/cms.md for the one-time GitHub App setup.",
    { status: 503 },
  );
}

type Handler = (req: Request) => Response | Promise<Response>;

let handlers: { GET: Handler; POST: Handler };
try {
  handlers = makeRouteHandler({ config });
} catch {
  handlers = { GET: unavailable, POST: unavailable };
}

export const { GET, POST } = handlers;

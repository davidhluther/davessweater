// Sitewide click tracking (GA4 custom event `element_click`). Kept as a pure,
// testable function; src/components/ClickTracker.tsx does the one-time DOM
// wiring (a single delegated listener instead of instrumenting every button,
// link, and dropdown by hand across the site).

export interface ClickTarget {
  tagName: string;
  text?: string | null;
  href?: string | null;
  ariaLabel?: string | null;
  // Optional escape hatch for icon-only elements where text/aria-label would
  // be blank or unhelpful — set data-track-label on the element to override.
  trackLabel?: string | null;
}

export interface ClickEventParams {
  element_type: string;
  link_text: string;
  link_url?: string;
  outbound: boolean;
  page_path: string;
}

const ELEMENT_TYPE: Record<string, string> = { a: "link", button: "button", summary: "toggle" };
const MAX_LABEL_LENGTH = 100;

function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// Every internal link on this site is relative (see lib/html.ts); an absolute
// http(s)/mailto/tel href is by that same convention always leaving the site.
function isOutbound(href: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(href);
}

export function buildClickEventParams(target: ClickTarget, pathname: string): ClickEventParams | null {
  const href = target.href?.trim() || undefined;
  const label =
    (target.trackLabel && cleanText(target.trackLabel)) ||
    (target.ariaLabel && cleanText(target.ariaLabel)) ||
    (target.text && cleanText(target.text)) ||
    href ||
    null;
  if (!label) return null;
  return {
    element_type: ELEMENT_TYPE[target.tagName] ?? "element",
    link_text: label.slice(0, MAX_LABEL_LENGTH),
    ...(href ? { link_url: href } : {}),
    outbound: href ? isOutbound(href) : false,
    page_path: pathname,
  };
}

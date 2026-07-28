// Pure routing math for the header's town picker (SiteHeader → TownPicker).
//
// Deliberately free of `node:fs` and of React: SiteHeader is a client
// component, so anything it imports at runtime ships to the browser — the
// town-aware loaders in @/lib/towns read the filesystem and must stay on the
// server. The header receives its town list as plain data (TownNavItem[]) and
// this module answers the only two questions the control has: which town is the
// page about, and where does each option go from here.

/** The two per-town surfaces the site publishes. */
export type TownSurface = "weather" | "right-wrong-ray";

export interface PickerState {
  /** Which surface the picker navigates within, so a visitor on a town's
   *  scoreboard switches to another town's scoreboard, not its forecast. */
  surface: TownSurface;
  /** The town this page is about, or null when the page isn't about one. */
  slug: string | null;
  /** What the control reads on the header bar. */
  label: string;
}

/** Off a town surface the control is a plain menu, so it says so. */
const MENU_LABEL = "Towns";
/** The /weather hub is every town at once — no single town is "current". */
const HUB_LABEL = "All towns";

/**
 * Where a town lives on a given surface. Boone keeps the legacy top-level URLs
 * (there is deliberately no /weather/boone twin — see lib/towns.ts), so it
 * routes to `/` or `/right-wrong-ray`.
 */
export function townHrefOn(slug: string, surface: TownSurface): string {
  if (slug === "boone") return surface === "weather" ? "/" : "/right-wrong-ray";
  return `/${surface}/${slug}`;
}

/** Strip a trailing slash so "/weather/" behaves like "/weather". */
function normalize(pathname: string | null | undefined): string {
  const p = (pathname || "/").split(/[?#]/)[0];
  return p.replace(/\/+$/, "") || "/";
}

/**
 * Resolve the picker's state from the current path.
 *
 * The homepage IS Boone's forecast and /right-wrong-ray IS Boone's scoreboard,
 * so both read "Boone". A town page reads that town. The /weather hub reads
 * "All towns". Everywhere else the site has no location context, so the control
 * stays an honest menu rather than claiming a town the page isn't about.
 */
export function pickerState(
  pathname: string | null | undefined,
  towns: { slug: string; name: string }[],
): PickerState {
  const path = normalize(pathname);
  const nameOf = (slug: string): string | null => towns.find((t) => t.slug === slug)?.name ?? null;

  if (path === "/") return { surface: "weather", slug: "boone", label: nameOf("boone") ?? "Boone" };
  if (path === "/right-wrong-ray") {
    return { surface: "right-wrong-ray", slug: "boone", label: nameOf("boone") ?? "Boone" };
  }
  if (path === "/weather") return { surface: "weather", slug: null, label: HUB_LABEL };

  for (const surface of ["weather", "right-wrong-ray"] as const) {
    const prefix = `/${surface}/`;
    if (!path.startsWith(prefix)) continue;
    const slug = path.slice(prefix.length).split("/")[0];
    const name = nameOf(slug);
    // An unknown slug means a 404-ish path; don't invent a current town for it,
    // but do keep the visitor on the surface they were browsing.
    return name ? { surface, slug, label: name } : { surface, slug: null, label: MENU_LABEL };
  }

  return { surface: "weather", slug: null, label: MENU_LABEL };
}

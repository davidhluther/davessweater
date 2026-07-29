// The visitor's chosen town, remembered between pages.
//
// Owner-reported 2026-07-28: "The dropdown selector should carry across pages.
// If they change from one town to the next, then the next page with a town
// selector should match it." Before this, the header control derived the town
// purely from the URL, so moving from /weather/beech-mountain to the nav's
// Right/Wrong Ray landed on BOONE's scoreboard and the selection was gone.
//
// The memory is one slug in localStorage. Deliberately not a cookie: nothing
// server-rendered may depend on it (see the hydration note below), and a cookie
// would be sent on every request for a preference only the browser uses.
//
// Two rules the storage layer has to hold:
//   1. Never throw. Safari private mode throws on setItem, sandboxed frames can
//      throw on merely touching localStorage, and this module runs inside the
//      header on every page. A broken storage means "no memory", never a broken
//      site.
//   2. Never trust what comes back. A slug from an older registry (or a hand-
//      edited value) is validated against the town list before it is used, so a
//      stale entry can't point the nav at a 404.
//
// HYDRATION: the prerendered HTML has to keep Boone's canonical `/` and
// `/right-wrong-ray` nav hrefs — both for the crawlers and because a first
// client render that disagreed with the server would be a hydration mismatch.
// So this is shaped as an external store (subscribe + snapshot) whose SERVER
// snapshot is always null: React renders "no remembered town" first, matching
// the server byte for byte, then re-reads after mount and swaps the two primary
// links onto the remembered town a tick later. See SiteHeader.
import { pickerState, normalizePath } from "./townPicker";

/** Storage key. Namespaced so it can't collide with anything else on the domain. */
export const TOWN_MEMORY_KEY = "ds:town";

/** The /weather hub is every town at once, so landing there means "no town". */
const HUB_PATH = "/weather";

/** What arriving at a given path should do to the remembered town. */
export type TownMemoryAction =
  | { kind: "remember"; slug: string }
  | { kind: "clear" }
  | { kind: "keep" };

/**
 * Decide what a pathname means for the memory. Pure, so the policy is testable
 * without a browser.
 *
 * Arriving on any page the picker can name a town for — by deep link, internal
 * link, or back button — is itself a choice of that town, so it is remembered
 * the same way an explicit pick is. The /weather hub clears the memory, because
 * choosing "All towns" deliberately means no single town. Everywhere else
 * (the shop, an article, the API page) has no location context and must leave
 * an existing choice alone.
 */
export function townMemoryAction(
  pathname: string | null | undefined,
  towns: { slug: string; name: string }[],
): TownMemoryAction {
  const { slug } = pickerState(pathname, towns);
  if (slug) return { kind: "remember", slug };
  if (normalizePath(pathname) === HUB_PATH) return { kind: "clear" };
  return { kind: "keep" };
}

/** localStorage if this environment has a working one, else null. */
function storage(): Storage | null {
  try {
    // globalThis rather than window: the same expression works server-side
    // (undefined) and under the node test environment.
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The remembered town, or null when there is none or it is no longer a town. */
export function readTown(towns: { slug: string; name: string }[]): string | null {
  const store = storage();
  if (!store) return null;
  let raw: string | null = null;
  try {
    raw = store.getItem(TOWN_MEMORY_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  return towns.some((t) => t.slug === raw) ? raw : null;
}

/** Subscribers to re-read after the memory changes (useSyncExternalStore). */
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of [...listeners]) listener();
}

/**
 * Subscribe to changes in the remembered town. Also relays the browser's
 * cross-tab `storage` event, so switching town in one tab updates the header in
 * another. Returns the unsubscribe function React expects.
 */
export function subscribeTown(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    // A null key means the whole store was cleared.
    if (e.key === null || e.key === TOWN_MEMORY_KEY) onChange();
  };
  const canListen = typeof window !== "undefined";
  if (canListen) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    if (canListen) window.removeEventListener("storage", onStorage);
  };
}

/** Remember a town. Silent no-op when storage is unavailable. */
export function writeTown(slug: string): void {
  const store = storage();
  if (store) {
    try {
      store.setItem(TOWN_MEMORY_KEY, slug);
    } catch {
      // Private-mode quota error. A visitor who can't be remembered still browses.
    }
  }
  emit();
}

/** Forget the town — what "All towns" means. */
export function clearTown(): void {
  const store = storage();
  if (store) {
    try {
      store.removeItem(TOWN_MEMORY_KEY);
    } catch {
      // Same as above: never let storage break a page render.
    }
  }
  emit();
}

/**
 * Apply the arrival policy for a pathname and answer with the town now in
 * effect. This is the one call the header makes on each navigation: it records
 * an arrival, honors the hub's clear, and otherwise reports what was already
 * remembered. Writing is the whole point — it updates an external system, which
 * is what an effect is for; the reading side goes through subscribeTown/readTown.
 */
export function recordTownArrival(
  pathname: string | null | undefined,
  towns: { slug: string; name: string }[],
): string | null {
  const action = townMemoryAction(pathname, towns);
  if (action.kind === "remember") {
    writeTown(action.slug);
    return action.slug;
  }
  if (action.kind === "clear") {
    clearTown();
    return null;
  }
  return readTown(towns);
}

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  TOWN_MEMORY_KEY, townMemoryAction, readTown, writeTown, clearTown, recordTownArrival,
  subscribeTown,
} from "@/lib/townMemory";

const TOWNS = [
  { slug: "boone", name: "Boone" },
  { slug: "blowing-rock", name: "Blowing Rock" },
  { slug: "beech-mountain", name: "Beech Mountain" },
];

// The test environment is node, so there is no localStorage until we install
// one. That is itself the SSR case the module has to survive, so the first
// describe deliberately runs with nothing installed.
type Store = Storage & { throwOnWrite?: boolean };

function fakeStorage(opts: { throwOnWrite?: boolean; throwOnRead?: boolean } = {}): Store {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => {
      if (opts.throwOnRead) throw new Error("blocked");
      return map.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (opts.throwOnWrite) throw new Error("QuotaExceededError");
      map.set(k, v);
    },
    removeItem: (k: string) => { map.delete(k); },
  } as Store;
}

function install(store: Storage | undefined) {
  Object.defineProperty(globalThis, "localStorage", {
    value: store, configurable: true, writable: true,
  });
}

describe("townMemoryAction", () => {
  it("remembers the town on every page the picker can name one for", () => {
    expect(townMemoryAction("/", TOWNS)).toEqual({ kind: "remember", slug: "boone" });
    expect(townMemoryAction("/right-wrong-ray", TOWNS)).toEqual({ kind: "remember", slug: "boone" });
    expect(townMemoryAction("/weather/beech-mountain", TOWNS)).toEqual({
      kind: "remember", slug: "beech-mountain",
    });
    expect(townMemoryAction("/right-wrong-ray/blowing-rock", TOWNS)).toEqual({
      kind: "remember", slug: "blowing-rock",
    });
  });

  it("clears on the /weather hub, because 'All towns' means no single town", () => {
    expect(townMemoryAction("/weather", TOWNS)).toEqual({ kind: "clear" });
    expect(townMemoryAction("/weather/", TOWNS)).toEqual({ kind: "clear" });
  });

  it("leaves the memory alone on pages with no location context", () => {
    for (const p of ["/shop", "/resources/articles", "/api", "/methodology"]) {
      expect(townMemoryAction(p, TOWNS)).toEqual({ kind: "keep" });
    }
  });

  it("keeps rather than clears on an unknown town slug", () => {
    expect(townMemoryAction("/weather/nowhere-ville", TOWNS)).toEqual({ kind: "keep" });
  });
});

describe("storage access without a localStorage (the server render)", () => {
  beforeEach(() => install(undefined));
  afterEach(() => install(undefined));

  it("reads null and writes nothing, without throwing", () => {
    expect(readTown(TOWNS)).toBeNull();
    expect(() => writeTown("beech-mountain")).not.toThrow();
    expect(() => clearTown()).not.toThrow();
    expect(recordTownArrival("/shop", TOWNS)).toBeNull();
  });
});

describe("storage access with a working localStorage", () => {
  beforeEach(() => install(fakeStorage()));
  afterEach(() => install(undefined));

  it("round-trips a town under the namespaced key", () => {
    writeTown("beech-mountain");
    expect(globalThis.localStorage.getItem(TOWN_MEMORY_KEY)).toBe("beech-mountain");
    expect(readTown(TOWNS)).toBe("beech-mountain");
  });

  it("forgets the town on clear", () => {
    writeTown("blowing-rock");
    clearTown();
    expect(readTown(TOWNS)).toBeNull();
  });

  it("refuses a stored slug that is no longer a town", () => {
    globalThis.localStorage.setItem(TOWN_MEMORY_KEY, "vilas");
    expect(readTown(TOWNS)).toBeNull();
  });
});

describe("storage that throws (Safari private mode, sandboxed frames)", () => {
  afterEach(() => install(undefined));

  it("swallows a setItem quota error", () => {
    install(fakeStorage({ throwOnWrite: true }));
    expect(() => writeTown("beech-mountain")).not.toThrow();
    expect(readTown(TOWNS)).toBeNull();
  });

  it("swallows a getItem failure", () => {
    install(fakeStorage({ throwOnRead: true }));
    expect(readTown(TOWNS)).toBeNull();
  });

  it("survives localStorage itself throwing on access", () => {
    Object.defineProperty(globalThis, "localStorage", {
      get() { throw new Error("access denied"); },
      configurable: true,
    });
    expect(readTown(TOWNS)).toBeNull();
    expect(() => writeTown("boone")).not.toThrow();
    expect(() => clearTown()).not.toThrow();
  });
});

describe("subscribeTown — what makes the header re-read after a change", () => {
  beforeEach(() => install(fakeStorage()));
  afterEach(() => install(undefined));

  it("notifies on write and on clear, and stops after unsubscribing", () => {
    let calls = 0;
    const unsubscribe = subscribeTown(() => { calls += 1; });
    writeTown("beech-mountain");
    expect(calls).toBe(1);
    clearTown();
    expect(calls).toBe(2);
    unsubscribe();
    writeTown("blowing-rock");
    expect(calls).toBe(2);
  });

  it("notifies for an arrival that changes the memory", () => {
    let calls = 0;
    const unsubscribe = subscribeTown(() => { calls += 1; });
    recordTownArrival("/weather/beech-mountain", TOWNS);
    expect(calls).toBe(1);
    unsubscribe();
  });
});

describe("recordTownArrival — the arrival the header runs on every navigation", () => {
  beforeEach(() => install(fakeStorage()));
  afterEach(() => install(undefined));

  it("banks a deep link, so arriving by any means counts as choosing", () => {
    expect(recordTownArrival("/weather/beech-mountain", TOWNS)).toBe("beech-mountain");
    expect(readTown(TOWNS)).toBe("beech-mountain");
  });

  it("carries the town onto a page with no location context", () => {
    recordTownArrival("/weather/beech-mountain", TOWNS);
    expect(recordTownArrival("/shop", TOWNS)).toBe("beech-mountain");
  });

  it("replaces the memory when the visitor moves to another town", () => {
    recordTownArrival("/weather/beech-mountain", TOWNS);
    expect(recordTownArrival("/right-wrong-ray/blowing-rock", TOWNS)).toBe("blowing-rock");
    expect(readTown(TOWNS)).toBe("blowing-rock");
  });

  it("clears at the hub and stays cleared afterwards", () => {
    recordTownArrival("/weather/beech-mountain", TOWNS);
    expect(recordTownArrival("/weather", TOWNS)).toBeNull();
    expect(recordTownArrival("/shop", TOWNS)).toBeNull();
  });

  it("treats the homepage and Boone's board as choosing Boone", () => {
    recordTownArrival("/weather/beech-mountain", TOWNS);
    expect(recordTownArrival("/", TOWNS)).toBe("boone");
  });
});

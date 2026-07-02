"use client";
// Reports-page teaser for the /fireworks sightline checker: the same input
// module, but Check hands the query to /fireworks (?check=...#checker), where
// the real checker auto-runs it. No terrain math happens on this page.
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SightlineTeaser() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const go = (q: string) => router.push(`/fireworks?check=${encodeURIComponent(q)}#checker`);
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => go("me")}
          className="rounded-md bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
        >
          Use My Location
        </button>
        <span className="text-sm text-muted">or</span>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (address.trim()) go(address.trim());
          }}
          className="flex min-w-0 flex-1 gap-2"
        >
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="street address, town, NC"
            aria-label="Address to check"
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-teal-700 px-3.5 py-2 text-sm font-semibold text-teal transition-colors hover:bg-surface"
          >
            Check
          </button>
        </form>
      </div>
    </div>
  );
}

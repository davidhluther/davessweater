## Roadmap & task tracking

**`CHECKLIST.md` (repo root) is the durable single source of truth for outstanding work.** The owner works across multiple sessions and tools and does not want to re-derive state each time.

**Standing instruction for every session:** read `CHECKLIST.md` at the start of work, and keep it current — check off completed items, add new ones as they come up, and treat it (not chat memory) as authoritative. When you finish a tracked task, update the checklist in the same change.

## Future Ideas

- **Head-to-head comparison on homepage**: Show a Ray's Weather vs Dave's Sweater (Open-Meteo) accuracy comparison directly on the site, similar to the Deep Gap scoring analysis done manually on June 14, 2026. (Dave's Sweater scored 92/100 vs Ray's 67/100 that day.)
- **Fourthwall Storefront API**: Contact Fourthwall support about the 403 error; if fixed, switch back from RSS feed for better product data.
- **Weather station (ground truth)**: Stand up a real Ecowitt Wittboy WS90 + GW2000 station in Boone, pull readings via the Ecowitt API in a GitHub Action, and wire those observations in as the authoritative "actuals" source. See `CHECKLIST.md` for the full plan.


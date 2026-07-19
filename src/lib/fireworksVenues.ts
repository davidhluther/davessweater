// Venue facts for /fireworks. Every claim is either verified against the named
// official source on `verifiedOn` (primary-source verification pass, July 2,
// 2026), or carries status "unconfirmed" and the page says so out loud.
// Official wording renders verbatim — a computed time never masquerades as an
// official one (Event JSON-LD gets a clock time ONLY when the venue itself
// states one; see page.tsx). Note Boone: the county TDA's listing field says
// 9:00 PM but the town's own wording everywhere is "around dusk", so schema
// stays date-only and the 9:00 lives in a caveat.
// Coordinates are the show site (OSM/Nominatim). The Python capture mirrors
// these ids — keep scripts/capture_fireworks_forecast.py in sync.
// Strings here feed JSON-LD rendered as text: avoid raw <, >, & (see JsonLd).

export interface VenueSource {
  name: string;
  url: string;
}

/**
 * The observed record — when a show ACTUALLY launched, as opposed to what the
 * listing said. `firstShell` is THE SLOT: when a real first-shell time surfaces
 * (e.g. a timestamped Facebook Live from that night), set it as 24h "HH:MM"
 * local and the venue card + FAQ pick it up on the next build. Until then,
 * `note` carries the honest bound we can prove, with the source linked.
 */
export interface ObservedStart {
  year: number;
  /** First-shell wall-clock time "HH:MM" (24h, America/New_York) once known. */
  firstShell: string | null;
  note: string;
  source?: VenueSource;
}

export interface FireworksVenue {
  id: string;
  /** Short display name for the matrix. */
  name: string;
  /** Full show name, used in Event schema. */
  showName: string;
  town: string;
  status: "confirmed" | "unconfirmed";
  date: string;
  /** Verbatim start-time wording from the source; "—" when none exists. */
  officialWording: string;
  /** "21:30" only when the venue publishes an actual clock time. */
  clockTimeStated: string | null;
  locationName: string;
  lat: number;
  lon: number;
  sources: VenueSource[];
  verifiedOn: string | null;
  weatherPolicy: string | null;
  logistics: string[];
  caveats: string[];
  observed?: ObservedStart[];
}

export const VENUES: FireworksVenue[] = [
  {
    id: "boone",
    name: "Boone",
    showName: "Town of Boone 4th of July Fireworks",
    town: "Boone",
    status: "confirmed",
    date: "2026-07-04",
    officialWording: "around dusk",
    clockTimeStated: null,
    locationName: "Clawson-Burnley Park, on the Boone Greenway",
    lat: 36.2049,
    lon: -81.6507,
    sources: [
      // Jones House (the town's own) leads — it also feeds the Event schema's
      // organizer. The TDA's per-event URL 410'd after the show (they purge past
      // events), so the TDA citation points at their stable annual-events page.
      { name: "Jones House Cultural Center (Town of Boone)", url: "https://www.joneshouse.org/4thofjuly" },
      { name: "ExploreBoone (Watauga County TDA)", url: "https://www.exploreboone.com/events/annual-events/" },
    ],
    verifiedOn: "2026-07-02",
    weatherPolicy: "Not stated on any official source; a day-of call would land on the town's channels.",
    logistics: [
      "The parade runs King Street downtown at 11 AM; free cake and watermelon on the Jones House lawn at noon.",
      "Evening at Clawson-Burnley: bounce houses, lawn games, music, food, all free.",
      "The TDA's own advice is to come early and walk the Greenway in, which is also just correct.",
    ],
    caveats: [
      "The county TDA's event listing shows a 9:00 PM start; the town's own wording everywhere is \"around dusk.\" We render the town's word and compute what it means; the two agree better than they sound.",
    ],
    // ← THE SLOT: when a 2025 first-shell time surfaces, set firstShell on the
    //   2025 entry ("21:XX") — the card and FAQ update on the next build.
    observed: [
      {
        year: 2025,
        firstShell: null,
        note: "Night-of drone footage bounds the show to after civil dusk and well before 10:40 PM; nobody recorded the first-shell minute. Clock it next time and we will print it.",
        source: { name: "night-of footage", url: "https://www.youtube.com/watch?v=hD6H2R_guzk" },
      },
      {
        year: 2024,
        firstShell: null,
        note: "A clip uploaded at 9:56 PM proves shells in the air by roughly 9:50, about half an hour after civil dusk ended.",
        source: { name: "night-of footage", url: "https://www.youtube.com/watch?v=I9o5W7ohyk4" },
      },
    ],
  },
  {
    id: "tweetsie",
    name: "Tweetsie Railroad",
    showName: "Tweetsie Railroad July 4th Fireworks Extravaganza",
    town: "Blowing Rock",
    status: "confirmed",
    date: "2026-07-04",
    officialWording: "Fireworks begin at 9:30 p.m.",
    clockTimeStated: "21:30",
    locationName: "Tweetsie Railroad, 300 Tweetsie Railroad Ln, US-321",
    lat: 36.1708,
    lon: -81.6485,
    sources: [
      { name: "Tweetsie Railroad (official)", url: "https://tweetsie.com/special-events/july-4th-fireworks-extravaganza/" },
    ],
    verifiedOn: "2026-07-02",
    weatherPolicy: "Verbatim: \"The fireworks will be launched in light rain or dry weather. In the very unlikely event that severe weather requires a delay, the show may be held the following evening.\"",
    logistics: [
      "July 4 only; there is no July 3 show in 2026.",
      "Watching from the Tweetsie parking lot is free: no ticket, free parking.",
      "Doing the park day first? Hours run 10 AM–9 PM, and guests \"must exit the park by 9:00 p.m. to watch the fireworks from the parking lot.\" No re-entry after 9.",
      "Park admission, if you want the rides: $65 adults (13+), $45 kids 3–12, free under 3.",
    ],
    caveats: [],
    observed: [
      {
        year: 2025,
        firstShell: null,
        note: "The full-show video runs 15 and a half minutes; with the stated 9:30 start, plan on roughly 9:30–9:46.",
        source: { name: "full-show video", url: "https://www.youtube.com/watch?v=npYoGzffspQ" },
      },
    ],
  },
  {
    id: "beech-mountain",
    name: "Beech Mountain",
    showName: "Beech Mountain Independence Day Celebration and 55th Annual Hog Roast",
    town: "Beech Mountain",
    status: "confirmed",
    date: "2026-07-04",
    officialWording: "Fireworks will begin at dusk",
    clockTimeStated: null,
    locationName: "Beech Mountain Resort, Play Yard slope by the Lodge",
    lat: 36.1961,
    lon: -81.8778,
    sources: [
      { name: "Beech Mountain Resort (official)", url: "https://www.beechmountainresort.com/event/independence-day-celebration-with-fireworks/" },
      { name: "beechmtn.com (town TDA) calendar", url: "https://beechmtn.com/calendar/" },
    ],
    verifiedOn: "2026-07-02",
    weatherPolicy: "Not stated on the resort's event page.",
    logistics: [
      "Celebration runs 5–9 PM: live music, vendors, the 55th Annual Hog Roast from 5. Free and open to the public.",
      "Viewing that has always worked: the resort village, the Play Yard slope, or the Lodge.",
      "Beech Mountain sits above 5,000 feet; a July evening up there is genuinely sweater weather. We would know.",
    ],
    caveats: [],
  },
  {
    id: "west-jefferson",
    name: "West Jefferson",
    showName: "Ashe County July 4 Fireworks",
    town: "West Jefferson",
    status: "confirmed",
    date: "2026-07-04",
    officialWording: "around dark",
    clockTimeStated: null,
    locationName: "Ridgeline off US-221, across from Mt. Jefferson Rd",
    lat: 36.3892,
    lon: -81.4813,
    sources: [
      { name: "Ashe County Chamber of Commerce", url: "https://ashechamber.com/event.php?id=6610" },
      { name: "Ashe County Parks and Recreation", url: "https://www.asheparks.com/4th-of-july" },
    ],
    verifiedOn: "2026-07-02",
    weatherPolicy: "Not stated.",
    logistics: [
      "County-run and county-scale, launched from a ridgeline; the official guidance is to watch \"from the safety of their vehicles.\" Staff and law enforcement direct parking.",
      "Parking that has worked in prior years: Ashe County High School, the old Lowes Foods, Walmart, the Ashe Civic Center, and downtown West Jefferson.",
      "Info: (336) 982-6185.",
    ],
    caveats: [
      "The 2026 listing's time field contains an obvious data-entry error, so we render the words: \"around dark.\" Prior years ran 9:30–10 PM, which is what the dusk math says anyway.",
    ],
  },
];

/** Towns people search for that don't have a CONFIRMED show of their own in 2026. */
export const NO_SHOW_TOWNS = [
  {
    id: "blowing-rock",
    town: "Blowing Rock",
    headline: "no town fireworks",
    note:
      "The chamber's full 2026 schedule is a 10 AM parade, a band until 3, games in Memorial Park, food trucks, and zero fireworks. (The town government's own July 4 page still carries years-old text about a Country Club show; it appears on no 2026 source. Town calendars recycle.) The fireworks people mean when they say Blowing Rock are Tweetsie Railroad's, just north on US-321. That's the show.",
    sources: [
      { name: "blowingrock.com 2026 July 4 schedule", url: "https://blowingrock.com/july4th/" },
      { name: "ExploreBoone listing", url: "https://www.exploreboone.com/event/blowing-rocks-4th-of-july-festival/27454/" },
    ] as VenueSource[],
  },
  {
    id: "elk-park",
    town: "Elk Park",
    headline: "listed everywhere, verified nowhere",
    note:
      "Aggregator roundups list a July 4 festival from 6 PM to midnight with fireworks at 9:30, but no official Elk Park source exists, and the listing's fireworks sentence appears word-for-word in 2024 coverage of a different town's show. It may well happen; we just can't tell you it will. If it matters to your night, call before driving: (828) 387-3003 appears on related listings.",
    sources: [
      { name: "High Country Host (aggregator; lead only)", url: "https://highcountryhost.com/NC-High-Country-4th-of-July-Celebrations-2026" },
    ] as VenueSource[],
  },
  {
    id: "banner-elk",
    town: "Banner Elk",
    headline: "daytime only, per every 2026 source",
    note:
      "Star Spangled Banner Elk is a daytime celebration: parade at 11, Party in the Park, duck races at 12:30, and, verbatim from the TDA, \"Festivities conclude at 3 p.m.\" The \"Mile High Fourth\" branding with 9:30 fireworks that aggregators still list was 2024's event; no 2026 source repeats it. If the town announces an evening show, we'll add it. Nearest verified fireworks: Beech Mountain, ten minutes up the hill.",
    sources: [
      { name: "bannerelk.com (TDA), 2026 article", url: "https://www.bannerelk.com/latest-news/star-spangled-banner-elk-fourth-of-july-celebration/" },
      { name: "Avery County Chamber", url: "https://www.bannerelk.org/4th-of-july.html" },
    ] as VenueSource[],
  },
];

/** Reported shows we could NOT verify with any primary source — listed with the sourcing stated. */
export const UNVERIFIED_REPORTS = [
  {
    town: "Newland",
    date: "2026-07-03",
    claim: "Town fireworks at dark on FRIDAY, July 3, after a 10 AM parade and an evening street dance at the Riverwalk; the only July 3 fireworks night we could trace in the High Country.",
    sourcing: "Local newspaper roundup (the article has since vanished); no town source found.",
  },
  {
    town: "Sparta",
    date: "2026-07-04",
    claim: "Fireworks \"at dark\" at the high school; parade at 2 PM with live music.",
    sourcing: "Aggregator only; the chamber's own page wouldn't load for us. (336) 372-5473 to verify.",
  },
  {
    town: "North Wilkesboro",
    date: "2026-07-04",
    claim: "Marketplace Meltdown, 5–8 PM at Yadkin Valley Marketplace; firetruck parade around 8, fireworks after.",
    sourcing: "The town's own pages still display 2024 and 2025 dates; the 2026 claim is aggregator-only. (336) 667-7129.",
  },
  {
    town: "Sugar Mountain",
    date: "2026-07-04",
    claim: "The village's own site lists fireworks beginning \"around 9:15 pm\", which is exactly what the dusk math predicts.",
    sourcing: "Primary wording exists (seesugar.com) but we could not verify the 2026 date specifics; check before driving.",
  },
];

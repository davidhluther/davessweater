// ─────────────────────────────────────────────────────────────────────────
// Editable site copy.
//
// This is the place to change the site's wording WITHOUT touching component
// code. Edit a string here, commit (the GitHub web editor works fine — open the
// file, click the ✏️, change the words, "Commit changes"), and the site updates
// on the next deploy. Keep the keys; just change the text in quotes.
//
// (Not every string on the site lives here yet — this covers the homepage hero
// and the Dave's Sweater Index. Ask to migrate more copy in as needed.)
// ─────────────────────────────────────────────────────────────────────────

export const copy = {
  hero: {
    // The big headline. `lead` is white; `emphasis` is the orange tail.
    headlineLead: "The free forecasts keep beating the one ",
    headlineEmphasis: "you pay for.",
    iphoneAside: "The only weather service you need is already in your pocket.",
    ctaPrimary: "See the full scoreboard",
    ctaSecondary: "How we score it",
  },

  // The "Dave's Sweater Index" strip at the bottom of the hero.
  index: {
    title: "Dave's Sweater Index",
    // `n` is the number of forecasters averaged together.
    footnote: (n: number) => `the average of ${n} independent (and free) forecasters`,
  },

  // The 5-day strip in the Today module.
  fiveDay: {
    // Header tooltip. `n` is the number of forecasters contributing to the
    // leading day's consensus — derived at render (same count the Dave's
    // Sweater Index shows), so it tracks roster changes on its own.
    tooltip: (n: number) => `The consensus of ${n} free forecasts, graded against reality every morning.`,
  },
} as const;

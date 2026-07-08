// ─────────────────────────────────────────────────────────────────────────
// Editable site copy.
//
// This is the place to change the site's wording WITHOUT touching component
// code. Edit a string here, commit (the GitHub web editor works fine — open the
// file, click the ✏️, change the words, "Commit changes"), and the site updates
// on the next deploy. Keep the keys; just change the text in quotes.
//
// (Not every string on the site lives here yet — this covers the homepage hero,
// the Dave's Sweater Index, and the "Why this exists" timeline. Ask to migrate
// more copy in as needed.)
// ─────────────────────────────────────────────────────────────────────────

export const copy = {
  hero: {
    // The big headline. `lead` is white; `emphasis` is the orange tail.
    headlineLead: "The free forecasts keep beating the one ",
    headlineEmphasis: "you pay for.",
    iphoneAside: "A better forecast may already be in your pocket.",
    ctaPrimary: "See the full scoreboard",
    ctaSecondary: "How we score it",
  },

  // The "Dave's Sweater Index" strip at the bottom of the hero.
  index: {
    title: "Dave's Sweater Index",
    // `n` is the number of forecasters averaged together.
    footnote: (n: number) => `the average of ${n} independent (and free) forecasters`,
  },

  // The homepage "Why this exists" timeline. Beats with live numbers keep
  // those numbers in the component; everything editable lives here.
  why: {
    kicker: "Why this exists",
    subline: "Boone's outlook, fact-checked daily. Built on data that was always yours.",
    beat1Head: "One forecast. One bill.",
    beat1Body:
      "You paid for the only outlook in town. The sell was authority: a professorship, staff forecasters, decades of habit, his own stations.",
    beat2Head: "So somebody started checking.",
    beat3Head: "The gap isn't close.",
    beat4Head: "It was never better weather.",
    // The live "{provided} of {days}" rain-total figure renders after this text.
    beat4Body:
      "It's open data anyone can pull. The habit was the product. And the paid forecast still doesn't publish a rain total, ",
    beat5Head: "The weather was never his.",
    beat5Body:
      "The data behind every forecast is public. Satellites, models, stations your taxes already paid for. Credentials that gate it behind a bill don't make it truer. We find it, vet it, and hand it over. Free.",
    beat6Head: "So we publish the receipts.",
    beat6Body:
      "One open rubric, every forecaster graded alike, ours included once our station goes up. And it doesn't stop at weather: dusk math for the fireworks, a day planner for the Games. Whatever's sitting out there, we'll make it useful.",
  },
} as const;

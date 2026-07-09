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
    // The one-line thesis under the headline. `dekLink` renders as a link to /about.
    dekLead: "Scored daily, published free, because nobody owns the weather. ",
    dekLink: "A sweater, you can own.",
    ctaPrimary: "See the full scoreboard",
    ctaSecondary: "How we score it",
    ctaTertiary: "Why we do it",
  },

  // The "Dave's Sweater Index" strip at the bottom of the hero.
  index: {
    title: "Dave's Sweater Index",
    // `n` is the number of forecasters averaged together.
    footnote: (n: number) => `the average of ${n} independent (and free) forecasters`,
    tagline: "The forecast belongs to everybody. The sweater call is yours.",
  },

  // The homepage "Why this exists" timeline. Beats with live numbers keep
  // those numbers in the component; everything editable lives here.
  why: {
    kicker: "Why this exists",
    subline: "Boone's outlook, fact-checked daily. Built on data that was always yours.",
    beat1Head: "One forecast. One bill.",
    beat1Body:
      "You paid a business for the only outlook in town. The sell was an appeal to authority: tenure, staff forecasters, decades of habit, and stations he owned.",
    beat2Head: "So, somebody started checking.",
    beat3Head: "The gap isn't close.",
    beat3Body:
      "Spending money for offices and equipment helped sell a product, but it doesn't buy accuracy.",
    beat4Head: "It was never better weather.",
    // The live "{provided} of {days}" rain-total figure renders after this text.
    // The live "(missing N of M days)" figure renders after this text.
    beat4Body:
      "It's open data anyone can pull, gated behind a paywall. The habit was the product, bundled with things you don't need and lacking what you do need, like publishing a rain total ",
    beat5Head: "The weather was never his.",
    beat5Body:
      "The data behind every forecast is public. Satellites, models, and data from stations your taxes already paid for. Credentials that gate it behind a bill don't make it truer. We find it, vet it, and hand it over. Free.",
    beat6Head: "And we publish the receipts.",
    beat6Body:
      "One open rubric, every forecaster graded alike — ours included. And it doesn't stop at weather: dusk math for the fireworks, a day planner for the Highland Games, and more to come. Whatever's sitting out there, we'll make it useful.",
  },

  // The 5-day strip in the Today module.
  fiveDay: {
    // Header tooltip. `n` is the number of forecasters contributing to the
    // leading day's consensus — derived at render (same count the Dave's
    // Sweater Index shows), so it tracks roster changes on its own.
    tooltip: (n: number) => `The consensus of ${n} free forecasts, graded against reality every morning.`,
  },
} as const;

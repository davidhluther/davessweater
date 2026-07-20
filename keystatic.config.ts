import { config, fields, collection } from "@keystatic/core";

// Git-based CMS (Keystatic). Local storage while developing writes straight to
// the working tree; GitHub storage on the deployed site so posts can be written
// from any browser — each save is a commit, and Vercel redeploys from it. This
// IS the data-democracy pitch applied to ourselves: the content never leaves
// the repo. One-time GitHub-App setup: docs/cms.md.
const storage =
  process.env.NODE_ENV === "development"
    ? ({ kind: "local" } as const)
    : ({ kind: "github", repo: "davidhluther/davessweater" } as const);

export default config({
  storage,
  ui: {
    brand: { name: "Dave's Sweater" },
  },
  collections: {
    posts: collection({
      label: "Posts",
      slugField: "slug",
      // Edits the SAME native posts the site already renders. Keystatic writes
      // .mdoc (markdown body + YAML frontmatter); getNativePosts() in
      // src/lib/data.ts reads both .md and .mdoc, so hand-authored posts and
      // CMS-authored posts coexist with one reader.
      path: "src/content/posts/*",
      entryLayout: "content",
      columns: ["slug", "date"],
      format: { contentField: "body" },
      schema: {
        slug: fields.slug({
          name: {
            label: "Title",
            description:
              "The headline readers see. Keep it under ~60 characters so Google shows it whole. Title Case for post titles (house rule).",
            validation: { isRequired: true },
          },
          slug: {
            label: "Web address",
            description:
              "The last part of the post's link (/resources/{category}/{this}). Auto-filled from the title.",
          },
        }),
        // NOTE: getNativePosts reads `title` from frontmatter, but Keystatic's
        // slugField stores the human name as the slug field's `name`, written to
        // frontmatter as `title`. So this schema writes title: + the filename is
        // the slug. The reader falls back to the filename for slug when an
        // explicit `slug:` key is absent (which it is for Keystatic entries).
        category: fields.select({
          label: "Category",
          description: "Articles = longer evergreen reads. News & Updates = announcements and changes.",
          options: [
            { label: "Articles", value: "articles" },
            { label: "News & Updates", value: "news" },
          ],
          defaultValue: "articles",
        }),
        date: fields.date({
          label: "Publish date",
          description: "Shown on the post. (Posts are not date-gated yet — a future date still renders.)",
          defaultValue: { kind: "today" },
          validation: { isRequired: true },
        }),
        summary: fields.text({
          label: "Teaser",
          description: "One or two sentences shown on the resources cards and, by default, in Google results.",
          multiline: true,
          validation: { isRequired: true, length: { min: 20, max: 300 } },
        }),
        metaTitle: fields.text({
          label: "SEO title (optional)",
          description: "Overrides the browser-tab and search-result title. Leave blank to use the post title.",
        }),
        metaDescription: fields.text({
          label: "SEO description (optional)",
          description: "Overrides the search-result description. Leave blank to use the teaser.",
          multiline: true,
        }),
        body: fields.markdoc({
          label: "Post",
          description:
            "Write like a doc — select text for bold, links, and headings. Use 'Heading 2' for section titles (sentence case). For an FAQ, add a 'Heading 2' reading exactly \"Frequently asked questions\" followed by each question as a 'Heading 3' — the site turns that section into FAQ rich results automatically.",
        }),
      },
    }),
  },
});

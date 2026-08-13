# Content editor (Keystatic)

Blog posts can be written and edited through a Google-Docs-style editor at
**`/keystatic`** — no markdown knowledge needed. The editor has a toolbar for
bold, links, headings, lists, and tables, and the structured fields (title,
web address, category, publish date, teaser, SEO overrides) are ordinary form
inputs. The content never leaves the repo: every save is a file in git, which
is the data-democracy pitch applied to ourselves.

## Writing a post

1. Open `/keystatic` → Posts → **Add**.
2. Fill in the title (the web address fills itself), pick a category
   (Articles = evergreen reads, News & Updates = announcements), set the
   publish date, and write a teaser. Write the post in the big editor; use
   "Heading 2" for section titles (sentence case, house rule).
3. For an FAQ, add a Heading 2 reading exactly **"Frequently asked questions"**
   then each question as a Heading 3. The site turns that section into FAQ rich
   results automatically — no separate field to fill.
4. Save. On the deployed site this creates a commit and Vercel redeploys (a
   couple of minutes). Locally it just writes the file.

Posts appear at `/resources/{category}/{slug}`; legacy `/blog/{slug}` links
redirect there automatically.

## How it stores content

CMS posts are written as `src/content/posts/{slug}.mdoc` — YAML frontmatter
plus a markdown body. The site's existing reader (`getNativePosts` in
`src/lib/data.ts`) reads both `.md` (hand-authored) and `.mdoc` (CMS) with one
code path, so the two coexist. Every share card, sitemap entry, and `/blog`
redirect is generated from the file, same as a hand-authored post.

**The four original posts stay `.md` and don't appear in the editor's list**
(their pre-CMS frontmatter shape differs). They still render and are still
hand-editable. Migrating them into the CMS is an optional future task — it
touches the redirect/sitemap coupling, so it's a reviewed change, not a
side effect of this setup.

## Live-site editing — one-time setup (owner)

Locally, `/keystatic` works with zero setup (it edits the working tree). The
**deployed** editor uses GitHub mode and needs a one-time GitHub App:

1. Visit `https://davessweater.com/keystatic` — it shows a setup wizard.
2. Follow it to create a GitHub App (`davessweater-keystatic`) and install it
   on the `davidhluther/davessweater` repo.
3. The wizard ends by giving you four values. Add them in Vercel → Project →
   Settings → Environment Variables (Production + Preview):
   - `KEYSTATIC_GITHUB_CLIENT_ID`
   - `KEYSTATIC_GITHUB_CLIENT_SECRET`
   - `KEYSTATIC_SECRET`
   - `NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG`
4. Redeploy.

Until then, the deployed `/keystatic` shows the setup screen and
`/api/keystatic` returns a 503 — the public site is unaffected either way
(the route handler degrades gracefully, so the build never breaks). Auth is
simply GitHub repo access: only accounts with write access to the repo can
edit. To add an editor, add them as a repo collaborator.

## Copy rules still apply

CMS-authored posts get the same styleguide treatment as everything else. Run
the validator before publishing:
`python3 ~/Projects/corpay-seo/.claude/skills/seo-validate/scripts/validate_article.py <file>`
(ignore its Corpay-specific blog-structure errors; the vocabulary, puffery,
colon, and pattern checks apply).

## The pieces (for replicating on another site)

- `keystatic.config.ts` — collection schema + storage mode
- `src/app/keystatic/` + `src/app/api/keystatic/` — editor UI + its API route
- `src/lib/data.ts` (`getNativePosts`) — the reader (file → typed post)
- `src/components/ChromeGate.tsx` — hides the site header/footer on `/keystatic`
- `next.config.ts` — `outputFileTracingIncludes` ships the content files with
  every function; `.mdoc` added to the `/blog` redirect generator

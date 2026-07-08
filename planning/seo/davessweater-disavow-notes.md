# davessweater.com — Disavow Notes & Rationale

**Generated:** 2026-07-07
**Source:** Ahrefs Site Explorer (referring-domains + anchors, `mode=subdomains`, `protocol=both`)
**Companion file:** `davessweater-disavow.txt` (the actual Google-format upload)
**Status:** DRAFT — owner should skim the KEEP section below (it's empty, by design) and then submit.

---

## Summary

| Metric | Value |
|---|---|
| Referring domains reviewed | **250** (Ahrefs: ~240 live / 255 all-time RDs — full retrievable set) |
| Total backlinks (Ahrefs) | 336 live / 397 all-time |
| **Disavowed** | **250** (100%) |
| **Kept (legit)** | **0** |
| **Unsure** | **0** |
| Dofollow links in entire profile | **0** |
| Referring domains with organic search traffic | **0** |
| Domains Ahrefs auto-flagged `is_spam=true` | 248 / 250 |

The backlink profile is **entirely** the spam/link-selling network described in the task
brief. There is nothing legitimate to preserve — no weather, local, news, tech, GitHub,
Vercel, or otherwise-topical domain appears anywhere in the profile. Every referring
domain is an algorithmically-named SEO/PBN/"buy-backlinks" shop with zero organic
footprint. Disavowing at the `domain:` level is safe and correct here.

---

## Spam patterns keyed on (why every domain qualifies)

1. **Zero dofollow, zero traffic, across the board.** All 250 RDs pass 0 dofollow links
   and have `traffic_domain = 0`. A real inbound link profile never looks like this.
2. **Ahrefs `is_spam=true`** on 248/250. The 2 it didn't auto-flag
   (`seopxl-ranking-boost-engine.shop`, `leonlinks.org`) are self-evidently the same
   network by name.
3. **Algorithmically-generated SEO-token domain names** — every domain is built from
   SEO sales vocabulary: `seoexpress-*`, `rank*`, `link*`, `outrank-hq-*`,
   `link-baron-*`, `seopxl-*`, `rank-forge-*`, `itxoft-*`, `fiverr-*seo*`,
   `*backlinks*`, `*guest-post*`, `*dofollow*`, `*high-da*`, `*pbn*`.
4. **Junk TLD concentration:** 109 `.shop`, 108 `.store`, 16 `.site`, 8 `.agency`,
   plus `.website/.pro/.online/.space/.click`. Only ONE `.com` in the whole set
   (`seodaro.com`, itself an SEO-service spam site).
5. **Keyword-stuffed / fake-testimonial anchor text.** The anchors are not editorial
   links — they are advertising copy for the link sellers themselves. Representative
   worst offenders (verbatim from Ahrefs anchors report):
   - *"When starting out with davessweater.com, achieving decent rankings seemed
     impossible until I stumbled upon SEOExpress.org's niche edits strategy—pure gold
     …"* — **149 refdomains, 178 links** (the single dominant anchor).
   - *"Strengthen davessweater.com through premium guest posts, high-quality backlinks,
     on-page SEO, local SEO, web development, SaaS tools and automation tools…"* —
     34 refdomains, 68 links.
   - *"Premium SEO Backlinks … in Gambling, Casino, Crypto, and Competitive Markets"*
   - *"Extreme PBN links for davessweater.com working in gambling adult crypto and all
     restricted niches"*
   - Dozens of fake first-person testimonials naming `ITXoft.com`, `Fiverr`,
     `rankio.agency`, `linkspro.agency`, `seogrow.pro`, etc.

---

## Spam clusters (shared-root patterns)

Google's disavow format does **not** support wildcards — each `domain:` line must be a
single registered domain — so the `.txt` lists all 250 individually. They are grouped
under comment headers by network for readability:

| Cluster | Domains | Notes |
|---|---|---|
| **SEOExpress network** (`*seoexpress*`) | 91 | Largest cluster; also the `SEOExpress.org` hub named in anchors. |
| **Assorted rank/link/backlink shops** (`.shop`/`.store`/`.agency`) | 116 | `rank*`, `link*`, `seo*`, `thebacklinks`, `theguestpost*`, etc. |
| **ITXoft SEO-service spam** (`itxoft-*.site`) | 10 | Fake-testimonial farm pushing ITXoft.com. |
| **Link-Baron network** (`link-baron-*`) | 10 | PBN / press-release / wiki-link cluster. |
| **Outrank-HQ network** (`outrank-hq-*` / `*outrank-hq*`) | 8 | |
| **SEO-PXL lab network** (`seopxl-*`) | 6 | |
| **Fiverr-branded SEO spam** (`fiverr-*.site`) | 5 | |
| **Rank-Forge network** (`rank-forge-*`) | 4 | |

(A single network operator almost certainly owns most/all of these; the naming families
are the tells. No wildcard is possible, but the clustering makes future re-audits easy —
if new `*seoexpress*` / `*outrank-hq*` / `link-baron-*` domains appear, they are the same
actor and can be added on sight.)

---

## KEEP list (legit links NOT disavowed)

**None.** There are zero legitimate referring domains in the current profile. When
davessweater.com earns real editorial links (weather sites, local Boone/WNC press,
GitHub, Vercel showcase, etc.), those will appear as **dofollow** links from domains
**with** organic traffic — none of which describes anything in the present set. Re-run
this audit before each disavow re-submission so a future genuine link is never caught.

## UNSURE list

**None.** The two domains Ahrefs left unflagged were reviewed by hand and are clearly the
same spam network:
- `seopxl-ranking-boost-engine.shop` — part of the SEO-PXL lab cluster.
- `leonlinks.org` — generic link-farm ("links") on a throwaway `.org`, DR 22, 0 traffic.

Both are disavowed.

---

## How to submit in Google Search Console

1. Go to **https://search.google.com/search-console/disavow-links**
2. Select the **davessweater.com** property (use the same property verified in GSC —
   Domain property `davessweater.com` preferred so it covers www + non-www + http/https).
3. Click **Upload disavow list** and choose `davessweater-disavow.txt`.
4. Confirm. Google replaces any prior list with this file (uploads are full replacements,
   not additive), so keep this file as the canonical source and re-upload the whole thing
   after any future edits.
5. Processing is not instant — Google recrawls and applies over weeks. Disavow tells
   Google to ignore these links; it does not remove them from Ahrefs/other tools.

### Maintenance
- This spam net is actively blasting new domains at the whole `*weather.com` family, so
  **expect new toxic RDs to keep appearing.** Re-run the Ahrefs referring-domains pull
  periodically (monthly is fine), append any new spam domains to `davessweater-disavow.txt`,
  and re-upload the full file.
- Because the profile is 100% spam today, a broad rule of thumb holds: any new RD with
  **0 dofollow + 0 organic traffic + an SEO/rank/link/backlink-token name on a
  .shop/.store/.agency TLD** is the same network and can be added without hesitation.

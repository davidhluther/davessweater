# Content brief: This weather site costs $12 a year to run

- **Slug:** `/resources/articles/12-dollars-a-year-weather-site`
- **Category:** Articles
- **Meta title:** This weather site runs on $12 a year
- **Meta description:** One person, free weather APIs, and a nightly GitHub Actions job beat a paid regional forecaster by about 21 points a day. Total cost: a $12 domain. Here's the stack.
- **Search intent:** Informational and inspirational for a technical audience (developers, self-hosters, indie hackers). Not a local-volume play. Readers arrive curious how a near-zero-cost stack can out-forecast a paid service; the win condition is shares and backlinks from HN, r/selfhosted, r/homelab, and dev newsletters, not local search traffic. Readers want the real bill of materials, honest free-vs-paid accounting, and links to the public data so they can verify and replicate.

## Answer block (article lead, ≤40 words)
Dave's Sweater runs on one hard cost: a $12/year domain. Free weather APIs, a nightly GitHub Actions job, and Vercel's free tier do the rest — and the free forecasts beat the paid regional service by about 21 points a day over 118 days.

## Target keywords
| Keyword | Vol/mo | KD | Note |
|---|---|---|---|
| build your own weather site | 300 | 25 | primary; build intent, dev audience |
| free weather api | 6000 | 40 | secondary; strong dev-audience volume, anchors the stack section |
| github actions automation | 2000 | 55 | secondary; dev audience, the cron-job pipeline section |
| replace paid weather service | 100 | 15 | angle keyword; low volume, high intent match |
| how much does it cost to run a website | 800 | 30 | long-tail; matches the $12 hook and title |
| open-meteo api | 700 | 20 | long-tail; names the core free source |

## SERP notes
Not a local SERP. Competes for dev-curiosity attention against build-log and "I built X for $Y" posts. Ranking is secondary to link/authority acquisition: the concrete $12 number, the "free beats paid" receipt, and public CSV/JSON data are the shareable hooks. Keep it a story with a bill of materials, not a tutorial — a step-by-step how-to invites competing tutorials and buries the narrative. Lead with the number in the title and answer block for snippet/social-preview capture. The comparison table (cost line | amount) is the screenshot-bait that travels on social. Be scrupulously honest about what's free-tier vs. genuinely free and about the non-commercial API terms — a technical audience will fact-check the bill, and the credibility of the whole bit rests on it.

## Voice-of-customer phrases
- build your own weather site
- free weather api no key needed
- how much does it cost to run
- one daily cron job
- no sign-up, no credit card
- replace a paid weather service
- open-meteo is free for non-commercial use
- runs on the free tier
- one person, no employees
- the data is public

## Real user questions (FAQ seeds)
- How much does it cost to run a website like this?
- Is Open-Meteo really free to use?
- Can free weather APIs beat a paid weather service?
- What does the GitHub Actions job actually do each day?
- Do you pay for Vercel hosting?
- Is the accuracy data public and can I check it myself?
- Why does the paid forecaster score lower than the free ones?

## Verified statistics
- Open-Meteo is free for non-commercial use up to 10,000 daily API calls with no API key, sign-up, or credit card required. — *Open-Meteo.com (official site / features page), 2026*
- Vercel's Hobby plan is free for personal projects and includes built-in CI/CD, automatic HTTPS, preview deployments, and 100 GB of fast data transfer; projects are paused if they exceed the free tier. — *Vercel Pricing (official docs), 2026*
- Open-Meteo integrates numerical weather prediction models from over 15 national weather services, including ECMWF, DWD, and NOAA. — *Open-Meteo.com (About / features), 2026*

## Internal link targets
- [the daily scoreboard where every forecaster gets graded](/right-wrong-ray)
- [how the 100-point scoring works](/methodology)
- [whether the paid local forecast is actually accurate](is-rays-weather-accurate)
- [today's Dave's Sweater Index and the headline accuracy stat](/)

## Article outline (sentence-case, answer-first)
- **H2:** What does it actually cost to run this weather site?
  - H3: The bill of materials, line by line
  - H3: What's genuinely free vs. free-tier
- **H2:** How can free weather APIs beat a paid service?
  - H3: The 118-day scoreboard
  - H3: Why the gap holds: about 21 points a day
- **H2:** What's the whole stack — and why is it this cheap?
  - H3: Roughly eight free forecast APIs, one source of truth
  - H3: Python stdlib pipeline plus Next.js on Vercel
- **H2:** What does the daily GitHub Actions job actually do?
  - H3: Capture at midday, score against tomorrow's actuals
  - H3: No servers, no employees, no database bill
- **H2:** Is the data public, and could you replicate this yourself?
  - H3: Open CSV and JSON, and the honest caveats
- **H2:** See the receipts on the live tracker
- **H2:** Frequently asked questions

---
title: "This weather site costs $12 a year to run"
slug: 12-dollars-a-year-weather-site
category: articles
date: 2026-07-02
summary: "How Dave's Sweater runs on a $12/year domain and free APIs, and still shows free forecasts beating the paid one."
metaTitle: "This weather site runs on $12 a year"
metaDescription: "One person, free weather APIs, and a nightly GitHub Actions job beat a paid regional forecaster by about 21 points a day. Total cost: a $12 domain. Here's the stack."
---
# This weather site costs $12 a year to run

Dave's Sweater runs on one cost: a $12/year domain. Free APIs, a daily GitHub Actions job, and Vercel's free tier handle the rest, and free forecasts beat the paid service by about 21 points a day over 118 days.

## The takeaways

- The only bill that clears is a $12/year domain. Everything else runs on free tiers or genuinely free, no-sign-up APIs
- Over 118 days, the best free source (Open-Meteo, 92.0 avg) beat the paid regional forecaster (Ray's Weather, 71.0 avg) by about 21 points a day
- The stack is roughly eight free forecast APIs, one daily GitHub Actions job, a Python-stdlib pipeline, and Next.js on Vercel: no servers, no database, no employees
- Every score is public as CSV and JSON, so you can check the bill and the receipts yourself
- The honest caveats: this measures short-range accuracy, and "actuals" come from the Open-Meteo archive, both disclosed on the methodology page

## What does it actually cost to run this weather site?

One line: $12 a year for the domain. That's the whole hard cost. The weather data comes from free APIs, the daily automation runs inside GitHub's free Actions minutes, and the site itself is hosted on Vercel's free Hobby tier. No servers to rent, no database to pay for, no salaries. If you want to know how much it costs to run a website like this, the answer fits on one receipt.

### What's on the bill?

Here's the entire spend, itemized, line by line. No footnotes hiding a surprise.

| Cost line | Amount |
| --- | --- |
| Domain (davessweater.com, per year) | $12 |
| Weather forecast APIs (~8 sources) | $0 |
| GitHub Actions (daily job) | $0 |
| Hosting (Vercel Hobby tier) | $0 |
| Database | $0 (there isn't one) |
| Employees | $0 (there aren't any) |
| **Total per year** | **$12** |

### What's the difference between free and a free tier?

Two of those zeros are different kinds of zero, and a technical reader will want the distinction. Open-Meteo is genuinely free for non-commercial use: no API key, no sign-up, no credit card. Vercel's Hobby plan is a free tier, free for personal, non-commercial projects, with the usual caveat that a project can be paused if it blows past the included limits. This site sits nowhere near either ceiling, so both stay at $0. But "free forever, no strings" and "free until you get big" are not the same promise, and it's worth saying which is which.

## How can free weather APIs beat a paid service?

They already do, measured daily. Over the 118-day tracking window, Open-Meteo (free) averages 92.0 on a 100-point scale and Ray's Weather (paid) averages 71.0, a gap of about 21 points a day. Apple Weather, also free, sits at 88.3. The free forecasts most people ignore have been quietly outscoring the one the region pays attention to, and the scoreboard runs every day.

### The 118-day scoreboard

Every forecaster gets the same test: capture the forecast, then grade it against what the sky actually did. Here's the window.

| Source | Tier | Avg score | Days graded Wrong |
| --- | --- | --- | --- |
| Open-Meteo | Free | 92.0 | 0 |
| Apple Weather | Free | 88.3 | 1 |
| Ray's Weather | Paid | 71.0 | 23 |

Seven other free sources have short samples so far (nine scored days each, so treat them as provisional), yet every one currently beats Ray's 71.0: Met.no 95.6, Google 94.0, Visual Crossing 93.7, Tomorrow.io 91.5, OpenWeatherMap 87.2, WeatherAPI 86.3, and NWS 84.1. Small samples, same direction.

### Why the gap holds: about 21 points a day

The gap isn't a one-week fluke. [June 2026 alone ran 29 scored days](/resources/articles/rays-weather-report-card-june-2026): Open-Meteo 92.3, Apple 88.0, Ray's 73.3, a 19.0-point June gap. Ray's best June day landed at 90.7 on June 24; his worst hit 26.1 on June 2. Part of the spread is structural: Ray's Weather never publishes a numeric precip amount, so under the implied-zero rule he forfeits the precip-amount field on wet-forecast days and earns it on dry ones. If you want the fuller version, [the full 118-day review of Ray's Weather](/resources/articles/is-rays-weather-accurate) has the deeper breakdown.

## What's the whole stack, and why is it this cheap?

The stack is deliberately boring: roughly eight free forecast APIs feeding one Python-stdlib pipeline, which writes JSON that a Next.js site reads at build time, deployed on Vercel. Cheap follows from having no moving parts that charge rent, no application server running around the clock, no managed database, no queue. The forecasts are the only external dependency, and they're free.

### Roughly eight free forecast APIs, one source of truth

Open-Meteo is the anchor. It's free for non-commercial use and blends numerical weather prediction models from several national weather services. Around it sit the other free sources (Apple Weather, Met.no, Google, Visual Crossing, Tomorrow.io, OpenWeatherMap, WeatherAPI, NWS), each captured and scored the same way. One source of truth ("actuals") settles who was right, and it's the same yardstick for everyone.

### Python stdlib pipeline plus Next.js on Vercel

The capture-and-score pipeline is Python standard library only: no pip install, no dependency tree to patch. It writes plain JSON files into the repo. Next.js renders the site, and Vercel rebuilds it on every commit to the data. Because the site is built from committed JSON rather than querying a live database, there's nothing to keep warm and nothing to bill hourly. The repo is the database.

## What does the daily GitHub Actions job actually do?

One daily cron job does the whole loop: capture today's forecast from each source around midday, then fetch yesterday's verified actuals and score every forecast against them. It commits the results back to the repo, which triggers a fresh site build. No human touches it. One daily cron job, and the scoreboard updates itself.

### Capture at midday, score against tomorrow's actuals

The timing matters for honesty. Each forecast is captured around midday and graded against the next day's verified actuals, so what the scoreboard measures is short-range accuracy, roughly a one-day lead time. That's a real, repeatable test, and it's the one we run. It is not a claim about 7- or 10-day forecasts; forecast skill decays with lead time, and the shape of that decay is published meteorology (see NOAA's [Forecast Verification](https://www.weather.gov/about/verification) materials), not something this site has measured. When you see our numbers, read them as a short-range local data point. For the longer-horizon question, see [how accurate a 10-day forecast really is](/resources/articles/how-accurate-is-a-10-day-forecast).

### No servers, no employees, no database bill

Because the work happens inside a scheduled Actions run and the output is committed files, the always-on cost is zero. Nothing listens for traffic on our side between builds. There's no ops rotation, no one on call, no employees. One person maintains it. The recurring invoice is still just the domain.

## Is the data public, and could you replicate this yourself?

Yes on both counts. Every score is published as open CSV and JSON, so you can pull the numbers and re-run the math yourself instead of taking our word for it. The stack is ordinary enough that a motivated developer could stand up their own version for the price of a domain:

- Free weather APIs for the forecasts
- A daily GitHub Actions job to capture and score them
- A static-ish Next.js build on Vercel to publish the results

The parts that take judgment are the scoring rules and the honesty about their limits.

### Open CSV and JSON, and the honest caveats

The data is public, and so are the caveats. Two matter most. First, this is short-range accuracy (a capture-day forecast graded against the next day's actuals), so no horizon or lead-time decay claim rides on our numbers alone. Second, our "actuals" come from the Open-Meteo historical archive, which means Open-Meteo is, in part, being graded against its own house's record; that circularity is disclosed on [how the 100-point scoring works](/methodology), not buried. The point of publishing the raw files is that you don't have to trust the summary. You can audit it.

## See the receipts on the live tracker

Bookmark [today's Dave's Sweater Index and the headline accuracy stat](/) if you want the short version, or open [the daily scoreboard where every forecaster gets graded](/right-wrong-ray) for the full ledger. The whole bit rests on the numbers being real and checkable, so the receipts stay in public view.

## Frequently asked questions

### How much does it cost to run a website like this?

For this one, $12 a year: a single domain registration. Free weather APIs supply the data, a daily GitHub Actions job does the work, and Vercel's free Hobby tier hosts the site. There's no database, no server rental, and no staff, so nothing else recurs.

### Is Open-Meteo really free to use?

For non-commercial use, yes: no API key, no sign-up, and no credit card. It's the free anchor of the stack. Commercial use has separate paid terms, so read Open-Meteo's own license before you build a business on it. This site stays well inside the non-commercial terms.

### Can free weather APIs beat a paid weather service?

By our tracker, yes. Over 118 days, Open-Meteo (free) averaged 92.0 and Ray's Weather (paid) averaged 71.0, about 21 points a day. Apple Weather, also free, averaged 88.3. Seven other free sources lead Ray's too, though on smaller, provisional samples.

### What does the GitHub Actions job actually do each day?

One daily cron run captures the day's forecast from each source around midday, fetches the prior day's verified actuals, scores every forecast against them, and commits the results. That commit triggers a fresh Vercel build. No servers stay running between jobs, and no one runs it by hand.

### Do you pay for Vercel hosting?

No. The site runs on Vercel's free Hobby tier, which suits a personal, non-commercial project like this one. The free tier does include limits, and a project that exceeds them can be paused. But this site's traffic and build volume sit well under them, so the hosting cost stays at $0.

### Is the accuracy data public and can I check it myself?

Yes. Every score is published as open CSV and JSON, so you can download the raw records and re-run the math. The scoring rules live on the methodology page. The reason it's all public is simple: the credibility of the comparison depends on you being able to verify it, not just read a summary.

### Why does the paid forecaster score lower than the free ones?

Two reasons, both measured. Ray's Weather runs a lower average across the scored fields in the window, and he never publishes a numeric precip amount, so under the implied-zero rule he forfeits the precip-amount field on wet-forecast days. It's tracked scoring against verified actuals, not opinion.

---

Want the live version instead of a snapshot? Open [the daily scoreboard where every forecaster gets graded](/right-wrong-ray) to watch every source get scored each day, and read [how the 100-point scoring works](/methodology) to see exactly how the math lands. The receipts update every day. Check them yourself.

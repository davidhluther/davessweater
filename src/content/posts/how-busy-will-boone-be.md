---
title: "Introducing the Busy-ness Index: How Busy Will Boone Be?"
slug: how-busy-will-boone-be
category: news
date: 2026-09-03
summary: "A new free forecast that scores how crowded the High Country will be two weeks out, built from hotel pricing, rental booking pace, the event calendar, and our own leaf model. The whole formula is on the page."
metaTitle: "Introducing the Busy-ness Index: How Busy Will Boone Be?"
metaDescription: "Dave's Sweater now forecasts crowding, not just weather. The High Country Busy-ness Index scores the next 14 days from hotel pricing, short-term-rental booking pace, events, and predicted peak fall color."
---
# Introducing the Busy-ness Index: How Busy Will Boone Be?

There is a question everybody around here asks in October and nobody can answer with a number.
Not what the weather will do. Whether it will be worth going anywhere once you get there.

Starting today we take a swing at it. The [Busy-ness Index](/tourism) scores the next two weeks
for Boone and the surrounding High Country on a 0 to 100 scale, updated every morning, free, with
the entire formula printed on the page.

## Where a crowd number comes from when nobody counts crowds

Nobody stands at the top of 421 with a clicker. But a lot of people who have money riding on the
answer have already committed to a guess, and most of those guesses are public.

Hotels price a Saturday months before it arrives. When most of the hotels in town move the same
night into their expensive band, they have collectively predicted a crowd, and they are the ones
who pay for being wrong. Short-term rentals, which are the bigger lodging segment in Boone by a
wide margin, fill on a schedule you can watch. The event calendar is published. And we already
forecast the weather for eighteen places and, since last week, [when the leaves peak in each
one](/leaf).

Five signals, then, added into one number:

- Hotel pricing, up to 40 points
- Short-term-rental booking pace, up to 25
- The event calendar, up to 30 net, with the events that push people *out* of town subtracting
- Our own predicted peak fall color, up to 15
- A flat 5 for a Friday or a Saturday

Under 35 is calm. 35 to 54 is typical. 55 to 74 is busy. 75 and up is slammed.

## An example, which is also a confession

Saturday, September 5 scored 82. Slammed. Three reasons, and the engine names them itself: App
State's home opener, 96% of the hotels we track pricing that night high, and rentals 74% booked.
The median cheapest hotel room in Boone that night is $263, against about $170 on an ordinary
late-summer Saturday.

That is the index working. Here is the part that is not finished.

We have been running this engine for six weeks. Six weeks is enough to say that a night beats 92%
of the comparable late-summer nights we have measured. It is nowhere near enough to tell you what
a normal mid-October Saturday looks like, because we have not lived through one yet with the
engine running. So the bands are absolute for now. A 60 means 60 on our scale, not "busier than
usual." When there is a real baseline the page will say so, and until then the page says this
instead.

A few other things it cannot do, all of them stated on the page as well. Hotels are the minority
of lodging here. The rate we read is the cheapest room listed, which is a bookability floor and
not what anybody actually takes in. And rental booking pace rises as any date approaches, which
biases the raw curve. We do not correct for that, because inventing a correction without the data
to fit one would be worse than saying it out loud. Instead, every comparison the page makes holds
lead time constant, so a night read three days out is only ever ranked against other nights read
three days out.

## The trick we built it for

Our leaf model knows nothing about hotel pricing. The hotels know nothing about our leaf model.
When both land on the same night, that is two independent signals agreeing, and it is a much
stronger claim than either makes alone. When they disagree, that is a story too, and we would
rather print it than hide it.

That has not happened yet, because nothing in the current two-week window is inside a predicted
peak color window. Ask again in five weeks.

## Take it

The index is [available as JSON](/api/v1/tourism) and [as a feed](/feed/high-country/busyness.xml),
licensed CC BY 4.0, same as everything else here. If you run a restaurant or a shop or a rental in
this town, the forecast is yours, and you did not have to buy it.

Every forecast is a claim about tomorrow. This one is ours, it is unproven, and the plan is the
same as it is for the weather. Publish the method, then grade it against what actually happened
and post the result whether or not it flatters us. Occupancy tax receipts and traffic counts are
both public. We will get there.

// /reports/grandfather-mountain-highland-games-planner-2026 — the planner. The printed
// GMHG schedule tells you WHAT is happening and WHEN; it will not tell you when
// to leave, which lot runs that day, how much cash the shuttle needs, or whether
// two things you want sit on opposite ends of a field you cannot cut across.
// This does. Build it straight where people rely on it (schedule, arrive-by,
// lot, cash, walk warnings); the site's dry humor rides in the framing and the
// packing list. Franchise instance #2 after /fireworks. Data + walk math are
// 2026-verified from gmhg.org — re-verify logistics before any 2027 reuse.
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import SectionBand from "@/components/SectionBand";
import Planner from "@/components/gmhg/Planner";
import FieldMap from "@/components/gmhg/FieldMap";
import { getGmhgData } from "@/lib/data";
import { breadcrumbs } from "@/lib/schema";

const SLUG = "/reports/grandfather-mountain-highland-games-planner-2026";
const PAGE_URL = `https://davessweater.com${SLUG}`;

export const metadata = {
  title: "Grandfather Mountain Highland Games 2026: Schedule, Parking & Day Planner",
  description:
    "Filter the full 2026 schedule, see which parking lot runs each day and the shuttle fare you need, and get a printable itinerary, field map, and packing list. MacRae Meadows, July 9–12.",
  alternates: { canonical: SLUG },
  openGraph: {
    title: "Grandfather Mountain Highland Games 2026: Schedule, Parking & Day Planner",
    description:
      "Filter events, then get a printable per-day itinerary, a field map with your stops pinned, arrive-by and between-event walk times, the right lot and shuttle fare, a live forecast with packing list, and a calendar export.",
    url: PAGE_URL,
    type: "website",
  },
  twitter: { card: "summary_large_image" as const },
};

interface Faq { id: string; q: string; a: string }

const FAQS: Faq[] = [
  {
    id: "faq-parking",
    q: "Where do I park for the Highland Games?",
    a: "There is no general daytime parking at MacRae Meadows. You park off-site and shuttle in, and the lot that runs changes by day. Thursday is Avery County High School only. Friday and Saturday run four lots: Sugar Mountain, Avery County HS, Millers Gap, and Linville. Sunday narrows to Sugar Mountain and Linville only. The planner picks the nearest running lot to wherever you are coming from and lists the rest.",
  },
  {
    id: "faq-cash",
    q: "How much is the shuttle, and can I pay by card?",
    a: "The shuttle is $10 per seat, round trip, bought from the attendants at the lot — and they take cards now, so cash is no longer required (it still works if you prefer it). The planner totals the shuttle cost across your days and the calendar export drops a reminder the evening before.",
  },
  {
    id: "faq-concert",
    q: "Can I just drive up for the Friday and Saturday night concerts?",
    a: "Yes, and this is the single most confused point of the weekend. On Friday and Saturday nights the general public may drive up and park directly on MacRae Meadows after 5 PM. Gates 2 and 3 open at 6 PM; the concert runs 6:30–10 PM. No shuttle, no off-site lot. If you select only concert events for a day, the planner switches to this drive-up mode automatically.",
  },
  {
    id: "faq-accessible",
    q: "Is there accessible transport?",
    a: "Yes. Wheelchair-accessible transport runs from Newland Elementary School (750 Linville St, Newland) on Friday, Saturday, and Sunday, and from Avery County High School on Thursday. One companion may ride along. On the field, GMHG provides golf-cart mobility assistance; find GMHG personnel, and no outside or rented carts. Toggle \"Accessible transport\" and the planner routes you to the right hub.",
  },
  {
    id: "faq-pets",
    q: "Can I bring my dog?",
    a: "No. Pets are not allowed on the Meadow. It is a lease restriction with the Grandfather Mountain Stewardship Foundation, and only certified ADA service animals are allowed. Leave the good boy at home.",
  },
  {
    id: "faq-tickets",
    q: "Do I need a ticket, and how much does it cost?",
    a: "Yes. Admission is sold per day, as a 4-day pass, and with camping as an add-on. Buy online at gmhg.org, at the GMHG office in Linville (cash, check, money order, or card), or at the gate the day of. Prices vary by day and change year to year, so check gmhg.org's current Prices page rather than trust an old number here.",
  },
  {
    id: "faq-camping",
    q: "Can I camp at the Games?",
    a: "Yes, but it is festival camping, not a traditional campground: No assigned sites, no full hookups, gravel roads, and rough terrain in spots, in a wooded area next to the field. Roughly three-quarters of the sites have electric and water access. Campers check in at Camping Registration on arrival and need their own camper 4-day ticket. Parking for camping sits apart from the tent area; attendants there will point you the right way.",
  },
  {
    id: "faq-conflict",
    q: "Can I see the caber toss and still make a show at the Gaelic tent?",
    a: "This is exactly the trap the planner exists to catch. The Professional Caber Toss (center field, 1:15 Saturday) and a 1:30 Gaelic Tent event sit on opposite ends of the meadow, and you route around the track oval, not across the live infield, so allow the better part of 20 minutes at that post-caber crowd peak. A 15-minute gap does not work, and the tool flags it red the moment you pick both. It does the same for every pair you select.",
  },
  {
    id: "faq-weather",
    q: "What should I pack for the weather?",
    a: "MacRae Meadows sits at about 4,300 feet, so it runs cooler and windier than the valley and the weather changes fast. Layers always; a raincoat or poncho (umbrellas are hopeless in the wind); sunscreen and a hat at that elevation. The planner pulls the live forecast for the field itself and turns it into a per-day packing list, and it falls back to the always-true version if the forecast is unreachable. Forecasts change, so check again the morning you go.",
  },
  {
    id: "faq-rain",
    q: "Does the event happen rain or shine?",
    a: "Yes. The Games run rain or shine, and events pause only for lightning, not for rain itself. Layers and a raincoat are the standing recommendation no matter what the forecast says, since mountain weather at 4,300 feet turns fast. Field and camping conditions can get muddy after a wet stretch, so plan your footwear accordingly.",
  },
  {
    id: "faq-marquee",
    q: "What are the can't-miss events?",
    a: "The Torch Light Ceremony (Thursday night), the Opening Ceremony (11 AM Friday and Saturday), Saturday's Massed Bands and Professional Caber Toss, the Friday and Saturday night concerts, Sunday's Parade of Tartans and Kilted Running, and the Closing Ceremony. Hit \"Just the highlights\" and the planner pre-loads them so you can trim from a sane starting point.",
  },
];

function buildJsonLd() {
  return [
    breadcrumbs([
      { name: "Home", path: "/" },
      { name: "Resources", path: "/resources" },
      { name: "Reports", path: "/resources/reports" },
      { name: "Grandfather Mountain Highland Games 2026 planner", path: SLUG },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Grandfather Mountain Highland Games 2026: Schedule, Parking & Day Planner",
      url: PAGE_URL,
      description: "A free interactive planner for the 70th Grandfather Mountain Highland Games. Filter events, then get a downloadable per-day itinerary, a field map with your stops pinned, arrive-by and between-event walk times, the right lot and shuttle fare, a live forecast with packing list, and a calendar export.",
      isPartOf: { "@type": "WebSite", name: "Dave's Sweater", url: "https://davessweater.com" },
      about: { "@type": "Event", name: "70th Grandfather Mountain Highland Games" },
    },
    {
      "@context": "https://schema.org",
      "@type": "Event",
      name: "70th Grandfather Mountain Highland Games",
      startDate: "2026-07-09",
      endDate: "2026-07-12",
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: {
        "@type": "Place",
        name: "MacRae Meadows, Grandfather Mountain",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Linville", addressRegion: "NC", addressCountry: "US",
        },
        geo: { "@type": "GeoCoordinates", latitude: 36.086254, longitude: -81.849066 },
      },
      description: "The 70th Grandfather Mountain Highland Games. Scottish heavy athletics, Highland dance, piping and drumming, Celtic music, and clan gatherings over four days at MacRae Meadows.",
      url: PAGE_URL,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question", name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];
}

export default async function Page() {
  const data = await getGmhgData();
  if (!data) {
    return (
      <SectionBand className="max-w-3xl">
        <p className="text-muted">The Highland Games schedule is temporarily unavailable.</p>
      </SectionBand>
    );
  }
  const { meta: m, events } = data;
  const lotsByDay = m.logistics.lots_by_day;
  const shuttleHours = m.logistics.shuttle_hours;

  return (
    <>
      <JsonLd data={buildJsonLd()} />

      {/* Branded header band over the torch-lighting photo */}
      <section className="relative isolate w-full overflow-hidden bg-teal-900 text-white print:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/gmhg-torch-lighting-photo-by-skip-sickler-courtesy-grandfather-mountain-stewardship-foundation.webp"
          alt="" aria-hidden="true"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center opacity-45"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-teal-900 via-teal-900/85 to-teal-900/45" />
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-12">
          <p className="text-xs font-bold uppercase tracking-wider text-orange-300">
            The High Country events desk | July 9–12, 2026
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Grandfather Mountain Highland Games 2026: Schedule, Parking & Day Planner
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/80">
            The official schedule is a wall of times. This turns it into a plan. Filter the events by
            type, pick the ones you want, and get it back the way you actually need it: A downloadable,
            printable per-day itinerary, a field map with your stops pinned, arrive-by and between-event
            walk times (so you never book two things across a field you cannot cut across), the right lot
            and the shuttle fare, and a live mountain forecast with a packing list. Free, no app, no
            sign-up.
          </p>
          <p className="mt-4 flex flex-wrap gap-3 text-xs text-white/70">
            <a href="#planner" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-[#9a3412]">Start planning ↓</a>
            <a href="#field-map" className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">Field map ↓</a>
            <a href="#logistics" className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">Parking & shuttle ↓</a>
            <a href="#faq" className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">FAQs ↓</a>
          </p>
          <p className="mt-5 text-[0.65rem] text-white/50">
            Torch Light Ceremony photo by Skip Sickler, courtesy of the Grandfather Mountain Stewardship Foundation.
          </p>
        </div>
      </section>

      {/* The planner (its own width; not the narrow prose column) */}
      <section id="planner" className="w-full scroll-mt-16 bg-background">
        <Planner events={events} meta={m} />
      </section>

      {/* Logistics answer-blocks — the earnest facts, rendered from the dataset */}
      <div className="print:hidden">
      <SectionBand tone="surface" id="logistics" className="max-w-4xl">
        <h2 className="font-display text-2xl font-bold">Parking, Shuttle & the 5 PM Cutover</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          There is no general daytime parking at MacRae Meadows. You park off-site and shuttle in, and
          the lots that run change by day. Below is exactly which lots run when.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 pr-3">Day</th>
                <th className="py-2 pr-3">Lots that run</th>
                <th className="py-2">Shuttle hours</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {Object.entries(lotsByDay).map(([day, lots]) => (
                <tr key={day} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">
                    {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })
                      .format(new Date(`${day}T12:00:00Z`))}
                  </td>
                  <td className="py-2 pr-3">{lots.join(" · ")}</td>
                  <td className="py-2 text-muted">{shuttleHours[day] ?? "n/a"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-4 max-w-2xl space-y-2 text-sm text-muted">
          <li><strong className="text-foreground">Cards or cash.</strong> The shuttle is $10 per seat, round trip, paid at the lot — the attendants take cards now, so you no longer have to hunt down an ATM in town first.</li>
          <li><strong className="text-foreground">Concert nights are different.</strong> Friday and Saturday after 5 PM, the public may drive up and park on MacRae Meadows itself; gates 2 and 3 open at 6 PM, concert 6:30–10 PM. No shuttle.</li>
          <li><strong className="text-foreground">Accessible transport</strong> runs from Newland Elementary (Fri–Sun) and Avery County HS (Thu); one companion may ride along. Golf-cart help on the field from GMHG personnel.</li>
          <li><strong className="text-foreground">No pets on the Meadow.</strong> Certified ADA service animals only. Games office: (828) 733-1333.</li>
        </ul>
      </SectionBand>

      <SectionBand tone="light" id="good-to-know" className="max-w-3xl">
        <h2 className="font-display text-2xl font-bold">Good to Know Before You Go</h2>
        <ul className="mt-3 max-w-2xl space-y-2 text-sm text-muted">
          <li><strong className="text-foreground">There is an EMS and First Aid tent</strong> on the field. Find the red cross near the center of the meadow.</li>
          <li><strong className="text-foreground">Cards work just about everywhere now.</strong> Vendors, ticket booths, and — as of this year — the shuttle all take card readers. Cash still works as a backup.</li>
          <li><strong className="text-foreground">There is little shelter from rain.</strong> Beyond the Patron tent, your options are the vendor tents and the trees, so pack a poncho and plan to ride out a passing shower.</li>
          <li><strong className="text-foreground">Coolers are welcome.</strong> Pack your own food and drinks.</li>
          <li><strong className="text-foreground">Bring chairs or a blanket.</strong> There is plenty of open, grassy hillside to set up and watch the field from, and a good vantage lets you take in more than one thing at once.</li>
          <li><strong className="text-foreground">Expect some mud after wet weather.</strong> It is a mountain meadow; wear boots or shoes you do not mind getting dirty, and check the rain forecast above.</li>
        </ul>
      </SectionBand>

      <SectionBand tone="light" id="field-map" className="max-w-4xl">
        <h2 className="font-display text-2xl font-bold">The MacRae Meadows Field Map</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Where everything sits: The oval track and East Meadow in the center, Highland Dancing and the
          Review Stand along the top, the Celtic Groves and Alex Beaton stage and bagpiping to the east,
          and the Gaelic, Children&apos;s, and Cultural Village tents to the south. Build a plan above and
          your picks drop onto this map as numbered pins, one map per day.
        </p>
        <div className="mt-4">
          <FieldMap />
        </div>
        <p className="mt-2 text-xs text-muted">
          Official field map, courtesy of the Grandfather Mountain Highland Games (gmhg.org). The layout is
          typical from year to year; confirm on site.
        </p>
      </SectionBand>

      <SectionBand tone="light" id="faq" className="max-w-3xl">
        <h2 className="font-display text-2xl font-bold">Questions People Actually Ask</h2>
        <div className="mt-3 space-y-5">
          {FAQS.map((f) => (
            <div key={f.id} id={f.id}>
              <h3 className="font-display text-base font-bold">{f.q}</h3>
              <p className="mt-1 text-sm text-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </SectionBand>

      <SectionBand tone="surface" className="max-w-3xl">
        <h2 className="font-display text-2xl font-bold">How the Planner Figures It</h2>
        <p className="mt-1 text-sm text-muted">
          Times come straight from the gmhg.org schedule (verified July 2026). Arrive-by works backward
          from your earliest pick: Drive time to the nearest running lot, the shuttle line, the ride up,
          and the walk to your first event, all named tunable estimates, surfaced as guidance rather than a
          promise. Walk warnings use realistic on-field times that route around the track oval and add a
          crowd tax at the ceremony, concert-ingress, and post-caber peaks; a straight line across the
          competition infield is a route you cannot actually walk, so we never draw one. The forecast is
          pulled live for MacRae Meadows’ own coordinates at about 4,300 feet, so treat the temperatures as
          directional, since the model smooths the terrain. And Grandfather, reliably, makes its own weather.
        </p>
        <p className="mt-4 text-xs text-muted">
          More from the events desk:{" "}
          <Link href="/reports/fireworks-fourth-july-2026" className="text-teal underline underline-offset-2">
            the Boone Fourth of July fireworks report
          </Link>
          {" | "}
          <Link href="/resources/reports" className="text-teal underline underline-offset-2">
            all reports
          </Link>
        </p>
      </SectionBand>
      </div>
    </>
  );
}

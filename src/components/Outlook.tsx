"use client";
export interface OutlookDay { label: string; hi: number; }

export default function Outlook({ days }: { days: OutlookDay[] }) {
  if (!days.length) return null;
  return (
    <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">
      {days.map((d) => (
        <div key={d.label} className="rounded-lg border border-border bg-background py-2.5 text-center">
          <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted">{d.label}</div>
          <div className="font-display text-base font-bold text-teal sm:text-lg">{Math.round(d.hi)}°</div>
        </div>
      ))}
    </div>
  );
}

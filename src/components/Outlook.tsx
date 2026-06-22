"use client";
export interface OutlookDay { label: string; hi: number; }

export default function Outlook({ days }: { days: OutlookDay[] }) {
  if (!days.length) return null;
  return (
    <div className="mt-3 grid grid-cols-5 gap-1.5">
      {days.map((d) => (
        <div key={d.label} className="rounded-lg bg-surface py-2 text-center">
          <div className="text-[0.65rem] text-muted">{d.label}</div>
          <div className="font-display text-sm font-bold text-teal">{Math.round(d.hi)}°</div>
        </div>
      ))}
    </div>
  );
}

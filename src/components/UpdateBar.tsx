export default function UpdateBar() {
  const updated = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date());
  return <div className="bg-card px-6 py-1.5 text-center text-xs text-muted">Updated: {updated}</div>;
}

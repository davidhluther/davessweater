import { cn } from "@/lib/utils";

export default function SectionBand({
  tone = "light", id, className, children,
}: { tone?: "light" | "dark" | "surface"; id?: string; className?: string; children: React.ReactNode }) {
  const bg = tone === "dark" ? "bg-teal-700 text-white" : tone === "surface" ? "bg-surface" : "bg-background";
  return (
    <section id={id} className={cn("w-full scroll-mt-16", bg)}>
      <div className={cn("mx-auto w-full max-w-3xl px-4 py-8 sm:py-10", className)}>{children}</div>
    </section>
  );
}

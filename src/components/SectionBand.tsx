import { cn } from "@/lib/utils";

export default function SectionBand({
  tone = "light", className, children,
}: { tone?: "light" | "dark" | "surface"; className?: string; children: React.ReactNode }) {
  const bg = tone === "dark" ? "bg-teal-700 text-white" : tone === "surface" ? "bg-surface" : "bg-background";
  return (
    <section className={cn("w-full", bg)}>
      <div className={cn("mx-auto w-full max-w-3xl px-4 py-8 sm:py-10", className)}>{children}</div>
    </section>
  );
}

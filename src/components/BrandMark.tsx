export default function BrandMark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span aria-hidden="true">
        Boone&apos;s #1 weather <s className="decoration-2">service</s>{" "}
        <span className="font-bold text-orange-300">tracker</span>
      </span>
      <span className="sr-only">Boone&apos;s number one weather tracker (not service)</span>
    </span>
  );
}

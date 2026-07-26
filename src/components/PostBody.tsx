import parse from "html-react-parser";
import type { BlogPost } from "@/lib/types";
import { sanitizePostHtml } from "@/lib/html";

// The shared render for a native post's on-page table of contents + prose
// body. Both the Articles detail route and the report-card franchise route use
// it, so the markdown path AND its presentation live in exactly one place.
export default function PostBody({ post }: { post: BlogPost }) {
  const html = sanitizePostHtml(post.content ?? post.summary ?? "");
  return (
    <>
      {post.toc && post.toc.length > 1 && (
        <nav aria-label="On this page" className="mt-6 rounded-xl border border-border bg-foreground/[0.02] p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">On this page</p>
          <ul className="space-y-1.5">
            {post.toc.map((h2) => (
              <li key={h2.id}>
                {h2.children.length > 0 ? (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
                      <span aria-hidden className="text-xs text-muted transition-transform group-open:rotate-90">&#9656;</span>
                      <a href={`#${h2.id}`} className="text-sm font-semibold text-foreground hover:text-orange-600 hover:underline underline-offset-2">{h2.text}</a>
                    </summary>
                    <ul className="ml-4 mt-1.5 space-y-1 border-l border-border pl-4">
                      {h2.children.map((h3) => (
                        <li key={h3.id}>
                          <a href={`#${h3.id}`} className="text-sm text-muted hover:text-orange-600 hover:underline underline-offset-2">{h3.text}</a>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <a href={`#${h2.id}`} className="ml-[1.375rem] block text-sm font-semibold text-foreground hover:text-orange-600 hover:underline underline-offset-2">{h2.text}</a>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div
        className={[
          "mt-6 max-w-none leading-relaxed text-foreground",
          "[&_h2]:font-display [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:scroll-mt-24 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-1.5",
          "[&_h3]:font-display [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground/90 [&_h3]:scroll-mt-24",
          "[&_h4]:mt-4 [&_h4]:mb-1 [&_h4]:font-bold",
          "[&_p]:my-3",
          "[&_a]:text-orange-600 [&_a]:hover:underline [&_a]:underline-offset-2",
          "[&_ul]:my-3 [&_ul]:space-y-1",
          "[&_ol]:my-3 [&_ol]:space-y-1",
          "[&_li]:ml-5 [&_li]:list-disc",
          "[&_ol_li]:list-decimal",
          "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted",
          "[&_table]:my-5 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-sm",
          "[&_th]:border [&_th]:border-border [&_th]:bg-foreground/5 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:align-top",
          "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
          "[&_hr]:my-8 [&_hr]:border-border",
        ].join(" ")}
      >
        {parse(html)}
      </div>
    </>
  );
}

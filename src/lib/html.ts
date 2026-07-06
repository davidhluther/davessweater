import sanitizeHtml from "sanitize-html";

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "figure", "figcaption", "h1", "h2"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "srcset", "alt", "title", "width", "height", "loading"],
      a: ["href", "name", "target", "rel"],
    },
    transformTags: {
      // External links open in a new tab; internal (relative) links stay in-app.
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        if (/^https?:\/\//i.test(href)) {
          return { tagName: "a", attribs: { ...attribs, rel: "noopener noreferrer", target: "_blank" } };
        }
        return { tagName: "a", attribs };
      },
    },
  });
}

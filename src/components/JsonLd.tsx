// Renders a JSON-LD structured-data block as plain text content — NOT via
// dangerouslySetInnerHTML. React HTML-escapes text children, so this is XSS-safe;
// it does mean the schema must avoid raw `<`, `>`, and `&` in string values
// (we use plain prose and absolute https URLs, so the escaped output equals the
// input and stays valid JSON-LD). Server-rendered, so crawlers see it without JS.
export default function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json">{JSON.stringify(data)}</script>;
}

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Comparison, Scores, BlogPost, LatestForecasts, GmhgData } from "@/lib/types";
import type { FireworksForecastFile } from "@/lib/fireworks";
import type { TerrainFile } from "@/lib/sightline";
import { marked } from "marked";
import { ARTICLE_SLUGS, type PostCategory } from "@/content/resources";

const DATA = join(process.cwd(), "data");

async function readJson<T>(path: string): Promise<T | null> {
  try { return JSON.parse(await readFile(path, "utf8")) as T; }
  catch { return null; }
}

export async function getLatestComparison(): Promise<Comparison | null> {
  const dir = join(DATA, "comparisons");
  if (!existsSync(dir)) return null;
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) return null;
  return readJson<Comparison>(join(dir, files[files.length - 1]));
}

export async function getComparisonWindow(dates: string[]): Promise<Comparison[]> {
  const dir = join(DATA, "comparisons");
  const out: Comparison[] = [];
  for (const date of dates) {
    const p = join(dir, `${date}.json`);
    if (!existsSync(p)) continue;
    const c = await readJson<Comparison>(p);
    if (c) out.push(c);
  }
  return out;
}

export async function getScores(): Promise<Scores | null> {
  return readJson<Scores>(join(DATA, "scores.json"));
}

export async function getLatestForecasts(): Promise<LatestForecasts | null> {
  return readJson<LatestForecasts>(join(DATA, "latest_forecasts.json"));
}

export async function getFireworksForecast(): Promise<FireworksForecastFile | null> {
  return readJson<FireworksForecastFile>(join(DATA, "fireworks_forecast.json"));
}

export async function getTerrain(): Promise<TerrainFile | null> {
  return readJson<TerrainFile>(join(DATA, "terrain.json"));
}

export async function getGmhgData(): Promise<GmhgData | null> {
  return readJson<GmhgData>(join(DATA, "gmhg_events.json"));
}

const POSTS_DIR = join(process.cwd(), "src", "content", "posts");

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    data[key] = val;
  }
  return { data, body: m[2] };
}

// The post <h1> renders from the title, so drop a leading markdown H1 from the
// body to avoid a duplicate heading.
function stripLeadingH1(md: string): string {
  return md.replace(/^\s*#\s+.*(?:\r?\n)+/, "");
}

// Flatten inline markdown (links, emphasis, code) to plain text for schema text.
function mdToText(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Pull question/answer pairs out of a post's "Frequently asked questions"
// section (## heading, then ### question + following paragraph) so the detail
// route can emit FAQPage JSON-LD. Answers are flattened to plain text.
function parseFaqs(md: string): { q: string; a: string }[] {
  const faqs: { q: string; a: string }[] = [];
  let inFaq = false;
  let q: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (q && buf.length) faqs.push({ q: mdToText(q), a: mdToText(buf.join(" ")) });
    q = null; buf = [];
  };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    if (h3) { if (inFaq) flush(); q = h3[1]; continue; }
    if (h2) { flush(); inFaq = /frequently asked questions/i.test(h2[1]); continue; }
    if (!inFaq) continue;
    if (line === "" ) continue;
    if (line === "---") { flush(); inFaq = false; continue; }
    if (q) buf.push(line);
  }
  flush();
  return faqs;
}

// Native posts authored as markdown in src/content/posts/. Unlike Substack
// feed posts they carry an explicit slug + category; the body renders to HTML
// and then flows through the same sanitizer as feed content.
async function getNativePosts(): Promise<BlogPost[]> {
  if (!existsSync(POSTS_DIR)) return [];
  const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith(".md"));
  const out: BlogPost[] = [];
  for (const f of files) {
    const { data, body } = parseFrontmatter(await readFile(join(POSTS_DIR, f), "utf8"));
    if (!data.slug || !data.title) continue;
    const category = data.category === "news" ? "news" : "articles";
    out.push({
      title: data.title,
      slug: data.slug,
      category,
      date: data.date,
      summary: data.summary,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      link: `/resources/${category}/${data.slug}`,
      content: marked.parse(stripLeadingH1(body), { async: false }) as string,
      faqs: parseFaqs(body),
    });
  }
  return out;
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  const feed = (await readJson<BlogPost[]>(join(DATA, "substack_feed.json"))) ?? [];
  const native = await getNativePosts();
  return [...native, ...feed].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export function slugFromLink(link: string, title: string): string {
  const m = link.match(/\/p\/([^/?#]+)/);
  if (m) return m[1];
  return (title || "post").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// A post's canonical slug + category, preferring the explicit fields native
// posts carry and falling back to the Substack derivation for feed posts.
export function postSlug(p: BlogPost): string {
  return p.slug ?? slugFromLink(p.link, p.title);
}
export function postCategoryOf(p: BlogPost): PostCategory {
  if (p.category === "articles" || p.category === "news") return p.category;
  return ARTICLE_SLUGS.has(postSlug(p)) ? "articles" : "news";
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const posts = await getBlogPosts();
  return posts.find((p) => postSlug(p) === slug) ?? null;
}

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Comparison, Scores, BlogPost } from "@/lib/types";

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

export async function getScores(): Promise<Scores | null> {
  return readJson<Scores>(join(DATA, "scores.json"));
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  const posts = (await readJson<BlogPost[]>(join(DATA, "substack_feed.json"))) ?? [];
  return [...posts].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export function slugFromLink(link: string, title: string): string {
  const m = link.match(/\/p\/([^/?#]+)/);
  if (m) return m[1];
  return (title || "post").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const posts = await getBlogPosts();
  return posts.find((p) => slugFromLink(p.link, p.title) === slug) ?? null;
}

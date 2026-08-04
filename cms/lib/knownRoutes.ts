import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { ARTICLES_DIR, SERVICES_DIR, TEAM_DIR } from "./paths.js";

export function listKnownInternalPaths(): string[] {
  const paths = new Set<string>([
    "/",
    "/about/",
    "/services/",
    "/articles/",
    "/team/",
    "/testimonials/",
    "/contact/",
    "/privacy/",
    "/terms/",
  ]);

  if (fs.existsSync(ARTICLES_DIR)) {
    for (const file of fs.readdirSync(ARTICLES_DIR)) {
      if (!file.endsWith(".md")) continue;
      const parsed = matter(
        fs.readFileSync(path.join(ARTICLES_DIR, file), "utf8"),
      );
      const slug =
        (parsed.data as { slug?: string }).slug || file.replace(/\.md$/, "");
      if (!(parsed.data as { draft?: boolean }).draft) {
        paths.add(`/articles/${slug}/`);
      }
    }
  }

  if (fs.existsSync(TEAM_DIR)) {
    for (const file of fs.readdirSync(TEAM_DIR)) {
      if (!file.endsWith(".md")) continue;
      const parsed = matter(
        fs.readFileSync(path.join(TEAM_DIR, file), "utf8"),
      );
      const slug =
        (parsed.data as { slug?: string }).slug || file.replace(/\.md$/, "");
      paths.add(`/team/#${slug}`);
      paths.add(`/team/`);
    }
  }

  if (fs.existsSync(SERVICES_DIR)) {
    for (const file of fs.readdirSync(SERVICES_DIR)) {
      if (!file.endsWith(".md")) continue;
      const parsed = matter(
        fs.readFileSync(path.join(SERVICES_DIR, file), "utf8"),
      );
      const slug =
        (parsed.data as { slug?: string }).slug || file.replace(/\.md$/, "");
      if (!(parsed.data as { draft?: boolean }).draft) {
        paths.add(`/services/#${slug}`);
      }
      paths.add(`/services/`);
    }
  }

  return [...paths];
}

export function listServiceSlugs(): string[] {
  if (!fs.existsSync(SERVICES_DIR)) return [];
  return fs
    .readdirSync(SERVICES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const parsed = matter(
        fs.readFileSync(path.join(SERVICES_DIR, file), "utf8"),
      );
      return (
        (parsed.data as { slug?: string }).slug || file.replace(/\.md$/, "")
      );
    });
}

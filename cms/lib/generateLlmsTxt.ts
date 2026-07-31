import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { ARTICLES_DIR, LLMS_TXT_PATH } from "./paths.js";
import type { ArticleFrontmatter } from "./schema.js";
import { absoluteUrl, readSiteIdentity } from "./siteConfig.js";

/**
 * Rebuilds public/llms.txt from all non-draft articles.
 * H1 = SITE_NAME, one-line blockquote, then H2 list of articles.
 */
export function generateLlmsTxt(): string {
  const { SITE_NAME } = readSiteIdentity();

  const articles: ArticleFrontmatter[] = [];
  if (fs.existsSync(ARTICLES_DIR)) {
    for (const file of fs.readdirSync(ARTICLES_DIR)) {
      if (!file.endsWith(".md")) continue;
      const parsed = matter(
        fs.readFileSync(path.join(ARTICLES_DIR, file), "utf8"),
      );
      const data = parsed.data as ArticleFrontmatter;
      if (data.draft) continue;
      articles.push(data);
    }
  }

  articles.sort((a, b) => {
    const da = new Date(a.date || 0).valueOf();
    const db = new Date(b.date || 0).valueOf();
    return db - da;
  });

  const lines: string[] = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_NAME} publishes practical articles on technical SEO, E-E-A-T, and AI-search visibility.`,
    "",
    "## Articles",
    "",
  ];

  if (articles.length === 0) {
    lines.push("No published articles yet.");
  } else {
    for (const article of articles) {
      const slug = article.slug || "";
      const url = absoluteUrl(`/articles/${slug}/`);
      const title = article.title || slug;
      const description = article.description || "";
      lines.push(`- [${title}](${url}): ${description}`);
    }
  }

  lines.push("");
  const body = lines.join("\n");
  fs.mkdirSync(path.dirname(LLMS_TXT_PATH), { recursive: true });
  fs.writeFileSync(LLMS_TXT_PATH, body, "utf8");
  return body;
}

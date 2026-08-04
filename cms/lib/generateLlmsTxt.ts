import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { ARTICLES_DIR, LLMS_TXT_PATH } from "./paths.js";
import type { ArticleFrontmatter } from "./schema.js";
import { absoluteUrl, readSiteIdentity } from "./siteConfig.js";

const SITE_DESCRIPTION = [
  "Rupert is an expert-led investor outreach service designed for founders raising capital. Rather than relying on automated campaigns or generic investor lists, every outreach effort is researched, written, and managed with precision to reach investors who actively back companies like yours.",
  "",
  "Throughout the process, you have complete transparency into every email, every conversation, and every response. Rupert never owns your relationships or takes a percentage of your raise. You keep every investor connection, while benefiting from the discipline, experience, and craftsmanship of a professional fundraising operator.",
].join("\n");

/**
 * Rebuilds public/llms.txt from all non-draft articles.
 * H1 = SITE_NAME, site description blockquote, then H2 list of articles.
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

  const descriptionQuote = SITE_DESCRIPTION.split("\n")
    .map((line) => (line.length === 0 ? ">" : `> ${line}`))
    .join("\n");

  const lines: string[] = [
    `# ${SITE_NAME}`,
    "",
    descriptionQuote,
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

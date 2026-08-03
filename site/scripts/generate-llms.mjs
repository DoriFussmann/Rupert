/**
 * Rebuilds public/llms.txt from non-draft articles in src/content/articles.
 * Run via npm prebuild so Astro builds never ship a stale file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, "..");
const ARTICLES_DIR = path.join(SITE_ROOT, "src/content/articles");
const SITE_CONFIG = path.join(SITE_ROOT, "src/config/site.ts");
const OUT_PATH = path.join(SITE_ROOT, "public/llms.txt");

function extractStringConst(source, name) {
  const match = source.match(
    new RegExp(`export\\s+const\\s+${name}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`),
  );
  if (!match) {
    throw new Error(`Could not parse ${name} from site config.`);
  }
  return match[1];
}

function absoluteUrl(siteUrl, pathname) {
  const base = siteUrl.replace(/\/+$/, "");
  if (!pathname || pathname === "/") return `${base}/`;
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return normalized.endsWith("/")
    ? `${base}${normalized}`
    : `${base}${normalized}/`;
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const fm = match[1];
  const get = (key) => fm.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, "m"))?.[1]?.trim();
  const unquote = (v) =>
    v ? v.replace(/^["']|["']$/g, "").trim() : undefined;

  return {
    draft: /^\s*draft:\s*true\s*$/m.test(fm),
    slug: unquote(get("slug")),
    title: unquote(get("title")),
    description: unquote(get("description")),
    date: unquote(get("date")),
  };
}

function main() {
  const configSource = fs.readFileSync(SITE_CONFIG, "utf8");
  const SITE_URL = extractStringConst(configSource, "SITE_URL");
  const SITE_NAME = extractStringConst(configSource, "SITE_NAME");

  const articles = [];
  if (fs.existsSync(ARTICLES_DIR)) {
    for (const file of fs.readdirSync(ARTICLES_DIR)) {
      if (!file.endsWith(".md")) continue;
      const data = parseFrontmatter(
        fs.readFileSync(path.join(ARTICLES_DIR, file), "utf8"),
      );
      if (!data || data.draft) continue;
      articles.push(data);
    }
  }

  articles.sort(
    (a, b) => new Date(b.date || 0).valueOf() - new Date(a.date || 0).valueOf(),
  );

  const lines = [
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
      const url = absoluteUrl(SITE_URL, `/articles/${slug}/`);
      const title = article.title || slug;
      const description = article.description || "";
      lines.push(`- [${title}](${url}): ${description}`);
    }
  }

  lines.push("");
  const body = lines.join("\n");
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, body, "utf8");
  console.log(`Wrote ${OUT_PATH} (${articles.length} articles)`);
}

main();

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { SITE_URL } from "./src/config/site.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const articlesDir = path.join(__dirname, "src/content/articles");

/** Map article slug → lastmod Date from frontmatter updatedDate (fallback: date). */
function loadArticleLastmods() {
  const map = new Map();
  if (!fs.existsSync(articlesDir)) return map;

  for (const file of fs.readdirSync(articlesDir)) {
    if (!file.endsWith(".md")) continue;
    const raw = fs.readFileSync(path.join(articlesDir, file), "utf8");
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) continue;
    const fm = fmMatch[1];
    if (/^\s*draft:\s*true\s*$/m.test(fm)) continue;

    const slug = fm.match(/^\s*slug:\s*["']?([^\s"']+)/m)?.[1];
    if (!slug) continue;

    const updated = fm.match(/^\s*updatedDate:\s*["']?([^\s"']+)/m)?.[1];
    const date = fm.match(/^\s*date:\s*["']?([^\s"']+)/m)?.[1];
    const lastmod = new Date(updated || date || "");
    if (!Number.isNaN(lastmod.valueOf())) {
      map.set(slug, lastmod);
    }
  }
  return map;
}

const articleLastmods = loadArticleLastmods();

export default defineConfig({
  site: SITE_URL,
  output: "static",
  trailingSlash: "always",
  integrations: [
    sitemap({
      filter: (page) => !page.includes("/404"),
      serialize(item) {
        // /articles/{slug}/ only — not /articles/ or /articles/page/N/
        const match = item.url.match(/\/articles\/([^/]+)\/?$/);
        if (match && match[1] !== "page") {
          const lastmod = articleLastmods.get(match[1]);
          if (lastmod) {
            item.lastmod = lastmod.toISOString();
          }
        }
        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});

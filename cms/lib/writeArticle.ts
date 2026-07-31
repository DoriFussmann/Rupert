import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { ARTICLES_DIR, ARTICLE_ASSETS_DIR } from "./paths.js";
import type { ArticleFrontmatter } from "./schema.js";
import type { SessionImages } from "./validateFrontmatter.js";
import {
  applyDefaults,
  sanitizeFaqs,
  sanitizeLinks,
} from "./validateFrontmatter.js";
import { generateLlmsTxt } from "./generateLlmsTxt.js";

function extFromName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return ext || ".jpg";
}

function toIsoDate(value: string | Date | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.valueOf())) {
    throw new Error(`Invalid date: ${String(value)}`);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Writes site/src/content/articles/{slug}.md and copies session images
 * into site/src/assets/articles/{slug}/. Filename is always derived from slug.
 */
export function writeArticle(options: {
  data: ArticleFrontmatter;
  body: string;
  sessionImages: SessionImages;
  overwrite?: boolean;
}): { slug: string; path: string } {
  const data = applyDefaults(options.data);
  const slug = data.slug?.trim();
  if (!slug) {
    throw new Error("slug is required");
  }

  fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  const outPath = path.join(ARTICLES_DIR, `${slug}.md`);
  if (fs.existsSync(outPath) && !options.overwrite) {
    throw new Error(
      `Article "${slug}" already exists. Pass overwrite=true or choose a new slug.`,
    );
  }

  if (!options.sessionImages.image) {
    throw new Error("Hero image must be uploaded in this session.");
  }

  const assetDir = path.join(ARTICLE_ASSETS_DIR, slug);
  fs.mkdirSync(assetDir, { recursive: true });

  const heroExt = extFromName(options.sessionImages.image.originalName);
  const heroName = `hero${heroExt}`;
  fs.copyFileSync(
    options.sessionImages.image.stagedPath,
    path.join(assetDir, heroName),
  );
  const imageRel = `../../assets/articles/${slug}/${heroName}`;

  let image2Rel: string | undefined;
  if (options.sessionImages.image2) {
    const ext = extFromName(options.sessionImages.image2.originalName);
    const name = `image2${ext}`;
    fs.copyFileSync(
      options.sessionImages.image2.stagedPath,
      path.join(assetDir, name),
    );
    image2Rel = `../../assets/articles/${slug}/${name}`;
  }

  let image3Rel: string | undefined;
  if (options.sessionImages.image3) {
    const ext = extFromName(options.sessionImages.image3.originalName);
    const name = `image3${ext}`;
    fs.copyFileSync(
      options.sessionImages.image3.stagedPath,
      path.join(assetDir, name),
    );
    image3Rel = `../../assets/articles/${slug}/${name}`;
  }

  const date = toIsoDate(data.date);
  const updatedDate = data.updatedDate ? toIsoDate(data.updatedDate) : date;

  const fm: Record<string, unknown> = {
    title: data.title,
    description: data.description,
    slug,
    date,
    updatedDate,
    author: data.author,
    category: data.category,
    tags: data.tags,
    image: imageRel,
    imageAlt: data.imageAlt,
    robots: data.robots,
    schemaType: data.schemaType,
    locale: data.locale,
    twitterCard: data.twitterCard,
    draft: data.draft,
  };

  if (data.keywords && data.keywords.length > 0) {
    fm.keywords = data.keywords;
  }
  if (data.canonical && data.canonical.trim()) {
    fm.canonical = data.canonical.trim();
  }
  if (image2Rel) {
    fm.image2 = image2Rel;
    fm.image2Alt = data.image2Alt;
  }
  if (image3Rel) {
    fm.image3 = image3Rel;
    fm.image3Alt = data.image3Alt;
  }

  if (
    typeof data.ogTitle === "string" &&
    data.ogTitle.trim() &&
    data.ogTitle.trim() !== data.title
  ) {
    fm.ogTitle = data.ogTitle.trim();
  }
  if (
    typeof data.ogDescription === "string" &&
    data.ogDescription.trim() &&
    data.ogDescription.trim() !== data.description
  ) {
    fm.ogDescription = data.ogDescription.trim();
  }

  const internalLinks = sanitizeLinks(data.internalLinks);
  if (internalLinks.length) fm.internalLinks = internalLinks;
  const externalLinks = sanitizeLinks(data.externalLinks);
  if (externalLinks.length) fm.externalLinks = externalLinks;
  const faqs = sanitizeFaqs(data.faqs);
  if (faqs.length) fm.faqs = faqs;

  const yaml = YAML.stringify(fm, { lineWidth: 0 }).trimEnd();
  const body = (options.body ?? "").replace(/^\uFEFF/, "").trimEnd();
  fs.writeFileSync(outPath, `---\n${yaml}\n---\n\n${body}\n`, "utf8");

  generateLlmsTxt();

  return { slug, path: outPath };
}

export function listArticles(): Array<{
  slug: string;
  title: string;
  draft: boolean;
  updatedDate: string;
  internalLinks: number;
  externalLinks: number;
  faqs: number;
  path: string;
}> {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const full = path.join(ARTICLES_DIR, file);
      const parsed = matter(fs.readFileSync(full, "utf8"));
      const data = parsed.data as ArticleFrontmatter;
      const slug = data.slug || file.replace(/\.md$/, "");
      return {
        slug,
        title: data.title || slug,
        draft: Boolean(data.draft),
        updatedDate: String(data.updatedDate || data.date || ""),
        internalLinks: Array.isArray(data.internalLinks)
          ? data.internalLinks.length
          : 0,
        externalLinks: Array.isArray(data.externalLinks)
          ? data.externalLinks.length
          : 0,
        faqs: Array.isArray(data.faqs) ? data.faqs.length : 0,
        path: full,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function readArticleFile(slug: string): {
  data: ArticleFrontmatter;
  body: string;
  path: string;
} {
  const full = path.join(ARTICLES_DIR, `${slug}.md`);
  if (!fs.existsSync(full)) {
    throw new Error(`Article not found: ${slug}`);
  }
  const parsed = matter(fs.readFileSync(full, "utf8"));
  return {
    data: parsed.data as ArticleFrontmatter,
    body: parsed.content.trim(),
    path: full,
  };
}

export function setArticleDraft(slug: string, draft: boolean): void {
  const { data, body } = readArticleFile(slug);
  const fm: Record<string, unknown> = {
    ...data,
    draft,
    date: toIsoDate(data.date),
    updatedDate: toIsoDate(data.updatedDate || data.date),
  };
  const yaml = YAML.stringify(fm, { lineWidth: 0 }).trimEnd();
  fs.writeFileSync(
    path.join(ARTICLES_DIR, `${slug}.md`),
    `---\n${yaml}\n---\n\n${body}\n`,
    "utf8",
  );
  generateLlmsTxt();
}

export function deleteArticle(slug: string): void {
  const full = path.join(ARTICLES_DIR, `${slug}.md`);
  if (fs.existsSync(full)) fs.unlinkSync(full);
  const assetDir = path.join(ARTICLE_ASSETS_DIR, slug);
  if (fs.existsSync(assetDir)) {
    fs.rmSync(assetDir, { recursive: true, force: true });
  }
  generateLlmsTxt();
}

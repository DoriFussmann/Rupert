import {
  ALT_MIN_LENGTH,
  DEFAULTS,
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  TAGS_MAX,
  TAGS_MIN,
  TITLE_MAX,
  TITLE_MIN,
  type ArticleFrontmatter,
  type FaqItem,
  type LinkItem,
} from "./schema.js";
import { siteHostname } from "./siteConfig.js";

export interface SessionImages {
  image?: { stagedPath: string; originalName: string };
  image2?: { stagedPath: string; originalName: string };
  image3?: { stagedPath: string; originalName: string };
}

export interface FieldStatus {
  name: string;
  ok: boolean;
  message?: string;
  required: boolean;
}

export interface ValidationResult {
  ok: boolean;
  missing: string[];
  invalid: string[];
  summary: string;
  fields: FieldStatus[];
  warnings: string[];
}

const PLACEHOLDER_RE = /(REPLACE|TODO|placeholder)/i;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function charCount(v: string): number {
  return [...v].length;
}

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function pathLooksPlaceholder(path: string | undefined): boolean {
  if (!isNonEmptyString(path)) return true;
  return PLACEHOLDER_RE.test(path);
}

export function validateArticle(
  data: ArticleFrontmatter,
  sessionImages: SessionImages,
  options: {
    knownAuthors: string[];
    knownInternalPaths: string[];
    overwrite?: boolean;
    existingSlugs?: string[];
  },
): ValidationResult {
  const fields: FieldStatus[] = [];
  const missing: string[] = [];
  const invalid: string[] = [];
  const warnings: string[] = [];
  const host = siteHostname();

  const push = (
    name: string,
    required: boolean,
    ok: boolean,
    message?: string,
  ) => {
    fields.push({ name, ok, message, required });
    if (!ok) {
      if (!data[name as keyof ArticleFrontmatter] && required) {
        missing.push(name);
      } else if (message) {
        invalid.push(`${name} (${message})`);
      } else {
        missing.push(name);
      }
    }
  };

  // title
  if (!isNonEmptyString(data.title)) {
    push("title", true, false, "missing");
  } else {
    const len = charCount(data.title);
    const ok = len >= TITLE_MIN && len <= TITLE_MAX;
    push(
      "title",
      true,
      ok,
      ok ? undefined : `${len} chars, needs ${TITLE_MIN}–${TITLE_MAX}`,
    );
  }

  // description
  if (!isNonEmptyString(data.description)) {
    push("description", true, false, "missing");
  } else {
    const len = charCount(data.description);
    const ok = len >= DESCRIPTION_MIN && len <= DESCRIPTION_MAX;
    push(
      "description",
      true,
      ok,
      ok ? undefined : `${len} chars, needs ${DESCRIPTION_MIN}–${DESCRIPTION_MAX}`,
    );
  }

  // slug
  if (!isNonEmptyString(data.slug)) {
    push("slug", true, false, "missing");
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) {
    push("slug", true, false, "must be lowercase kebab-case");
  } else {
    push("slug", true, true);
    if (
      options.existingSlugs?.includes(data.slug) &&
      !options.overwrite
    ) {
      warnings.push(
        `Slug "${data.slug}" already exists — choose overwrite or rename.`,
      );
    }
  }

  // date
  {
    const d = data.date ? new Date(data.date) : null;
    push(
      "date",
      true,
      !!d && !Number.isNaN(d.valueOf()),
      data.date ? undefined : "missing",
    );
  }

  // author
  if (!isNonEmptyString(data.author)) {
    push("author", true, false, "missing");
  } else if (!options.knownAuthors.includes(data.author)) {
    push("author", true, false, `unknown team slug "${data.author}"`);
  } else {
    push("author", true, true);
  }

  // category
  push("category", true, isNonEmptyString(data.category), "missing");

  // tags
  if (!Array.isArray(data.tags) || data.tags.length === 0) {
    push("tags", true, false, "missing");
  } else if (
    data.tags.length < TAGS_MIN ||
    data.tags.length > TAGS_MAX ||
    data.tags.some((t) => !isNonEmptyString(t))
  ) {
    push(
      "tags",
      true,
      false,
      `needs ${TAGS_MIN}–${TAGS_MAX} non-empty strings`,
    );
  } else {
    push("tags", true, true);
  }

  // image — session upload required; frontmatter path alone never satisfies
  if (!sessionImages.image) {
    const pathMsg = isNonEmptyString(data.image)
      ? pathLooksPlaceholder(data.image)
        ? "path present in file but looks like a placeholder — drop a real file"
        : "path present in file but no image uploaded this session — drop a real file"
      : "missing — drop a real file";
    push("image", true, false, pathMsg);
  } else {
    push("image", true, true);
  }

  // imageAlt
  if (!isNonEmptyString(data.imageAlt)) {
    push("imageAlt", true, false, "missing");
  } else if (charCount(data.imageAlt) < ALT_MIN_LENGTH) {
    push(
      "imageAlt",
      true,
      false,
      `needs at least ${ALT_MIN_LENGTH} characters`,
    );
  } else {
    push("imageAlt", true, true);
  }

  // defaults (always ok if present or will default)
  push("robots", true, true);
  push("schemaType", true, true);
  push("locale", true, true);
  push("twitterCard", true, true);
  push("draft", true, typeof data.draft === "boolean" || data.draft === undefined);

  // updatedDate — optional, defaults to date
  if (data.updatedDate) {
    const d = new Date(data.updatedDate);
    push(
      "updatedDate",
      false,
      !Number.isNaN(d.valueOf()),
      "invalid date",
    );
  } else {
    push("updatedDate", false, true);
  }

  // keywords — optional but recommended
  if (data.keywords === undefined || data.keywords === null) {
    push("keywords", false, true);
  } else if (
    !Array.isArray(data.keywords) ||
    data.keywords.some((k) => !isNonEmptyString(k))
  ) {
    push("keywords", false, false, "must be an array of strings");
  } else {
    push("keywords", false, true);
  }

  // canonical
  if (!data.canonical) {
    push("canonical", false, true);
  } else if (!isHttpUrl(data.canonical)) {
    push("canonical", false, false, "must be a valid http(s) URL");
  } else {
    push("canonical", false, true);
  }

  // image2 / image2Alt
  if (sessionImages.image2) {
    push("image2", false, true);
    if (!isNonEmptyString(data.image2Alt)) {
      push("image2Alt", false, false, "required when image2 is present");
    } else if (charCount(data.image2Alt) < ALT_MIN_LENGTH) {
      push(
        "image2Alt",
        false,
        false,
        `needs at least ${ALT_MIN_LENGTH} characters`,
      );
    } else {
      push("image2Alt", false, true);
    }
  } else if (isNonEmptyString(data.image2)) {
    push(
      "image2",
      false,
      false,
      "path present in file but no image uploaded this session — drop a real file",
    );
    push("image2Alt", false, true);
  } else {
    push("image2", false, true);
    push("image2Alt", false, true);
  }

  // image3 / image3Alt
  if (sessionImages.image3) {
    push("image3", false, true);
    if (!isNonEmptyString(data.image3Alt)) {
      push("image3Alt", false, false, "required when image3 is present");
    } else if (charCount(data.image3Alt) < ALT_MIN_LENGTH) {
      push(
        "image3Alt",
        false,
        false,
        `needs at least ${ALT_MIN_LENGTH} characters`,
      );
    } else {
      push("image3Alt", false, true);
    }
  } else if (isNonEmptyString(data.image3)) {
    push(
      "image3",
      false,
      false,
      "path present in file but no image uploaded this session — drop a real file",
    );
    push("image3Alt", false, true);
  } else {
    push("image3", false, true);
    push("image3Alt", false, true);
  }

  // og overrides — optional; blank means omit
  push("ogTitle", false, true);
  push("ogDescription", false, true);
  push("ogImage", false, true);

  // internalLinks
  const internal = Array.isArray(data.internalLinks) ? data.internalLinks : [];
  let internalOk = true;
  let internalMsg: string | undefined;
  for (const [i, link] of internal.entries()) {
    if (!isNonEmptyString(link.label)) {
      internalOk = false;
      internalMsg = `row ${i + 1}: label required`;
      break;
    }
    if (!isNonEmptyString(link.url)) {
      internalOk = false;
      internalMsg = `row ${i + 1}: url required`;
      break;
    }
    const normalized = normalizeInternalPath(link.url);
    if (
      normalized &&
      options.knownInternalPaths.length > 0 &&
      !options.knownInternalPaths.includes(normalized)
    ) {
      warnings.push(
        `internalLinks[${i}] "${link.url}" does not match a known internal page`,
      );
    }
  }
  push("internalLinks", false, internalOk, internalMsg);

  // externalLinks
  const external = Array.isArray(data.externalLinks) ? data.externalLinks : [];
  let externalOk = true;
  let externalMsg: string | undefined;
  for (const [i, link] of external.entries()) {
    if (!isNonEmptyString(link.label)) {
      externalOk = false;
      externalMsg = `row ${i + 1}: label required`;
      break;
    }
    if (!isHttpUrl(link.url)) {
      externalOk = false;
      externalMsg = `row ${i + 1}: must be valid http(s) URL`;
      break;
    }
    try {
      const u = new URL(link.url);
      if (u.hostname === host || u.hostname === "example.com") {
        externalOk = false;
        externalMsg = `row ${i + 1}: must not point at this site or example.com`;
        break;
      }
    } catch {
      externalOk = false;
      externalMsg = `row ${i + 1}: invalid URL`;
      break;
    }
  }
  push("externalLinks", false, externalOk, externalMsg);

  // faqs — optional
  const faqs = Array.isArray(data.faqs) ? data.faqs : [];
  let faqsOk = true;
  let faqsMsg: string | undefined;
  for (const [i, faq] of faqs.entries()) {
    if (!isNonEmptyString(faq.question) || !isNonEmptyString(faq.answer)) {
      faqsOk = false;
      faqsMsg = `row ${i + 1}: question and answer required`;
      break;
    }
  }
  push("faqs", false, faqsOk, faqsMsg);

  // Deduplicate missing/invalid lists for summary
  const missingUnique = [...new Set(missing)];
  const invalidUnique = [...new Set(invalid)];

  // Required fields that must be ok for Generate
  const requiredFailed = fields.filter((f) => f.required && !f.ok);
  // Also block on optional image2/3 session path issues when they fail
  const imageOptionalFailed = fields.filter(
    (f) =>
      !f.ok &&
      (f.name === "image2" ||
        f.name === "image2Alt" ||
        f.name === "image3" ||
        f.name === "image3Alt" ||
        f.name === "internalLinks" ||
        f.name === "externalLinks" ||
        f.name === "faqs"),
  );

  const blocking = [...requiredFailed, ...imageOptionalFailed];
  const ok = blocking.length === 0;

  let summary: string;
  if (ok && warnings.length === 0) {
    summary = "All required fields present.";
  } else if (ok) {
    summary = `All required fields present. Warnings: ${warnings.join(" · ")}`;
  } else {
    const parts: string[] = [];
    if (missingUnique.length) parts.push(`Missing: ${missingUnique.join(", ")}`);
    if (invalidUnique.length) parts.push(`Invalid: ${invalidUnique.join(", ")}`);
    summary = parts.join(" · ") || "Validation failed.";
  }

  return { ok, missing: missingUnique, invalid: invalidUnique, summary, fields, warnings };
}

function normalizeInternalPath(url: string): string | null {
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const u = new URL(url);
      let p = u.pathname;
      if (!p.endsWith("/")) p += "/";
      return p;
    }
    let p = url.startsWith("/") ? url : `/${url}`;
    if (!p.endsWith("/")) p += "/";
    return p;
  } catch {
    return null;
  }
}

export function applyDefaults(data: ArticleFrontmatter): ArticleFrontmatter {
  return {
    ...data,
    robots: data.robots ?? DEFAULTS.robots,
    schemaType: data.schemaType ?? DEFAULTS.schemaType,
    locale: data.locale ?? DEFAULTS.locale,
    twitterCard: data.twitterCard ?? DEFAULTS.twitterCard,
    draft: typeof data.draft === "boolean" ? data.draft : DEFAULTS.draft,
  };
}

export function sanitizeLinks(links: LinkItem[] | undefined): LinkItem[] {
  return (links ?? []).filter(
    (l) => isNonEmptyString(l.label) && isNonEmptyString(l.url),
  );
}

export function sanitizeFaqs(faqs: FaqItem[] | undefined): FaqItem[] {
  return (faqs ?? []).filter(
    (f) => isNonEmptyString(f.question) && isNonEmptyString(f.answer),
  );
}

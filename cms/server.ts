import express from "express";
import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { fileURLToPath } from "node:url";
import { IMAGE_MAX_BYTES } from "./lib/schema.js";
import type { ArticleFrontmatter } from "./lib/schema.js";
import { STAGING_DIR } from "./lib/paths.js";
import {
  applyDefaults,
  validateArticle,
  type SessionImages,
} from "./lib/validateFrontmatter.js";
import {
  deleteArticle,
  listArticles,
  readArticleFile,
  setArticleDraft,
  writeArticle,
} from "./lib/writeArticle.js";
import {
  deleteTeamMember,
  listTeam,
  readTeamMember,
  writeTeamMember,
} from "./lib/writeTeamMember.js";
import { generateLlmsTxt } from "./lib/generateLlmsTxt.js";
import { listKnownInternalPaths, listServiceSlugs } from "./lib/knownRoutes.js";
import { absoluteUrl, readSiteIdentity } from "./lib/siteConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.CMS_PORT || 3737);

fs.mkdirSync(STAGING_DIR, { recursive: true });

const upload = multer({
  dest: STAGING_DIR,
  limits: { fileSize: IMAGE_MAX_BYTES },
});

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

type SessionStore = {
  images: SessionImages;
  body?: string;
};

const sessions = new Map<string, SessionStore>();

function getSession(req: Request): SessionStore {
  const id = String(req.headers["x-session-id"] || req.query.sessionId || "default");
  let s = sessions.get(id);
  if (!s) {
    s = { images: {} };
    sessions.set(id, s);
  }
  return s;
}

function jsonError(res: Response, status: number, message: string, extra?: object) {
  return res.status(status).json({ ok: false, error: message, ...extra });
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/site", (_req, res) => {
  res.json({ ok: true, ...readSiteIdentity() });
});

app.get("/articles", (_req, res) => {
  res.json({ ok: true, articles: listArticles() });
});

app.get(
  "/articles/:slug",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug);
    const article = readArticleFile(slug);
    res.json({ ok: true, ...article });
  }),
);

app.get("/api/team", (_req, res) => {
  res.json({ ok: true, team: listTeam() });
});

app.get(
  "/api/team/:slug",
  asyncHandler(async (req, res) => {
    const member = readTeamMember(String(req.params.slug));
    res.json({ ok: true, member });
  }),
);

app.get("/api/routes", (_req, res) => {
  res.json({
    ok: true,
    internalPaths: listKnownInternalPaths(),
    services: listServiceSlugs(),
    authors: listTeam().map((t) => ({ slug: t.slug, name: t.name })),
  });
});

app.post(
  "/parse",
  upload.single("markdown"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return jsonError(res, 400, "No markdown file uploaded.");
    }
    const raw = fs.readFileSync(req.file.path, "utf8");
    fs.unlinkSync(req.file.path);
    const parsed = matter(raw);
    const data = applyDefaults(parsed.data as ArticleFrontmatter);
    const session = getSession(req);
    session.body = parsed.content.trim();

    const existingSlugs = listArticles().map((a) => a.slug);
    const validation = validateArticle(data, session.images, {
      knownAuthors: listTeam().map((t) => t.slug),
      knownInternalPaths: listKnownInternalPaths(),
      existingSlugs,
      overwrite: false,
    });

    res.json({
      ok: true,
      data,
      body: session.body,
      validation,
      existingSlugs,
    });
  }),
);

app.post(
  "/api/validate",
  asyncHandler(async (req, res) => {
    const session = getSession(req);
    const data = applyDefaults(req.body?.data || {});
    const overwrite = Boolean(req.body?.overwrite);
    const validation = validateArticle(data, session.images, {
      knownAuthors: listTeam().map((t) => t.slug),
      knownInternalPaths: listKnownInternalPaths(),
      existingSlugs: listArticles().map((a) => a.slug),
      overwrite,
    });
    res.json({ ok: true, validation, sessionImages: Object.keys(session.images) });
  }),
);

app.post(
  "/api/upload-image",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    const slot = String(req.body?.slot || "image") as keyof SessionImages;
    if (!["image", "image2", "image3"].includes(slot)) {
      return jsonError(res, 400, "slot must be image, image2, or image3");
    }
    if (!req.file) {
      return jsonError(res, 400, "No image file uploaded.");
    }
    const session = getSession(req);
    session.images[slot] = {
      stagedPath: req.file.path,
      originalName: req.file.originalname,
    };
    res.json({
      ok: true,
      slot,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  }),
);

app.post(
  "/api/articles",
  asyncHandler(async (req, res) => {
    const session = getSession(req);
    const data = applyDefaults(req.body?.data || {});
    const body = String(req.body?.body ?? session.body ?? "");
    const overwrite = Boolean(req.body?.overwrite);

    const validation = validateArticle(data, session.images, {
      knownAuthors: listTeam().map((t) => t.slug),
      knownInternalPaths: listKnownInternalPaths(),
      existingSlugs: listArticles().map((a) => a.slug),
      overwrite,
    });
    if (!validation.ok) {
      return jsonError(res, 400, validation.summary, { validation });
    }

    const result = writeArticle({
      data,
      body,
      sessionImages: session.images,
      overwrite,
    });

    // Clear session images after successful write
    session.images = {};
    session.body = undefined;

    res.json({ ok: true, ...result, llmsTxt: true });
  }),
);

app.patch(
  "/api/articles/:slug/draft",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug);
    const draft = Boolean(req.body?.draft);
    setArticleDraft(slug, draft);
    res.json({ ok: true, slug, draft });
  }),
);

app.delete(
  "/api/articles/:slug",
  asyncHandler(async (req, res) => {
    deleteArticle(String(req.params.slug));
    res.json({ ok: true });
  }),
);

app.post(
  "/api/team",
  upload.single("photo"),
  asyncHandler(async (req, res) => {
    let data: Record<string, unknown>;
    if (req.body?.data) {
      data =
        typeof req.body.data === "string"
          ? JSON.parse(req.body.data)
          : req.body.data;
    } else {
      data = {
        name: req.body.name,
        slug: req.body.slug,
        role: req.body.role,
        bio: req.body.bio,
        credentials: req.body.credentials,
        sameAs: req.body.sameAs
          ? String(req.body.sameAs)
              .split("\n")
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [],
        photo: req.body.photo,
      };
    }

    const overwrite = Boolean(
      req.body?.overwrite === true ||
        req.body?.overwrite === "true" ||
        req.body?.overwrite === "1",
    );

    const photoStaged = req.file
      ? { stagedPath: req.file.path, originalName: req.file.originalname }
      : undefined;

    const result = writeTeamMember({
      data: data as Parameters<typeof writeTeamMember>[0]["data"],
      photoStaged,
      overwrite,
    });
    res.json({ ok: true, ...result });
  }),
);

app.delete(
  "/api/team/:slug",
  asyncHandler(async (req, res) => {
    deleteTeamMember(String(req.params.slug));
    res.json({ ok: true });
  }),
);

app.post("/api/preview-jsonld", (req, res) => {
  try {
    const data = applyDefaults(req.body?.data || {});
    const identity = readSiteIdentity();
    const author = listTeam().find((t) => t.slug === data.author);

    const pageUrl = absoluteUrl(`/articles/${data.slug || "slug"}/`);
    const schemas: object[] = [];

    schemas.push({
      "@context": "https://schema.org",
      "@type": data.schemaType || "BlogPosting",
      headline: data.title,
      description: data.description,
      datePublished: data.date,
      dateModified: data.updatedDate || data.date,
      author: author
        ? {
            "@type": "Person",
            name: author.name,
            url: absoluteUrl(`/team/#${author.slug}`),
            sameAs: author.sameAs || [],
          }
        : { "@type": "Person", name: data.author },
      image: "(resolved at build via getImage)",
      mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
      publisher: {
        "@type": "Organization",
        name: identity.SITE_NAME,
      },
    });

    if (author) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "Person",
        name: author.name,
        jobTitle: author.role,
        description: author.bio,
        url: absoluteUrl(`/team/#${author.slug}`),
        sameAs: author.sameAs || [],
      });
    }

    schemas.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: absoluteUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Articles",
          item: absoluteUrl("/articles/"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: data.title,
          item: pageUrl,
        },
      ],
    });

    if (Array.isArray(data.faqs) && data.faqs.length > 0) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: data.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      });
    }

    res.json({ ok: true, schemas });
  } catch (err) {
    jsonError(
      res,
      400,
      err instanceof Error ? err.message : "Preview failed",
    );
  }
});

app.post("/api/llms", (_req, res) => {
  const body = generateLlmsTxt();
  res.json({ ok: true, body });
});

// Multer / JSON error handler — always JSON
app.use(
  (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return jsonError(
          res,
          413,
          `File too large. Maximum size is ${IMAGE_MAX_BYTES / (1024 * 1024)}MB per file.`,
        );
      }
      return jsonError(res, 400, err.message);
    }
    const message = err instanceof Error ? err.message : "Server error";
    console.error(err);
    return jsonError(res, 500, message);
  },
);

// Catch-all API 404 as JSON
app.use("/api", (_req, res) => {
  jsonError(res, 404, "Not found");
});

app.listen(PORT, () => {
  console.log(`CMS running at http://localhost:${PORT}`);
  console.log(`Articles → site/src/content/articles/`);
  console.log(`Max image upload: ${IMAGE_MAX_BYTES / (1024 * 1024)}MB`);
});

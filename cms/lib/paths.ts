import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const CMS_ROOT = path.resolve(__dirname, "..");
export const REPO_ROOT = path.resolve(CMS_ROOT, "..");
export const SITE_ROOT = path.join(REPO_ROOT, "site");

export const ARTICLES_DIR = path.join(SITE_ROOT, "src", "content", "articles");
export const TEAM_DIR = path.join(SITE_ROOT, "src", "content", "team");
export const SERVICES_DIR = path.join(SITE_ROOT, "src", "content", "services");
export const ARTICLE_ASSETS_DIR = path.join(SITE_ROOT, "src", "assets", "articles");
export const TEAM_ASSETS_DIR = path.join(SITE_ROOT, "src", "assets", "team");
export const LLMS_TXT_PATH = path.join(SITE_ROOT, "public", "llms.txt");
export const STAGING_DIR = path.join(CMS_ROOT, ".staging");
export const SITE_CONFIG_PATH = path.join(SITE_ROOT, "src", "config", "site.ts");

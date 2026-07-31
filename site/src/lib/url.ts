import { SITE_URL } from "../config/site";

const FILE_ENDPOINTS = new Set([
  "robots.txt",
  "rss.xml",
  "sitemap-index.xml",
  "sitemap-0.xml",
  "llms.txt",
]);

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isFileEndpoint(pathname: string): boolean {
  const cleaned = pathname.replace(/^\/+/, "");
  const basename = cleaned.split("/").pop() ?? "";
  return FILE_ENDPOINTS.has(basename) || /\.[a-z0-9]+$/i.test(basename);
}

/**
 * Join SITE_URL + path and enforce trailingSlash: 'always' for routes.
 * File endpoints (robots.txt, rss.xml, sitemap-index.xml, etc.) stay slash-free.
 * Hash fragments are preserved and do not receive a trailing slash after the hash.
 */
export function absoluteUrl(path: string = "/"): string {
  const base = stripTrailingSlash(SITE_URL);

  if (!path || path === "/") {
    return `${base}/`;
  }

  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const beforeHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;

  const queryIndex = beforeHash.indexOf("?");
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex) : "";
  const pathnameOnly =
    queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;

  const normalized = pathnameOnly.startsWith("/")
    ? pathnameOnly
    : `/${pathnameOnly}`;

  // Asset paths from getImage() (e.g. /_astro/hero....webp)
  if (isFileEndpoint(normalized) || normalized.startsWith("/_astro/")) {
    return `${base}${stripTrailingSlash(normalized)}${query}${hash}`;
  }

  // Hash-only anchors on a path: ensure path has trailing slash, hash does not
  if (hash && (!normalized || normalized === "/")) {
    return `${base}/${query}${hash}`;
  }

  const withSlash = normalized.endsWith("/") ? normalized : `${normalized}/`;
  return `${base}${withSlash}${query}${hash}`;
}

export function sitePath(path: string = "/"): string {
  if (!path || path === "/") {
    return "/";
  }

  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const beforeHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;

  if (!beforeHash || beforeHash === "/") {
    return `/${hash}`;
  }

  const normalized = beforeHash.startsWith("/") ? beforeHash : `/${beforeHash}`;
  if (isFileEndpoint(normalized) || normalized.startsWith("/_astro/")) {
    return `${stripTrailingSlash(normalized)}${hash}`;
  }
  const withSlash = normalized.endsWith("/") ? normalized : `${normalized}/`;
  return `${withSlash}${hash}`;
}

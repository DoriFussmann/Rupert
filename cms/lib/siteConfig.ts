import fs from "node:fs";
import { SITE_CONFIG_PATH } from "./paths.js";

export interface SiteIdentity {
  SITE_URL: string;
  SITE_NAME: string;
  SAME_AS: string[];
  CONTACT_EMAIL: string;
}

function extractStringConst(source: string, name: string): string {
  const re = new RegExp(
    `export\\s+const\\s+${name}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`,
  );
  const match = source.match(re);
  if (!match) {
    throw new Error(`Could not parse ${name} from site config.`);
  }
  return match[1];
}

function extractStringArrayConst(source: string, name: string): string[] {
  const re = new RegExp(
    `export\\s+const\\s+${name}\\s*:\\s*string\\[\\]\\s*=\\s*\\[([\\s\\S]*?)\\]`,
  );
  const match = source.match(re);
  if (!match) {
    throw new Error(`Could not parse ${name} from site config.`);
  }
  const urls: string[] = [];
  for (const m of match[1].matchAll(/["'`]([^"'`]+)["'`]/g)) {
    urls.push(m[1]);
  }
  return urls;
}

export function readSiteIdentity(): SiteIdentity {
  const source = fs.readFileSync(SITE_CONFIG_PATH, "utf8");
  const SITE_URL = extractStringConst(source, "SITE_URL");
  const SITE_NAME = extractStringConst(source, "SITE_NAME");
  const SAME_AS = extractStringArrayConst(source, "SAME_AS");
  const CONTACT_EMAIL = extractStringConst(source, "CONTACT_EMAIL");
  return { SITE_URL, SITE_NAME, SAME_AS, CONTACT_EMAIL };
}

export function absoluteUrl(path: string, siteUrl?: string): string {
  const base = (siteUrl ?? readSiteIdentity().SITE_URL).replace(/\/+$/, "");
  if (!path || path === "/") return `${base}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (/\.[a-z0-9]+$/i.test(normalized.split("/").pop() ?? "")) {
    return `${base}${normalized.replace(/\/+$/, "")}`;
  }
  return normalized.endsWith("/")
    ? `${base}${normalized}`
    : `${base}${normalized}/`;
}

export function siteHostname(siteUrl?: string): string {
  try {
    return new URL(siteUrl ?? readSiteIdentity().SITE_URL).hostname;
  } catch {
    return "example.com";
  }
}

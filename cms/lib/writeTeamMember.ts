import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { TEAM_DIR, TEAM_ASSETS_DIR } from "./paths.js";
import type { TeamFrontmatter } from "./schema.js";

function extFromName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return ext || ".jpg";
}

export function writeTeamMember(options: {
  data: TeamFrontmatter;
  photoStaged?: { stagedPath: string; originalName: string };
  overwrite?: boolean;
}): { slug: string; path: string } {
  const { data } = options;
  const slug = data.slug?.trim();
  if (!slug) throw new Error("slug is required");
  if (!data.name?.trim()) throw new Error("name is required");
  if (!data.role?.trim()) throw new Error("role is required");
  if (!data.bio?.trim()) throw new Error("bio is required");

  fs.mkdirSync(TEAM_DIR, { recursive: true });
  const outPath = path.join(TEAM_DIR, `${slug}.md`);
  if (fs.existsSync(outPath) && !options.overwrite) {
    throw new Error(
      `Team member "${slug}" already exists. Pass overwrite=true or choose a new slug.`,
    );
  }

  let photoRel = data.photo;
  if (options.photoStaged) {
    const assetDir = path.join(TEAM_ASSETS_DIR, slug);
    fs.mkdirSync(assetDir, { recursive: true });
    const name = `photo${extFromName(options.photoStaged.originalName)}`;
    fs.copyFileSync(
      options.photoStaged.stagedPath,
      path.join(assetDir, name),
    );
    photoRel = `../../assets/team/${slug}/${name}`;
  }

  if (!photoRel) {
    throw new Error("photo is required (upload a file or provide a path)");
  }

  const fm: Record<string, unknown> = {
    name: data.name.trim(),
    slug,
    role: data.role.trim(),
    bio: data.bio.trim(),
    photo: photoRel,
    sameAs: Array.isArray(data.sameAs)
      ? data.sameAs.filter((u) => typeof u === "string" && u.trim())
      : [],
  };
  if (data.credentials?.trim()) {
    fm.credentials = data.credentials.trim();
  }

  const yaml = YAML.stringify(fm, { lineWidth: 0 }).trimEnd();
  fs.writeFileSync(outPath, `---\n${yaml}\n---\n`, "utf8");
  return { slug, path: outPath };
}

export function listTeam(): Array<TeamFrontmatter & { path: string }> {
  if (!fs.existsSync(TEAM_DIR)) return [];
  return fs
    .readdirSync(TEAM_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const full = path.join(TEAM_DIR, file);
      const parsed = matter(fs.readFileSync(full, "utf8"));
      const data = parsed.data as TeamFrontmatter;
      return { ...data, slug: data.slug || file.replace(/\.md$/, ""), path: full };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function readTeamMember(slug: string): TeamFrontmatter & { path: string } {
  const full = path.join(TEAM_DIR, `${slug}.md`);
  if (!fs.existsSync(full)) {
    throw new Error(`Team member not found: ${slug}`);
  }
  const parsed = matter(fs.readFileSync(full, "utf8"));
  return { ...(parsed.data as TeamFrontmatter), path: full };
}

export function deleteTeamMember(slug: string): void {
  const full = path.join(TEAM_DIR, `${slug}.md`);
  if (fs.existsSync(full)) fs.unlinkSync(full);
  const assetDir = path.join(TEAM_ASSETS_DIR, slug);
  if (fs.existsSync(assetDir)) {
    fs.rmSync(assetDir, { recursive: true, force: true });
  }
}

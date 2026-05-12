import { Router } from "express";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { METHODOLOGIES_ROOT } from "../services/claude-spawn";

export const methodologyRoutes = Router();

interface MethodologyMeta {
  id: string;       // e.g. "analysis/wyckoff"
  label: string;
  category: string;
  summary: string;
  path: string;     // relative path under skills/, e.g. "analysis/wyckoff.md"
}

interface MethodologyFile extends MethodologyMeta {
  body: string;
}

const ID_RE = /^[a-z0-9_-]+\/[a-z0-9_-]+$/;

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  if (!raw.startsWith("---")) return { meta: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: raw };
  const fmBlock = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\r?\n/, "");
  const meta: Record<string, string> = {};
  for (const line of fmBlock.split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    meta[m[1]] = m[2].trim();
  }
  return { meta, body };
}

function readMethodology(filePath: string, id: string): MethodologyFile | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const { meta, body } = parseFrontmatter(raw);
    if (!meta.label || !meta.category) return null;
    return {
      id: meta.id || id,
      label: meta.label,
      category: meta.category,
      summary: meta.summary || "",
      path: `${id}.md`,
      body,
    };
  } catch {
    return null;
  }
}

function listMethodologies(): MethodologyMeta[] {
  if (!existsSync(METHODOLOGIES_ROOT)) return [];
  const out: MethodologyMeta[] = [];
  for (const category of readdirSync(METHODOLOGIES_ROOT)) {
    const categoryDir = path.join(METHODOLOGIES_ROOT, category);
    if (!statSync(categoryDir).isDirectory()) continue;
    for (const file of readdirSync(categoryDir)) {
      if (!file.endsWith(".md")) continue;
      const slug = file.replace(/\.md$/, "");
      const id = `${category}/${slug}`;
      const m = readMethodology(path.join(categoryDir, file), id);
      if (!m) continue;
      const { body: _, ...meta } = m;
      void _;
      out.push(meta);
    }
  }
  return out.sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));
}

// GET /api/methodologies — list all available methodology skills
methodologyRoutes.get("/", (_req, res) => {
  res.json(listMethodologies());
});

// GET /api/methodologies/:category/:slug — fetch the full body of one methodology
methodologyRoutes.get("/:category/:slug", (req, res) => {
  const id = `${req.params.category}/${req.params.slug}`;
  if (!ID_RE.test(id)) {
    res.status(400).json({ error: "Invalid methodology id" });
    return;
  }
  const filePath = path.join(METHODOLOGIES_ROOT, `${id}.md`);
  if (!existsSync(filePath)) {
    res.status(404).json({ error: "Methodology not found" });
    return;
  }
  const m = readMethodology(filePath, id);
  if (!m) {
    res.status(500).json({ error: "Failed to read methodology" });
    return;
  }
  res.json(m);
});

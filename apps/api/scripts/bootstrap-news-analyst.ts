/**
 * Push the news-analyst.md prompt into the News Analyst agent.
 *
 * Mirrors bootstrap-team-lead.ts. Use after editing
 * apps/api/scripts/prompts/news-analyst.md to push to the live agent.
 *
 * Run from muxai/apps/api with the API process running:
 *     pnpm tsx scripts/bootstrap-news-analyst.ts
 *     pnpm tsx scripts/bootstrap-news-analyst.ts --dry-run
 *
 * Idempotent.
 */

import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const EMBEDDED_URL = "postgresql://muxai:muxai@localhost:5433/muxai";
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === "embedded") {
  process.env.DATABASE_URL = EMBEDDED_URL;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma } = require("../src/lib/db") as typeof import("../src/lib/db");

const DRY_RUN = process.argv.includes("--dry-run");
const AGENT_NAME = process.env.NA_AGENT_NAME ?? "News Analyst";
const PROMPT_PATH = path.join(__dirname, "prompts", "news-analyst.md");

function logTag(): string {
  return DRY_RUN ? "[dry-run]" : "[write]";
}

async function main() {
  console.log("-".repeat(60));
  console.log(`News Analyst prompt bootstrap  ${DRY_RUN ? "(DRY RUN)" : ""}`);
  console.log("-".repeat(60));

  const promptTemplate = readFileSync(PROMPT_PATH, "utf-8");
  console.log(`${logTag()} Read prompt from ${PROMPT_PATH} (${promptTemplate.length} chars, ${promptTemplate.split(/\s+/).filter(Boolean).length} words).`);

  const agents = await prisma.agent.findMany({
    where: { name: AGENT_NAME },
    select: { id: true, name: true, role: true, adapterConfig: true },
  });
  if (agents.length === 0) throw new Error(`No agent named "${AGENT_NAME}".`);
  if (agents.length > 1) throw new Error(`${agents.length} agents named "${AGENT_NAME}" — disambiguate or set NA_AGENT_NAME.`);

  const [agent] = agents;
  const prev = (agent.adapterConfig as Record<string, unknown>) ?? {};
  const merged = { ...prev, promptTemplate };

  const before = (prev.promptTemplate as string) ?? "";
  const changed = before !== promptTemplate;
  console.log(`${logTag()} Target: id=${agent.id} role="${agent.role}"`);
  console.log(`${logTag()} promptTemplate ${changed ? "CHANGE" : "same"}  (before=${before.length}c / ${before.split(/\s+/).filter(Boolean).length}w, after=${promptTemplate.length}c / ${promptTemplate.split(/\s+/).filter(Boolean).length}w)`);

  if (DRY_RUN) {
    console.log(`${logTag()} Would update adapterConfig.promptTemplate. Re-run without --dry-run.`);
    return;
  }

  await prisma.agent.update({
    where: { id: agent.id },
    data: { adapterConfig: merged },
  });
  console.log(`${logTag()} Updated agent id=${agent.id}.`);
  console.log("-".repeat(60));
  console.log("Done. Next News Analyst invocation will use the new prompt.");
  console.log("-".repeat(60));
}

main()
  .catch((err) => {
    console.error("[bootstrap-news-analyst] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

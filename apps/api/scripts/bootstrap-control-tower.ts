/**
 * Push the control-tower.md prompt into the Control Tower agent.
 *
 * Mirrors bootstrap-team-lead.ts / bootstrap-news-analyst.ts. The Control
 * Tower agent is hidden from the standard /api/agents listing (admin
 * singleton), so this script targets by role=control_tower directly.
 *
 * Run from muxai/apps/api with the API process running:
 *     pnpm tsx scripts/bootstrap-control-tower.ts
 *     pnpm tsx scripts/bootstrap-control-tower.ts --dry-run
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
const PROMPT_PATH = path.join(__dirname, "prompts", "control-tower.md");

function logTag(): string {
  return DRY_RUN ? "[dry-run]" : "[write]";
}

async function main() {
  console.log("-".repeat(60));
  console.log(`Control Tower prompt bootstrap  ${DRY_RUN ? "(DRY RUN)" : ""}`);
  console.log("-".repeat(60));

  const promptTemplate = readFileSync(PROMPT_PATH, "utf-8");
  const wc = promptTemplate.split(/\s+/).filter(Boolean).length;
  console.log(`${logTag()} Read prompt from ${PROMPT_PATH} (${promptTemplate.length} chars, ${wc} words).`);

  const agents = await prisma.agent.findMany({
    where: { role: "control_tower" },
    select: { id: true, name: true, role: true, adapterConfig: true },
  });
  if (agents.length === 0) throw new Error(`No agent with role="control_tower" found.`);
  if (agents.length > 1) throw new Error(`${agents.length} agents with role="control_tower" — disambiguate manually.`);

  const [agent] = agents;
  const prev = (agent.adapterConfig as Record<string, unknown>) ?? {};
  const merged = { ...prev, promptTemplate };

  const before = (prev.promptTemplate as string) ?? "";
  const changed = before !== promptTemplate;
  console.log(`${logTag()} Target: id=${agent.id} name="${agent.name}"`);
  console.log(`${logTag()} promptTemplate ${changed ? "CHANGE" : "same"}  (before=${before.length}c, after=${promptTemplate.length}c)`);

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
  console.log("Done. Next Control Tower invocation (any Telegram message) will use the new prompt.");
  console.log("-".repeat(60));
}

main()
  .catch((err) => {
    console.error("[bootstrap-control-tower] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

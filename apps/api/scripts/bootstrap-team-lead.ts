/**
 * Push the team-lead.md prompt into the Team Lead agent's adapterConfig.
 *
 * Mirrors bootstrap-trading-desk.ts but for the Team Lead. Use this when
 * you've edited apps/api/scripts/prompts/team-lead.md and want the live
 * agent to pick it up on its next invocation.
 *
 * Run from muxai/apps/api with the API process running:
 *     pnpm tsx scripts/bootstrap-team-lead.ts
 *     pnpm tsx scripts/bootstrap-team-lead.ts --dry-run
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
const AGENT_NAME = process.env.TL_AGENT_NAME ?? "Team Lead";
const PROMPT_PATH = path.join(__dirname, "prompts", "team-lead.md");

function logTag(): string {
  return DRY_RUN ? "[dry-run]" : "[write]";
}

async function main() {
  console.log("─".repeat(60));
  console.log(`Team Lead prompt bootstrap  ${DRY_RUN ? "(DRY RUN)" : ""}`);
  console.log("─".repeat(60));

  const promptTemplate = readFileSync(PROMPT_PATH, "utf-8");
  console.log(`${logTag()} Read prompt from ${PROMPT_PATH} (${promptTemplate.length} chars).`);

  const agents = await prisma.agent.findMany({
    where: { name: AGENT_NAME },
    select: { id: true, name: true, role: true, adapterConfig: true },
  });
  if (agents.length === 0) throw new Error(`No agent named "${AGENT_NAME}".`);
  if (agents.length > 1) throw new Error(`${agents.length} agents named "${AGENT_NAME}" — disambiguate or set TL_AGENT_NAME.`);

  const [agent] = agents;
  const prev = (agent.adapterConfig as Record<string, unknown>) ?? {};
  const merged = { ...prev, promptTemplate };

  const before = (prev.promptTemplate as string) ?? "";
  const changed = before !== promptTemplate;
  console.log(`${logTag()} Target: id=${agent.id} role="${agent.role}"`);
  console.log(`${logTag()} promptTemplate ${changed ? "CHANGE" : "same"}  (before=${before.length} chars, after=${promptTemplate.length} chars)`);

  if (DRY_RUN) {
    console.log(`${logTag()} Would update adapterConfig.promptTemplate. Re-run without --dry-run.`);
    return;
  }

  await prisma.agent.update({
    where: { id: agent.id },
    data: { adapterConfig: merged },
  });
  console.log(`${logTag()} Updated agent id=${agent.id}.`);
  console.log("─".repeat(60));
  console.log("Done. Next Team Lead invocation will use the new prompt.");
  console.log("─".repeat(60));
}

main()
  .catch((err) => {
    console.error("[bootstrap-team-lead] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

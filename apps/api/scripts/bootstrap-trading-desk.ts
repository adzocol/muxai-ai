/**
 * One-shot bootstrap: clean up the duplicate TradingView McpServer DB row
 * (now superseded by the registry entry in config/mcp-registry.json) and
 * update the Technical Analyst agent with the SMC system prompt + Phase 0
 * default invocation prompt.
 *
 * The API process must be RUNNING (so embedded Postgres is up on port 5433).
 * Run from muxai/apps/api:
 *     pnpm tsx scripts/bootstrap-trading-desk.ts             # write
 *     pnpm tsx scripts/bootstrap-trading-desk.ts --dry-run   # preview, no writes
 *
 * Safe to re-run. Idempotent.
 */

import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";

// tsx runs this file as CommonJS (apps/api has module:Node16, no
// "type":"module" in package.json), so __dirname is available natively
// and top-level await is not. Keep the env mutation before the lazy
// require() of lib/db so the prisma proxy captures the right URL.

// muxAI .env lives at the muxai/ repo root; mirror apps/api/src/env.ts
// (which resolves "../../../.env" from src/).
loadEnv({ path: path.resolve(__dirname, "../../../.env") });

// muxAI's lib/db.ts reads DATABASE_URL on first prisma access. In embedded
// mode the .env value is the literal string "embedded", which the API's
// startDatabase() rewrites to the embedded-postgres URL on boot. Standalone
// scripts must do the same rewrite BEFORE importing prisma.
const EMBEDDED_URL = "postgresql://muxai:muxai@localhost:5433/muxai";
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === "embedded") {
  process.env.DATABASE_URL = EMBEDDED_URL;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma } = require("../src/lib/db") as typeof import("../src/lib/db");

const DRY_RUN = process.argv.includes("--dry-run");
const KEEP_MODEL = process.argv.includes("--keep-model");
const AGENT_NAME = process.env.TA_AGENT_NAME ?? "Technical Analyst";
const TA_MODEL = "claude-sonnet-4-6";
const DEFAULT_INVOCATION_PROMPT =
  "Analyse XAUUSD across D1, 4H, 1H, 15M using Smart Money Concepts.";

const PROMPT_PATH = path.join(__dirname, "prompts", "technical-analyst.md");

function logTag(): string {
  return DRY_RUN ? "[dry-run]" : "[write]";
}

async function handleTradingviewMcpRow() {
  const existing = await prisma.mcpServer.findUnique({ where: { name: "tradingview" } });
  if (!existing) {
    console.log(`${logTag()} [mcp] No McpServer DB row named 'tradingview' — nothing to delete.`);
    return;
  }
  console.log(`${logTag()} [mcp] Found McpServer DB row:`);
  console.log(`            id=${existing.id}`);
  console.log(`            label=${existing.label}`);
  console.log(`            command=${existing.command}`);
  console.log(`            args=${JSON.stringify(existing.args)}`);
  if (DRY_RUN) {
    console.log(`${logTag()} [mcp] WOULD delete this row (registry entry is authoritative).`);
    return;
  }
  await prisma.mcpServer.delete({ where: { name: "tradingview" } });
  console.log(`${logTag()} [mcp] Deleted McpServer DB row id=${existing.id}.`);
}

async function handleTechnicalAnalystPrompt() {
  const promptTemplate = readFileSync(PROMPT_PATH, "utf-8");
  console.log(`${logTag()} [ta] Read prompt template from ${PROMPT_PATH} (${promptTemplate.length} chars).`);

  const agents = await prisma.agent.findMany({
    where: { name: AGENT_NAME },
    select: { id: true, name: true, role: true, adapterConfig: true },
  });

  if (agents.length === 0) {
    throw new Error(
      `No agent named "${AGENT_NAME}" found. Create it via the muxAI UI first, or set TA_AGENT_NAME env var to the agent's exact name.`,
    );
  }
  if (agents.length > 1) {
    throw new Error(
      `${agents.length} agents named "${AGENT_NAME}". Disambiguate via the UI (rename one) or pass TA_AGENT_NAME.`,
    );
  }

  const [agent] = agents;
  const prev = (agent.adapterConfig as Record<string, unknown>) ?? {};
  const merged: Record<string, unknown> = {
    ...prev,
    promptTemplate,
    defaultPrompt: DEFAULT_INVOCATION_PROMPT,
  };
  if (!KEEP_MODEL) {
    merged.model = TA_MODEL;
  }

  console.log(`${logTag()} [ta] Target agent: id=${agent.id} name="${agent.name}" role="${agent.role}"`);
  console.log(`${logTag()} [ta] Current adapterConfig keys: ${Object.keys(prev).join(", ") || "(none)"}`);
  console.log(`${logTag()} [ta] Model handling: ${KEEP_MODEL ? "PRESERVE existing (--keep-model)" : `set to "${TA_MODEL}"`}`);
  console.log(`${logTag()} [ta] Field-level diff:`);

  const diffKeys = KEEP_MODEL
    ? (["promptTemplate", "defaultPrompt"] as const)
    : (["promptTemplate", "defaultPrompt", "model"] as const);
  for (const key of diffKeys) {
    const before = prev[key];
    const after = (merged as Record<string, unknown>)[key];
    const beforeStr = typeof before === "string" ? `${before.slice(0, 80)}${before.length > 80 ? "…" : ""}` : JSON.stringify(before);
    const afterStr = typeof after === "string" ? `${after.slice(0, 80)}${after.length > 80 ? "…" : ""}` : JSON.stringify(after);
    const changed = JSON.stringify(before) !== JSON.stringify(after);
    console.log(`            - ${key} (${changed ? "CHANGE" : "same"})`);
    console.log(`                 before: ${beforeStr ?? "(unset)"}`);
    console.log(`                 after:  ${afterStr}`);
  }

  if (DRY_RUN) {
    console.log(`${logTag()} [ta] WOULD update adapterConfig with the three fields above.`);
    return;
  }

  await prisma.agent.update({
    where: { id: agent.id },
    data: { adapterConfig: merged },
  });
  console.log(`${logTag()} [ta] Updated agent id=${agent.id}.`);
}

async function main() {
  console.log("─".repeat(60));
  console.log(`Trading desk bootstrap — Phase 0  ${DRY_RUN ? "(DRY RUN — no writes)" : "(WRITE MODE)"}${KEEP_MODEL ? "  [--keep-model]" : ""}`);
  console.log(`DATABASE_URL=${process.env.DATABASE_URL}`);
  console.log("─".repeat(60));

  await handleTradingviewMcpRow();
  console.log("");
  await handleTechnicalAnalystPrompt();

  console.log("─".repeat(60));
  if (DRY_RUN) {
    console.log("Dry run complete. Re-run without --dry-run to apply.");
  } else {
    console.log("Done. Restart the API, then invoke the Technical Analyst agent.");
  }
  console.log("─".repeat(60));
}

main()
  .catch((err) => {
    console.error("[bootstrap] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

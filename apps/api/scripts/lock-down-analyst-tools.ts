/**
 * Lock down News Analyst + Data Analyst tool access.
 *
 * Symptom: when Team Lead invokes run_team, every reporter runs in
 * parallel. News and Data analysts have unrestricted access to
 * tradingview MCP tools, so they all hammer the live chart at the
 * same time as the Technical Analyst — causing CDP races, OHLCV
 * payload bloat (they call summary=false), and "unknown error"
 * crashes for everyone.
 *
 * Fix: append every tradingview MCP tool to each non-TA analyst's
 * disallowedTools string, and bump their maxTurnsPerRun so they
 * have headroom for the legitimate work they do (news/events).
 *
 * Run from muxai/apps/api with the API running:
 *     pnpm tsx scripts/lock-down-analyst-tools.ts
 *     pnpm tsx scripts/lock-down-analyst-tools.ts --dry-run
 */

import { config as loadEnv } from "dotenv";
import { readFileSync } from "fs";
import path from "path";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const EMBEDDED_URL = "postgresql://muxai:muxai@localhost:5433/muxai";
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === "embedded") {
  process.env.DATABASE_URL = EMBEDDED_URL;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma } = require("../src/lib/db") as typeof import("../src/lib/db");

const DRY_RUN = process.argv.includes("--dry-run");
const TARGET_NAMES = ["News Analyst", "Data Analyst"];
const TARGET_MAX_TURNS = 25;

function logTag(): string {
  return DRY_RUN ? "[dry-run]" : "[lock-down]";
}

function loadTradingViewToolNames(): string[] {
  const registryPath = path.join(__dirname, "..", "..", "..", "config", "mcp-registry.json");
  const registry = JSON.parse(readFileSync(registryPath, "utf-8")) as Array<{
    id: string;
    tools?: Array<{ fullName?: string; name?: string }>;
  }>;
  const tv = registry.find((s) => s.id === "tradingview");
  if (!tv || !tv.tools) {
    throw new Error(`tradingview entry not found in mcp-registry.json`);
  }
  // fullName is the canonical Claude tool name format: mcp__tradingview__chart_set_symbol etc.
  return tv.tools
    .map((t) => t.fullName)
    .filter((n): n is string => typeof n === "string" && n.length > 0);
}

async function main() {
  console.log("─".repeat(60));
  console.log(`Lock-down analyst tools  ${DRY_RUN ? "(DRY RUN)" : ""}`);
  console.log("─".repeat(60));

  const tvTools = loadTradingViewToolNames();
  console.log(`Loaded ${tvTools.length} tradingview tool names from registry.`);

  for (const name of TARGET_NAMES) {
    const agents = await prisma.agent.findMany({
      where: { name },
      select: { id: true, name: true, adapterConfig: true },
    });
    if (agents.length === 0) {
      console.warn(`${logTag()} No agent named "${name}" — skipping.`);
      continue;
    }
    if (agents.length > 1) {
      console.warn(`${logTag()} Multiple agents named "${name}" — skipping (disambiguate manually).`);
      continue;
    }
    const [agent] = agents;
    const cfg = (agent.adapterConfig as Record<string, unknown>) ?? {};
    const existing = (cfg.disallowedTools as string | undefined) ?? "";
    const existingSet = new Set(
      existing.split(",").map((s) => s.trim()).filter(Boolean),
    );

    let added = 0;
    for (const t of tvTools) {
      if (!existingSet.has(t)) {
        existingSet.add(t);
        added++;
      }
    }
    const newDisallowed = [...existingSet].join(",");
    const newMaxTurns = TARGET_MAX_TURNS;
    const oldMaxTurns = (cfg.maxTurnsPerRun as number | undefined) ?? "(unset)";

    console.log(`\n${logTag()} ${name}:`);
    console.log(`  added ${added} tradingview tool(s) to disallowedTools (total now ${existingSet.size})`);
    console.log(`  maxTurnsPerRun: ${oldMaxTurns} → ${newMaxTurns}`);

    if (DRY_RUN) {
      continue;
    }
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        adapterConfig: {
          ...cfg,
          disallowedTools: newDisallowed,
          maxTurnsPerRun: newMaxTurns,
        },
      },
    });
    // Reset status to idle as a side-effect — if the agent was stuck
    // in error from the prior run, this gets it back online.
    await prisma.agent.update({
      where: { id: agent.id },
      data: { status: "idle" },
    });
    console.log(`  ${logTag()} updated agent id=${agent.id} + status reset to idle.`);
  }

  console.log("─".repeat(60));
  console.log(DRY_RUN ? "Dry run complete." : "Done. Re-invoke the Team Lead — the analysts can no longer touch tradingview MCP.");
  console.log("─".repeat(60));
}

main()
  .catch((err) => {
    console.error("[lock-down] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

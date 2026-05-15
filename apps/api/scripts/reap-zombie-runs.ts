/**
 * Reap zombie runs and reset agent status.
 *
 * When the API process dies mid-run (Windows reboot, manual kill, dev
 * restart) the spawned child claude processes are orphaned. The DB still
 * shows status=running for both the HeartbeatRun and the Agent, which
 * blocks any new invocation because muxAI refuses to start a second run
 * on an already-running agent.
 *
 * This script finds any HeartbeatRun whose status=running but whose
 * startedAt is older than --max-age-min (default 15min) and:
 *   1. Marks the run failed with errorMsg "orphaned (api restart)"
 *   2. Resets the owning agent's status to idle
 *
 * Run from muxai/apps/api with the new API running:
 *     pnpm tsx scripts/reap-zombie-runs.ts
 *     pnpm tsx scripts/reap-zombie-runs.ts --max-age-min 30
 *     pnpm tsx scripts/reap-zombie-runs.ts --dry-run
 */

import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const EMBEDDED_URL = "postgresql://muxai:muxai@localhost:5433/muxai";
if (!process.env.DATABASE_URL || process.env.DATABASE_URL === "embedded") {
  process.env.DATABASE_URL = EMBEDDED_URL;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prisma } = require("../src/lib/db") as typeof import("../src/lib/db");

const DRY_RUN = process.argv.includes("--dry-run");
const maxAgeIdx = process.argv.indexOf("--max-age-min");
const MAX_AGE_MIN = maxAgeIdx >= 0 ? Number(process.argv[maxAgeIdx + 1]) : 15;

function logTag(): string {
  return DRY_RUN ? "[dry-run]" : "[reap]";
}

async function main() {
  console.log("─".repeat(60));
  console.log(`Zombie reaper  ${DRY_RUN ? "(DRY RUN)" : ""}  cutoff=${MAX_AGE_MIN}min`);
  console.log("─".repeat(60));

  const cutoff = new Date(Date.now() - MAX_AGE_MIN * 60_000);

  const zombies = await prisma.heartbeatRun.findMany({
    where: { status: "running", startedAt: { lt: cutoff } },
    select: { id: true, agentId: true, startedAt: true, agent: { select: { name: true, status: true } } },
    orderBy: { startedAt: "asc" },
  });

  if (zombies.length === 0) {
    console.log(`${logTag()} No running runs older than ${MAX_AGE_MIN}min. Nothing to reap.`);
    return;
  }

  console.log(`${logTag()} Found ${zombies.length} zombie run(s):`);
  for (const z of zombies) {
    const ageMin = Math.round((Date.now() - z.startedAt!.getTime()) / 60_000);
    console.log(`            run ${z.id.slice(0, 8)} · agent="${z.agent.name}" (status=${z.agent.status}) · started ${ageMin}min ago`);
  }

  if (DRY_RUN) {
    console.log(`${logTag()} Would mark each run as failed + reset agent status to idle. Re-run without --dry-run to apply.`);
    return;
  }

  for (const z of zombies) {
    await prisma.heartbeatRun.update({
      where: { id: z.id },
      data: {
        status: "failed",
        errorMsg: "orphaned (api restart) — reaped by reap-zombie-runs.ts",
        finishedAt: new Date(),
        exitCode: -1,
      },
    });
    if (z.agent.status === "running") {
      await prisma.agent.update({
        where: { id: z.agentId },
        data: { status: "idle" },
      });
    }
    console.log(`${logTag()} Reaped run ${z.id.slice(0, 8)} · reset agent "${z.agent.name}" → idle`);
  }

  console.log("─".repeat(60));
  console.log("Done.");
  console.log("─".repeat(60));
}

main()
  .catch((err) => {
    console.error("[reap] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

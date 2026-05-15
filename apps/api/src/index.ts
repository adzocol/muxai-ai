import "./env";
import express from "express";
import cors from "cors";
import { startDatabase } from "./services/database";
import { prisma } from "./lib/db";
import { agentRoutes } from "./routes/agents";
import { controlTowerRoutes } from "./routes/control-tower";
import { runRoutes } from "./routes/runs";
import { mcpServerRoutes } from "./routes/mcp-servers";
import { sandboxRoutes } from "./routes/sandbox";
import { roleRoutes } from "./routes/roles";
import { contractorRoutes } from "./routes/contractors";
import { chatRoutes } from "./routes/chat";
import { settingsRoutes } from "./routes/settings";
import { teamRoutes } from "./routes/teams";
import { schedulerRoutes } from "./routes/schedulers";
import { candleRoutes } from "./routes/candles";
import { eventRoutes } from "./routes/events";
import { initScheduler } from "./services/scheduler";
import { initTelegramGatewayOnBoot } from "./services/gateways/telegram";
import { initTradeResolver } from "./services/trade-resolver-tick";
import { initEventsCollector } from "./services/events-collector";
import "./services/adapters"; // Register all adapter types (claude_local, etc.)
import { onGlobalLog } from "./services/run-events";
import { apiKeyAuth } from "./middleware/auth";

const DEFAULT_ROLES = [
  { name: "general", description: "General-purpose agent" },
  { name: "analyst", description: "Data or market analyst" },
  { name: "news-analyst", description: "Monitors and summarises news" },
  { name: "technical-analyst", description: "Chart and technical analysis" },
  { name: "researcher", description: "Deep research and information gathering" },
  { name: "engineer", description: "Software engineering tasks" },
  { name: "ceo", description: "High-level strategy and orchestration" },
  { name: "cto", description: "Technical strategy and architecture" },
];

const DEFAULT_SETTINGS: Record<string, string> = {
  solana_network: "devnet",
  solana_rpc_url: "https://api.devnet.solana.com",
  base_network: "mainnet",
  base_rpc_url: "https://mainnet.base.org",
};

async function seedDefaultSettings() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}

async function seedDefaultRoles() {
  const count = await prisma.agentRole.count();
  if (count > 0) return;
  await prisma.agentRole.createMany({ data: DEFAULT_ROLES, skipDuplicates: true });
  console.log("Seeded default agent roles");
}

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(apiKeyAuth);

app.use("/api/agents", agentRoutes);
app.use("/api/control-tower", controlTowerRoutes);
app.use("/api/runs", runRoutes);
app.use("/api/mcp-servers", mcpServerRoutes);
app.use("/api/sandbox", sandboxRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/contractors", contractorRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/schedulers", schedulerRoutes);
app.use("/api/candles", candleRoutes);
app.use("/api/events", eventRoutes);

// GET /api/logs/stream — global SSE stream for all agent activity
app.get("/api/logs/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const unsubscribe = onGlobalLog((event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      unsubscribe();
    }
  });

  req.on("close", () => unsubscribe());
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

async function cleanupStaleRuns() {
  const result = await prisma.heartbeatRun.updateMany({
    where: { status: { in: ["running", "queued"] } },
    data: {
      status: "failed",
      finishedAt: new Date(),
      exitCode: -1,
      errorMsg: "Marked failed on startup — process died without cleanup",
    },
  });
  if (result.count > 0) {
    console.log(`[muxai] Cleaned up ${result.count} stale run(s) from previous session`);
  }
  // Reset agents back to idle — they're spawnable again immediately. Prior
  // behaviour set them to "error" which required manual UI intervention to
  // recover. The stale-run record above already preserves the failure for
  // audit; the agent itself isn't broken.
  const agents = await prisma.agent.updateMany({
    where: { status: "running" },
    data: { status: "idle" },
  });
  if (agents.count > 0) {
    console.log(`[muxai] Reset ${agents.count} agent(s) from running → idle`);
  }

  // Sweep any temp files left behind by claude-local adapter spawns from
  // prior sessions. File names match `muxai-*.tmp` in OS tmpdir.
  try {
    const fs = await import("fs");
    const os = await import("os");
    const path = await import("path");
    const tmpDir = os.tmpdir();
    const files = fs.readdirSync(tmpDir);
    let unlinked = 0;
    for (const f of files) {
      if (f.startsWith("muxai-") && f.endsWith(".tmp")) {
        try {
          fs.unlinkSync(path.join(tmpDir, f));
          unlinked++;
        } catch { /* ignore */ }
      }
    }
    if (unlinked > 0) {
      console.log(`[muxai] Unlinked ${unlinked} stale temp file(s) from prior spawns`);
    }
  } catch (err) {
    console.warn(`[muxai] Temp-file sweep failed (non-fatal):`, err instanceof Error ? err.message : err);
  }
}

async function main() {
  await startDatabase();
  app.listen(PORT, async () => {
    console.log(`muxai API running on http://localhost:${PORT}`);
    await cleanupStaleRuns();
    await seedDefaultSettings();
    await seedDefaultRoles();
    await initScheduler();
    await initTelegramGatewayOnBoot();
    initTradeResolver();
    initEventsCollector();
  });
}

main().catch((err) => {
  console.error("[muxai] Fatal startup error:", err instanceof Error ? err.message : err);
  process.exit(1);
});

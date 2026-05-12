"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { Agent } from "@/lib/types";

interface MethodologyMeta {
  id: string;
  label: string;
  category: string;
  summary: string;
  path: string;
}

interface MethodologyFile extends MethodologyMeta {
  body: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  analysis: "Analysis",
  risk: "Risk",
  governance: "Governance",
};

const CATEGORY_COLORS: Record<string, string> = {
  analysis: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  risk: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  governance: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

const ROLE_COLORS: Record<string, string> = {
  "ceo": "bg-violet-500/15 text-violet-400 border-violet-500/20",
  "news-analyst": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "technical-analyst": "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  "analyst": "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  "engineer": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "general": "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

function roleColor(role: string): string {
  return ROLE_COLORS[role] ?? "bg-slate-500/15 text-slate-400 border-slate-500/20";
}

export default function MethodologiesPage() {
  const [methodologies, setMethodologies] = useState<MethodologyMeta[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [bodies, setBodies] = useState<Record<string, MethodologyFile>>({});
  const [loadingBody, setLoadingBody] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch<MethodologyMeta[]>("/api/methodologies")
      .then(setMethodologies)
      .catch(() => setError("Failed to load methodologies"));
    apiFetch<Agent[]>("/api/agents")
      .then(setAgents)
      .catch(() => {});
  }, []);

  const agentsByMethodology = agents.reduce<Record<string, Agent[]>>((acc, a) => {
    const skill = (a.adapterConfig as Record<string, unknown>)?.methodologySkill as string | undefined;
    if (!skill) return acc;
    (acc[skill] = acc[skill] || []).push(a);
    return acc;
  }, {});

  async function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    if (!bodies[id] && !loadingBody.has(id)) {
      setLoadingBody((prev) => new Set(prev).add(id));
      try {
        const file = await apiFetch<MethodologyFile>(`/api/methodologies/${id}`);
        setBodies((prev) => ({ ...prev, [id]: file }));
      } catch {
        // surface inside the card
      } finally {
        setLoadingBody((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!methodologies) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const grouped = methodologies.reduce<Record<string, MethodologyMeta[]>>((acc, m) => {
    (acc[m.category] = acc[m.category] || []).push(m);
    return acc;
  }, {});
  const categories = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
          <GraduationCap className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-xl font-semibold leading-none">Methodologies</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lenses an agent can wear. Assign one methodology to an agent on its edit page — same role + different methodology = different behavior.
          </p>
        </div>
      </div>

      {methodologies.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No methodologies found in <code className="font-mono text-xs">packages/methodology-skills/skills/</code>.
          </CardContent>
        </Card>
      ) : (
        categories.map((category) => (
          <div key={category} className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {CATEGORY_LABELS[category] ?? category}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grouped[category].map((m) => {
                const open = expanded.has(m.id);
                const body = bodies[m.id];
                const isLoading = loadingBody.has(m.id);
                const badgeClass = CATEGORY_COLORS[m.category] ?? "bg-muted text-muted-foreground border-border";
                const assigned = agentsByMethodology[m.id] ?? [];
                return (
                  <Card
                    key={m.id}
                    className={cn("cursor-pointer transition-colors", open ? "ring-1 ring-primary/30" : "")}
                    onClick={() => toggleExpand(m.id)}
                  >
                    <CardHeader className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-sm">{m.label}</CardTitle>
                          <CardDescription className="text-xs mt-0.5 line-clamp-2">{m.summary}</CardDescription>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className={cn("text-xs", badgeClass)}>
                            {CATEGORY_LABELS[m.category] ?? m.category}
                          </Badge>
                          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-3" onClick={(e) => e.stopPropagation()}>
                        {assigned.length === 0 ? (
                          <span className="text-[10px] text-muted-foreground italic">Not assigned to any agent</span>
                        ) : (
                          <>
                            <span className="text-[10px] text-muted-foreground mr-0.5">
                              {assigned.length} agent{assigned.length !== 1 ? "s" : ""}:
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              {assigned.map((a) => (
                                <Link
                                  key={a.id}
                                  href={`/agents/${a.id}`}
                                  title={`${a.name}${a.title ? ` — ${a.title}` : ""}`}
                                  className={cn(
                                    "flex h-6 w-6 items-center justify-center rounded border text-[10px] font-bold uppercase hover:opacity-80 transition-opacity",
                                    roleColor(a.role),
                                  )}
                                >
                                  {a.name.slice(0, 2)}
                                </Link>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </CardHeader>
                    {open && (
                      <CardContent className="px-4 pb-4 pt-0" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>id:</span>
                            <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{m.id}</code>
                          </div>
                          {isLoading && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Loading…
                            </div>
                          )}
                          {body && (
                            <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono p-3 rounded-md bg-muted max-h-96 overflow-y-auto">
                              {body.body}
                            </pre>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

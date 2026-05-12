import { AGENT_TEMPLATES, type AgentTemplate } from "./agent-templates";

export interface TeamBlueprintMember {
  templateId: string;
  role: "lead" | "reporter";
}

export interface TeamBlueprint {
  id: string;
  label: string;
  description: string;
  image?: string;
  members: TeamBlueprintMember[];
}

export function getTemplate(id: string): AgentTemplate | undefined {
  return AGENT_TEMPLATES.find((t) => t.id === id);
}

export const TEAM_BLUEPRINTS: TeamBlueprint[] = [
  {
    id: "trade-desk",
    label: "Trade Desk",
    description: "Crypto analysis team that synthesizes OHLCV indicators, funding rates, open interest, news sentiment, chart analysis, and the macro/event calendar into a structured trade decision.",
    image: "/trading_desk_team.jpg",
    members: [
      { templateId: "team-lead", role: "lead" },
      { templateId: "news-analyst", role: "reporter" },
      { templateId: "technical-analyst", role: "reporter" },
      { templateId: "data-analyst", role: "reporter" },
    ],
  },
  {
    id: "wyckoff-desk",
    label: "Wyckoff Desk",
    description: "Phase-driven trading team built around the Wyckoff method. A single Wyckoff Analyst replaces the separate technical and data analysts — reading price, volume, and Composite Operator footprint (funding, OI, positioning) as one integrated phase call, with the news analyst supplying catalyst context.",
    image: "/wyckoff_desk_team.jpg",
    members: [
      { templateId: "team-lead", role: "lead" },
      { templateId: "news-analyst", role: "reporter" },
      { templateId: "wyckoff-analyst", role: "reporter" },
    ],
  },
];

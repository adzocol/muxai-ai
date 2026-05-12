# Methodology Skills

A methodology skill is a single markdown file that teaches an agent **how to interpret what it sees**. It complements the agent's role (defined in SKILL.md) and tools (MCPs) — same role + different methodology = different behavior.

When an agent is assigned a methodology, the file is appended to its system prompt at spawn time via Claude Code's `--append-system-prompt-file` flag. One methodology per agent.

## File layout

```
packages/methodology-skills/skills/
├── analysis/         # Lenses for analyst / strategist agents
├── risk/             # Sizing & risk discipline for decision-makers (team leads)
└── governance/       # Council-level rules (e.g. confluence thresholds, event vetoes)
```

The sub-folder is a hint for browsing — agents can pick any methodology regardless of category.

## File format

Each methodology is a `.md` file with frontmatter:

```markdown
---
id: analysis/wyckoff
label: Wyckoff Method
category: analysis
summary: Phase-driven market analysis. Reads price action as Accumulation, Markup, Distribution, Markdown.
---

# <Methodology Name>

## What it is
One paragraph describing the lens.

## When to apply
Market regimes, timeframes, asset classes where this lens is most useful — and when it is not.

## How to interpret data through this lens
Concrete reading rules. For an analysis methodology: how to read OHLCV, indicators, volume, derivatives data. For a risk methodology: how to convert decisions into sized actions.

## Anti-patterns
What looks like this methodology but isn't. Common misreadings.

## Output for the council
The structured output the agent should add to its response so the team lead can synthesize across reporters.
```

## Frontmatter fields

| Field | Required | Notes |
|---|---|---|
| `id` | yes | `<category>/<slug>` — must match the file path under `skills/` |
| `label` | yes | Human-readable name shown in dropdowns and the overview page |
| `category` | yes | `analysis` / `risk` / `governance` (or future categories) |
| `summary` | yes | One sentence; shown on the overview page card |

## Adding a new methodology

1. Create `skills/<category>/<slug>.md` with the frontmatter and structure above.
2. The methodology automatically appears in the `/methodologies` overview page and in the agent edit dropdown — no code changes required.

Keep methodology content focused. Agents already have role-level SKILL.md instructions; this file is the lens, not the role.

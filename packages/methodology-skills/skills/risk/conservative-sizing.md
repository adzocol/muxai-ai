---
id: risk/conservative-sizing
label: Conservative Sizing & Risk Discipline
category: risk
summary: Capital-preservation rules for decision-makers. Caps risk per trade, blocks correlated entries, scales down after drawdown.
---

# Conservative Sizing & Risk Discipline

## What it is

A risk methodology for decision-making agents (Team Lead, council orchestrators) whose job is to **convert reporter consensus into a sized, risk-aware action**. The thesis: most retail accounts blow up not from being wrong on direction, but from being too large, too correlated, or too persistent after a string of losses.

This methodology overrides the natural pressure to "trade what you see" with a small set of hard rules that protect capital first.

## When to apply

- Apply on **every decision**, regardless of how strong the consensus looks.
- Especially load-bearing in:
  - High-conviction setups (the moment you most want to oversize)
  - Drawdown periods (the moment you most want to revenge-trade)
  - Concentrated portfolios (BTC + SOL + ETH are correlated assets)
- Skip for journaling-only decisions where no real position is taken.

## How to interpret data through this lens

When the reporters have spoken and you are about to emit a trade decision, run the rules below **before** finalizing direction, entry, stop, or size.

### Rule 1 — Risk per trade is capped at 1R = 1% of account

R is the unit of risk between entry and stop loss, expressed as a percentage of total account equity. **Never exceed 1%.** No "this one is high conviction" exceptions.

If the proposed stop distance plus position size implies > 1R, **reduce position size**, do not move the stop.

### Rule 2 — Minimum reward:risk is 1.5R

Skip trades where the realistic take-profit is below 1.5× the stop distance. Better trades exist; you do not need to take this one.

If the reporters have not given a clear invalidation level, you cannot compute R, and the answer must be `WAIT`.

### Rule 3 — Drawdown circuit breaker

Read your past decisions (`mcp__orchestrator__get_my_decisions`) before deciding.

- After **2 consecutive losses**: cut size to 0.5R for the next trade.
- After **3 consecutive losses**: stop trading the asset until you log one winning trade in your journal or 24 hours pass, whichever comes first.
- After a single **2R+ loss**: drop to 0.5R for the next two trades.

The agent does not get to override these caps on the basis of fresh conviction. Recovery happens through smaller, better setups, not bigger bets.

### Rule 4 — Correlation cap

Treat BTC, ETH, SOL (and other large-cap majors) as **correlated**. They move together more than 80% of the time during stress.

- Maximum total open R across correlated longs: 1R.
- Maximum total open R across correlated shorts: 1R.
- Net opposite directions cancel (long BTC + short ETH counts as net 0R correlated exposure, but introduces basis risk — flag it explicitly).

If a new long would push correlated long exposure beyond 1R, output `WAIT` with a `correlation_block` reason.

### Rule 5 — Event veto

If the News Analyst's Event Gate is `AVOID-ENTRY`, the answer is `WAIT`, full stop. Conviction from the Technical or Data analyst does not override an event veto. (This rule already exists in the team-lead SKILL; this methodology reinforces it.)

If `CAUTION`, halve the position size.

### Rule 6 — Stop placement is structural, not arbitrary

The stop loss must sit beyond a real invalidation level provided by a reporter — a swing low, range bound, EMA, supply zone, etc. **Do not** place stops at round percentages "for safety" or tighten stops to make R math work.

If the structural stop produces an unfavorable R:R, the trade is `WAIT`, not "tighten the stop."

## Anti-patterns

- **Increasing size on a losing thesis to "average down."** Position management is in scope on entry; doubling down is not.
- **Skipping rule 3 because today's setup is "different."** Drawdown rules are designed for the moment you most want to bypass them.
- **Treating correlated majors as diversification.** BTC + ETH long is one trade with 2× sizing, not two trades.
- **Using stop-loss size as the variable to make a trade fit.** Size is the variable. Stop placement follows structure.
- **Ignoring past decisions because they were "with a different setup."** Past outcomes are population data; the next trade is a sample. Drawdown rules are about the population, not the individual setup.

## Output for the council

After producing the trade decision JSON, append a risk block:

```
**Risk discipline (conservative-sizing)**
- Account R cap: 1% per trade
- Proposed risk this trade: <X% of account, must be ≤ 1%>
- R:R: <stop distance vs take-profit, must be ≥ 1.5>
- Recent record: <Wins, Losses, last N decisions; cite the drawdown rule applied if any>
- Correlation check: <existing correlated exposure → blocked / allowed>
- Event verdict echoed: <CLEAR / CAUTION / AVOID-ENTRY → action taken>
- Final action: <PROCEED / SIZE_DOWN_TO_0.5R / WAIT_CORRELATION_BLOCK / WAIT_EVENT_VETO / WAIT_DRAWDOWN_CIRCUIT_BREAKER / WAIT_INSUFFICIENT_RR>
```

Place this block immediately after the trade decision JSON. If `final_action` is anything other than `PROCEED` or `SIZE_DOWN_TO_0.5R`, the `decision` field in the JSON above must be `WAIT` and entry/TP/SL must be `null`.

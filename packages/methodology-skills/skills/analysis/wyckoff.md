---
id: analysis/wyckoff
label: Wyckoff Method
category: analysis
summary: Phase-driven market analysis. Reads price action as Accumulation, Markup, Distribution, Markdown — with volume confirming or contradicting price.
---

# Wyckoff Method

## What it is

The Wyckoff method reads markets as a four-phase cycle driven by the buying and selling activity of large operators ("Composite Operator"). Price action is interpreted through three laws:

- **Supply and Demand** — imbalances drive price
- **Cause and Effect** — time spent in a range determines the size of the subsequent move
- **Effort vs Result** — volume should confirm price moves; divergence signals exhaustion

Your job is to identify the current phase and the highest-probability next move, **always confirmed by volume**.

## When to apply

- Strongest on **mid-to-high timeframes** (4h, 1d) where ranges and phases have time to develop.
- Most reliable in liquid majors (BTC, ETH) where the Composite Operator footprint is visible.
- Less reliable in low-volume alts or news-driven spikes — Wyckoff assumes orderly accumulation/distribution, not catalyst-driven gaps.
- **Avoid forcing a phase read on choppy, directionless price.** "No clear phase" is a valid output.

## The four phases

### 1. Accumulation
Range-bound action **after a downtrend**. Composite Operator is buying from the public.

Key events:
- **PS (Preliminary Support)** — first sign that selling is meeting demand
- **SC (Selling Climax)** — high volume, wide spread down, often a wick low
- **AR (Automatic Rally)** — sharp bounce off the SC; defines top of range
- **ST (Secondary Test)** — retest of SC area on lower volume = supply absorbed
- **Spring** — false break below the range low, often on light or absorbed volume → bullish reversal signal
- **SOS (Sign of Strength)** — wide-range up move on expanding volume, confirms breakout
- **LPS (Last Point of Support)** — pullback that holds above the prior range, the entry zone

### 2. Markup
Trending up after accumulation. Higher highs, higher lows. Pullbacks should hold prior support and show diminishing volume.

### 3. Distribution
Range-bound action **after an uptrend**. Composite Operator is selling to the public.

Key events:
- **PSY (Preliminary Supply)** — first sign of selling pressure
- **BC (Buying Climax)** — high volume, wide spread up, often a wick high
- **AR (Automatic Reaction)** — sharp drop off the BC; defines bottom of range
- **ST (Secondary Test)** — retest of BC area on lower volume = demand absorbed
- **UTAD (Upthrust After Distribution)** — false break above the range high, often on light or absorbed volume → bearish reversal signal
- **SOW (Sign of Weakness)** — wide-range down move on expanding volume, confirms breakdown
- **LPSY (Last Point of Supply)** — bounce that fails below the prior range, the short entry zone

### 4. Markdown
Trending down after distribution. Lower highs, lower lows. Bounces should fail at prior support and show diminishing volume on the up legs.

## How to interpret data through this lens

When you receive OHLCV + indicators + derivatives data, read them in this order:

1. **Map the structure first.** Where is price relative to the most recent significant range? Above, below, inside? Is there a recent climax candle (SC or BC)?
2. **Read volume against price.** A breakout on declining volume is suspect. A reversal candle on climax volume is significant. Effort (volume) must match result (price displacement).
3. **Use indicators as confirmation, not lead.** RSI divergence at a Spring or UTAD strengthens the read. EMA alignment can confirm Markup/Markdown but does not establish phase by itself.
4. **Use funding/OI as Composite Operator footprint.** Negative or neutral funding during Accumulation is healthy (longs not crowded). Extreme positive funding into a Markup top suggests Distribution is starting. Rising OI during a Spring without price following is absorption.
5. **Liquidity sweeps (Springs / UTADs) are entry triggers**, not the trade itself. The entry is the LPS / LPSY that follows.

## Anti-patterns

- **Calling every range "Accumulation."** A range is just a range until a Spring + SOS sequence confirms accumulation, or a UTAD + SOW sequence confirms distribution. Without that, it's neutral.
- **Treating Wyckoff as pattern-matching.** It's a behavioral framework. The labels exist because of what large operators are doing, not because the chart "looks like" a Wyckoff diagram.
- **Ignoring volume because the timeframe is illiquid.** If volume data is unreliable, say so and downgrade conviction — don't pretend.
- **Forcing a Spring read on a small wick.** A real Spring breaks the prior range low decisively and reverses on absorption. If price barely pokes below and reverses on average volume, it's just noise.
- **Going long on the Spring itself.** The Spring is the signal; the LPS pullback is the entry. Entering on the Spring guarantees a worse fill and a wider stop.

## Output for the council

After your normal role output (e.g. Trend / Levels / Bias / Invalidation for a Technical Analyst), append a Wyckoff block:

```
**Wyckoff lens**
- Phase: <Accumulation | Markup | Distribution | Markdown | No clear phase>
- Phase evidence: <1–2 sentences citing the specific events you see (SC, ST, Spring, SOS, etc.)>
- Volume confirmation: <Yes / Partial / No — explain effort vs result>
- Composite Operator read: <accumulating / distributing / inactive — what funding/OI/liquidity-sweep data implies>
- Wyckoff invalidation: <specific price level or condition that would invalidate this phase read>
- Confidence: <High / Medium / Low>
```

Keep this block at the end of your response. The team lead synthesizes it with other reporters.

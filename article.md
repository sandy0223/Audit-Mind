# Teaching an AI Agent What Fixes Failed Using Hindsight

When a walk-in fridge drifts to 7.2°C, the standard fix is to replace the thermometer. We replaced ours three times before admitting the thermometer was never the problem — the morning marination trays were being loaded into the walk-in with the door propped open. Our AI agent had the same blind spot, and that is the story of how we fixed it.

**AuditMind** is a compliance agent for a multi-site restaurant group. It lives in our team chat rooms and a local terminal, logging temperature checks, deliveries, corrective actions, and audit findings. Every write goes to **[Hindsight](https://github.com/vectorize-io/hindsight)**, an open-source long-term memory engine for agents. The agent doesn't just store records — it remembers which corrective actions actually worked, and refuses to suggest the ones that didn't.

<!-- ADD SCREENSHOT 1: CLI with colored [hindsight:RECALL] / [hindsight:RETAIN] traces (npm run cli) -->

## The RAG wall

Our first version was a textbook RAG setup: chunk the food-safety manual, embed the SOPs, cosine-match every incoming message, prompt the LLM. The answers were operationally useless. Every time a manager logged a warm fridge, the agent cheerfully recited FSSAI thresholds and suggested checking the door gaskets. It had no idea gasket replacements had already failed three times that month, or that one poultry supplier was delivering warm chicken to three outlets on the night shift.

Vector similarity retrieves *documents*. It cannot tell you whether an action succeeded, whether Tuesday's log invalidated Monday's, or whether a rule existed yet when the event happened. We tore out the vector store and rebuilt the agent on episodic memory instead.

## How it hangs together

Every message runs through the same three-step loop in `src/agent.ts`:

1. **Recall** — fetch memories relevant to the message before the LLM sees it.
2. **Think & act** — the model calls tools in an adaptive loop (max 6 rounds). Logging tools retain records with real timestamps; analysis tools use reflect for cross-outlet synthesis.
3. **Retain** — the conversation itself is committed back to memory, so knowledge compounds.

```
 Managers (Band chat rooms)  +  Local CLI
                  │
                  ▼
        AuditMind agent loop
      ┌─────────┼─────────┐
   RECALL    THINK & ACT   RETAIN
  (Hindsight)  (Groq LLM   (Hindsight)
      │        + 8 tools)      │
      └────────►┬◄─────────────┘
                ▼
     One Hindsight bank for the whole group
```

<!-- ADD SCREENSHOT 2: architecture diagram (box diagram image) -->

The LLM is Groq's `gpt-oss-120b`, with explicit retry handling for the two failure modes the API is notorious for: HTTP 400 `tool_use_failed` on malformed tool calls, and 429 rate limits on the free tier. Band AI Desktop is the team-facing surface; the CLI exists so we can rehearse and record demos without it.

### One bank, not three

We debated giving each branch its own memory bank. It felt cleaner — Koramangala gets a bank, Indiranagar gets a bank, HSR Layout gets a bank.

That design would have hidden the most dangerous risks. In multi-site operations, the interesting failures are *cross-outlet*: one supplier delivering warm goods at three different sites. Each manager sees one warm delivery a fortnight and calls it an anomaly. All three sites now feed a **[single shared agent memory bank](https://vectorize.io/what-is-agent-memory)** with site metadata, so reflect can connect dots no individual outlet can see.

## Fix outcomes are first-class memories

This is the decision the whole project turned on.

Conventional schemas mark tasks `status: "completed"`. In food safety, "completed" is close to meaningless — a thermometer replacement can be signed off, invoiced, and 100% complete while the fridge stays at 7°C. So we added a tool whose only job is recording whether a fix *worked*:

```typescript
// src/tools.ts
async record_fix_outcome(a) {
  const worked = Boolean(a.worked);
  await retain({
    context: "fix-outcome",
    content: `[${stamp()}] ${a.outlet}: OUTCOME — the fix "${a.action}" for
      "${a.issue}" ${worked ? "WORKED" : "DID NOT WORK"}.
      ${a.evidence ? `Evidence: ${a.evidence}.` : ""}`,
    metadata: { outlet: a.outlet, worked: String(worked) },
  });
  return `Outcome recorded — future advice will factor this in.`;
}
```

The system prompt then makes the negative knowledge binding:

```typescript
// src/agent.ts
- Never suggest a fix that history says already failed — say so explicitly.
- When a manager tells you whether a fix worked, record it with record_fix_outcome.
```

The effect is visible. Asked *"Walk-in fridge read 7.1°C this morning. What should we do?"*, a stateless agent recommends a thermometer check. AuditMind answers:

> Note: replacing the thermometer previously did NOT work here. Check whether morning prep marination was loaded with the door left open — moving marination to reach-in 2 resolved this in October.

One line of memory, one dead-end eliminated, permanently.

## An auditor's disposition

LLMs are agreeable. Tell one "the fridge issue is resolved" and it replies "great!" — even when Wednesday's log reads 6.8°C. Agreeableness is a liability in compliance work, so we configured the bank's disposition in [the Hindsight docs](https://hindsight.vectorize.io/) with high skepticism:

```typescript
// src/memory.ts
disposition: {
  skepticism: 4, // flag contradictions ("fixed" but readings still high)
  literalism: 3,
  empathy: 2,    // this is an auditor, not a therapist
}
```

With skepticism at 4, contradiction *is* the signal. When asked whether the fridge was fixed, the agent cross-references the claim against subsequent readings and reports: "the thermostat replacement was logged complete on January 30, but readings stayed high until prep segregation was verified on February 2."

Timestamped retention solves the other compliance trap — temporal leakage. Every retain carries the event's real timestamp, so a February incident is judged against the policy version in force in February, never a rule that took effect in April.

<!-- ADD SCREENSHOT 3: side-by-side before/after — /memory off vs /memory on on the same question -->

## Before and after

We built a toggle into the runtime (`/memory off` in the CLI) that bypasses Hindsight while keeping the same model and tools. Same question, two realities:

**"Is Koramangala ready for Friday's audit?"**

- *Memory off:* a generic checklist — keep chillers below 5°C, sign the pest register, check hairnets. True, and useless.
- *Memory on:* a ranked briefing citing eight morning walk-in breaches, the failed thermometer swap, the six-day pest-log gap that an earlier client audit already flagged, and the exact 7-day post-fix temperature logs to hand the auditor.

**"FreshCo chicken just arrived at 7.9°C, Imran took it on night shift."**

- *Memory off:* "Logged. 7.9°C exceeds the 5°C limit."
- *Memory on:* logged, then flagged — the fifth warm FreshCo delivery across the group, four accepted by night staff under driver pressure, with an instruction to isolate the batch and escalate to the head of compliance.

## What I'd do differently

1. **Batched intake, not premature tool calls.** Early versions logged "fridge is warm" as a reading with no temperature attached. We now force the model to ask for *all* missing fields in one numbered list before calling any tool.
2. **Separate working context from institutional memory.** The last 12 turns stay in process memory; everything durable goes to Hindsight. Packing weeks of logs into the context window is expensive and makes reasoning worse.
3. **Trace or it didn't happen.** Every retain/recall/reflect call prints a colored `[hindsight:…]` trace. In a compliance product, an answer without provenance is an answer an auditor will reject — and the traces are what made our demos believable.
4. **Vector search alone was a dead end.** We started there, it failed for exactly the reasons above, and no amount of chunking tuning would have fixed it. State tracking needs temporal, outcome-linked memory — which is the problem Hindsight exists to solve.

## The takeaway

Stateful memory is the line between a chat toy and a colleague. When an agent remembers which fixes failed, it stops reciting the manual and starts carrying institutional history — the kind that usually walks out the door when a manager resigns.

If you're building agents that need to remember outcomes rather than documents, start with the [Hindsight GitHub repository](https://github.com/vectorize-io/hindsight), read the [documentation](https://hindsight.vectorize.io/), and skim [what agent memory actually means](https://vectorize.io/what-is-agent-memory) before you reach for another vector store.

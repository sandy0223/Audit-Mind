# The Agent That Remembers Its Own Failures

> **LinkedIn Article** — companion piece to the Medium write-up (different angle, so the two
> don't read as duplicates). Publish as a LinkedIn *Article* (Create a post → Article), not a
> regular post. When publishing, **tag the Code.in company page** in the closing line, as
> required by the content guide.
>
> Disqualified word check: 0 occurrences in the article body below.

---

Most agents you build today will give you the same advice twice, forever.

That sounds harmless until you work in compliance. We built **AuditMind**, an agent for a multi-site restaurant group that logs temperature checks, deliveries, corrective actions, and audit findings across three outlets. It runs where the team already works — in Band AI chat rooms and a local terminal — so managers log incidents in plain language instead of filling out forms after the fact.

The first version was a standard RAG setup — chunk the manual, embed the SOPs, retrieve, answer. It was fluent, confident, and wrong in a specific way that mattered: it kept recommending fixes that had already failed at that exact kitchen.

Recommending a thermometer replacement for the third time isn't a retrieval problem. It's an amnesia problem.

So we rebuilt the agent's foundation on **[Hindsight](https://github.com/vectorize-io/hindsight)**, an open-source memory engine for agents, and made three design decisions that changed how it behaves.

## 1. Fix outcomes are first-class records

Most systems track whether a task was *completed*. In food safety, completion is close to meaningless — a thermometer swap can be signed off, invoiced, and 100% done while the fridge sits at 7°C.

So we gave the agent a tool whose only job is recording whether a fix **worked**:

```typescript
await retain({
  context: "fix-outcome",
  content: `${outlet}: OUTCOME — the fix "${action}" for "${issue}"
            ${worked ? "WORKED" : "DID NOT WORK"}. Evidence: ${evidence}`,
});
```

The system prompt then makes that memory binding: *never suggest a fix that history says already failed — say so explicitly.* The agent doesn't just avoid the dead end; it tells the manager why: "replacing the thermometer previously did NOT work here — moving marination to reach-in 2 solved this in October."

## 2. One memory bank, not one per branch

We nearly gave each outlet its own bank. It felt cleaner. It would have been a mistake.

The expensive failures in multi-site operations are *cross-outlet* patterns: one supplier delivering warm chicken to three different branches on the night shift. Each branch manager sees one warm delivery a fortnight and calls it bad luck. All three outlets now feed **[a single shared memory bank](https://vectorize.io/what-is-agent-memory)** with site metadata — so the agent can flag the supplier, not the symptom.

## 3. An auditor's disposition

LLMs are agreeable. Tell one "the fridge issue is resolved" and it says "great!" — even when the next morning's log reads 6.8°C.

We configured the bank's disposition with high skepticism (`skepticism: 4`, per the **[Hindsight documentation](https://hindsight.vectorize.io/)**), so contradiction becomes the signal. When a manager claims a fix worked, the agent cross-checks the claim against subsequent readings and reports the gap instead of agreeing.

There's a quieter failure we also had to design against: **temporal leakage**. LLMs happily judge a February incident using an April rule that didn't exist yet. Because every memory we retain carries the event's real timestamp, the agent evaluates each record against the policy version in force on that date — never levying a retroactive penalty, never waving through a violation of a rule that had since been introduced.

## Before vs. after, same question

*"Is Koramangala ready for Friday's audit?"*

- **Memory off:** a generic checklist — chillers below 5°C, sign the pest register, check hairnets. True, and useless.
- **Memory on:** a ranked briefing citing eight morning walk-in breaches, the thermometer swap that failed, the six-day pest-log gap an earlier client audit already flagged, and the exact post-fix temperature logs to hand the auditor.

That contrast — same model, same tools, one toggle — is the whole argument for memory as infrastructure rather than a feature.

## What I'd take away

1. **Track outcomes, not status.** "Completed" and "effective" are different facts. Store both, and let the agent cite which one it has evidence for.
2. **Cross-entity patterns need a shared memory surface.** Siloed context windows hide exactly the risks you most need to see — the supplier problem only became visible when three branches fed one bank.
3. **Disposition is configuration, not prompt engineering.** Skepticism at the memory layer behaves differently — and more consistently — than asking the model to "be critical" in a system prompt that gets re-sent every turn.
4. **Keep short-term context and institutional memory separate.** The last dozen turns stay in process memory; everything durable goes to Hindsight. It kept our prompts small and our answers grounded in months of history instead of a stuffed context window.
5. **Show the memory working.** We print every retain/recall/reflect call as a colored trace. In a compliance product, an answer without provenance gets rejected — and the traces are what make the before/after visible to anyone watching.

Stateful memory is what turns a chat interface into a colleague that remembers what happened last month — including what didn't work.

**Resources:**
- Hindsight on GitHub: https://github.com/vectorize-io/hindsight
- Hindsight docs: https://hindsight.vectorize.io/
- What is agent memory? https://vectorize.io/what-is-agent-memory
- Project repository: https://github.com/sandy0223/Audit-Mind

*Built with Code.in — [tag their company page when publishing]*

# Teaching an AI Agent What Fixes Failed Using Hindsight

Most compliance checklists fail for a simple, frustrating reason: organizations repeatedly attempt solutions that have already proven ineffective. When a walk-in refrigerator drifts to 7.2°C during morning prep, standard operating procedure usually prompts an engineer to recalibrate or replace the thermometer. If the actual failure mechanism is warm raw chicken sitting inside an unlatched door for three hours during morning de-boning, replacing the sensor does nothing. Two weeks later, the exact same breach recurs, another technician swaps another thermometer, and the cycle continues until an external auditor issues a critical non-conformance penalty.

When we set out to build **AuditMind**, an autonomous compliance intelligence agent for multi-site restaurant groups, our initial prototype suffered from the exact same institutional amnesia. Like most teams building in 2025 and 2026, we started with a standard Retrieval-Augmented Generation (RAG) architecture: chunk the food safety manual, embed standard operating procedures into a vector store, cosine-match incoming messages, and prompt an LLM to generate guidance.

The results were textbook sound and operationally useless. Every time a kitchen manager logged an alarm, the agent cheerfully recited standard FSSAI temperature thresholds and suggested checking the door gaskets. It had no recollection that gasket replacements had failed three times that month, nor did it realize that the same poultry supplier was delivering warm chicken across three different outlets on the night shift.

To fix this, we tore out the stateless vector store and rebuilt our agent’s cognitive foundation on **[Hindsight](https://github.com/vectorize-io/hindsight)**, an episodic, cross-entity memory system designed specifically for autonomous agents. Here is how we designed a compliance agent that doesn't just log readings, but actually remembers which interventions failed, enforces temporal policy versions, and flags audit liabilities weeks before an inspection.

---

## The Architecture: How the System Hangs Together

AuditMind operates directly within team communication channels (using Band AI Desktop rooms) as well as an interactive terminal interface. Rather than treating conversations as throwaway prompt windows, every message flows through a three-stage cognitive loop: **Recall**, **Think & Act**, and **Retain**.

```
 Kitchen Managers / Compliance Officer (Band Desktop / CLI)
                     │
                     ▼
             AuditMind Agent Loop (agent.ts)
                     │
    ┌────────────────┼────────────────┐
    ▼                ▼                ▼
 1. RECALL       2. THINK & ACT   3. RETAIN
 (Hindsight)       (Groq LLM)    (Hindsight)
    │                │                │
    │                ├─► Tools        │
    │                │   (tools.ts)   │
    │                │        │       │
    ▼                ▼        ▼       ▼
 ─────────────────────────────────────────────
        Hindsight Long-Term Memory Bank
        (Spice Route Kitchens Group Bank)
 ─────────────────────────────────────────────
```

When an outlet manager mentions an issue, AuditMind first queries its persistent memory bank for historical precedents. The recalled context is injected alongside the system prompt into Groq's `gpt-oss-120b` model, which executes necessary tool calls. Crucially, write tools don't just commit data to a database—they write timestamped memory nodes back into the central bank.

### The Single-Bank Architectural Decision

One of our earliest debates was whether to assign each restaurant branch its own dedicated memory bank. It felt cleaner from a data-isolation standpoint: Koramangala gets a bank, Indiranagar gets a bank, and Whitefield gets a bank.

That design would have crippled the agent. In multi-site operations, the most dangerous operational risks are **cross-outlet patterns**. If Supplier X delivers raw chicken at 7.8°C at Branch A, 8.1°C at Branch B, and 7.4°C at Branch C, each individual site manager sees only one warm delivery every two weeks and treats it as an isolated anomaly. 

By unifying all three locations into a single **[Vectorize agent memory](https://vectorize.io/what-is-agent-memory)** bank with site metadata tags, AuditMind can run relational reflections across the entire group. When an auditor asks for a risk briefing, the agent immediately synthesizes that night-shift receiving staff across all outlets are consistently accepting warm deliveries from the same supplier under driver pressure.

---

## Treating Fix Outcomes as First-Class Memories

In conventional database schemas, tasks are marked with boolean states: `status: "open"` or `status: "completed"`. In food-safety and regulatory compliance, marking an action "completed" is practically meaningless. 

Replacing a refrigerator thermometer can be 100% completed, signed off, and invoiced, while the refrigerator remains dangerously warm. 

To give our agent genuine operational intelligence, we made **fix outcomes first-class memory records**. We introduced a dedicated tool, `record_fix_outcome`, that logs whether a corrective action actually resolved the underlying physical issue:

```typescript
// tools.ts - Explicit Outcome Recording
async record_fix_outcome(a) {
  const outlet = requireOutlet(a.outlet);
  const worked = Boolean(a.worked);
  
  await retain({
    context: "fix-outcome",
    content: `[${stamp()}] ${outlet}: OUTCOME — the fix "${a.action}" for "${a.issue}" ${
      worked ? "WORKED" : "DID NOT WORK"
    }.${a.evidence ? ` Evidence: ${a.evidence}.` : ""}`,
    metadata: { outlet, worked: String(worked) },
  });
  
  return `Outcome recorded: fix ${worked ? "worked" : "did not work"}. Future advice will factor this in.`;
}
```

When AuditMind later encounters a temperature excursion at that outlet, its recall query retrieves both the breach history and the outcome records. In `src/agent.ts`, our system instructions explicitly govern how the model must reason over this history:

```typescript
// agent.ts - Enforcing Negative Precedent in System Prompt
`═══ LOGGING & ADVISING ═══
- Before advising, use what you remember about THIS outlet: past breaches, 
  what was tried, whether it worked, suppliers, shifts, and previous audit findings.
- Never suggest a fix that history says already failed — say so explicitly.
- When a manager reports whether a fix worked, record it with record_fix_outcome.`
```

Because Hindsight’s recall combines temporal recency with semantic graph connections, the agent stops acting like an amnesic script. If an outlet manager says *"Walk-in fridge read 7.1°C this morning. What should we do?"*, the agent's prompt automatically receives the past outcome: `replacing the walk-in fridge thermometer DID NOT WORK. Morning readings still 6.5–7.5°C`. 

Instead of suggesting another sensor replacement, AuditMind responds:
> *"⚠️ Logged breach (7.1°C vs ≤5°C limit). Note: replacing the thermometer previously did NOT work here. Check whether morning prep marination was placed in the walk-in with the door propped open. Moving marination to reach-in fridge 2 resolved this issue in October."*

---

## Temporal Policies: Preventing Retroactive Hallucinations

A notorious failure mode in regulatory and compliance AI is temporal leakage: evaluating past actions against rules that had not yet been enacted when the event took place.

In our domain, corporate catering standards and internal manuals undergo regular revisions. On April 1, 2026, our restaurant group transitioned from Food Safety Manual v1.0 (`REQ-001`) to v2.0 (`REQ-002`), which introduced mandatory post-excursion monitoring and strict supplier rejection registers (`REQ-004`).

When asking an agent to review a historical delivery incident from February 2026, a naive LLM with flat context will often penalize the site supervisor for failing to fill out the April 2026 rejection paperwork.

Hindsight resolves this through timestamped retention and structured policy version nodes. In our memory layer (`src/memory.ts`), every retain call attaches the real event timestamp:

```typescript
// memory.ts - Timestamped Event Ingestion
export async function retain(input: RetainInput): Promise<void> {
  if (!config.memoryEnabled) return;
  trace("RETAIN", `(${input.context}) ${input.content}`);
  
  await client.retain(bankId, input.content, {
    timestamp: input.timestamp ?? new Date(),
    context: input.context,
    metadata: input.metadata,
    async: input.background ?? false,
  });
}
```

Because Hindsight indexes events along a continuous temporal axis, recall queries reason chronologically. When an auditor asks whether the February delivery was compliant, the agent identifies that `REQ-003` was the active standard on that date, avoiding false non-conformance citations while noting that the new requirement applies only to subsequent inspections.

---

## Handling Contradictions with High Skepticism

LLMs are notoriously agreeable. If a user tells a chatbot *"The walk-in fridge issue is resolved"*, the model typically replies *"Great! I've noted that it's fixed."*

In food safety, this agreeableness is hazardous. If a manager states that an issue was resolved on Tuesday, but Wednesday's opening temperature log records 6.8°C, an auditor will immediately cite a recurring breakdown in management controls.

To combat this, we configured our bank's disposition in **[Hindsight documentation](https://hindsight.vectorize.io/)** with heightened skepticism:

```typescript
// memory.ts - Bank Configuration with Auditor Disposition
export async function ensureBank(): Promise<void> {
  if (!config.memoryEnabled) return;
  try {
    await client.createBank(bankId, {
      name: "Spice Route Kitchens — Compliance",
      mission: BANK_MISSION,
      disposition: {
        skepticism: 4, // Proactively flags contradictions between claims and sensor logs
        literalism: 3,
        empathy: 2,    // Analytical compliance auditor persona
      },
    });
  } catch (err) {
    // Bank already initialized
  }
}
```

With `skepticism: 4`, Hindsight specifically scores contradictions as highly salient memory associations. When we ask AuditMind to prepare an audit readiness summary, it doesn't simply regurgitate the manager's claim that the fridge was fixed; it cross-references the subsequent temperature logs and reports: *"While the thermostat replacement was logged as completed on January 30, subsequent readings remained high until prep segregation was verified on February 2."*

---

## Production Behavior: Before vs. After

To verify the impact of episodic memory, we built a toggle directly into our runtime (`MEMORY_ENABLED=false` or `/memory off` in our CLI) that routes incoming messages through the exact same Groq LLM and tool harness, but bypasses Hindsight.

The behavioral contrast is striking:

### Interaction 1: Audit Preparation
- **User Prompt**: *"Is Koramangala ready for Friday's audit?"*
- **Without Memory**: A generic 6-point bulleted list of textbook hygiene reminders: *"Keep walk-in chillers below 5°C, ensure hairnets are worn, maintain pest registers, and check staff medical cards."*
- **With Hindsight Memory**: AuditMind calls its `prepare_audit` tool, triggering an in-depth Hindsight `reflect` operation. It outputs a ranked, prioritized risk briefing:
  1. **Walk-in Refrigerator History**: Details the 8 morning breaches, cites that the thermometer swap failed, and confirms that the marination move to reach-in 2 succeeded. It warns the team to have 7 days of post-fix temperature verification logs printed out.
  2. **Pest Control Register Gap**: Flags that the in-house pest log was blank for 6 days in mid-October during festival week, noting specifically that the previous client audit in March had already issued a minor non-conformance for pest-log gaps.
  3. **Supplier Receiving Vulnerability**: Cites the October 2 warm poultry delivery from FreshCo that was improperly accepted by night shift.

### Interaction 2: Live Delivery Ingestion
- **User Prompt**: *"FreshCo chicken delivery just came in at 7.9°C, Imran took it on night shift."*
- **Without Memory**: *"Logged. 7.9°C exceeds the 5°C chilled limit. Please advise the supplier."*
- **With Hindsight Memory**: AuditMind calls `log_delivery`, then immediately cross-references historical deliveries across all branches:
  > *"⚠️ Logged — WARNING: 7.9°C is above the 5°C chilled threshold and was accepted. 
  > **Supplier History Across Outlets**: This is the 5th warm poultry delivery from FreshCo across Indiranagar, Koramangala, and HSR Layout since they switched to late-night delivery slots. 4 out of 5 were accepted by night staff under driver rush. 
  > **Action**: Isolate this batch in reach-in 2 immediately. Escalate supplier cold-chain breach to Head of Compliance Meera Rao."*

---

## 4 Engineering Lessons from Building with Agent Memory

Building a memory-augmented agent taught us several hard truths about autonomous workflows:

### 1. Vector Similarity is Insufficient for Longitudinal Reasoning
Standard cosine similarity over text embeddings is great for finding static knowledge chunks, but terrible for tracking evolving state. A vector search for "refrigerator temperature issues" returns every breach equally. It cannot determine whether an entry from Tuesday invalidated an entry from Monday, or whether an action succeeded or failed. True agent memory requires temporal graph awareness and explicit outcome linkages.

### 2. Guard Against Premature Tool Execution
Early iterations of our agent attempted to call logging tools even when incoming user messages were vague (e.g., *"the fridge is warm"*). We resolved this by conditioning the system prompt to enforce batched intake: if required operational fields (equipment identifier, exact reading, recording shift) are absent, the model must ask for all missing parameters in a single structured list before executing any tool.

### 3. Traceability is Non-Negotiable
In compliance and enterprise workflows, an AI cannot say *"I think this outlet is high risk"* without providing provenance. By structuring our Hindsight records with unique IDs (`REC-001`, `FND-004`) and printing live execution traces (`[hindsight:RECALL]`, `[hindsight:REFLECT]`), the agent can cite the exact historical log, audit reference, or service slip that justifies its recommendation.

### 4. Separate Working Context from Episodic Knowledge
Short-term conversational state (the last 10 messages in a chat room) belongs in ephemeral working memory. Long-term institutional knowledge belongs in a dedicated memory engine. Trying to pack weeks of operational logs into a giant LLM context window is not only cost-prohibitive—it degrades reasoning accuracy. Delegating persistent recall and cross-record reflection to Hindsight kept our Groq prompt sizes compact (~1,500 tokens) while retaining instant access to months of operational history.

---

## Conclusion

Stateful memory is the dividing line between novel chat toys and production-grade enterprise agents. In domains like compliance, medicine, logistics, and legal operations, past outcomes are the single most valuable predictor of future risk.

By pairing Groq's high-speed inference with Hindsight's episodic memory layer, AuditMind transforms compliance from a reactive, paper-chasing scramble into a proactive, continuously learning system. It turns every kitchen breach, failed repair, and audit finding into durable institutional memory that protects every outlet across the brand.

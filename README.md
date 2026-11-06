# 🛡️ AuditMind

> **An autonomous food-safety compliance agent that remembers every check, fix, and audit — and learns which corrective actions actually hold.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Memory: Hindsight](https://img.shields.io/badge/Memory-Vectorize%20Hindsight-008080.svg)](https://hindsight.vectorize.io/)
[![LLM: Groq](https://img.shields.io/badge/LLM-Groq%20(gpt--oss--120b)-F55036.svg)](https://groq.com/)
[![Chat: Band AI](https://img.shields.io/badge/Platform-Band%20AI%20Desktop-7C3AED.svg)](https://www.band.ai/)
[![Tests](https://img.shields.io/badge/Tests-24%2F24%20Passing-success.svg)](#-testing--verification)

---

## 📌 Overview

Restaurant groups fail audits for the exact same reasons again and again: the same walk-in fridge, the same supplier defect, the same unrecorded log. The operational records exist, but they are scattered across paper registers, WhatsApp chats, and disconnected spreadsheets. Nobody connects the patterns across outlets or remembers whether past fixes actually worked.

**AuditMind** lives inside your team's **[Band](https://www.band.ai)** chat rooms (and local CLI), logging checks directly into **[Hindsight](https://github.com/vectorize-io/hindsight)** persistent memory. It doesn't just log data — it learns root causes, tracks fix outcomes, enforces temporal policy versions, and flags audit gaps before inspectors find them.

| Scenario | Without Memory (Stateless LLM) | With Hindsight Long-Term Memory |
|:---|:---|:---|
| *"Walk-in fridge at 7.1°C"* | "Keep fridges below 5°C, check the door seal." | **"4th morning breach in 3 weeks. Replacing the thermometer previously failed. Segregating prep marination to reach-in 2 resolved this in October. Check whether prep went back in."** |
| *"Is Koramangala ready for Friday's audit?"* | A generic, textbook FSSAI checklist. | **Ranked risks from Koramangala's real history: walk-in fridge prep habits, warm FreshCo chicken delivery, and the 6-day pest-log gap already flagged in March.** |
| *"Weekly risk briefing"* | Broad, high-level cleanliness advice. | **"FreshCo Poultry's late-night deliveries arrived warm 5 times across all 3 outlets. 4 were accepted by night staff due to driver rush. Immediate supplier contract action required."** |

---

## 🏗️ Architecture

```mermaid
flowchart TD
    subgraph Client ["Team Touchpoints"]
<<<<<<< HEAD
        A["Manager / Auditor<br/>Band Desktop Room"]
        B["Local Terminal<br/>Interactive CLI"]
    end

    subgraph Core ["AuditMind Agent Loop (agent.ts)"]
        C["1. RECALL<br/>Fetch Relevant Memory"]
        D["2. THINK & ACT<br/>Groq LLM (gpt-oss-120b)"]
        E["3. RETAIN<br/>Store Interaction"]
    end

    subgraph Memory ["Vectorize Hindsight Bank"]
        F[("Single Group Bank<br/>spice-route-compliance<br/>Historical checks & fixes")]
=======
        A["Manager / Auditor\n(Band Desktop Room)"]
        B["Local Terminal\n(Interactive CLI)"]
    end

    subgraph Core ["AuditMind Agent Loop (agent.ts)"]
        C["1. RECALL\nFetch Relevant Memory"]
        D["2. THINK & ACT\nGroq LLM (gpt-oss-120b)"]
        E["3. RETAIN\nStore Interaction"]
    end

    subgraph Memory ["Vectorize Hindsight Bank"]
        F[("Single Group Bank\n(spice-route-compliance)\n• Historical checks\n• Fix outcomes\n• Policy versions")]
>>>>>>> a36b2820ed6c1efcfc661f9071b9343f4aefc46f
    end

    subgraph ToolLayer ["8 Specialized Tools (tools.ts)"]
        G["log_temperature_check"]
        H["log_delivery"]
        I["record_fix_outcome"]
<<<<<<< HEAD
        K["prepare_audit"]
        L["risk_briefing"]
    end

    A -->|Mention agent| C
    B -->|User message| C
    C <-->|Query history| F
    C --> D
    D <-->|Tool Loop| ToolLayer
    ToolLayer <-->|Retain / Recall / Reflect| F
    D --> E
    E -->|Save interaction| F
=======
        K["prepare_audit (reflect)"]
        L["risk_briefing (reflect)"]
    end

    A -->|@AuditMind| C
    B -->|User message| C
    C <-->|Query relevant history| F
    C --> D
    D <-->|Tool Execution Loop| ToolLayer
    ToolLayer <-->|Retain / Recall / Reflect| F
    D --> E
    E -->|Write back learning| F
>>>>>>> a36b2820ed6c1efcfc661f9071b9343f4aefc46f
    D -->|Verified Answer| A
    D -->|Verified Answer| B
```

### The 3-Step Cognitive Loop (Every Turn)
1. **Recall**: Pull long-term memories relevant to the incoming message (`src/agent.ts`).
2. **Think + Act**: Groq executes tool calls in an adaptive loop. Logging tools **retain** records with real timestamps; analysis tools use **reflect** for cross-outlet pattern synthesis (`src/tools.ts`).
3. **Retain**: The conversation itself is committed to Hindsight, ensuring every interaction compounds knowledge over time.

---

## 🧠 Memory Design Decisions

- **One Single Bank for the Entire Restaurant Group**: Rather than siloed per-outlet databases, all sites feed one memory bank with site metadata. This allows Hindsight `reflect` to uncover systemic issues — like a single supplier delivering warm goods across multiple branches.
- **Fix Outcomes as First-Class Memories**: Most agents log actions, not effectiveness. AuditMind explicitly tracks whether a corrective action *worked* via `record_fix_outcome`, ensuring the LLM stops recommending interventions that have already failed.
- **Skepticism Disposition (4/5)**: The Hindsight bank is configured with high skepticism (`disposition.skepticism: 4`) so it proactively flags contradictions (e.g. when an issue is logged as "fixed" but morning temperatures remain high).
- **Temporal Policy Versioning**: AuditMind respects effective dates. It evaluates older incidents against the policy in effect on that date, never penalizing historical events with retroactive rules.
- **Preserving Uncertainty**: Missing evidence is never assumed to be a pass. If records or batch numbers are missing, AuditMind explicitly identifies the evidence gap and requests documentation.

---

## ⚡ Quick Start

### Prerequisites
- **Node.js ≥ 22.0.0** (tested on v24)
- **Groq API Key** (free tier at [console.groq.com](https://console.groq.com))
- **Hindsight API Key** ([Hindsight Cloud](https://ui.hindsight.vectorize.io) — promo code `MEMHACK99` for $50 free credits)
- **Band AI Agent** (optional for desktop chat: [app.band.ai](https://app.band.ai))

### 1. Installation
```bash
git clone https://github.com/your-username/auditmind.git
cd auditmind
npm install
```

### 2. Configure Environment
Copy the example environment file and add your API keys:
```bash
cp .env.example .env
```

Edit `.env`:
```env
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=your_hindsight_api_key_here
HINDSIGHT_BANK_ID=spice-route-compliance

GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b

BAND_AGENT_ID=your_band_agent_uuid_here
BAND_API_KEY=your_band_api_key_here

MEMORY_ENABLED=true
MEMORY_TRACE=true
```

---

## 📦 Loading Memory & Datasets

AuditMind includes two rich datasets for seeding Hindsight memory:

### Option A: 6-Week Planted Pattern Scenario (Recommended for Demos)
Generates realistic 6-week operational logs across 3 Bengaluru outlets with deliberate planted failure patterns:
```bash
npm run seed -- --dry-run   # Preview records
npm run seed                # Seed into Hindsight
```
*Planted Patterns:*
1. **Koramangala Walk-in Fridge**: 8 morning breaches. Thermometer replacement failed; moving marination prep worked.
2. **FreshCo Poultry**: Changed to late-night delivery route; 5 warm arrivals accepted by night shift.
3. **Pest Control Gap**: 6-day blank log at Koramangala during Ayudha Puja week (a repeat finding from March).

### Option B: 12-Month Longitudinal Compliance Dataset
Seeds a complete 12-month timeline with 62 linked records, 8 requirements, 6 controls, and 4 policy versions:
```bash
npm run seed:compliance -- --dry-run   # Preview
npm run seed:compliance               # Seed into Hindsight
```

---

## 🎮 How to Run

### Mode 1: Interactive Local CLI (Instant Setup)
The CLI supports hot-swapping speaker personas and toggling memory live:
```bash
npm run cli
```

**Built-in CLI Commands:**
| Command | Description |
|:---|:---|
| `/as <Name>` | Switch active speaker (e.g. `/as Arjun`, `/as Meera`) |
| `/memory off` | Disable Hindsight memory (demonstrates the "before" stateless baseline) |
| `/memory on` | Re-enable Hindsight memory (demonstrates the "after" memory intelligence) |
| `/exit` | Exit the CLI session |

### Mode 2: Band Desktop (Team Chat Rooms)
Run AuditMind as a native participant in Band rooms:
```bash
npm run band
```
1. Open **Band AI Desktop**.
2. Create a room (e.g. `#compliance-koramangala`).
3. Add **@AuditMind** to the room.
4. Mention the agent: `@AuditMind Is Koramangala ready for Friday's audit?`

---

## 🎬 3-Minute Demo Walkthrough

Follow this turn-by-turn sequence in the CLI to demonstrate AuditMind's full potential:

```text
# 1. Warm Greeting (UX Polish)
/as Arjun
hi

# 2. Batched Data Intake (No multi-turn badgering)
fridge is warm at Koramangala

# 3. The "Before" Baseline (Stateless LLM)
/as Meera
/memory off
Is Koramangala ready for Friday's audit?

# 4. The "After" Highlight (Hindsight Memory Reflection)
/memory on
Is Koramangala ready for Friday's audit?

# 5. Outcome Learning ("Never suggest a failed fix")
/as Arjun
Walk-in fridge read 7.1°C this morning. What should we do?

# 6. Live Ingestion (Continuous learning)
We moved the marination trays to reach-in 2 and closed the door. Temperature is now 3.8°C. The fix worked.

# 7. Cross-Outlet Pattern Discovery (Single Bank Power)
FreshCo chicken delivery just arrived at 8.1°C, Imran accepted it on night shift

# 8. Executive Strategic Synthesis
/as Meera
weekly risk briefing
```

---

## 🧪 Testing & Verification

AuditMind includes zero-dependency smoke tests validating pure business logic (outlet normalization, FSSAI temperature thresholds, and breach detection):

```bash
# Run test suite (24/24 passing)
npm test

# Verify TypeScript types
npm run typecheck
```

---

## 📂 Project Structure

```
auditmind/
├── src/
│   ├── agent.ts          # Core 3-step loop (recall → LLM tool loop → retain)
│   ├── memory.ts         # Hindsight client wrapper (retain, recall, reflect, mission)
│   ├── tools.ts          # 8 LLM tools with FSSAI limits & compliance handlers
│   ├── llm.ts            # Groq client with retries for tool_use_failed & 429
│   ├── band.ts           # Band AI GenericAdapter connector
│   ├── cli.ts            # Local REPL with persona switching & memory toggle
│   ├── config.ts         # Environment configuration & outlet normalization
│   └── tests.ts          # Automated unit & smoke test suite
├── scripts/
│   ├── generate-data.ts  # Deterministic synthetic data generator
│   ├── seed.ts           # Planted pattern scenario loader
│   └── seed-compliance.ts# 12-month longitudinal compliance dataset loader
├── data/
│   ├── knowledge/        # House standards & policy markdown files
│   └── seed/             # Pre-generated seed event JSONs
├── .env.example          # Sanitized environment template (no secrets)
├── package.json
└── tsconfig.json
```

---

## 📄 Documentation & PDF Playbooks

Comprehensive presentation guides are available in the repository root:
- [`AuditMind_Presentation_and_Scenarios_Guide.pdf`](./AuditMind_Presentation_and_Scenarios_Guide.pdf) — 4-page guide covering presentation timing, 5 deep scenarios, and Judge Q&A defense.
- [`AuditMind_Master_Prompt_Playbook.pdf`](./AuditMind_Master_Prompt_Playbook.pdf) — 3-page action-oriented prompt cheat sheet for live execution.

---

## ⚖️ License & Attribution

Built with:
- **[Hindsight](https://hindsight.vectorize.io/)** by Vectorize (Long-term memory engine)
- **[Band](https://www.band.ai)** (Agent chat workspace)
- **[Groq](https://groq.com)** (LPU inference engine)

*Disclaimer: All restaurant names, personnel, and compliance events in the seed datasets are synthetic and for illustrative demonstration purposes.*

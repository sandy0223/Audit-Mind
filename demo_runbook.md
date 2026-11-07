# AuditMind — Demo & Recording Runbook

> Step-by-step work plan: preflight → seed → CLI rehearsal → Band test → record → publish.
> Follow in order. Total time: ~60–75 minutes.

---

## Phase 0 — Preflight (10 min)

### 0.1 Environment
```bash
node -v          # must be >= 22 (tested on v24)
npm install
```

### 0.2 Verify keys (`.env` must be filled — already configured ✅)
| Variable | Purpose |
|:--|:--|
| `HINDSIGHT_API_KEY` | memory engine (Cloud) |
| `GROQ_API_KEY` | LLM inference |
| `BAND_AGENT_ID` + `BAND_API_KEY` | Band Desktop agent |
| `MEMORY_ENABLED=true` | memory ON for demo |
| `MEMORY_TRACE=true` | **required for the video** — prints colored `[hindsight:…]` traces |

### 0.3 Run checks
```bash
npm test           # expect: 29 tests: 29 passed, 0 failed
npm run typecheck  # expect: no output = clean
```

### 0.4 ⚠️ Seed the bank (CRITICAL — do this before rehearsing)

**Current state:** the live bank contains only the 12-month *compliance dataset*
(Northwind / Whitefield / FND-xxx records). The playbook, this runbook, and
`video_script.md` all quote the **6-week planted patterns** (8 morning breaches,
FreshCo warm deliveries, Ayudha Puja pest-log gap, failed thermometer swap).
Those records are **not in the bank yet** — if you record now, the "after"
answers won't match your script.

**Recommended fix — fresh bank with planted patterns:**

```bash
# 1. In .env, switch to a clean bank so records aren't mixed/duplicated:
HINDSIGHT_BANK_ID=spice-route-demo

# 2. Preview, then seed (142 events + 6 policy sections):
npm run seed -- --dry-run
npm run seed
```

**Verify it took (should return fridge/FreshCo/pest-gap memories, not FND-xxx):**
```bash
# quick check: run the CLI and ask, with memory on:
npm run cli
> Is Koramangala ready for Friday's audit?
```
You should see `[hindsight:REFLECT]` fire and get outlet-specific risks.

> Alternative: keep the current compliance bank and adapt your talking points to
> what's actually there (FND-004 thermostat replacement, repeat pest findings
> FND-003→007→010, REQ-003→REQ-004 policy change). Only choose this if you've
> already rehearsed against it.

---

## Phase 1 — CLI rehearsal (15 min, no recording)

```bash
npm run cli
```

Walk the 8 turns from the Master Prompt Playbook. Expected behavior:

| # | Paste | What you should see |
|:-:|:--|:--|
| 1 | `/as Arjun` then `hi` | Warm 2-line greeting, **zero** tool calls |
| 2 | `fridge is warm at Koramangala` | One numbered list asking for equipment + temp + shift (no tool yet) |
| 3 | `/as Meera` → `/memory off` → `Is Koramangala ready for Friday's audit?` | Generic checklist, no `[hindsight:…]` traces |
| 4 | `/memory on` → same question | `[hindsight:REFLECT]` trace + specific risks (breaches, pest gap, failed fix) |
| 5 | `/as Arjun` → `Walk-in fridge read 7.1°C this morning. What should we do?` | Logs breach, explicitly says thermometer swap **did not work**, suggests marination move |
| 6 | `We moved the marination trays to reach-in 2 and closed the door. Temperature is now 3.8°C. The fix worked.` | Cyan `[hindsight:RETAIN]` trace, outcome recorded |
| 7 | `FreshCo chicken delivery just arrived at 8.1°C, Imran accepted it on night shift` | Logs delivery + cross-outlet FreshCo pattern |
| 8 | `/as Meera` → `weekly risk briefing` | `[hindsight:REFLECT]` group synthesis with counts/dates |

**Rehearse until** every response matches the expected behavior above without
you having to re-ask. If a response is generic, the bank is likely empty or
unseeded — return to Phase 0.4.

---

## Phase 2 — Band Desktop test (10 min)

> Note: `/memory off` is a **CLI-only** command. In Band, memory is always on.
> Record the before/after contrast in the CLI (video step 2), and use Band for
> the "live team chat" shot.

1. Open **Band AI Desktop** → create room `#compliance-koramangala`.
2. In a terminal, start the agent (leave it running):
   ```bash
   npm run band
   ```
   Expected log: `AuditMind is connecting to Band (memory ON)…`
3. In the room, add **@AuditMind** (your external agent) as a member.
4. Send: `@AuditMind hi`
   - Terminal shows `[band] Received message…` → `[band] Reply delivered successfully.`
   - Room shows AuditMind's reply within a few seconds.
5. Send a real test: `@AuditMind FreshCo delivery at 8.1°C just came in, Imran took it`
   - Confirm the reply cites history (cross-outlet pattern), and the terminal
     shows `[hindsight:RETAIN]` / `[hindsight:RECALL]` traces.

**If the reply doesn't arrive:** check the terminal for
`Error in handleMessage` (keys/bank) or `Delivery failed` (agent handle/mention
routing — the code falls back to mentioning the sender).

---

## Phase 3 — Record the video (30–40 min)

**Setup:** OBS (free) → 1920×1080, 30fps, record screen (not phone).
Terminal font ≥ 16pt. Close notifications, Slack, unrelated tabs.
Have `video_script.md` open on a second screen/phone — follow it, don't read it verbatim.

### Recording sequence (mirrors `video_script.md`)

| Time | Shot | On screen |
|:--|:--|:--|
| 0:00–0:30 | Intro | Camera or `src/agent.ts` — who you are, what AuditMind does, one line on why |
| 0:30–1:00 | **The problem (before)** | Terminal `npm run cli` → `/as Meera` → `/memory off` → *Is Koramangala ready for Friday's audit?* — show the generic checklist |
| 1:00–2:15 | **The demo (after)** | `/memory on`, same question → point at `[hindsight:REFLECT]` trace → then `/as Arjun` + FreshCo delivery → point at `[hindsight:RETAIN]` |
| 1:15–1:45 | *Optional Band shot* | Cut to Band room showing the same exchange in `#compliance-koramangala` |
| 2:15–2:45 | Synthesis | `/as Meera` → `weekly risk briefing` |
| 2:45–3:00 | Takeaway | Talking head or repo file tree — one key takeaway |

**Tips:** if you fumble a prompt, keep rolling and redo the turn — authenticity
beats polish. Take a clean pass of each terminal segment so editing has options.

### Thumbnail
Use the prompt at the bottom of `video_script.md` in Google Nano Banana (16:9),
attaching a team photo. Export as PNG/JPG.

---

## Phase 4 — Publish (20 min)

### 4.1 Article → Medium
1. Open `article.md` → paste into Medium (Medium imports markdown; check headers,
   code blocks, and links render).
2. Insert your 3 screenshots at the `<!-- ADD SCREENSHOT … -->` markers:
   - CLI with colored hindsight traces
   - Architecture diagram
   - Before/after side-by-side (`/memory off` vs `/memory on`)
3. Verify all 3 required links are live:
   - https://github.com/vectorize-io/hindsight
   - https://hindsight.vectorize.io/
   - https://vectorize.io/what-is-agent-memory
4. Publish as **public** → copy the URL.

### 4.2 Share on Reddit (Link posts, pick 1–4)
r/llmdevs · r/sideproject · r/aiagents · r/aimemory — title it about the idea,
not the event.

### 4.3 LinkedIn
1. Publish the LinkedIn **Article** from `linkedin_article.md`
   (Create a post → Article). **Tag the Code.in company page** in the closing line.
2. Publish the **post** from `social_post.md` (copy-paste block only, 682 chars).
3. First comment → your Medium article URL.
4. Second comment → `https://github.com/vectorize-io/hindsight`.

### 4.4 YouTube
Upload the recording as **public**, attach the Nano Banana thumbnail, put the
project repo (`https://github.com/sandy0223/Audit-Mind`) in the description.

---

## Pre-submit checklist

- [ ] Title is about the idea/result, not the event
- [ ] Opens with something specific and surprising
- [ ] Problem explained in concrete terms
- [ ] Shows where and how Hindsight is integrated
- [ ] At least one real code snippet from the project
- [ ] At least one concrete before/after example
- [ ] At least one honest lesson, limitation, or dead end
- [ ] Screenshots/images included
- [ ] Published to a public, linkable URL
- [ ] Zero occurrences of the disqualified word in article, post, and video
- [ ] Social post under 800 chars with repo link in the body
- [ ] First comment = article URL; a comment with the Hindsight repo link
- [ ] Video 2–5 min, 1080p, posted to YouTube (not Drive)
- [ ] Every team member has submitted their own article + social post

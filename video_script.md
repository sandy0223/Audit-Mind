# 🎥 3-Minute Demo Video Script & YouTube Assets

> [!NOTE]
> Conforms to **Prompt 5** and **Prompt 6** of the Content Submission Guide.
> - Length: ~3 minutes (ideal for YouTube / screen recording).
> - Style: Conversational, screen recording with voiceover (optional talking head).
> - Includes exact screen cues, terminal commands, and 5 click-worthy YouTube titles.

> [!IMPORTANT]
> **Prerequisite before recording:** the demo bank must contain the 6-week planted-pattern
> data (`npm run seed`), otherwise steps 3–8 will not produce the responses scripted below.
> Run `npm run seed -- --dry-run` first to preview, and see `demo_runbook.md` for the
> full preflight checklist.

---

## 📺 5 High-Performing YouTube Titles
1. **I Built an AI Compliance Agent That Remembers Which Fixes Actually Worked**
2. **Why Stateless AI Sucks for Compliance (And How We Fixed It with Hindsight)**
3. **Teaching an AI Agent to Never Repeat a Failed Fix Using Episodic Memory**
4. **How Long-Term Memory Turned Our AI Chatbot into a Proactive Food Safety Auditor**
5. **RAG Couldn't Solve This: Building Cross-Site Agent Memory with Vectorize Hindsight**

---

## 🎬 3-Minute Video Script (Turn-by-Turn)

### 0:00 - 0:30 | Hook & Problem (Quick Intro)
* **On Screen**: Camera on you or code editor showing `src/agent.ts`.
* **Narration**:  
  > *"Hi, I'm Sandeep. If you've ever worked in multi-site restaurants or retail, you know that businesses fail health audits for the exact same reasons over and over again: the same walk-in fridge, the same supplier defect, or a blank pest register.*  
  > *The records exist, but they're buried across paper sheets and WhatsApp groups. If you ask a standard AI chatbot to help, it just recites generic textbook advice without remembering that your fridge repair failed twice last week.*  
  > *We built **AuditMind** to solve this—an autonomous compliance agent that remembers every check, fix, and audit across outlets using Vectorize Hindsight memory."*

---

### 0:30 - 1:00 | The "Before" Moment (Stateless Baseline)
* **On Screen**: Terminal running `npm run cli`. Terminal font size enlarged.
* **Action**:
  ```text
  /as Meera
  /memory off
  Is Koramangala ready for Friday's audit?
  ```
* **Narration**:  
  > *"To show why memory matters, let's first turn memory OFF. I'm logged in as Meera, our Head of Compliance, asking if our Koramangala restaurant is ready for an upcoming client audit.*  
  > *Look at the output: it gives a generic FSSAI checklist. Keep fridges below 5 degrees, verify hairnets, sign the logs. It's safe advice, but completely blind to the actual operational history of this branch."*

---

### 1:00 - 2:15 | The Live Demo (Memory Reflection & Learning)
* **On Screen**: Terminal running `npm run cli`.
* **Action 1**:
  ```text
  /memory on
  Is Koramangala ready for Friday's audit?
  ```
* **Narration**:  
  > *"Now watch what happens when we turn Hindsight memory ON and ask the exact same question.*  
  > *You see `[hindsight:REFLECT]` fire in real time. Instead of generic advice, AuditMind surfaces the branch's actual liabilities:*  
  > *First, it recalls eight morning fridge breaches, notes that replacing the thermometer previously failed, but moving marination to reach-in 2 worked. Second, it flags a six-day gap in the pest log from festival week, and warns that the March audit already cited this.*  
  > *Next, let's look at live incident logging. I'll switch to Arjun, the branch manager:"*

* **Action 2**:
  ```text
  /as Arjun
  FreshCo chicken delivery just came in at 7.8°C, Imran took it on night shift
  ```
* **Narration**:  
  > *"Arjun reports a warm poultry delivery. Notice the green retain trace: AuditMind logs the breach, but then does something traditional RAG can't do—it correlates this with deliveries at our other outlets.*  
  > *It alerts Arjun that this is the fifth warm delivery from FreshCo across all three sites, and four of them were accepted by night staff due to driver pressure. It instantly connects the dots."*

---

### 2:15 - 2:45 | Strategic Synthesis
* **On Screen**: Switch back to Meera.
* **Action**:
  ```text
  /as Meera
  weekly risk briefing
  ```
* **Narration**:  
  > *"Finally, when Meera asks for the weekly briefing, AuditMind uses Hindsight's reflection engine to synthesize root causes across the entire chain: late-night delivery routing and night-shift receiving protocol gaps. Nobody ever hand-coded that conclusion—the agent deduced it from weeks of memory."*

---

### 2:45 - 3:00 | Takeaway & Wrap-up
* **On Screen**: Talking head or GitHub repo showing clean code structure.
* **Narration**:  
  > *"My biggest takeaway from this project? Vector embeddings are great for documents, but true agency requires episodic memory. When an agent remembers which fixes failed, it stops being a chat toy and starts acting like an experienced colleague.*  
  > *Check out the repo in the description below, and let me know your thoughts in the comments!"*

---

## 🎨 YouTube Thumbnail Prompt (Prompt 6)
*(Use with Google Nano Banana, Midjourney, or Canva)*

```text
A vibrant, attention-grabbing YouTube thumbnail (16:9 aspect ratio). On the left side, a split screen: one side labeled "Stateless AI" with a generic checklist and a red warning badge; the other side labeled "Memory-Powered AI" with green checkmarks, clean data graphs, and an active compliance dashboard. On the right side, an expressive, curious software engineer pointing towards the center with a bold headline in clean modern sans-serif typography: "AI FINALLY REMEMBERS!". High contrast, professional tech aesthetic, subtle neon blue and teal accents, 4K resolution.
```

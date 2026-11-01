# Baton — knowledge handover that doesn't lose the "why"

**Team OneByte · Nihali Jain**

Baton turns a departing member's scattered project activity into a **verified, permission-aware handover**. Every claim links to the exact text it came from, uncertainty is labelled instead of hidden, the person leaving is asked only about real gaps, and each incoming member sees only what they are allowed to see.

The demo uses a fictional college robotics club, **RoboCell**. Its club lead, Aarav, is leaving; Priya (tech lead) and Kabir (treasurer) take over; Dr. Rao (faculty advisor) reviews the handover.

## Try it (about 3 minutes, no login)

1. **Connect** — keep all sources ticked (optionally import any public GitHub repo) → *Ingest and continue*.
2. **Reconstruct** — *Reconstruct project state*. Browse the timeline and the extracted claims; click *Show source* on any claim.
3. **Verify** — answer the exit-interview questions, or click *Fill sample answers* → *Send to reviewer*.
4. **Review** — resolve the two conflicts (telemetry database, design report deadline) → *Accept all remaining* → *Approve handover*.
5. **Handover** — switch between Priya and Kabir to see two different, permission-filtered handovers. Flag a claim or acknowledge receipt. *Reset demo* starts over.

## What works

- Five-step workflow end to end: Connect → Reconstruct → Verify → Review → Handover
- 7 sources across GitHub, Google Drive, Discord and Trello (synthetic), each with its own access list; personal DMs excluded
- **Live connector:** import any public GitHub repository (README, open issues, commit history)
- Extraction of decisions (with reasons), owners, tasks, deadlines, requirements and blockers, recurring problems and fixes, contacts, credentials, finance and role changes
- **Rule-based extractor** by default; **optional Gemini AI extraction** when an API key is set
- **Citation check in code:** every claim must quote its source verbatim; unsupported claims are downgraded or dropped
- Five claim statuses: Verified, Inferred, Conflicting, Missing, Stated by leaver
- **Conflict detection:** disagreeing sources are flagged, never merged silently
- **Gap-driven exit interview:** questions generated only where evidence is missing (no reason, no owner, owned by the leaver, conflicts, credentials); answers become new claims that inherit the access of their topic
- **Sensitive data:** secrets are redacted everywhere; the confidential channel never reaches incoming members
- Review console: resolve conflicts, accept / edit / reject, bulk accept, approve, version history
- **Permission-first handover:** chunks are filtered by the reader's roles *before* the view is built; claims need every piece of evidence to be visible
- First actions, open gaps, highlighted source quotes, acknowledgement of receipt, flag-as-wrong loop back to the reviewer, audit log, Markdown export

## How it works

```
Sources (GitHub, Drive, Discord, Trello, live GitHub)
   → chunks tagged with source, author, date and access list        src/lib/pipeline.ts  toChunks
   → structured extraction (tasks, owners, due dates, commit share)  extractStructured
   → free-text extraction: rules, or Gemini via /api/extract         extractFreeText / connectors.ts
   → citation check (quote must exist verbatim in the chunk)         verifyCitations
   → conflict detection (same attribute, different values)           detectConflicts
   → gap questions for the leaver                                    buildGapQuestions
   → reviewer approval → versioned handover
   → per-reader view: filter chunks by role FIRST, then claims        viewFor
```

| Layer | Choice |
| --- | --- |
| App | Next.js 15 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4 |
| AI (optional) | Google Gemini via a server route; the key never reaches the browser and secrets are redacted before sending |
| Integrations | GitHub REST API (live, public repos); synthetic Drive / Discord / Trello exports |
| State | Browser localStorage (each visitor gets their own demo workspace) |
| Hosting | Vercel |

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

## Deploy (free, about 5 minutes)

1. Push this folder to a GitHub repository.
2. Go to <https://vercel.com>, choose **Continue with GitHub**, then **Add New → Project**, pick the repository and press **Deploy**. No settings are needed.
3. Optional, to turn on AI extraction: create a free key at <https://aistudio.google.com/apikey>, then in Vercel open **Project → Settings → Environment Variables**, add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, default `gemini-2.5-flash`), and redeploy.

Without a key the app uses the rule-based extractor, so the demo always works.

## Project structure

```
src/lib/data.ts         synthetic RoboCell dataset (planted conflicts, gaps, credential, confidential channel)
src/lib/pipeline.ts     ingestion, extraction, citation check, conflicts, gaps, permissions, next actions
src/lib/connectors.ts   live GitHub import and AI extraction client
src/lib/store.tsx       app state, review, versions, acknowledgements, flags, audit log
src/app/api/extract     server route that calls Gemini
src/components/         the five screens
```

All people, companies and data in the demo are fictional.

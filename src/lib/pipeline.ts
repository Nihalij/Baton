import type {
  Chunk,
  Claim,
  ClaimType,
  Evidence,
  GapQuestion,
  Person,
  Role,
  Source,
} from "./types";

// ---------------------------------------------------------------------------
// 1. CONNECT → chunks. Every chunk carries the access list of its source.
// ---------------------------------------------------------------------------

export function toChunks(sources: Source[]): Chunk[] {
  const out: Chunk[] = [];
  for (const s of sources) {
    for (const it of s.items) {
      out.push({
        id: it.id,
        sourceId: s.id,
        kind: s.kind,
        sourceName: s.name,
        title: it.title,
        author: it.author,
        date: it.date,
        url: it.url,
        text: it.text,
        access: s.access,
        confidential: s.confidential,
        meta: it.meta,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const DATE_RE = /(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})/i;

export function parseDate(s: string): string | null {
  const m = s.match(DATE_RE);
  if (!m) return null;
  const mm = MONTHS.indexOf(m[2].toLowerCase()) + 1;
  return `${m[3]}-${String(mm).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${d} ${mon} ${y}`;
}

const ABBR = new Set(["dr", "mr", "mrs", "ms", "rs", "no", "vs", "st", "e.g", "i.e"]);

/** Split text into sentences that are exact substrings of the original text. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    let start = 0;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if ((ch === "." || ch === "!" || ch === "?") && line[i + 1] === " " && /[A-Z]/.test(line[i + 2] || "")) {
        const prevWord = line.slice(start, i).split(/\s+/).pop()?.toLowerCase() || "";
        if (ABBR.has(prevWord)) continue;
        out.push(line.slice(start, i + 1).trim());
        start = i + 2;
      }
    }
    const tail = line.slice(start).trim();
    if (tail) out.push(tail);
  }
  return out;
}

const SECRET_RE = /\b(password|passwd|pass|api[ _-]?key|token|secret)\b(\s*[:=]\s*)(\S+)/gi;

/** Mask secrets wherever text is displayed. Credentials are never shown. */
export function redact(text: string): string {
  return text.replace(SECRET_RE, (_m, k, sep) => `${k}${sep}[REDACTED]`);
}

function norm(s: string) {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Citation check: the quoted span must exist verbatim in the cited chunk. */
export function citationHolds(ev: Evidence, chunks: Map<string, Chunk>): boolean {
  const c = chunks.get(ev.chunkId);
  if (!c || !ev.quote || ev.quote.length < 4) return false;
  const q = norm(ev.quote);
  return norm(c.text).includes(q) || norm(redact(c.text)).includes(q);
}

const STOP = new Set(["the", "a", "an", "submission", "has", "on", "campus", "our", "of"]);
function topicKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .join(" ")
    .trim();
}

const TASK_VERBS = /^(write|submit|build|order|fix|create|prepare|send|finish|complete)\s+/i;
export function taskTopic(title: string) {
  return topicKey(title.replace(TASK_VERBS, ""));
}

const DB_RE = /\b(postgresql|postgres|mongodb|mysql|sqlite|firebase)\b/i;
function canonDb(s: string) {
  const l = s.toLowerCase();
  if (l.startsWith("postgres")) return "PostgreSQL";
  if (l === "mongodb") return "MongoDB";
  if (l === "mysql") return "MySQL";
  if (l === "sqlite") return "SQLite";
  return "Firebase";
}

let idCounter = 0;
function cid(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function mk(
  type: ClaimType,
  text: string,
  evidence: Evidence[],
  extra: Partial<Claim> = {},
): Claim {
  return {
    id: cid(type),
    type,
    text,
    status: "verified",
    evidence,
    origin: "rules",
    citationOk: true,
    review: { state: "pending" },
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// 2. RECONSTRUCT (rule-based extractor for free text)
// ---------------------------------------------------------------------------

export function extractFreeText(chunk: Chunk): Claim[] {
  const claims: Claim[] = [];
  if (chunk.kind === "trello") return claims; // handled as structured data
  if (chunk.id === "gh-commits") return claims;

  const sents = sentences(chunk.text);
  const used = new Set<number>();

  // Recurring problems are detected per chunk so the fix travels with them.
  const recurIdx = sents.findIndex((s) => /\b(again|keeps|every time|recurring|third time)\b/i.test(s));
  if (recurIdx >= 0) {
    const fixIdx = sents.findIndex(
      (s, i) => i !== recurIdx && /\b(workaround|fix|use the|same .* issue)\b/i.test(s),
    );
    const title = chunk.title.replace(/^Issue #\d+ · /, "").replace(/^#\w[\w-]* · .*/, "");
    const lead = chunk.kind === "github" && title ? `${title}. ` : "";
    const text = `Recurring problem: ${lead}${sents[recurIdx]}${fixIdx >= 0 ? ` Known fix/context: ${sents[fixIdx]}` : ""}`;
    const ev: Evidence[] = [{ chunkId: chunk.id, quote: sents[recurIdx] }];
    if (fixIdx >= 0) ev.push({ chunkId: chunk.id, quote: sents[fixIdx] });
    claims.push(mk("recurring", text, ev));
    used.add(recurIdx);
    if (fixIdx >= 0) used.add(fixIdx);
  }

  sents.forEach((s, i) => {
    if (used.has(i)) return;
    const ev = [{ chunkId: chunk.id, quote: s }];

    // credential (secret itself is cut from the quote and redacted on display)
    const cred = s.match(/^(.*?)\b(password|passwd|api[ _-]?key|token|secret)\b\s*[:=]/i);
    if (cred) {
      const sys = s.match(/the ([A-Z][\w]*(?: [a-z]+)?) login/);
      const system = sys ? sys[1] : "a shared account";
      const quote = s.slice(0, s.search(/\b(password|passwd|api[ _-]?key|token|secret)\b/i)).trim();
      claims.push(
        mk(
          "credential",
          `A login exists for the ${system} (secret redacted). It was shared in chat by ${chunk.author}; it must be handed over securely and the password changed.`,
          [{ chunkId: chunk.id, quote: quote.replace(/[,\s]+$/, "") }],
          { sensitive: true, attribute: `credential ${system.toLowerCase()}` },
        ),
      );
      return;
    }

    // decision
    const dec = s.match(/^(?:decision:\s*|we decided to\s+|decided to\s+)(.+)$/i);
    if (dec) {
      const body = dec[1].replace(/\.$/, "");
      const r = body.match(/\b(because|since|due to|so that)\b\s*(.*)$/i);
      const what = r ? body.slice(0, r.index).replace(/[,\s]+$/, "") : body;
      claims.push(
        mk("decision", `Decision: ${what.charAt(0).toUpperCase()}${what.slice(1)}.`, ev, {
          reason: r ? r[2] : null,
          note: r ? `Reason: ${r[2]}` : "No reason recorded in the source.",
          attribute: `decision ${topicKey(what)}`,
        }),
      );
      const db = body.match(/\bto (PostgreSQL|Postgres|MongoDB|MySQL|SQLite|Firebase)\b/i);
      if (db && /telemetry/i.test(chunk.text)) {
        claims.push(
          mk("techchoice", `Telemetry database: ${canonDb(db[1])} (per ${chunk.title}).`, ev, {
            attribute: "telemetry database",
            value: canonDb(db[1]),
          }),
        );
      }
      return;
    }

    // action item → task with owner
    const act = s.match(/^Action:\s*([A-Z][a-z]+ [A-Z][a-z]+) to (.+?)(?: by (\d{1,2} \w+ \d{4}))?\.?$/);
    if (act) {
      claims.push(
        mk("task", `${act[1]} owns: ${act[2]}${act[3] ? ` (due ${act[3]})` : ""}.`, ev, {
          owner: act[1],
          due: act[3] ? parseDate(act[3]) : null,
        }),
      );
      return;
    }

    // handover announcement → owner claims
    const take = s.match(/([A-Z][a-z]+) will take over as ([a-z ]+?)(?: and ([A-Z][a-z]+) as ([a-z ]+))?\.?$/);
    if (take) {
      claims.push(mk("handover", `${take[1]} takes over as ${take[2].trim()}.`, ev, { owner: take[1] }));
      if (take[3]) claims.push(mk("handover", `${take[3]} takes over as ${take[4].trim()}.`, ev, { owner: take[3] }));
      return;
    }

    // tech choice in config files
    const cfg = s.match(/driver:\s*(\w+)/i);
    if (cfg && DB_RE.test(cfg[1]) && /telemetry/i.test(chunk.text)) {
      claims.push(
        mk("techchoice", `Telemetry database: ${canonDb(cfg[1])} (per ${chunk.title}).`, [{ chunkId: chunk.id, quote: s.trim() }], {
          attribute: "telemetry database",
          value: canonDb(cfg[1]),
        }),
      );
      return;
    }

    // deadlines and key dates
    const date = parseDate(s);
    if (date && /(deadline|due|submission|round|by \d)/i.test(s)) {
      let topic = "";
      const afterColon = s.includes(":") ? s.slice(s.lastIndexOf(":") + 1) : s;
      if (/deadline/i.test(s)) {
        const seg = s.slice(0, s.toLowerCase().indexOf("deadline"));
        topic = topicKey(seg.includes(":") ? seg.slice(seg.lastIndexOf(":") + 1) : seg);
      } else if (s.includes(":") && !DATE_RE.test(s.slice(0, s.indexOf(":")))) {
        topic = topicKey(s.slice(0, s.indexOf(":")));
      } else {
        const m = s.match(/submit (.+?) by \d/i);
        topic = topicKey(m ? m[1] : afterColon);
      }
      claims.push(
        mk("deadline", `${topic.charAt(0).toUpperCase()}${topic.slice(1)}: ${fmtDate(date)}.`, ev, {
          attribute: `deadline ${topic}`,
          value: date,
          due: date,
        }),
      );
      return;
    }

    // contacts
    if (/\b(contact|reach out|managed by|in-charge)\b/i.test(s) || /[\w.]+@[\w.]+/.test(s)) {
      claims.push(mk("contact", `Contact: ${s}`, ev));
      return;
    }

    // money facts
    if (/\bRs\.? ?[\d,]+/.test(s)) {
      claims.push(mk("finance", s, ev));
      return;
    }

    // requirements, blockers, dependencies
    if (/\b(requires?|needs?|must|blocked (?:until|by)|depends on|waiting for)\b/i.test(s)) {
      const ctx = chunk.kind === "github" ? `${chunk.title.replace(/^Issue (#\d+) · /, "Issue $1 ")}: ` : "";
      claims.push(mk("dependency", `${ctx}${s}`, ev, { note: /blocked/i.test(s) ? "Blocker" : undefined }));
      return;
    }
  });

  if (chunk.confidential) {
    for (const c of claims) {
      c.sensitive = true;
      c.note = "From a confidential channel. Only the core team and advisor can see this.";
    }
    // Also capture confidential messages that match no rule, so the reviewer sees them.
    if (claims.length === 0) {
      claims.push(
        mk("risk", sents.join(" "), [{ chunkId: chunk.id, quote: sents[0] }], {
          sensitive: true,
          note: "From a confidential channel. Only the core team and advisor can see this.",
        }),
      );
    }
  }
  return claims;
}

// ---------------------------------------------------------------------------
// 2b. RECONSTRUCT (structured data: task boards, issues, commits)
// ---------------------------------------------------------------------------

export function extractStructured(chunk: Chunk, leaverName: string): Claim[] {
  const out: Claim[] = [];
  const m = chunk.meta;
  if (!m) return out;

  const isTask = chunk.kind === "trello" || (chunk.kind === "github" && m.state === "open");
  if (isTask) {
    const title = chunk.title;
    const quote =
      chunk.kind === "trello"
        ? `Assignee: ${m.assignee ?? "none"}`
        : sentences(chunk.text)[0];
    const ev = [{ chunkId: chunk.id, quote }];
    const where = chunk.kind === "trello" ? m.list : `open issue`;
    out.push(
      mk(
        "task",
        `${title} — ${where}; owner: ${m.assignee ?? "none"}${m.due ? `; due ${fmtDate(m.due)}` : ""}.`,
        ev,
        { origin: "structured", owner: m.assignee ?? null, due: m.due ?? null },
      ),
    );
    if (!m.assignee) {
      out.push(
        mk("gap", `No owner recorded for "${title}".`, ev, {
          origin: "gap",
          status: "missing",
          attribute: `owner ${topicKey(title)}`,
        }),
      );
    } else if (m.assignee === leaverName) {
      out.push(
        mk("risk", `"${title}" is owned by ${leaverName}, who is leaving. It needs a new owner.`, ev, {
          origin: "structured",
          owner: m.assignee,
          due: m.due ?? null,
          attribute: `leaver-owned ${topicKey(title)}`,
        }),
      );
    }
    if (m.due && chunk.kind === "trello") {
      const topic = taskTopic(title);
      const dq = chunk.text.match(/Due: [^.]+/);
      out.push(
        mk("deadline", `${title}: due ${fmtDate(m.due)}.`, [{ chunkId: chunk.id, quote: dq ? dq[0] : quote }], {
          origin: "structured",
          attribute: `deadline ${topic}`,
          value: m.due,
          due: m.due,
        }),
      );
    }
  }

  if (m.commits && m.commits.length) {
    const counts = new Map<string, number>();
    for (const c of m.commits) counts.set(c.author, (counts.get(c.author) || 0) + 1);
    const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const pct = Math.round((n / m.commits.length) * 100);
    const first = m.commits.find((c) => c.author === top)!;
    const repo = chunk.sourceName.replace(/^GitHub · /, "");
    const ev = [{ chunkId: chunk.id, quote: `${first.date} ${first.author}: ${first.message}` }];
    out.push(
      mk("owner", `${top} is likely the main owner of ${repo}.`, ev, {
        origin: "inferred",
        status: "inferred",
        owner: top,
        note: `Inferred from commit history: ${n} of the last ${m.commits.length} commits (${pct}%).`,
        attribute: `code owner ${repo}`,
      }),
    );
    if (top === leaverName) {
      out.push(
        mk("risk", `The main contributor to ${repo} (${top}) is leaving. Knowledge of this code is concentrated in one person.`, ev, {
          origin: "inferred",
          status: "inferred",
          note: `Inferred from commit history (${pct}% of recent commits).`,
          attribute: `leaver-owned code ${repo}`,
        }),
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. VERIFY: citation check, conflict detection, gap questions
// ---------------------------------------------------------------------------

export function verifyCitations(claims: Claim[], chunks: Chunk[]): Claim[] {
  const map = new Map(chunks.map((c) => [c.id, c]));
  const out: Claim[] = [];
  for (const c of claims) {
    const ok = c.evidence.length > 0 && c.evidence.every((e) => citationHolds(e, map));
    if (ok) {
      out.push({ ...c, citationOk: true });
    } else if (c.evidence.some((e) => citationHolds(e, map))) {
      // keep only the evidence that holds, downgrade to inferred
      out.push({
        ...c,
        evidence: c.evidence.filter((e) => citationHolds(e, map)),
        status: c.status === "verified" ? "inferred" : c.status,
        citationOk: true,
        note: `${c.note ? c.note + " " : ""}Part of the cited text could not be found in the source, so this was downgraded.`,
      });
    }
    // claims with no valid citation are dropped: nothing unsupported reaches the ledger
  }
  return out;
}

export function detectConflicts(claims: Claim[]): Claim[] {
  const groups = new Map<string, Claim[]>();
  for (const c of claims) {
    if (!c.attribute || !c.value) continue;
    const g = groups.get(c.attribute) || [];
    g.push(c);
    groups.set(c.attribute, g);
  }
  const conflicting = new Set<string>();
  for (const [attr, g] of groups) {
    const values = new Set(g.map((c) => c.value));
    if (values.size > 1) for (const c of g) conflicting.add(c.id + "|" + attr);
  }
  return claims.map((c) =>
    c.attribute && conflicting.has(c.id + "|" + c.attribute)
      ? { ...c, status: "conflicting", conflictGroup: c.attribute }
      : c,
  );
}

export function buildGapQuestions(claims: Claim[], leaverName: string): GapQuestion[] {
  const qs: GapQuestion[] = [];
  const seenConflict = new Set<string>();
  for (const c of claims) {
    if (c.type === "decision" && !c.reason) {
      qs.push({
        id: `q-${c.id}`,
        claimId: c.id,
        kind: "no-reason",
        question: `The sources record this decision but not why: "${c.text.replace(/^Decision: /, "").replace(/\.$/, "")}". What was the reason?`,
      });
    }
    if (c.type === "gap") {
      const t = c.text.match(/"(.+)"/)?.[1] ?? c.text;
      qs.push({ id: `q-${c.id}`, claimId: c.id, kind: "no-owner", question: `Nobody owns "${t}". Who should own it, and what is its status?` });
    }
    if (c.type === "risk" && c.text.includes("who is leaving")) {
      const t = c.text.match(/"(.+)"/)?.[1] ?? c.text;
      qs.push({ id: `q-${c.id}`, claimId: c.id, kind: "owner-leaving", question: `You own "${t}". Who should take it over, and what is left to do?` });
    }
    if (c.type === "risk" && c.text.startsWith("The main contributor")) {
      qs.push({ id: `q-${c.id}`, claimId: c.id, kind: "owner-leaving", question: `You wrote most of the rover firmware. Which parts are fragile or undocumented, and who should own the code after you?` });
    }
    if (c.type === "credential") {
      qs.push({ id: `q-${c.id}`, claimId: c.id, kind: "credential", question: `A login was shared in chat (${c.text.match(/for the (.+?) \(/)?.[1] ?? "account"}). Who should receive it after you leave, and how?` });
    }
    if (c.status === "conflicting" && c.conflictGroup && !seenConflict.has(c.conflictGroup)) {
      seenConflict.add(c.conflictGroup);
      const g = claims.filter((x) => x.conflictGroup === c.conflictGroup);
      const vals = [...new Set(g.map((x) => (x.type === "deadline" ? fmtDate(x.value) : x.value)))].join(" vs ");
      qs.push({
        id: `q-${c.id}`,
        claimId: c.id,
        kind: "conflict",
        question: `Sources disagree on the ${c.conflictGroup.replace(/^deadline /, "").replace(/^/, "")}${c.type === "deadline" ? " deadline" : ""}: ${vals}. Which is correct, and why?`,
      });
    }
  }
  void leaverName;
  return qs;
}

// ---------------------------------------------------------------------------
// Full reconstruction run
// ---------------------------------------------------------------------------

export function reconstruct(chunks: Chunk[], leaverName: string, llmClaims?: Claim[]): {
  claims: Claim[];
  gaps: GapQuestion[];
  dropped: number;
} {
  idCounter = 0;
  const raw: Claim[] = [];
  for (const ch of chunks) {
    raw.push(...extractStructured(ch, leaverName));
    if (!llmClaims) raw.push(...extractFreeText(ch));
  }
  if (llmClaims) raw.push(...llmClaims);
  const verified = verifyCitations(raw, chunks);
  const withConflicts = detectConflicts(verified);
  const chunkMap = new Map(chunks.map((c) => [c.id, c]));
  for (const c of withConflicts) {
    if (c.evidence.some((e) => chunkMap.get(e.chunkId)?.confidential)) {
      c.sensitive = true;
      c.note = c.note ?? "From a confidential channel. Only the core team and advisor can see this.";
    }
  }
  const gaps = buildGapQuestions(withConflicts, leaverName);
  return { claims: withConflicts, gaps, dropped: raw.length - verified.length };
}

// ---------------------------------------------------------------------------
// 4/5. PERMISSIONS: what a given reader may see
// ---------------------------------------------------------------------------

export function canSeeChunk(roles: Role[], chunk: Chunk | undefined) {
  if (!chunk) return false;
  return chunk.access.some((r) => roles.includes(r));
}

/** A claim is visible only if the reader may see EVERY piece of its evidence. */
export function canSeeClaim(roles: Role[], claim: Claim, chunkMap: Map<string, Chunk>) {
  return claim.evidence.every((e) => canSeeChunk(roles, chunkMap.get(e.chunkId)));
}

export function claimAccessLabel(claim: Claim, chunkMap: Map<string, Chunk>): string {
  let allowed: Role[] = ["member", "tech", "finance", "core", "advisor"];
  for (const e of claim.evidence) {
    const ch = chunkMap.get(e.chunkId);
    if (ch) allowed = allowed.filter((r) => ch.access.includes(r));
  }
  if (allowed.includes("member")) return "All members";
  return allowed.filter((r) => r !== "advisor").map((r) => r[0].toUpperCase() + r.slice(1)).join(", ") + " + advisor";
}

export interface ReaderView {
  visibleChunkIds: Set<string>;
  claims: Claim[];
  withheld: number;
}

/**
 * Permission-first: filter the chunks the reader may see FIRST, then keep only
 * claims built entirely from those chunks. Nothing else is ever passed on.
 */
export function viewFor(person: Person, claims: Claim[], chunks: Chunk[]): ReaderView {
  const visible = chunks.filter((c) => canSeeChunk(person.roles, c));
  const visibleMap = new Map(visible.map((c) => [c.id, c]));
  const out = claims.filter((c) => c.evidence.every((e) => visibleMap.has(e.chunkId)));
  return { visibleChunkIds: new Set(visibleMap.keys()), claims: out, withheld: claims.length - out.length };
}

export interface Action {
  text: string;
  why: string;
  claimId: string;
}

export function nextActions(claims: Claim[], leaverName: string, today = new Date()): Action[] {
  const actions: Action[] = [];
  for (const c of claims) {
    if (c.type === "risk" && c.text.includes("who is leaving")) {
      const t = c.text.match(/"(.+)"/)?.[1] ?? c.text;
      const answer = c.answeredBy ? claims.find((x) => x.id === c.answeredBy) : undefined;
      actions.push({
        text: answer ? `Confirm the handover of "${t}"` : `Find a new owner for "${t}"`,
        why: answer ? `${leaverName} said: ${answer.value}` : `Currently owned by ${leaverName}${c.due ? `, due ${fmtDate(c.due)}` : ""}.`,
        claimId: c.id,
      });
    }
  }
  const soon = claims
    .filter((c) => c.type === "deadline" && c.due)
    .filter((c) => {
      const d = new Date(c.due + "T00:00:00");
      const days = (d.getTime() - today.getTime()) / 864e5;
      return days > -1 && days < 75;
    })
    .sort((a, b) => (a.due! < b.due! ? -1 : 1));
  const seen = new Set<string>();
  for (const c of soon) {
    if (seen.has(c.attribute || c.id)) continue;
    seen.add(c.attribute || c.id);
    const days = Math.ceil((new Date(c.due + "T00:00:00").getTime() - today.getTime()) / 864e5);
    actions.push({
      text: `Prepare for the deadline — ${c.text.replace(/\.$/, "").replace(/: due /, ", due ")}`,
      why: days >= 0 ? `Due in ${days} day${days === 1 ? "" : "s"}.` : "Due today.",
      claimId: c.id,
    });
  }
  for (const c of claims.filter((c) => c.type === "dependency" && /blocked/i.test(c.text))) {
    actions.push({ text: `Unblock: ${c.text}`, why: "Blocker found in the sources.", claimId: c.id });
  }
  for (const c of claims.filter((c) => c.type === "gap" && !c.answeredBy)) {
    actions.push({ text: c.text.replace("No owner recorded for", "Assign an owner to"), why: "No owner in any source.", claimId: c.id });
  }
  return actions.slice(0, 6);
}

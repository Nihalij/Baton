"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AuditEntry, Chunk, Claim, GapQuestion, HandoverVersion, Role, Source } from "./types";
import { CLUB, DEMO_SOURCES, PEOPLE } from "./data";
import { reconstruct as runReconstruct, toChunks, fmtDate, taskTopic } from "./pipeline";
import { llmExtract } from "./connectors";

export interface Flag {
  claimId: string;
  by: string;
  at: string;
  reason: string;
}

export interface State {
  step: number;
  enabled: string[];
  live: Source[];
  chunks: Chunk[];
  ingestedAt?: string;
  mode: "rules" | "llm";
  modeNote?: string;
  reconstructedAt?: string;
  claims: Claim[];
  gaps: GapQuestion[];
  versions: HandoverVersion[];
  acks: { personId: string; version: number; at: string }[];
  flags: Flag[];
  audit: AuditEntry[];
  reader: string;
}

const initial = (): State => ({
  step: 0,
  enabled: DEMO_SOURCES.map((s) => s.id),
  live: [],
  chunks: [],
  mode: "rules",
  claims: [],
  gaps: [],
  versions: [],
  acks: [],
  flags: [],
  audit: [],
  reader: "priya",
});

const KEY = "baton-state-v1";
const now = () => new Date().toISOString();
const name = (id: string) => PEOPLE.find((p) => p.id === id)?.name ?? id;

interface Ctx {
  s: State;
  ready: boolean;
  allSources: Source[];
  setStep: (n: number) => void;
  setReader: (id: string) => void;
  toggleSource: (id: string) => void;
  addLive: (src: Source) => void;
  ingest: () => void;
  reconstruct: (mode: "rules" | "llm") => Promise<void>;
  answerGap: (qid: string, answer: string) => void;
  review: (claimId: string, state: "accepted" | "rejected" | "edited" | "pending", text?: string) => void;
  resolveConflict: (group: string, value: string) => void;
  acceptAllRemaining: () => void;
  approve: () => void;
  acknowledge: (personId: string) => void;
  flag: (claimId: string, personId: string, reason: string) => void;
  reset: () => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);
  const latest = useRef(s);
  latest.current = s;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setS({ ...initial(), ...JSON.parse(raw) });
    } catch {
      /* storage unavailable: start fresh */
    }
    loaded.current = true;
    setReady(true);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, [s]);

  const log = (st: State, actor: string, action: string): AuditEntry[] => [{ at: now(), actor, action }, ...st.audit].slice(0, 200);

  const allSources = useMemo(() => [...DEMO_SOURCES, ...s.live], [s.live]);

  const setStep = useCallback((n: number) => setS((st) => ({ ...st, step: n })), []);
  const setReader = useCallback((id: string) => setS((st) => ({ ...st, reader: id })), []);

  const toggleSource = useCallback(
    (id: string) =>
      setS((st) => ({
        ...st,
        enabled: st.enabled.includes(id) ? st.enabled.filter((x) => x !== id) : [...st.enabled, id],
      })),
    [],
  );

  const addLive = useCallback(
    (src: Source) =>
      setS((st) => ({
        ...st,
        live: [...st.live.filter((x) => x.id !== src.id), src],
        enabled: st.enabled.includes(src.id) ? st.enabled : [...st.enabled, src.id],
        audit: log(st, CLUB.leaverName, `Imported live GitHub repository ${src.name.replace("GitHub · ", "")} (${src.items.length} records)`),
      })),
    [],
  );

  const ingest = useCallback(
    () =>
      setS((st) => {
        const srcs = [...DEMO_SOURCES, ...st.live].filter((x) => st.enabled.includes(x.id));
        const chunks = toChunks(srcs);
        return {
          ...st,
          chunks,
          ingestedAt: now(),
          claims: [],
          gaps: [],
          reconstructedAt: undefined,
          step: 1,
          audit: log(st, CLUB.leaverName, `Connected ${srcs.length} sources and ingested ${chunks.length} records`),
        };
      }),
    [],
  );

  const reconstruct = useCallback(
    async (mode: "rules" | "llm") => {
      const chunks: Chunk[] = latest.current.chunks;
      let llmClaims: Claim[] | undefined;
      let modeNote = "Rule-based extractor";
      let usedMode: "rules" | "llm" = "rules";
      if (mode === "llm") {
        try {
          llmClaims = await llmExtract(chunks);
          usedMode = "llm";
          modeNote = "AI extraction (Gemini) + structured data";
        } catch (e) {
          modeNote = `AI extraction failed (${String((e as Error).message).slice(0, 80)}). Fell back to the rule-based extractor.`;
        }
      }
      const r = runReconstruct(chunks, CLUB.leaverName, llmClaims);
      setS((st) => ({
        ...st,
        claims: r.claims,
        gaps: r.gaps,
        mode: usedMode,
        modeNote: r.dropped ? `${modeNote}. ${r.dropped} claim(s) dropped by the citation check.` : modeNote,
        reconstructedAt: now(),
        versions: st.versions,
        audit: log(
          st,
          "Baton",
          `Reconstructed ${r.claims.length} claims and ${r.gaps.length} gap questions (${modeNote}${r.dropped ? `; ${r.dropped} unsupported claims dropped` : ""})`,
        ),
      }));
    },
    [],
  );

  const answerGap = useCallback(
    (qid: string, answer: string) =>
      setS((st) => {
        const q = st.gaps.find((g) => g.id === qid);
        if (!q || !answer.trim()) return st;
        const related = st.claims.find((c) => c.id === q.claimId);
        if (!related) return st;
        const chunkMap = new Map(st.chunks.map((c) => [c.id, c]));
        // the answer inherits the strictest access of the claim it is about
        let access: Role[] = ["member", "tech", "finance", "core", "advisor"];
        for (const e of related.evidence) {
          const ch = chunkMap.get(e.chunkId);
          if (ch) access = access.filter((r) => ch.access.includes(r));
        }
        const chunkId = `iv-${q.id}`;
        const chunk: Chunk = {
          id: chunkId,
          sourceId: "interview",
          kind: "interview",
          sourceName: `Exit interview · ${CLUB.leaverName}`,
          title: q.question,
          author: CLUB.leaverName,
          date: now().slice(0, 10),
          text: `Q: ${q.question}\nA: ${answer.trim()}`,
          access,
          confidential: related.sensitive && related.type !== "credential",
        };
        const subject = related.text.match(/"(.+?)"/)?.[1] ?? related.text.replace(/^Decision: /, "").replace(/\.$/, "");
        const label =
          q.kind === "no-reason"
            ? `Reason for "${subject}"`
            : q.kind === "no-owner"
              ? `Owner for "${subject}"`
              : q.kind === "owner-leaving"
                ? `Handover of "${subject}"`
                : q.kind === "credential"
                  ? "Credential handover"
                  : `On the ${related.conflictGroup?.replace(/^deadline /, "") ?? "conflict"}`;
        const statedId = `stated-${q.id}`;
        const stated: Claim = {
          id: statedId,
          type: related.type === "gap" ? "task" : related.type,
          text: `${label}: ${answer.trim()}`,
          status: "stated",
          evidence: [{ chunkId, quote: answer.trim() }],
          origin: "interview",
          value: answer.trim(),
          note: `Stated by ${CLUB.leaverName} in the exit interview. Not yet checked against other sources.`,
          citationOk: true,
          sensitive: chunk.confidential,
          review: { state: "pending" },
        };
        return {
          ...st,
          chunks: [...st.chunks.filter((c) => c.id !== chunkId), chunk],
          gaps: st.gaps.map((g) => (g.id === qid ? { ...g, answer: answer.trim() } : g)),
          claims: [
            ...st.claims
              .filter((c) => c.id !== statedId)
              .map((c) => (c.id === related.id && q.kind !== "conflict" ? { ...c, answeredBy: statedId } : c)),
            stated,
          ],
          audit: log(st, CLUB.leaverName, `Answered exit-interview question: "${q.question.slice(0, 70)}…"`),
        };
      }),
    [],
  );

  const review = useCallback(
    (claimId: string, state: "accepted" | "rejected" | "edited" | "pending", text?: string) =>
      setS((st) => ({
        ...st,
        claims: st.claims.map((c) =>
          c.id === claimId
            ? {
                ...c,
                text: state === "edited" && text ? text : c.text,
                review: { state, by: name("rao"), at: now() },
              }
            : c,
        ),
        audit: log(st, name("rao"), `${state === "pending" ? "Reopened" : state[0].toUpperCase() + state.slice(1)} claim: "${(text ?? st.claims.find((c) => c.id === claimId)?.text ?? "").slice(0, 70)}"`),
      })),
    [],
  );

  const resolveConflict = useCallback(
    (group: string, value: string) =>
      setS((st) => ({
        ...st,
        claims: st.claims.map((c) => {
          // keep task cards consistent with a corrected deadline
          if (c.type === "task" && c.due && group.startsWith("deadline ") && /^\d{4}-/.test(value) && c.due !== value) {
            const title = c.text.split(" — ")[0];
            if (`deadline ${taskTopic(title)}` === group) {
              return {
                ...c,
                due: value,
                text: c.text.replace(fmtDate(c.due), fmtDate(value)),
                note: `Due date corrected from ${fmtDate(c.due)} by ${name("rao")} after resolving a conflict.`,
              };
            }
          }
          if (c.conflictGroup !== group) return c;
          return c.value === value
            ? {
                ...c,
                status: "verified",
                note: `Conflict resolved by ${name("rao")}: confirmed as correct.`,
                review: { state: "accepted", by: name("rao"), at: now() },
              }
            : {
                ...c,
                note: `Superseded: ${name("rao")} confirmed a different value.`,
                review: { state: "rejected", by: name("rao"), at: now() },
              };
        }),
        audit: log(st, name("rao"), `Resolved conflict on ${group.replace(/^deadline /, "")} → ${/^\d{4}-/.test(value) ? fmtDate(value) : value}`),
      })),
    [],
  );

  const acceptAllRemaining = useCallback(
    () =>
      setS((st) => {
        let n = 0;
        const claims = st.claims.map((c) => {
          if (c.review.state !== "pending" || c.status === "conflicting") return c;
          n += 1;
          return { ...c, review: { state: "accepted" as const, by: name("rao"), at: now() } };
        });
        return { ...st, claims, audit: log(st, name("rao"), `Accepted ${n} remaining claims in bulk`) };
      }),
    [],
  );

  const approve = useCallback(
    () =>
      setS((st) => {
        const version = (st.versions[0]?.version ?? 0) + 1;
        const v: HandoverVersion = {
          version,
          approvedAt: now(),
          approvedBy: name("rao"),
          claims: st.claims.filter((c) => c.review.state === "accepted" || c.review.state === "edited"),
        };
        return {
          ...st,
          versions: [v, ...st.versions],
          step: 4,
          audit: log(st, name("rao"), `Approved handover version ${version} (${v.claims.length} claims)`),
        };
      }),
    [],
  );

  const acknowledge = useCallback(
    (personId: string) =>
      setS((st) => {
        const version = st.versions[0]?.version;
        if (!version) return st;
        return {
          ...st,
          acks: [...st.acks.filter((a) => !(a.personId === personId && a.version === version)), { personId, version, at: now() }],
          audit: log(st, name(personId), `Acknowledged receipt of handover version ${version}`),
        };
      }),
    [],
  );

  const flag = useCallback(
    (claimId: string, personId: string, reason: string) =>
      setS((st) => ({
        ...st,
        flags: [{ claimId, by: name(personId), at: now(), reason }, ...st.flags],
        claims: st.claims.map((c) => (c.id === claimId ? { ...c, review: { state: "pending" } } : c)),
        audit: log(st, name(personId), `Flagged a claim as wrong: "${reason.slice(0, 60)}" (sent back to the reviewer)`),
      })),
    [],
  );

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setS(initial());
  }, []);

  return (
    <StoreCtx.Provider
      value={{
        s,
        ready,
        allSources,
        setStep,
        setReader,
        toggleSource,
        addLive,
        ingest,
        reconstruct,
        answerGap,
        review,
        resolveConflict,
        acceptAllRemaining,
        approve,
        acknowledge,
        flag,
        reset,
      }}
    >
      {children}
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}

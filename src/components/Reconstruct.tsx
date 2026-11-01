"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { llmStatus } from "@/lib/connectors";
import { fmtDate, redact } from "@/lib/pipeline";
import type { Claim, ClaimType } from "@/lib/types";
import { Button, Card, ClaimRow, Hint, Stat, StatusBadge, TYPE_LABEL, cx } from "./ui";

const GROUPS: { title: string; types: ClaimType[] }[] = [
  { title: "Decisions and technology choices", types: ["decision", "techchoice"] },
  { title: "Ownership, tasks and role changes", types: ["owner", "task", "handover"] },
  { title: "Deadlines", types: ["deadline"] },
  { title: "Risks, gaps and requirements", types: ["risk", "gap", "dependency"] },
  { title: "Recurring problems", types: ["recurring"] },
  { title: "Contacts, credentials and finance", types: ["contact", "credential", "finance"] },
];

export function Reconstruct() {
  const { s, reconstruct, setStep } = useStore();
  const [ai, setAi] = useState<{ llm: boolean; model: string } | null>(null);
  const [mode, setMode] = useState<"rules" | "llm">("rules");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    llmStatus().then((r) => {
      setAi(r);
      if (r.llm) setMode("llm");
    });
  }, []);

  const chunkMap = useMemo(() => new Map(s.chunks.map((c) => [c.id, c])), [s.chunks]);
  const claims = s.claims.filter((c) => c.origin !== "interview");

  const timeline = useMemo(() => {
    const items: { date: string; claim: Claim }[] = [];
    for (const c of claims) {
      if (c.type === "deadline" && c.due) items.push({ date: c.due, claim: c });
      else if (c.type === "decision" || c.type === "techchoice" || c.type === "handover") {
        const ch = chunkMap.get(c.evidence[0]?.chunkId);
        if (ch) items.push({ date: ch.date, claim: c });
      }
    }
    const seen = new Set<string>();
    return items
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .filter((i) => {
        const k = i.date + i.claim.text;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }, [claims, chunkMap]);

  async function run() {
    setBusy(true);
    await reconstruct(mode);
    setBusy(false);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <Hint>
        Baton reads the {s.chunks.length} ingested records and pulls out decisions, owners, tasks, deadlines, risks,
        dependencies, recurring problems and contacts. Press <b>Reconstruct project state</b>, then look through the results.
      </Hint>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <div className="mb-2 text-sm font-semibold text-slate-900">Extraction engine</div>
            <div className="flex flex-wrap gap-2">
              <label className={cx("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm", mode === "rules" ? "border-teal-600 bg-teal-50" : "border-slate-300")}>
                <input type="radio" name="mode" checked={mode === "rules"} onChange={() => setMode("rules")} className="accent-teal-700" />
                Rule-based extractor
              </label>
              <label
                title={ai?.llm ? "" : "Add GEMINI_API_KEY to the server environment to enable"}
                className={cx(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  !ai?.llm && "cursor-not-allowed opacity-50",
                  ai?.llm && "cursor-pointer",
                  mode === "llm" ? "border-teal-600 bg-teal-50" : "border-slate-300",
                )}
              >
                <input type="radio" name="mode" disabled={!ai?.llm} checked={mode === "llm"} onChange={() => setMode("llm")} className="accent-teal-700" />
                AI extraction {ai?.llm ? `(${ai.model})` : "(not configured)"}
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Either way, every claim must quote its source word for word. Code checks each quote, and claims that fail are
              downgraded or dropped.
            </p>
          </div>
          <Button onClick={run} disabled={busy || s.chunks.length === 0}>
            {busy ? "Reconstructing…" : s.reconstructedAt ? "Run again" : "Reconstruct project state"}
          </Button>
        </div>
        {s.modeNote && s.reconstructedAt && <p className="mt-3 text-xs text-slate-600">Last run: {s.modeNote}</p>}
      </Card>

      {s.reconstructedAt && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat n={claims.length} label="claims found" />
            <Stat n={claims.filter((c) => c.type === "decision").length} label="decisions" />
            <Stat n={claims.filter((c) => c.type === "task").length} label="tasks" />
            <Stat n={claims.filter((c) => c.status === "conflicting").length} label="conflicting claims" />
            <Stat n={s.gaps.length} label="gaps to ask about" />
          </div>

          <Card>
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="font-semibold text-slate-900">Project timeline</h3>
              <p className="text-xs text-slate-500">Decisions in the order they were made, and the deadlines ahead.</p>
            </div>
            <ol className="relative px-4 py-3">
              {timeline.map(({ date, claim }, i) => {
                const future = date >= today;
                return (
                  <li key={i} className="flex gap-3 py-1.5">
                    <div className={cx("w-24 shrink-0 text-right text-xs", future ? "font-semibold text-teal-800" : "text-slate-500")}>{fmtDate(date)}</div>
                    <div className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", future ? "bg-teal-600" : "bg-slate-300")} />
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-sm">
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">{TYPE_LABEL[claim.type]}</span>
                      <span className="text-slate-800">{redact(claim.text)}</span>
                      {claim.status !== "verified" && <StatusBadge status={claim.status} />}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {GROUPS.map((g) => {
            const list = claims.filter((c) => g.types.includes(c.type));
            if (!list.length) return null;
            return (
              <Card key={g.title}>
                <div className="border-b border-slate-100 px-4 py-3">
                  <h3 className="font-semibold text-slate-900">
                    {g.title} <span className="font-normal text-slate-400">({list.length})</span>
                  </h3>
                </div>
                {list.map((c) => (
                  <ClaimRow key={c.id} claim={c} chunkMap={chunkMap} />
                ))}
              </Card>
            );
          })}

          <div className="flex justify-end">
            <Button onClick={() => setStep(2)}>Continue to Verify →</Button>
          </div>
        </>
      )}
    </div>
  );
}

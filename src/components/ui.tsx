"use client";

import { useState } from "react";
import type { Chunk, Claim, ClaimStatus, ClaimType } from "@/lib/types";
import { claimAccessLabel, fmtDate, redact } from "@/lib/pipeline";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  size = "md",
  title,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  size?: "sm" | "md";
  title?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm",
        variant === "primary" && "bg-teal-700 text-white hover:bg-teal-800",
        variant === "secondary" && "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100",
        variant === "danger" && "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
      )}
    >
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-slate-200 bg-white", className)}>{children}</div>;
}

export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
      <span className="font-semibold">What to do here: </span>
      {children}
    </div>
  );
}

export const STATUS: Record<ClaimStatus, { label: string; cls: string; help: string }> = {
  verified: { label: "Verified", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", help: "A source states this directly." },
  inferred: { label: "Inferred", cls: "bg-amber-50 text-amber-800 ring-amber-200", help: "Derived from patterns; reasoning shown." },
  conflicting: { label: "Conflicting", cls: "bg-rose-50 text-rose-800 ring-rose-200", help: "Sources disagree." },
  missing: { label: "Missing", cls: "bg-slate-100 text-slate-700 ring-slate-300", help: "Expected but not found in any source." },
  stated: { label: "Stated by leaver", cls: "bg-sky-50 text-sky-800 ring-sky-200", help: "From the exit interview; not yet checked against other sources." },
};

export function StatusBadge({ status }: { status: ClaimStatus }) {
  const s = STATUS[status];
  return (
    <span title={s.help} className={cx("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", s.cls)}>
      {s.label}
    </span>
  );
}

export const TYPE_LABEL: Record<ClaimType, string> = {
  decision: "Decision",
  owner: "Ownership",
  task: "Task",
  deadline: "Deadline",
  dependency: "Requirement",
  contact: "Contact",
  recurring: "Recurring problem",
  credential: "Credential",
  risk: "Risk",
  techchoice: "Tech choice",
  finance: "Finance",
  handover: "Role change",
  gap: "Gap",
};

export function TypeTag({ type }: { type: ClaimType }) {
  return <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-500">{TYPE_LABEL[type]}</span>;
}

const KIND_ICON: Record<string, string> = { github: "GH", drive: "DR", discord: "DC", trello: "TR", interview: "EI" };
const KIND_CLS: Record<string, string> = {
  github: "bg-slate-800 text-white",
  drive: "bg-yellow-400 text-yellow-950",
  discord: "bg-indigo-500 text-white",
  trello: "bg-sky-600 text-white",
  interview: "bg-teal-600 text-white",
};

export function KindIcon({ kind }: { kind: string }) {
  return (
    <span className={cx("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold", KIND_CLS[kind])}>
      {KIND_ICON[kind]}
    </span>
  );
}

function Highlight({ text, quotes }: { text: string; quotes: string[] }) {
  const shown = redact(text);
  const ranges: [number, number][] = [];
  for (const q of quotes) {
    const pattern = q
      .trim()
      .split(/\s+/)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s+");
    if (!pattern) continue;
    const m = new RegExp(pattern, "i").exec(shown);
    if (m) ranges.push([m.index, m.index + m[0].length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([a, b], k) => {
    if (a < pos) return;
    parts.push(shown.slice(pos, a));
    parts.push(
      <mark key={k} className="rounded bg-yellow-200 px-0.5 text-slate-900">
        {shown.slice(a, b)}
      </mark>,
    );
    pos = b;
  });
  parts.push(shown.slice(pos));
  return <span className="whitespace-pre-wrap">{parts}</span>;
}

export function Citations({ claim, chunkMap }: { claim: Claim; chunkMap: Map<string, Chunk> }) {
  const byChunk = new Map<string, string[]>();
  for (const e of claim.evidence) byChunk.set(e.chunkId, [...(byChunk.get(e.chunkId) || []), e.quote]);
  return (
    <div className="mt-2 space-y-2">
      {[...byChunk.entries()].map(([id, quotes]) => {
        const ch = chunkMap.get(id);
        if (!ch) return null;
        return (
          <div key={id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <KindIcon kind={ch.kind} />
              <span className="font-semibold text-slate-900">{ch.sourceName}</span>
              <span className="text-slate-500">· {ch.title.length > 70 ? ch.title.slice(0, 70) + "…" : ch.title}</span>
              <span className="text-slate-500">· {ch.author}, {fmtDate(ch.date)}</span>
              {ch.url && (
                <a href={ch.url} target="_blank" rel="noreferrer" className="text-teal-700 underline">
                  open
                </a>
              )}
            </div>
            <div className="font-mono text-[11.5px] leading-relaxed">
              <Highlight text={ch.text.length > 900 ? ch.text.slice(0, 900) + "…" : ch.text} quotes={quotes} />
            </div>
          </div>
        );
      })}
      <div className="text-[11px] text-slate-500">
        Visible to: {claimAccessLabel(claim, chunkMap)}
        {claim.citationOk ? " · citation check passed (quote found verbatim in source)" : ""}
      </div>
    </div>
  );
}

export function ClaimRow({
  claim,
  chunkMap,
  right,
  showType = true,
  children,
}: {
  claim: Claim;
  chunkMap: Map<string, Chunk>;
  right?: React.ReactNode;
  showType?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 px-4 py-3 last:border-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={claim.status} />
            {showType && <TypeTag type={claim.type} />}
            {claim.sensitive && (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800 ring-1 ring-violet-200">
                Sensitive
              </span>
            )}
            {claim.origin === "llm" && <span className="text-[11px] text-slate-400">AI-extracted</span>}
          </div>
          <div className="text-sm text-slate-900">{redact(claim.text)}</div>
          {claim.note && <div className="mt-0.5 text-xs text-slate-500">{claim.note}</div>}
          <button onClick={() => setOpen(!open)} className="mt-1 text-xs font-medium text-teal-700 hover:underline">
            {open ? "Hide source" : `Show source (${claim.evidence.length})`}
          </button>
          {open && <Citations claim={claim} chunkMap={chunkMap} />}
          {children}
        </div>
        {right && <div className="flex shrink-0 items-center gap-1.5">{right}</div>}
      </div>
    </div>
  );
}

export function Stat({ n, label, cls }: { n: number | string; label: string; cls?: string }) {
  return (
    <div className={cx("rounded-lg border border-slate-200 bg-white px-3 py-2", cls)}>
      <div className="text-xl font-semibold text-slate-900">{n}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

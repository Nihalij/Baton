"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { fmtDate } from "@/lib/pipeline";
import type { Claim } from "@/lib/types";
import { Button, Card, ClaimRow, Hint, cx } from "./ui";

function ReviewState({ c }: { c: Claim }) {
  const st = c.review.state;
  if (st === "pending") return <span className="text-[11px] font-semibold text-slate-400">Not reviewed</span>;
  return (
    <span
      className={cx(
        "text-[11px] font-semibold",
        st === "accepted" && "text-emerald-700",
        st === "edited" && "text-sky-700",
        st === "rejected" && "text-rose-700",
      )}
    >
      {st === "accepted" ? "Accepted" : st === "edited" ? "Edited" : "Rejected"}
    </span>
  );
}

export function Review() {
  const { s, review, resolveConflict, acceptAllRemaining, approve } = useStore();
  const chunkMap = useMemo(() => new Map(s.chunks.map((c) => [c.id, c])), [s.chunks]);
  const [filter, setFilter] = useState<"attention" | "all">("attention");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [choice, setChoice] = useState<Record<string, string>>({});

  const openGroups = [...new Set(s.claims.filter((c) => c.status === "conflicting" && c.review.state !== "rejected").map((c) => c.conflictGroup!))];
  const flaggedIds = new Set(s.flags.map((f) => f.claimId));
  const needsAttention = (c: Claim) =>
    c.status !== "verified" || c.sensitive || flaggedIds.has(c.id) || c.review.state === "edited";
  const list = s.claims
    .filter((c) => c.status !== "conflicting")
    .filter((c) => filter === "all" || needsAttention(c));
  const pending = s.claims.filter((c) => c.review.state === "pending").length;
  const reviewed = s.claims.length - pending;
  const canApprove = openGroups.length === 0 && pending === 0 && s.claims.length > 0;
  const latest = s.versions[0];
  const changedSince = latest && s.claims.some((c) => c.review.at && c.review.at > latest.approvedAt);

  return (
    <div className="space-y-5">
      <Hint>
        You are now <b>Dr. Meera Rao</b>, the faculty advisor. Resolve each conflict, check the claims that need attention
        (inferred, missing, stated by the leaver, sensitive), then <b>Accept all remaining</b> and <b>Approve</b>. Nothing is
        shared until you approve.
      </Hint>

      {s.flags.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 p-4">
          <h3 className="mb-2 font-semibold text-amber-900">Flagged by incoming members ({s.flags.length})</h3>
          <ul className="space-y-1 text-sm text-amber-900">
            {s.flags.map((f, i) => (
              <li key={i}>
                <b>{f.by}</b>: “{f.reason}” on “{s.claims.find((c) => c.id === f.claimId)?.text.slice(0, 80)}”
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-800">Flagged claims were reopened. Review them below and approve a new version.</p>
        </Card>
      )}

      {openGroups.length > 0 && (
        <Card>
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="font-semibold text-slate-900">1. Resolve conflicts ({openGroups.length})</h3>
            <p className="text-xs text-slate-500">Pick the value that is correct. Check the sources and Aarav’s answer if he gave one.</p>
          </div>
          {openGroups.map((g) => {
            const claims = s.claims.filter((c) => c.conflictGroup === g);
            const values = [...new Set(claims.map((c) => c.value!))];
            const leaverSaid = s.claims.find((c) => c.origin === "interview" && c.text.startsWith(`On the ${g.replace(/^deadline /, "")}`));
            const label = g.replace(/^deadline /, "") + (g.startsWith("deadline") ? " deadline" : "");
            return (
              <div key={g} className="border-b border-slate-100 p-4 last:border-0">
                <div className="mb-2 text-sm font-semibold capitalize text-slate-900">{label}</div>
                <div className="space-y-2">
                  {values.map((v) => {
                    const support = claims.filter((c) => c.value === v);
                    return (
                      <label key={v} className={cx("block cursor-pointer rounded-lg border p-3", choice[g] === v ? "border-teal-600 bg-teal-50" : "border-slate-200")}>
                        <div className="flex items-center gap-2">
                          <input type="radio" name={g} checked={choice[g] === v} onChange={() => setChoice({ ...choice, [g]: v })} className="accent-teal-700" />
                          <span className="text-sm font-semibold text-slate-900">{/^\d{4}-/.test(v) ? fmtDate(v) : v}</span>
                          <span className="text-xs text-slate-500">
                            — {support.map((c) => chunkMap.get(c.evidence[0].chunkId)?.sourceName.replace(/^.* · /, "")).join(", ")}
                          </span>
                        </div>
                        {support.map((c) => (
                          <ClaimRow key={c.id} claim={c} chunkMap={chunkMap} showType={false} />
                        ))}
                      </label>
                    );
                  })}
                </div>
                {leaverSaid && (
                  <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-900">
                    <b>Aarav said:</b> {leaverSaid.value}
                  </p>
                )}
                <div className="mt-3">
                  <Button size="sm" disabled={!choice[g]} onClick={() => resolveConflict(g, choice[g])}>
                    Confirm and resolve
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="font-semibold text-slate-900">{openGroups.length ? "2. " : ""}Review claims</h3>
            <p className="text-xs text-slate-500">
              {reviewed} of {s.claims.length} reviewed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-300 p-0.5 text-xs">
              {(["attention", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cx("rounded-md px-2.5 py-1", filter === f ? "bg-slate-900 text-white" : "text-slate-600")}
                >
                  {f === "attention" ? "Needs attention" : "All claims"}
                </button>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={acceptAllRemaining} disabled={pending === 0}>
              Accept all remaining
            </Button>
          </div>
        </div>
        {list.length === 0 && <p className="px-4 py-6 text-sm text-slate-500">Nothing needs attention.</p>}
        {list.map((c) => (
          <ClaimRow
            key={c.id}
            claim={c}
            chunkMap={chunkMap}
            right={
              editing === c.id ? null : (
                <>
                  <ReviewState c={c} />
                  <Button size="sm" variant="secondary" onClick={() => review(c.id, "accepted")} title="Accept">
                    ✓
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditing(c.id);
                      setEditText(c.text);
                    }}
                    title="Edit"
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => review(c.id, "rejected")} title="Reject">
                    ✕
                  </Button>
                </>
              )
            }
          >
            {flaggedIds.has(c.id) && <div className="mt-1 text-xs font-semibold text-amber-700">Flagged as wrong by an incoming member</div>}
            {editing === c.id && (
              <div className="mt-2 flex gap-2">
                <input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal-600"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    review(c.id, "edited", editText);
                    setEditing(null);
                  }}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            )}
          </ClaimRow>
        ))}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900 px-5 py-4 text-white">
        <div className="text-sm">
          {openGroups.length > 0 && <div>⚠ {openGroups.length} conflict(s) still open</div>}
          {pending > 0 && <div>{pending} claim(s) not reviewed yet</div>}
          {canApprove && (
            <div>
              Ready to approve {s.claims.filter((c) => c.review.state !== "rejected").length} claims
              {latest ? ` as version ${latest.version + 1}` : ""}.
            </div>
          )}
          {latest && !changedSince && canApprove && <div className="text-slate-300">No changes since version {latest.version}.</div>}
        </div>
        <Button onClick={approve} disabled={!canApprove || (Boolean(latest) && !changedSince)}>
          Approve handover →
        </Button>
      </div>

      {s.versions.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-2 font-semibold text-slate-900">Version history</h3>
          <ul className="space-y-1 text-sm text-slate-700">
            {s.versions.map((v) => (
              <li key={v.version}>
                <b>v{v.version}</b> · approved by {v.approvedBy} · {new Date(v.approvedAt).toLocaleString()} · {v.claims.length} claims
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

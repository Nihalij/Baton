"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { ClaimStatus, GapQuestion } from "@/lib/types";
import { Button, Card, ClaimRow, Hint, STATUS, StatusBadge, cx } from "./ui";

// Ready-made answers so judges can move through the demo quickly.
const SAMPLE: [RegExp, string][] = [
  [/L298N/, "The L298N wasted too much power as heat and drained the battery in about 20 minutes. The TB6612FNG is far more efficient."],
  [/LiDAR sensor"\. What/, "ROS 2 SLAM needs a 2D LiDAR for navigation, and the sponsor confirmed equipment purchases are allowed."],
  [/Issue #42/, "Rohan Iyer should own it. The capacitor workaround helps, but the real fix is a separate battery for the Jetson."],
  [/Issue #51/, "Priya should own the migration. The schema is half done in src/telemetry/schema.sql."],
  [/rover firmware/, "The nav launch files and the brownout watchdog are fragile and undocumented. Priya should own the firmware; Rohan knows the motor module best."],
  [/Write design report/, "Priya takes over. Sections 1 to 3 are drafted in the Drive folder; test results and the Zentrix logo are still missing."],
  [/sponsor progress report/, "Kabir takes over. Use the budget sheet and add rover photos; the sponsor expects it by email."],
  [/battery charging/, "Ishaan offered to build it in January. The parts are in the lab cupboard."],
  [/login was shared/, "Dr. Rao should receive it in person. Priya gets her own Vercel account, and the shared password must be changed."],
  [/telemetry database/, "MongoDB is still live because the PostgreSQL migration (issue #51) is not finished. PostgreSQL is the target."],
  [/design report deadline/, "22 January 2027 is correct. The organisers extended the deadline by email on 27 October."],
];

function sampleFor(q: GapQuestion) {
  return SAMPLE.find(([re]) => re.test(q.question))?.[1] ?? "";
}

const KIND_LABEL: Record<GapQuestion["kind"], string> = {
  "no-reason": "Decision without a reason",
  "no-owner": "Task without an owner",
  "owner-leaving": "Owned by you",
  conflict: "Sources disagree",
  credential: "Credential",
};

export function Verify() {
  const { s, answerGap, setStep } = useStore();
  const chunkMap = useMemo(() => new Map(s.chunks.map((c) => [c.id, c])), [s.chunks]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const counts = (Object.keys(STATUS) as ClaimStatus[]).map((k) => [k, s.claims.filter((c) => c.status === k).length] as const);
  const groups = [...new Set(s.claims.filter((c) => c.status === "conflicting").map((c) => c.conflictGroup!))];
  const answered = s.gaps.filter((g) => g.answer).length;

  function fillAll() {
    for (const g of s.gaps) {
      if (!g.answer) {
        const a = sampleFor(g);
        if (a) answerGap(g.id, a);
      }
    }
  }

  return (
    <div className="space-y-5">
      <Hint>
        Every claim now has a status. Instead of writing a handover from memory, Aarav answers only the{" "}
        <b>{s.gaps.length} questions</b> the sources could not answer. Type an answer and press <b>Save</b>, or use{" "}
        <b>Fill sample answers</b> for the demo. Unanswered questions stay visible as open gaps.
      </Hint>

      <Card className="p-4">
        <h3 className="mb-3 font-semibold text-slate-900">Claim ledger</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {counts.map(([k, n]) => (
            <div key={k} className="rounded-lg border border-slate-200 p-3">
              <StatusBadge status={k} />
              <div className="mt-1.5 text-xl font-semibold text-slate-900">{n}</div>
              <div className="text-[11px] leading-snug text-slate-500">{STATUS[k].help}</div>
            </div>
          ))}
        </div>
      </Card>

      {groups.length > 0 && (
        <Card>
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="font-semibold text-slate-900">Conflicts found ({groups.length})</h3>
            <p className="text-xs text-slate-500">Baton never merges disagreeing sources silently. The reviewer must decide.</p>
          </div>
          {groups.map((g) => (
            <div key={g} className="border-b border-slate-100 last:border-0">
              <div className="bg-rose-50/50 px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-rose-800">
                {g.replace(/^deadline /, "") + (g.startsWith("deadline") ? " deadline" : "")}
              </div>
              {s.claims
                .filter((c) => c.conflictGroup === g)
                .map((c) => (
                  <ClaimRow key={c.id} claim={c} chunkMap={chunkMap} showType={false} />
                ))}
            </div>
          ))}
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="font-semibold text-slate-900">Exit interview for Aarav</h3>
            <p className="text-xs text-slate-500">
              {answered} of {s.gaps.length} answered. Answers become new claims marked “Stated by leaver”, with the same access
              limits as the topic they are about.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={fillAll} disabled={answered === s.gaps.length}>
            Fill sample answers
          </Button>
        </div>
        <ol>
          {s.gaps.map((g, i) => {
            const draft = drafts[g.id] ?? g.answer ?? "";
            return (
              <li key={g.id} className="border-b border-slate-100 px-4 py-3 last:border-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">Q{i + 1}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{KIND_LABEL[g.kind]}</span>
                  {g.answer && <span className="text-[11px] font-semibold text-emerald-700">Saved</span>}
                </div>
                <p className="text-sm text-slate-900">{g.question}</p>
                <div className="mt-2 flex gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDrafts({ ...drafts, [g.id]: e.target.value })}
                    rows={2}
                    placeholder="Type Aarav's answer…"
                    className={cx(
                      "min-h-[44px] flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-teal-600",
                      g.answer ? "border-emerald-300 bg-emerald-50/40" : "border-slate-300",
                    )}
                  />
                  <div className="flex flex-col gap-1">
                    <Button size="sm" onClick={() => answerGap(g.id, draft)} disabled={!draft.trim() || draft.trim() === g.answer}>
                      Save
                    </Button>
                    {!g.answer && sampleFor(g) && (
                      <Button size="sm" variant="ghost" onClick={() => setDrafts({ ...drafts, [g.id]: sampleFor(g) })}>
                        Sample
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => setStep(3)}>Send to reviewer →</Button>
      </div>
    </div>
  );
}

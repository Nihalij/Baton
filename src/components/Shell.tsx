"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { CLUB } from "@/lib/data";
import { Connect } from "./Connect";
import { Reconstruct } from "./Reconstruct";
import { Verify } from "./Verify";
import { Review } from "./Review";
import { Handover } from "./Handover";
import { Button, cx } from "./ui";

const STEPS = [
  { n: "01", name: "Connect", desc: "Bring in authorised sources", actor: "Aarav · leaving" },
  { n: "02", name: "Reconstruct", desc: "Find decisions, owners, state", actor: "Baton" },
  { n: "03", name: "Verify", desc: "Check evidence, ask about gaps", actor: "Aarav · leaving" },
  { n: "04", name: "Review", desc: "Correct and approve", actor: "Dr. Rao · reviewer" },
  { n: "05", name: "Handover", desc: "Role-based continuation plan", actor: "Priya / Kabir · incoming" },
];

export function Shell() {
  const { s, ready, setStep, reset } = useStore();
  const [showLog, setShowLog] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  const unlocked = [true, s.chunks.length > 0, Boolean(s.reconstructedAt), Boolean(s.reconstructedAt), Boolean(s.reconstructedAt)];
  const done = [s.chunks.length > 0, Boolean(s.reconstructedAt), s.gaps.length > 0 && s.gaps.every((g) => g.answer), s.versions.length > 0, s.acks.length > 0];

  if (!ready) return <div className="p-10 text-sm text-slate-500">Loading…</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-sm font-bold text-white">B</div>
            <div>
              <div className="font-semibold leading-tight text-slate-900">Baton</div>
              <div className="text-xs text-slate-500">Knowledge handover · demo workspace: {CLUB.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowLog(!showLog)}>
              Audit log ({s.audit.length})
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={reset}
            >
              Reset demo
            </Button>
          </div>
        </div>
        <nav className="mx-auto max-w-5xl overflow-x-auto px-4 pb-3">
          <ol className="flex min-w-[640px] gap-2">
            {STEPS.map((st, i) => (
              <li key={st.n} className="flex-1">
                <button
                  disabled={!unlocked[i]}
                  onClick={() => setStep(i)}
                  className={cx(
                    "w-full rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40",
                    s.step === i ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white hover:border-slate-300",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cx("text-[11px] font-semibold", s.step === i ? "text-teal-100" : "text-teal-700")}>
                      {st.n} {done[i] && "✓"}
                    </span>
                  </div>
                  <div className="text-sm font-semibold">{st.name}</div>
                  <div className={cx("truncate text-[11px]", s.step === i ? "text-teal-100" : "text-slate-500")}>{st.actor}</div>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {showIntro && s.step === 0 && (
          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Prevent critical knowledge from leaving with people</h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-600">
                  Baton turns scattered project activity into a handover where every claim links to its source, uncertainty is
                  labelled, the leaver is asked only about real gaps, and each newcomer sees only what they are allowed to see.
                </p>
                <p className="mt-3 max-w-3xl text-sm text-slate-600">
                  <b>Scenario:</b> {CLUB.leaverName}, club lead of the fictional RoboCell Robotics Club, leaves in {CLUB.leavingOn}.
                  Priya Nair takes over as tech lead and Kabir Shah as treasurer. Dr. Meera Rao, the faculty advisor, reviews the
                  handover. Follow the five steps above, in order; it takes about 3 minutes.
                </p>
              </div>
              <button onClick={() => setShowIntro(false)} className="text-slate-400 hover:text-slate-600" aria-label="Hide introduction">
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {STEPS[s.step].n} · {STEPS[s.step].name}
          </h2>
          <p className="text-sm text-slate-500">{STEPS[s.step].desc}</p>
        </div>

        {s.step === 0 && <Connect />}
        {s.step === 1 && <Reconstruct />}
        {s.step === 2 && <Verify />}
        {s.step === 3 && <Review />}
        {s.step === 4 && <Handover />}

        {showLog && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">Audit log</div>
            <ul className="max-h-80 overflow-y-auto text-sm">
              {s.audit.map((a, i) => (
                <li key={i} className="flex gap-3 border-b border-slate-50 px-4 py-2">
                  <span className="w-20 shrink-0 text-xs text-slate-400">{new Date(a.at).toLocaleTimeString()}</span>
                  <span className="w-32 shrink-0 text-xs font-semibold text-slate-700">{a.actor}</span>
                  <span className="text-slate-700">{a.action}</span>
                </li>
              ))}
              {s.audit.length === 0 && <li className="px-4 py-3 text-slate-500">No activity yet.</li>}
            </ul>
          </div>
        )}
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-slate-400">
        All people, companies and data in this demo are fictional. Baton · Team OneByte.
      </footer>
    </div>
  );
}

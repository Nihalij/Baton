"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { importGithubRepo } from "@/lib/connectors";
import type { Role } from "@/lib/types";
import { Button, Card, Hint, KindIcon, cx } from "./ui";

const ACCESS_LABEL: Record<string, string> = {
  member: "All members",
  tech: "Tech team",
  finance: "Finance",
  core: "Core team",
  advisor: "Advisor",
};

function AccessChips({ access }: { access: Role[] }) {
  const shown = access.includes("member") ? ["member"] : access;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((r) => (
        <span key={r} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
          {ACCESS_LABEL[r]}
        </span>
      ))}
    </div>
  );
}

export function Connect() {
  const { s, allSources, toggleSource, addLive, ingest } = useStore();
  const [repo, setRepo] = useState("");
  const [access, setAccess] = useState<"tech" | "member">("tech");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const enabledCount = allSources.filter((x) => s.enabled.includes(x.id)).length;
  const records = allSources.filter((x) => s.enabled.includes(x.id)).reduce((n, x) => n + x.items.length, 0);

  async function doImport() {
    setErr("");
    setBusy(true);
    try {
      const roles: Role[] = access === "tech" ? ["tech", "core", "advisor"] : ["member", "tech", "finance", "core", "advisor"];
      const src = await importGithubRepo(repo, roles);
      if (src.items.length === 0) throw new Error("No README, open issues or commits found.");
      addLive(src);
      setRepo("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Hint>
        You are <b>Aarav</b>, the club lead who is leaving. Choose which project sources Baton may read, then press{" "}
        <b>Ingest</b>. Each source keeps its own access rules, which later decide who can see what.
      </Hint>

      <Card>
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="font-semibold text-slate-900">Authorised sources</h3>
          <p className="text-xs text-slate-500">Demo data for a fictional club. Untick a source to leave it out.</p>
        </div>
        <ul>
          {allSources.map((src) => {
            const on = s.enabled.includes(src.id);
            return (
              <li key={src.id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                <input
                  type="checkbox"
                  aria-label={`Include ${src.name}`}
                  checked={on}
                  onChange={() => toggleSource(src.id)}
                  className="h-4 w-4 accent-teal-700"
                />
                <KindIcon kind={src.kind} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cx("text-sm font-medium", on ? "text-slate-900" : "text-slate-400")}>{src.name}</span>
                    {src.confidential && (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800 ring-1 ring-violet-200">
                        Confidential
                      </span>
                    )}
                    {src.live && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                        Live import
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {src.description} · {src.items.length} records
                  </div>
                </div>
                <div className="hidden w-48 shrink-0 sm:block">
                  <div className="mb-0.5 text-[10px] uppercase tracking-wide text-slate-400">Who can see it</div>
                  <AccessChips access={src.access} />
                </div>
              </li>
            );
          })}
          <li className="flex items-center gap-3 px-4 py-3 opacity-60">
            <input type="checkbox" disabled aria-label="Personal DMs" className="h-4 w-4" />
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-200 text-[10px] font-bold text-slate-600">DM</span>
            <div className="text-sm text-slate-500">Personal direct messages — excluded by default and never ingested.</div>
          </li>
        </ul>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-slate-900">Add a real public GitHub repository (optional)</h3>
        <p className="mb-3 text-xs text-slate-500">
          Baton reads its README, open issues and recent commits live from GitHub, then treats them like any other source.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && repo && !busy && doImport()}
            placeholder="owner/repo, e.g. vercel/swr"
            className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
          <select
            value={access}
            onChange={(e) => setAccess(e.target.value as "tech" | "member")}
            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
            aria-label="Who can see the imported repository"
          >
            <option value="tech">Visible to tech team</option>
            <option value="member">Visible to all members</option>
          </select>
          <Button variant="secondary" onClick={doImport} disabled={!repo || busy}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </div>
        {err && <p className="mt-2 text-sm text-rose-700">{err}</p>}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900 px-5 py-4 text-white">
        <div className="text-sm">
          <b>{enabledCount}</b> sources selected · <b>{records}</b> records
          {s.ingestedAt && <span className="text-slate-300"> · last ingested {new Date(s.ingestedAt).toLocaleTimeString()}</span>}
        </div>
        <Button onClick={ingest} disabled={enabledCount === 0}>
          Ingest and continue →
        </Button>
      </div>
    </div>
  );
}

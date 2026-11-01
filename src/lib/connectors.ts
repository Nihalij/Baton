/* eslint-disable @typescript-eslint/no-explicit-any -- GitHub API responses are loosely typed */
import type { Chunk, Claim, ClaimType, Role, Source } from "./types";
import { redact } from "./pipeline";

// ---------------------------------------------------------------------------
// Live connector: any public GitHub repository, read through GitHub's REST API.
// No token needed (GitHub allows 60 unauthenticated requests per hour per IP).
// ---------------------------------------------------------------------------

async function gh(path: string, raw = false) {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json" },
  });
  if (!r.ok) {
    if (r.status === 404) throw new Error("Repository not found or not public.");
    if (r.status === 403) throw new Error("GitHub rate limit reached. Try again in a few minutes.");
    throw new Error(`GitHub returned ${r.status}.`);
  }
  return raw ? r.text() : r.json();
}

export function parseRepo(input: string): string | null {
  const m = input.trim().match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

export async function importGithubRepo(input: string, access: Role[]): Promise<Source> {
  const full = parseRepo(input);
  if (!full) throw new Error('Enter a repository as "owner/name" or a github.com link.');
  const repo = await gh(`/repos/${full}`);
  const [readme, issues, commits] = await Promise.all([
    gh(`/repos/${full}/readme`, true).catch(() => ""),
    gh(`/repos/${full}/issues?state=open&per_page=15`).catch(() => []),
    gh(`/repos/${full}/commits?per_page=30`).catch(() => []),
  ]);
  const items: Source["items"] = [];
  const today = new Date().toISOString().slice(0, 10);
  if (readme) {
    items.push({
      id: `live-${full}-readme`,
      title: "README",
      author: repo.owner?.login ?? full.split("/")[0],
      date: (repo.pushed_at || today).slice(0, 10),
      text: String(readme).replace(/<[^>]+>/g, " ").replace(/\n{3,}/g, "\n\n").slice(0, 3000),
      url: `${repo.html_url}#readme`,
    });
  }
  for (const it of (issues as Array<Record<string, any>>).filter((i) => !i.pull_request).slice(0, 12)) {
    const body = String(it.body || "").replace(/\r/g, "").replace(/<[^>]+>/g, " ").slice(0, 700);
    items.push({
      id: `live-${full}-issue-${it.number}`,
      title: `Issue #${it.number} · ${it.title}`,
      author: it.user?.login ?? "unknown",
      date: String(it.created_at).slice(0, 10),
      text: `${it.title}.${body ? "\n" + body : ""}`,
      url: it.html_url,
      meta: {
        state: "open",
        assignee: it.assignee?.login ?? null,
        labels: (it.labels || []).map((l: { name: string }) => l.name),
      },
    });
  }
  const cs = (commits as Array<Record<string, any>>).map((c) => ({
    date: String(c.commit?.author?.date || "").slice(0, 10),
    author: c.author?.login || c.commit?.author?.name || "unknown",
    message: String(c.commit?.message || "").split("\n")[0].slice(0, 120),
  }));
  if (cs.length) {
    items.push({
      id: `live-${full}-commits`,
      title: `Commit history (last ${cs.length})`,
      author: "GitHub",
      date: cs[0].date,
      text: cs.map((c) => `${c.date} ${c.author}: ${c.message}`).join("\n"),
      url: `${repo.html_url}/commits`,
      meta: { commits: cs },
    });
  }
  return {
    id: `live-${full}`,
    kind: "github",
    name: `GitHub · ${full}`,
    description: repo.description || "Imported live from GitHub.",
    access,
    live: true,
    items,
  };
}

// ---------------------------------------------------------------------------
// AI extraction (calls our own /api/extract route; the key stays on the server)
// ---------------------------------------------------------------------------

const TYPES: ClaimType[] = [
  "decision", "task", "deadline", "dependency", "contact", "recurring",
  "credential", "risk", "techchoice", "finance", "handover",
];

export async function llmStatus(): Promise<{ llm: boolean; model: string }> {
  try {
    const r = await fetch("/api/status", { cache: "no-store" });
    return await r.json();
  } catch {
    return { llm: false, model: "" };
  }
}

export async function llmExtract(chunks: Chunk[]): Promise<Claim[]> {
  const free = chunks.filter((c) => c.kind !== "trello" && !c.meta?.commits);
  const r = await fetch("/api/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    // secrets are masked BEFORE anything leaves the app
    body: JSON.stringify({ chunks: free.map((c) => ({ id: c.id, title: c.title, text: redact(c.text) })) }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.detail || data?.error || "AI extraction failed");
  let n = 0;
  return (data.claims as Array<Record<string, string>>)
    .filter((c) => c && c.chunk_id && c.quote && c.text)
    .map((c) => {
      n += 1;
      const type = (TYPES.includes(c.type as ClaimType) ? c.type : "dependency") as ClaimType;
      const attribute = (c.attribute || "").toLowerCase().trim() || undefined;
      const value = (c.value || "").trim() || undefined;
      return {
        id: `llm-${n}`,
        type,
        text: type === "decision" && !/^decision/i.test(c.text) ? `Decision: ${c.text}` : c.text,
        status: "verified",
        evidence: [{ chunkId: c.chunk_id, quote: c.quote }],
        origin: "llm",
        attribute,
        value,
        owner: c.owner || null,
        due: type === "deadline" && /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : null,
        reason: type === "decision" ? c.reason || null : null,
        note: type === "decision" ? (c.reason ? `Reason: ${c.reason}` : "No reason recorded in the source.") : undefined,
        sensitive: type === "credential",
        citationOk: false,
        review: { state: "pending" },
      } satisfies Claim;
    });
}

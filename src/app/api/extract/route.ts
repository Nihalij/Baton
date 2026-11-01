import { NextResponse } from "next/server";

// Server-side AI extraction. The API key never reaches the browser.
// Works with Google Gemini (free key from https://aistudio.google.com).

export const runtime = "nodejs";
export const maxDuration = 60;

interface InChunk {
  id: string;
  title: string;
  text: string;
}

const PROMPT = `You extract handover knowledge from project records of a student club.
Return ONLY JSON: {"claims":[...]} where each claim is:
{
 "type": one of "decision","task","deadline","dependency","contact","recurring","credential","risk","techchoice","finance","handover",
 "text": one short sentence stating the claim,
 "chunk_id": the id of the record it comes from,
 "quote": an EXACT substring copied character-for-character from that record that supports the claim,
 "attribute": for deadlines "deadline <short topic>", for technology choices "<component> database" or similar, else "",
 "value": for deadlines an ISO date yyyy-mm-dd, for technology choices the product name, else "",
 "owner": person responsible if stated, else "",
 "reason": for decisions the stated reason, else "" (do not invent reasons)
}
Rules: never invent facts, owners, reasons or dates. If a record has no useful claim, skip it.
Do not repeat secrets; they are already replaced with [REDACTED].
Use the same attribute wording for the same topic across records, so contradictions can be detected.`;

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "no-key" }, { status: 400 });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const { chunks } = (await req.json()) as { chunks: InChunk[] };
  if (!Array.isArray(chunks) || chunks.length === 0 || chunks.length > 200) {
    return NextResponse.json({ error: "bad-input" }, { status: 400 });
  }
  const records = chunks
    .map((c) => `<record id="${c.id}" title="${c.title.replace(/"/g, "'")}">\n${c.text.slice(0, 4000)}\n</record>`)
    .join("\n");

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${PROMPT}\n\nRecords:\n${records}` }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
        }),
      },
    );
    if (!r.ok) {
      const detail = await r.text();
      return NextResponse.json({ error: "llm-failed", status: r.status, detail: detail.slice(0, 300) }, { status: 502 });
    }
    const data = await r.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
    const parsed = JSON.parse(text.replace(/^```json\s*|```$/g, ""));
    return NextResponse.json({ claims: Array.isArray(parsed.claims) ? parsed.claims : [], model });
  } catch (e) {
    return NextResponse.json({ error: "llm-failed", detail: String(e).slice(0, 300) }, { status: 502 });
  }
}

export type Role = "member" | "tech" | "finance" | "core" | "advisor";

export type SourceKind = "github" | "drive" | "discord" | "trello" | "interview";

export interface SourceItem {
  id: string;
  title: string;
  author: string;
  date: string; // ISO yyyy-mm-dd
  text: string;
  url?: string;
  meta?: {
    assignee?: string | null;
    due?: string | null;
    state?: string;
    labels?: string[];
    list?: string;
    commits?: { date: string; author: string; message: string }[];
  };
}

export interface Source {
  id: string;
  kind: SourceKind;
  name: string;
  description: string;
  access: Role[];
  confidential?: boolean;
  live?: boolean;
  items: SourceItem[];
}

export interface Chunk {
  id: string;
  sourceId: string;
  kind: SourceKind;
  sourceName: string;
  title: string;
  author: string;
  date: string;
  url?: string;
  text: string;
  access: Role[];
  confidential?: boolean;
  meta?: SourceItem["meta"];
}

export type ClaimType =
  | "decision"
  | "owner"
  | "task"
  | "deadline"
  | "dependency"
  | "contact"
  | "recurring"
  | "credential"
  | "risk"
  | "techchoice"
  | "finance"
  | "handover"
  | "gap";

export type ClaimStatus = "verified" | "inferred" | "conflicting" | "missing" | "stated";

export interface Evidence {
  chunkId: string;
  quote: string;
}

export type ReviewState = "pending" | "accepted" | "edited" | "rejected";

export interface Claim {
  id: string;
  type: ClaimType;
  text: string;
  status: ClaimStatus;
  evidence: Evidence[];
  origin: "rules" | "structured" | "llm" | "interview" | "inferred" | "gap";
  attribute?: string; // normalised key used for conflict detection
  value?: string;
  owner?: string | null;
  due?: string | null;
  reason?: string | null;
  note?: string; // extra explanation shown to the reader (e.g. why inferred)
  conflictGroup?: string;
  citationOk: boolean;
  sensitive?: boolean;
  answeredBy?: string; // claim id of the interview answer that resolves this gap
  review: { state: ReviewState; by?: string; at?: string; note?: string };
}

export interface GapQuestion {
  id: string;
  claimId: string; // the missing / conflicting / risk claim it is about
  kind: "no-reason" | "no-owner" | "owner-leaving" | "conflict" | "credential";
  question: string;
  answer?: string;
}

export interface Person {
  id: string;
  name: string;
  title: string;
  roles: Role[];
  kind: "leaver" | "reviewer" | "incoming";
}

export interface HandoverVersion {
  version: number;
  approvedAt: string;
  approvedBy: string;
  claims: Claim[];
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
}

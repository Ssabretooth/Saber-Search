import type { FlagType, JudicialStatus } from "@/lib/types/flags";

export type SourceTier =
  | "tier1_official"
  | "tier2_judgment"
  | "tier2_indexed_republication"
  | "tier3_media";

export type VerificationStatus =
  | "machine_extracted"
  | "human_verified"
  | "disputed"
  | "withdrawn";

export type ReviewStatus = "draft" | "in_review" | "published" | "rejected";

export type DisclosureCategory =
  | "directorship"
  | "paid_employment"
  | "shareholding"
  | "consultancy"
  | "gift_hospitality"
  | "foreign_travel"
  | "land_property"
  | "other";

export type SpendType =
  | "domestic_travel"
  | "international_travel"
  | "constituency_allowance"
  | "other";

export type Chamber = "na" | "ncop";

export type MpPublic = {
  id: string;
  full_name: string;
  known_as: string | null;
  chamber: Chamber;
  party: string | null;
  constituency: string | null;
  portfolio: string | null;
  term_start: string | null;
  term_end: string | null;
  official_profile_url: string | null;
};

export type DisclosurePublic = {
  id: string;
  mp_id: string;
  category: DisclosureCategory;
  description: string | null;
  counterparty: string | null;
  value_zar: number | null;
  period_start: string | null;
  period_end: string | null;
  source_document_id: string;
  verification_status: Exclude<VerificationStatus, "withdrawn">;
  extracted_at: string;
};

export type SpendingPublic = {
  id: string;
  mp_id: string;
  spend_type: SpendType;
  amount_zar: number;
  period_start: string;
  period_end: string;
  department: string | null;
  source_document_id: string;
  verification_status: Exclude<VerificationStatus, "withdrawn" | "disputed">;
  extracted_at: string;
};

export type JudicialPublic = {
  id: string;
  mp_id: string;
  status: JudicialStatus;
  case_number: string | null;
  court: string | null;
  summary_neutral: string | null;
  status_as_of: string;
  source_document_id: string;
  verification_status: Exclude<VerificationStatus, "withdrawn">;
};

export type FlagPublic = {
  id: string;
  subject_type: string;
  subject_id: string;
  flag_type: FlagType;
  rule_id: string;
  rule_version: string;
  computed_value: number | null;
  threshold: number | null;
  public_text: string;
  source_document_id: string;
  reviewed_at: string | null;
};

export type SourcePublic = {
  id: string;
  source_id: string;
  publisher: string;
  title: string;
  url: string;
  tier: SourceTier;
  format: string;
  published_at: string | null;
  retrieved_at: string;
  sha256: string;
  licence_note: string | null;
};

export type SourceDocument = Pick<
  SourcePublic,
  "id" | "publisher" | "title" | "url" | "published_at" | "licence_note"
>;

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: {
      v_mps_public: { Row: MpPublic; Relationships: [] };
      v_disclosures_public: { Row: DisclosurePublic; Relationships: [] };
      v_spending_public: { Row: SpendingPublic; Relationships: [] };
      v_judicial_public: { Row: JudicialPublic; Relationships: [] };
      v_flags_public: { Row: FlagPublic; Relationships: [] };
      v_sources_public: { Row: SourcePublic; Relationships: [] };
    };
    Functions: Record<string, never>;
  };
};

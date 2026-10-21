export type FlagType =
  | "outlier_expense"
  | "disclosure_inconsistency"
  | "cipc_directorship_match"
  | "procurement_relationship"
  | "civil_proceeding"
  | "criminal_charge_pending"
  | "acquitted"
  | "convicted_appeal_pending"
  | "convicted_final";

export type JudicialStatus =
  | "charge_pending"
  | "acquitted"
  | "convicted_appeal_pending"
  | "convicted_final"
  | "civil_matter";

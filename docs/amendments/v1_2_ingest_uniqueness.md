# Module 2 uniqueness migration
Migration 0005_ingest_uniqueness.sql was added in Module 2 to make the
pipeline idempotent. The natural-key choices are:
  - mps: (full_name, chamber, term_start)
  - financial_disclosures: (source_document_id, mp_id, category,
    period_start, period_end, counterparty)
  - state_spending_logs: (source_document_id, mp_id, spend_type,
    period_start, period_end, department)
  - judicial_proceedings: (source_document_id, mp_id, status, case_number)
If a source produces two rows that legitimately differ only in fields NOT
in the natural key, this is a layout issue, not a schema issue — the parser
must produce rows whose natural keys are distinct.

-- Idempotency constraints for ingestion/run.py upserts.
-- Postgres 15 NULLS NOT DISTINCT makes nullable natural keys behave as
-- equal (NULL = NULL for uniqueness) without coalesce hacks.

create unique index if not exists source_documents_source_sha_uniq
  on source_documents (source_id, sha256);

create unique index if not exists mps_natural_key
  on mps (full_name, chamber, term_start) nulls not distinct;

create unique index if not exists financial_disclosures_natural_key
  on financial_disclosures (
    source_document_id, mp_id, category,
    period_start, period_end, counterparty
  ) nulls not distinct;

create unique index if not exists state_spending_logs_natural_key
  on state_spending_logs (
    source_document_id, mp_id, spend_type, period_start, period_end, department
  ) nulls not distinct;

create unique index if not exists judicial_proceedings_natural_key
  on judicial_proceedings (
    source_document_id, mp_id, status, case_number
  ) nulls not distinct;

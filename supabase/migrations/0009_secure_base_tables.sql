-- Revoke direct table access to force anon through the views
revoke all on financial_disclosures from anon, authenticated;
revoke all on state_spending_logs from anon, authenticated;
revoke all on judicial_proceedings from anon, authenticated;

-- Grant SELECT on ONLY the public columns (excluding row_hash, is_dormant)
grant select (
    id, mp_id, category, description, counterparty, value_zar,
    period_start, period_end, source_document_id, verification_status, extracted_at
) on financial_disclosures to anon, authenticated;

grant select (
    id, mp_id, spend_type, amount_zar, period_start, period_end,
    department, source_document_id, verification_status, extracted_at
) on state_spending_logs to anon, authenticated;

grant select (
    id, mp_id, status, case_number, court, summary_neutral,
    status_as_of, source_document_id, verification_status
) on judicial_proceedings to anon, authenticated;

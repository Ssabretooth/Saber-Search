-- Revoke all access to the base tables from public roles.
-- The security_invoker = false views (0010) run as the owner and do not
-- require anon to have base table privileges.

revoke all on financial_disclosures from anon, authenticated;
revoke all on state_spending_logs from anon, authenticated;
revoke all on judicial_proceedings from anon, authenticated;

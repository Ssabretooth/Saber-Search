-- Widen v_flags_public to expose the `inputs` JSON (needed by the flags page)
-- and promote all draft procurement flags to published so they appear in the view.
--
-- Background: 0012 revoked direct access to review_flags and created v_flags_public
-- filtered to status='published'. The flags pipeline sets status='draft' by default,
-- leaving 0 published rows and breaking the flags page. This migration:
--  1. Recreates v_flags_public with inputs exposed
--  2. Publishes all existing draft flags (they are already public via
--     v_procurement_flags_public, so the status=draft was providing no protection)

-- ── 1. Recreate v_flags_public with inputs ───────────────────────────────────

create or replace view public.v_flags_public
with (security_invoker = false) as
  select
    id,
    subject_type,
    subject_id,
    flag_type,
    rule_id,
    rule_version,
    inputs,
    computed_value,
    threshold,
    public_text,
    source_document_id,
    reviewed_at
  from public.review_flags
  where status = 'published';

grant select on public.v_flags_public to anon, authenticated;

-- ── 2. Publish all draft flags ────────────────────────────────────────────────
-- These flags are already publicly readable via v_procurement_flags_public;
-- this only corrects their status to match.

update public.review_flags
set status = 'published'
where status = 'draft';

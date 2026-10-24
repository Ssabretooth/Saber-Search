-- review_flags, disputes and source_documents were granted directly to anon in
-- 0003, which exposed reviewer ids, raw flag inputs, dispute statements and
-- local file paths. Route all public reads through explicit-column views that
-- run as the owner, then revoke the base tables.

drop view if exists v_flags_public;
drop view if exists v_sources_public;

create view v_flags_public with (security_invoker = false) as
  select id, subject_type, subject_id, flag_type, rule_id, rule_version,
         computed_value, threshold, public_text, source_document_id, reviewed_at
  from review_flags
  where status = 'published';

create view v_sources_public with (security_invoker = false) as
  select id, source_id, publisher, title, url, tier, format, published_at,
         retrieved_at, sha256, licence_note
  from source_documents;

grant select on v_flags_public, v_sources_public to anon, authenticated;

revoke all on review_flags from anon, authenticated;
revoke all on disputes from anon, authenticated;
revoke all on source_documents from anon, authenticated;

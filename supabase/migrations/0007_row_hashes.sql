drop index if exists financial_disclosures_natural_key;
drop index if exists state_spending_logs_natural_key;
drop index if exists judicial_proceedings_natural_key;

alter table financial_disclosures add column row_hash text not null default '';
alter table state_spending_logs add column row_hash text not null default '';
alter table judicial_proceedings add column row_hash text not null default '';

alter table financial_disclosures alter column row_hash drop default;
alter table state_spending_logs alter column row_hash drop default;
alter table judicial_proceedings alter column row_hash drop default;

create unique index financial_disclosures_row_hash_uniq on financial_disclosures (source_document_id, row_hash);
create unique index state_spending_logs_row_hash_uniq on state_spending_logs (source_document_id, row_hash);
create unique index judicial_proceedings_row_hash_uniq on judicial_proceedings (source_document_id, row_hash);

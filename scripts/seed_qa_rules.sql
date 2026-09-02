-- seed_qa_rules.sql
-- Development-only script to seed approved QA rules into medical_knowledge schema.

begin;

-- 0. Make a user an authorized reviewer
insert into medical_knowledge.authorized_reviewers (user_id, granted_by, granted_at, notes)
values ((select id from auth.users limit 1), (select id from auth.users limit 1), now(), 'System-verified')
on conflict do nothing;

-- 1. Insert Source Records
insert into medical_knowledge.source_records (id, source_name, external_identifier, source_url, payload_hash, normalized_payload)
values 
  ('11111111-1111-1111-1111-111111111111', 'dailymed', 'FDA-LABEL-83367', 'https://dailymed.nlm.nih.gov', 'hash1', '{}'::jsonb),
  ('22222222-2222-2222-2222-222222222222', 'openfda', 'FDA-LABEL-29046', 'https://open.fda.gov', 'hash2', '{}'::jsonb)
on conflict do nothing;

-- 2. Insert Atorvastatin Rule
insert into medical_knowledge.interaction_rules (
  id, rule_key, version, status, medication_selector, food_component_selector, temporal_logic,
  severity, mechanism, effect, recommendation_template
)
values (
  '33333333-3333-3333-3333-333333333333', 'ATORVASTATIN_GRAPEFRUIT', 1, 'draft',
  '{"type":"exact_rxcui","entities":["83367"],"condition":"ALL"}'::jsonb,
  '{"components":["grapefruit"],"condition":"ANY"}'::jsonb,
  '{"type":"none"}'::jsonb,
  'moderate', 'Grapefruit inhibits CYP3A4 metabolism of atorvastatin.',
  'Increased risk of myopathy and rhabdomyolysis.',
  'Avoid large quantities of grapefruit juice.'
) on conflict do nothing;

insert into medical_knowledge.rule_evidence (rule_id, citation_text, source_url, evidence_grade, source_record_id)
values ('33333333-3333-3333-3333-333333333333', 'FDA Notice', 'https://dailymed.nlm.nih.gov', 'B', '11111111-1111-1111-1111-111111111111')
on conflict do nothing;

update medical_knowledge.interaction_rules set status = 'submitted' where id = '33333333-3333-3333-3333-333333333333';

insert into medical_knowledge.rule_reviews (rule_id, reviewer_user_id, reviewer_credential_reference, decision, review_note)
values ('33333333-3333-3333-3333-333333333333', (select id from auth.users limit 1), 'System-verified', 'approved', 'Approved via M4 flow')
on conflict do nothing;

update medical_knowledge.interaction_rules 
set status = 'approved', effective_from = now(), 
    approved_by = (select id from auth.users limit 1), approved_at = now()
where id = '33333333-3333-3333-3333-333333333333';


-- 3. Insert Lisinopril Rule
insert into medical_knowledge.interaction_rules (
  id, rule_key, version, status, medication_selector, food_component_selector, temporal_logic,
  severity, mechanism, effect, recommendation_template
)
values (
  '44444444-4444-4444-4444-444444444444', 'LISINOPRIL_SPIRONOLACTONE_HYPERKALEMIA', 1, 'draft',
  '{"type":"exact_rxcui","entities":["29046","9997"],"condition":"ALL"}'::jsonb,
  '{"components":[],"condition":"ANY"}'::jsonb,
  '{"type":"none"}'::jsonb,
  'high', 'Additive potassium-retaining effect leads to severe hyperkalemia risk.',
  'May cause cardiac arrhythmias, muscle weakness, or cardiac arrest.',
  'Monitor serum potassium and renal function closely.'
) on conflict do nothing;

insert into medical_knowledge.rule_evidence (rule_id, citation_text, source_url, evidence_grade, source_record_id)
values ('44444444-4444-4444-4444-444444444444', 'FDA Warning', 'https://open.fda.gov', 'A', '22222222-2222-2222-2222-222222222222')
on conflict do nothing;

update medical_knowledge.interaction_rules set status = 'submitted' where id = '44444444-4444-4444-4444-444444444444';

insert into medical_knowledge.rule_reviews (rule_id, reviewer_user_id, reviewer_credential_reference, decision, review_note)
values ('44444444-4444-4444-4444-444444444444', (select id from auth.users limit 1), 'System-verified', 'approved', 'Approved via M4 flow')
on conflict do nothing;

update medical_knowledge.interaction_rules 
set status = 'approved', effective_from = now(), 
    approved_by = (select id from auth.users limit 1), approved_at = now()
where id = '44444444-4444-4444-4444-444444444444';

commit;

-- ==========================================
-- M6: DETERMINISTIC INTERACTION ENGINE RPC & RULES
-- ==========================================

begin;

-- Function to safely load approved interaction rules with evidence
create or replace function public.get_approved_interaction_rules()
returns jsonb
language plpgsql
security definer
set search_path = medical_knowledge, public
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'rule_key', r.rule_key,
        'version', r.version,
        'status', r.status,
        'medication_selector', r.medication_selector,
        'food_component_selector', r.food_component_selector,
        'temporal_logic', r.temporal_logic,
        'severity', r.severity,
        'mechanism', r.mechanism,
        'effect', r.effect,
        'recommendation_template', r.recommendation_template,
        'effective_from', r.effective_from,
        'effective_until', r.effective_until,
        'rule_evidence', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', e.id,
                'citation_text', e.citation_text,
                'source_url', e.source_url,
                'evidence_grade', e.evidence_grade,
                'source_record_id', e.source_record_id,
                'source_records', (
                  select jsonb_build_object(
                    'source_name', s.source_name,
                    'external_identifier', s.external_identifier
                  )
                  from medical_knowledge.source_records s
                  where s.id = e.source_record_id
                )
              )
            )
            from medical_knowledge.rule_evidence e
            where e.rule_id = r.id
          ),
          '[]'::jsonb
        )
      )
    ),
    '[]'::jsonb
  )
  into result
  from medical_knowledge.interaction_rules r
  where r.status = 'approved'
    and (r.effective_from is null or r.effective_from <= now())
    and (r.effective_until is null or r.effective_until >= now());

  return result;
end;
$$;

commit;

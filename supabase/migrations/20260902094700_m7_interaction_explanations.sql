-- M7: Controlled Gemini Explanation Layer Cache
CREATE TABLE public.interaction_explanations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id TEXT NOT NULL,
    audience TEXT NOT NULL CHECK (audience IN ('patient', 'professional')),
    language TEXT NOT NULL DEFAULT 'en',
    prompt_version INT NOT NULL DEFAULT 1,
    model TEXT NOT NULL,
    explanation_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(assessment_id, audience, language, prompt_version)
);

ALTER TABLE public.interaction_explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role Full Access"
ON public.interaction_explanations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

/*
# Keep or Go — Decision Engine Schema

Adds the data structures needed to power the multi-factor AI decision engine,
preference learning, and recommendation history.

1. Modified Tables
  - `items`: adds `confidence_level` (high/medium/low), `decision_factors` JSONB
    (array of weighted factors that drove the recommendation), `ai_scores` JSONB
    (raw score per option from the engine), `override_reason` (text the user
    provided when they disagreed with the AI), `what_if_context` JSONB (saved
    what-if override state), `item_factors` JSONB (all the input factors used
    for the decision, e.g. lastUsed, frequency, sentimentalValue).

2. New Tables
  - `preference_patterns`: stores learned patterns derived from user overrides.
    Each row is a (project_id, pattern_key, value) triple, e.g.
    pattern_key='category_Tools', value={"preferred":"keep","confidence":0.8}.
    Used to nudge future recommendations toward observed user habits.

3. Security
  - RLS enabled on new table. anon + authenticated (no sign-in required).
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='confidence_level') THEN
    ALTER TABLE items ADD COLUMN confidence_level text NOT NULL DEFAULT 'medium'
      CHECK (confidence_level IN ('high','medium','low'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='decision_factors') THEN
    ALTER TABLE items ADD COLUMN decision_factors jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='ai_scores') THEN
    ALTER TABLE items ADD COLUMN ai_scores jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='override_reason') THEN
    ALTER TABLE items ADD COLUMN override_reason text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='what_if_context') THEN
    ALTER TABLE items ADD COLUMN what_if_context jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='item_factors') THEN
    ALTER TABLE items ADD COLUMN item_factors jsonb;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS preference_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  pattern_key text NOT NULL,
  pattern_value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS preference_patterns_key_idx ON preference_patterns(project_id, pattern_key);
CREATE INDEX IF NOT EXISTS preference_patterns_project_idx ON preference_patterns(project_id);

ALTER TABLE preference_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_preference_patterns" ON preference_patterns;
CREATE POLICY "anon_select_preference_patterns" ON preference_patterns FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_preference_patterns" ON preference_patterns;
CREATE POLICY "anon_insert_preference_patterns" ON preference_patterns FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_preference_patterns" ON preference_patterns;
CREATE POLICY "anon_update_preference_patterns" ON preference_patterns FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_preference_patterns" ON preference_patterns;
CREATE POLICY "anon_delete_preference_patterns" ON preference_patterns FOR DELETE TO anon, authenticated USING (true);

import { supabase } from './supabase';
import type { Recommendation, UserDecision } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PatternValue {
  preferred: UserDecision;
  overrideCount: number;
  totalCount: number;
  confidence: number; // 0–1
}

export interface LearnedInsight {
  text: string;
  category?: string;
}

// In-memory session cache
let sessionPatterns: Record<string, PatternValue> = {};
let currentProjectId: string | null = null;

// ─── Load patterns for a project ─────────────────────────────────────────────

export async function loadPatterns(projectId: string): Promise<void> {
  currentProjectId = projectId;
  const { data } = await supabase
    .from('preference_patterns')
    .select('pattern_key, pattern_value')
    .eq('project_id', projectId);

  sessionPatterns = {};
  (data ?? []).forEach((row) => {
    sessionPatterns[row.pattern_key] = row.pattern_value as PatternValue;
  });
}

// ─── Record an override ───────────────────────────────────────────────────────

export async function recordDecision(opts: {
  projectId: string;
  category: string | null;
  aiRecommendation: Recommendation;
  userDecision: UserDecision;
}): Promise<void> {
  const { projectId, category, aiRecommendation, userDecision } = opts;
  if (!category) return;

  const key = `category_${category.replace(/\s+/g, '_')}`;
  const existing = sessionPatterns[key] ?? { preferred: userDecision, overrideCount: 0, totalCount: 0, confidence: 0 };

  const isOverride = aiRecommendation !== userDecision;
  const updated: PatternValue = {
    preferred: userDecision,
    overrideCount: existing.overrideCount + (isOverride ? 1 : 0),
    totalCount: existing.totalCount + 1,
    confidence: Math.min(1, (existing.totalCount + 1) / 5),
  };

  sessionPatterns[key] = updated;

  // Upsert to DB
  await supabase.from('preference_patterns').upsert(
    { project_id: projectId, pattern_key: key, pattern_value: updated, updated_at: new Date().toISOString() },
    { onConflict: 'project_id,pattern_key' }
  );
}

// ─── Get preference boost for a category ─────────────────────────────────────

export function getPreferenceBoosts(category: string | null): Record<string, number> {
  if (!category) return {};
  const key = `category_${category.replace(/\s+/g, '_')}`;
  const pattern = sessionPatterns[key];
  if (!pattern || pattern.confidence < 0.4) return {};

  // Boost the preferred decision score
  return { [pattern.preferred]: Math.round(pattern.confidence * 12) };
}

// ─── Generate human-readable insights ────────────────────────────────────────

export function getLearnedInsights(projectId: string): LearnedInsight[] {
  const insights: LearnedInsight[] = [];

  Object.entries(sessionPatterns).forEach(([key, pattern]) => {
    if (!key.startsWith('category_')) return;
    if (pattern.confidence < 0.5 || pattern.totalCount < 2) return;

    const category = key.replace('category_', '').replace(/_/g, ' ');
    const decision = pattern.preferred;
    const pct = pattern.totalCount > 0
      ? Math.round((pattern.overrideCount / pattern.totalCount) * 100)
      : 0;

    if (pct >= 60) {
      insights.push({
        text: `You tend to ${decision} items in ${category} — I've weighted that into remaining recommendations.`,
        category,
      });
    } else if (pattern.totalCount >= 3) {
      const verb = decision === 'keep' ? 'keep' : decision === 'sell' ? 'sell' : 'donate';
      insights.push({
        text: `Pattern noticed: you usually ${verb} ${category} items.`,
        category,
      });
    }
  });

  return insights.slice(0, 3);
}

// ─── Build summary of user vs AI agreement ───────────────────────────────────

export function buildAgreementSummary(items: { recommendation: string; user_decision: string | null }[]): {
  agreed: number;
  overridden: number;
  pctAgreement: number;
} {
  const decided = items.filter((i) => i.user_decision !== null);
  const agreed = decided.filter((i) => i.recommendation === i.user_decision).length;
  const overridden = decided.length - agreed;
  return {
    agreed,
    overridden,
    pctAgreement: decided.length > 0 ? Math.round((agreed / decided.length) * 100) : 0,
  };
}

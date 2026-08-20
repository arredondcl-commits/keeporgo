import type { Recommendation, UserDecision } from './supabase';

// ─── Input types ─────────────────────────────────────────────────────────────

export type LastUsed = 'this_week' | 'this_month' | 'this_year' | 'years_ago' | 'never' | 'unknown';
export type UseFrequency = 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'rarely' | 'never' | 'unknown';
export type ItemSize = 'tiny' | 'small' | 'medium' | 'large' | 'bulky';
export type SentimentLevel = 'none' | 'low' | 'medium' | 'high';
export type Replaceability = 'very_easy' | 'easy' | 'difficult' | 'very_difficult';

export interface ItemFactors {
  // Identity
  name: string;
  category: string;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  size: ItemSize;

  // Usage
  lastUsed: LastUsed;
  frequency: UseFrequency;
  seasonal: boolean;

  // Value
  resaleValueCents: number;
  resaleMinCents: number;
  resaleMaxCents: number;
  replacementCostCents: number;

  // Context
  sentimentalValue: SentimentLevel;
  hasDuplicate: boolean;
  difficultyToReplace: Replaceability;

  // Selling logistics
  effortToSell: 'low' | 'medium' | 'high';
  shippable: boolean;

  // Project context
  goal: string;   // 'space' | 'move' | 'downsize' | 'organize' | 'estate' | 'sell'
  style: string;  // 'cautious' | 'balanced' | 'aggressive'
}

// ─── Output types ─────────────────────────────────────────────────────────────

export type FactorImpact = 'for' | 'against' | 'neutral';

export interface DecisionFactor {
  id: string;
  label: string;
  value: string;
  impact: FactorImpact; // relative to the top recommendation
  weight: 'high' | 'medium' | 'low';
  sentence: string;    // one plain-English sentence
}

export interface DecisionResult {
  recommendation: Recommendation;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;        // 0–100 for the top option
  secondOption: Recommendation;   // runner-up
  explanation: string;            // 1–2 sentence narrative
  factors: DecisionFactor[];      // ordered by impact weight, most influential first
  scores: Record<string, number>; // raw score per option (for What If display)
}

// ─── What-if overrides ───────────────────────────────────────────────────────

export interface WhatIfOverrides {
  frequency?: UseFrequency;
  lastUsed?: LastUsed;
  sentimentalValue?: SentimentLevel;
  hasDuplicate?: boolean;
  condition?: 'excellent' | 'good' | 'fair' | 'poor';
  resaleValueCents?: number;
}

// ─── Scoring helpers ─────────────────────────────────────────────────────────

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

const CONDITION_SCORE: Record<string, number> = {
  excellent: 4, good: 3, fair: 2, poor: 0,
};

const FREQUENCY_SCORE: Record<string, number> = {
  daily: 10, weekly: 8, monthly: 6, seasonal: 4, rarely: 1, never: 0, unknown: 3,
};

const LAST_USED_SCORE: Record<string, number> = {
  this_week: 10, this_month: 7, this_year: 4, years_ago: 1, never: 0, unknown: 3,
};

const SIZE_PENALTY: Record<string, number> = {
  tiny: 0, small: 2, medium: 5, large: 10, bulky: 18,
};

function scoreKeep(f: ItemFactors): number {
  let s = 0;

  // Usage (highest weight for keep)
  s += FREQUENCY_SCORE[f.frequency] * 3;
  s += LAST_USED_SCORE[f.lastUsed] * 2;
  if (f.seasonal) s += 8;

  // Replacement economics: high replacement cost relative to resale = strong keep signal
  const ratio = f.replacementCostCents / Math.max(1, f.resaleValueCents);
  if (ratio >= 4) s += 25;
  else if (ratio >= 2.5) s += 18;
  else if (ratio >= 1.5) s += 10;
  else if (ratio < 1) s -= 10;  // Resale worth more than buying new → sell instead

  // Condition
  s += CONDITION_SCORE[f.condition] * 2;

  // Sentimental
  if (f.sentimentalValue === 'high') s += 28;
  else if (f.sentimentalValue === 'medium') s += 16;
  else if (f.sentimentalValue === 'low') s += 6;

  // Difficulty to replace
  if (f.difficultyToReplace === 'very_difficult') s += 20;
  else if (f.difficultyToReplace === 'difficult') s += 12;

  // Duplicate penalty (strong)
  if (f.hasDuplicate) s -= 22;

  // Storage footprint penalty (aggressive style cares more)
  s -= SIZE_PENALTY[f.size];

  return clamp(s);
}

function scoreSell(f: ItemFactors): number {
  let s = 0;
  const resale = f.resaleValueCents / 100;

  // Resale value bands
  if (resale >= 200) s += 38;
  else if (resale >= 100) s += 28;
  else if (resale >= 50) s += 18;
  else if (resale >= 20) s += 8;
  else s -= 15; // Not worth the effort

  // Effort to sell
  if (f.effortToSell === 'low') s += 20;
  else if (f.effortToSell === 'medium') s += 8;
  else if (f.effortToSell === 'high') s -= 12;

  // Shippable = wider market
  if (f.shippable) s += 8;

  // Condition matters a lot for selling
  if (f.condition === 'poor') s -= 25;
  else if (f.condition === 'fair') s -= 8;
  else if (f.condition === 'excellent') s += 12;

  // Not used in a long time = good sell candidate
  if (f.lastUsed === 'never' || f.lastUsed === 'years_ago') s += 15;
  else if (f.lastUsed === 'this_week') s -= 12;

  // Sentimental reduces sell likelihood
  if (f.sentimentalValue === 'high') s -= 28;
  else if (f.sentimentalValue === 'medium') s -= 10;

  // Duplicate = easier decision to sell
  if (f.hasDuplicate) s += 10;

  // High-value items warrant more effort even if shipping is hard
  if (resale >= 150 && f.effortToSell === 'high') s += 8;

  return clamp(s);
}

function scoreDonate(f: ItemFactors): number {
  let s = 0;
  const resale = f.resaleValueCents / 100;

  // Low resale value but still usable = donate
  if (resale < 20) s += 28;
  else if (resale < 50) s += 15;
  else if (resale < 100) s += 5;
  else s -= 10; // Too valuable to just donate

  // High effort to sell → donate instead
  if (f.effortToSell === 'high') s += 18;
  else if (f.effortToSell === 'medium' && resale < 50) s += 10;

  // Condition must be good enough to donate
  if (f.condition === 'poor') s -= 25;
  else if (f.condition === 'good' || f.condition === 'excellent') s += 8;

  // Not used = ready to go
  if (f.lastUsed === 'never' || f.lastUsed === 'years_ago') s += 10;

  // Sentimental = don't donate
  if (f.sentimentalValue === 'high') s -= 20;
  else if (f.sentimentalValue === 'medium') s -= 8;

  return clamp(s);
}

function scoreRecycle(f: ItemFactors): number {
  let s = 0;
  const resale = f.resaleValueCents / 100;

  // Very low resale + poor/fair condition → recycle
  if (resale < 10 && f.condition !== 'good' && f.condition !== 'excellent') s += 30;
  if (f.condition === 'poor') s += 20;
  if (f.condition === 'fair' && resale < 20) s += 12;

  // Electronics often have recycling programs
  if (['Electronics', 'Appliances'].includes(f.category)) s += 10;

  return clamp(s);
}

function scoreTrash(f: ItemFactors): number {
  let s = 0;
  const resale = f.resaleValueCents / 100;

  if (f.condition === 'poor') s += 35;
  if (resale === 0) s += 20;
  if (f.condition === 'poor' && resale < 5) s += 20;

  // Not recyclable + worthless = trash
  if (!['Electronics', 'Appliances', 'Packaging'].includes(f.category) && f.condition === 'poor') s += 10;

  // Sentimental protection even for trash
  if (f.sentimentalValue === 'high') s -= 30;

  return clamp(s);
}

// ─── Goal + style modifiers ──────────────────────────────────────────────────

function applyGoalModifiers(scores: Record<string, number>, goal: string) {
  switch (goal) {
    case 'space':
      // More willing to donate/recycle low-value items
      scores.donate = clamp(scores.donate + 10);
      scores.recycle = clamp(scores.recycle + 8);
      scores.keep = clamp(scores.keep - 8);
      break;
    case 'sell':
      // Prioritize resale
      scores.sell = clamp(scores.sell + 15);
      scores.donate = clamp(scores.donate - 8);
      break;
    case 'move':
      // Ruthless — only keep what genuinely earns its place
      scores.keep = clamp(scores.keep - 10);
      scores.sell = clamp(scores.sell + 8);
      scores.donate = clamp(scores.donate + 5);
      break;
    case 'downsize':
      scores.donate = clamp(scores.donate + 8);
      scores.sell = clamp(scores.sell + 10);
      scores.keep = clamp(scores.keep - 12);
      break;
    case 'estate':
      // Be more careful — sentimental items deserve consideration
      scores.keep = clamp(scores.keep + 5);
      scores.donate = clamp(scores.donate + 5);
      break;
    case 'organize':
      // Balanced, slight nudge to keep things in better condition
      scores.keep = clamp(scores.keep + 5);
      break;
  }
}

function applyStyleModifiers(scores: Record<string, number>, style: string) {
  switch (style) {
    case 'aggressive':
      scores.donate = clamp(scores.donate + 12);
      scores.sell = clamp(scores.sell + 8);
      scores.keep = clamp(scores.keep - 15);
      scores.recycle = clamp(scores.recycle + 5);
      break;
    case 'cautious':
      scores.keep = clamp(scores.keep + 15);
      scores.donate = clamp(scores.donate - 8);
      scores.trash = clamp(scores.trash - 10);
      break;
    // 'balanced': no modifier
  }
}

// ─── Factor explanation builder ──────────────────────────────────────────────

function buildFactors(f: ItemFactors, top: Recommendation): DecisionFactor[] {
  const factors: DecisionFactor[] = [];

  // Usage factors
  if (f.lastUsed !== 'unknown') {
    const recentUse = f.lastUsed === 'this_week' || f.lastUsed === 'this_month';
    const oldUse = f.lastUsed === 'years_ago' || f.lastUsed === 'never';
    const lastUsedLabels: Record<string, string> = {
      this_week: 'Used this week', this_month: 'Used this month',
      this_year: 'Used this year', years_ago: 'Not used in years',
      never: 'Never used',
    };
    const impact: FactorImpact = top === 'keep'
      ? (recentUse ? 'for' : oldUse ? 'against' : 'neutral')
      : (oldUse ? 'for' : recentUse ? 'against' : 'neutral');

    factors.push({
      id: 'last_used',
      label: 'Last used',
      value: lastUsedLabels[f.lastUsed] ?? f.lastUsed,
      impact,
      weight: 'high',
      sentence: recentUse
        ? 'You used this recently, which is a strong reason to keep it.'
        : oldUse
        ? `You haven't used this in ${f.lastUsed === 'never' ? 'ever' : 'years'}, which frees it up to leave.`
        : 'Usage history is moderate — not a strong signal either way.',
    });
  }

  // Frequency
  if (f.frequency !== 'unknown') {
    const freq = FREQUENCY_SCORE[f.frequency];
    const impact: FactorImpact = top === 'keep'
      ? (freq >= 6 ? 'for' : freq <= 1 ? 'against' : 'neutral')
      : (freq <= 1 ? 'for' : freq >= 6 ? 'against' : 'neutral');
    const freqLabel: Record<string, string> = {
      daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
      seasonal: 'Seasonal', rarely: 'Rarely', never: 'Never',
    };
    factors.push({
      id: 'frequency',
      label: 'How often used',
      value: freqLabel[f.frequency] ?? f.frequency,
      impact,
      weight: 'high',
      sentence: freq >= 6
        ? 'Regular use means this earns its space.'
        : freq === 4
        ? f.seasonal ? 'Seasonal items often justify keeping — they\'re hard to rebuy each year.' : 'Infrequent use is a mild signal to reconsider.'
        : 'Rarely or never used items have a weak case for keeping.',
    });
  }

  // Resale value
  const resale = f.resaleValueCents / 100;
  if (f.resaleValueCents > 0) {
    const impact: FactorImpact = top === 'sell'
      ? (resale >= 50 ? 'for' : 'against')
      : top === 'keep'
      ? (resale > f.replacementCostCents / 100 ? 'against' : 'neutral')
      : 'neutral';
    const rangeText = f.resaleMinCents > 0
      ? `$${Math.round(f.resaleMinCents / 100)}–$${Math.round(f.resaleMaxCents / 100)}`
      : `~$${Math.round(resale)}`;
    factors.push({
      id: 'resale_value',
      label: 'Estimated resale',
      value: rangeText,
      impact,
      weight: resale >= 100 ? 'high' : resale >= 30 ? 'medium' : 'low',
      sentence: resale >= 100
        ? `Recent comparable sales suggest ${rangeText} — strong enough to list.`
        : resale >= 30
        ? `Estimated resale of ${rangeText} is modest but worth considering.`
        : `Resale value of ${rangeText} is too low to justify the effort of selling.`,
    });
  }

  // Replacement cost
  if (f.replacementCostCents > 0) {
    const rep = f.replacementCostCents / 100;
    const ratio = rep / Math.max(1, resale);
    const impact: FactorImpact = top === 'keep'
      ? (ratio >= 2.5 ? 'for' : ratio < 1.2 ? 'against' : 'neutral')
      : top === 'sell'
      ? (ratio < 1.5 ? 'for' : 'neutral')
      : 'neutral';
    factors.push({
      id: 'replacement_cost',
      label: 'Replacement cost',
      value: `~$${Math.round(rep)}`,
      impact,
      weight: ratio >= 3 ? 'high' : 'medium',
      sentence: ratio >= 3
        ? `Replacing this would cost roughly $${Math.round(rep)} — significantly more than you'd get selling it.`
        : ratio >= 1.5
        ? `Replacement cost is noticeably higher than resale value.`
        : `Replacement cost and resale value are fairly close.`,
    });
  }

  // Condition
  {
    const impact: FactorImpact = top === 'sell'
      ? (f.condition === 'excellent' || f.condition === 'good' ? 'for' : 'against')
      : top === 'trash' || top === 'recycle'
      ? (f.condition === 'poor' ? 'for' : 'against')
      : 'neutral';
    factors.push({
      id: 'condition',
      label: 'Condition',
      value: f.condition.charAt(0).toUpperCase() + f.condition.slice(1),
      impact,
      weight: f.condition === 'poor' ? 'high' : 'low',
      sentence: f.condition === 'poor'
        ? 'The poor condition limits both resale value and donation appeal.'
        : f.condition === 'excellent'
        ? 'Excellent condition means it will sell well or hold value if kept.'
        : 'Condition is reasonable and not a major deciding factor.',
    });
  }

  // Sentimental value
  if (f.sentimentalValue !== 'none') {
    const impact: FactorImpact = top === 'keep' ? 'for' : 'against';
    factors.push({
      id: 'sentimental',
      label: 'Sentimental value',
      value: f.sentimentalValue.charAt(0).toUpperCase() + f.sentimentalValue.slice(1),
      impact,
      weight: f.sentimentalValue === 'high' ? 'high' : 'medium',
      sentence: f.sentimentalValue === 'high'
        ? 'High sentimental value is a meaningful reason to keep this, regardless of resale.'
        : 'Some sentimental value — worth weighing carefully before letting go.',
    });
  }

  // Duplicate
  if (f.hasDuplicate) {
    const impact: FactorImpact = top === 'keep' ? 'against' : 'for';
    factors.push({
      id: 'duplicate',
      label: 'Duplicate',
      value: 'You own another one',
      impact,
      weight: 'high',
      sentence: 'You already own a similar item, which weakens the case for keeping this one.',
    });
  }

  // Effort to sell
  if (f.effortToSell !== 'low') {
    const impact: FactorImpact = top === 'sell' ? 'against' : top === 'donate' ? 'for' : 'neutral';
    factors.push({
      id: 'effort',
      label: 'Effort to sell',
      value: f.effortToSell === 'high' ? 'High' : 'Medium',
      impact,
      weight: f.effortToSell === 'high' ? 'high' : 'low',
      sentence: f.effortToSell === 'high'
        ? 'Large or bulky items require significant coordination — pickup scheduling, messaging, potential no-shows.'
        : 'Selling requires a moderate amount of time and coordination.',
    });
  }

  // Storage footprint
  if (f.size === 'large' || f.size === 'bulky') {
    const impact: FactorImpact = top === 'keep' ? 'against' : 'for';
    factors.push({
      id: 'size',
      label: 'Storage footprint',
      value: f.size === 'bulky' ? 'Bulky — takes significant space' : 'Large item',
      impact,
      weight: f.size === 'bulky' ? 'high' : 'medium',
      sentence: f.size === 'bulky'
        ? 'This item takes up significant space — freeing it would be immediately noticeable.'
        : 'This item occupies meaningful floor or shelf space.',
    });
  }

  // Sort: high weight first, 'for' before 'against' before 'neutral'
  const weightOrder = { high: 0, medium: 1, low: 2 };
  const impactOrder = { for: 0, against: 1, neutral: 2 };
  return factors.sort((a, b) =>
    weightOrder[a.weight] - weightOrder[b.weight] ||
    impactOrder[a.impact] - impactOrder[b.impact]
  ).slice(0, 6);
}

// ─── Explanation narrative ────────────────────────────────────────────────────

function buildExplanation(f: ItemFactors, rec: Recommendation, factors: DecisionFactor[]): string {
  const resale = f.resaleValueCents / 100;
  const rep = f.replacementCostCents / 100;
  const range = f.resaleMinCents > 0
    ? `$${Math.round(f.resaleMinCents / 100)}–$${Math.round(f.resaleMaxCents / 100)}`
    : resale > 0 ? `~$${Math.round(resale)}` : '';

  switch (rec) {
    case 'keep': {
      const useReason = FREQUENCY_SCORE[f.frequency] >= 6
        ? 'You use this regularly'
        : f.seasonal ? 'You use this seasonally'
        : f.sentimentalValue === 'high' ? 'It has meaningful sentimental value'
        : 'Replacing it would cost significantly more than you\'d recoup selling it';
      const costNote = rep > 0 ? ` and replacing it would cost roughly $${Math.round(rep)}` : '';
      return `${useReason}${costNote}. This one earns its space.`;
    }
    case 'sell': {
      const effort = f.effortToSell === 'low' ? 'easy to list' : 'worth the effort to list';
      const notUsed = f.lastUsed === 'years_ago' || f.lastUsed === 'never'
        ? " You haven't used it in years." : '';
      return `Recent comparable sales indicate strong demand — estimated net value ${range}.${notUsed} It's ${effort}.`;
    }
    case 'donate': {
      if (f.effortToSell === 'high' && resale < 50) {
        return `Estimated resale is ${range || 'low'}, but selling would require considerable coordination. Donating reclaims the space immediately and benefits someone who needs it.`;
      }
      return `Low resale value and still in usable condition — a donation center will take this immediately and put it to good use.`;
    }
    case 'recycle': {
      return `Minimal resale potential and condition limits donation options. Recycling is the responsible next step.`;
    }
    case 'trash': {
      return `Damaged or beyond useful life with no meaningful resale or donation value. The right call is to let it go.`;
    }
    default:
      return 'Based on the available information, this is the best recommendation.';
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function analyzeItem(
  factors: ItemFactors,
  whatIfOverrides: WhatIfOverrides = {}
): DecisionResult {
  // Merge what-if overrides
  const f: ItemFactors = { ...factors, ...whatIfOverrides };

  const rawScores: Record<string, number> = {
    keep:    scoreKeep(f),
    sell:    scoreSell(f),
    donate:  scoreDonate(f),
    recycle: scoreRecycle(f),
    trash:   scoreTrash(f),
  };

  // Deep clone for modifier application
  const scores = { ...rawScores };
  applyGoalModifiers(scores, f.goal);
  applyStyleModifiers(scores, f.style);

  // Find top two
  const sorted = (Object.entries(scores) as [Recommendation, number][])
    .sort((a, b) => b[1] - a[1]);
  const [topRec, topScore] = sorted[0];
  const [secondRec, secondScore] = sorted[1] ?? ['keep' as Recommendation, 0];

  const margin = topScore - secondScore;
  const confidence: 'high' | 'medium' | 'low' =
    margin > 22 ? 'high' : margin > 10 ? 'medium' : 'low';

  const factorList = buildFactors(f, topRec);
  const explanation = buildExplanation(f, topRec, factorList);

  return {
    recommendation: topRec,
    confidence,
    confidenceScore: Math.round(topScore),
    secondOption: secondRec,
    explanation,
    factors: factorList,
    scores,
  };
}

// ─── Helpers for building ItemFactors from answers ────────────────────────────

export function answersToFactors(
  answers: Record<string, string>,
  base: Partial<ItemFactors>
): Partial<ItemFactors> {
  const patch: Partial<ItemFactors> = {};

  if (answers.last_used) {
    const map: Record<string, LastUsed> = {
      'Within the past week': 'this_week',
      'Within the past month': 'this_month',
      'Within the past year': 'this_year',
      'Over a year ago': 'years_ago',
      'Two or more years ago': 'years_ago',
      "Can't remember / never": 'never',
      'Never / Can\'t remember': 'never',
    };
    patch.lastUsed = map[answers.last_used] ?? 'unknown';
  }

  if (answers.frequency) {
    const map: Record<string, UseFrequency> = {
      'Daily or almost daily': 'daily',
      'A few times a week': 'weekly',
      'Monthly': 'monthly',
      'Once or twice a year': 'seasonal',
      'Rarely': 'rarely',
      'Never': 'never',
    };
    patch.frequency = map[answers.frequency] ?? 'unknown';
  }

  if (answers.sentimental) {
    const map: Record<string, SentimentLevel> = {
      'Yes, very much so': 'high',
      'A little': 'low',
      'Not really': 'none',
      'No': 'none',
    };
    patch.sentimentalValue = map[answers.sentimental] ?? 'none';
  }

  if (answers.duplicate) {
    patch.hasDuplicate = answers.duplicate === 'Yes';
  }

  if (answers.replace) {
    const map: Record<string, Replaceability> = {
      'Very easy — available everywhere': 'very_easy',
      'Fairly easy': 'easy',
      'Somewhat difficult': 'difficult',
      'Very difficult or impossible': 'very_difficult',
    };
    patch.difficultyToReplace = map[answers.replace] ?? 'easy';
  }

  if (answers.use_next_year) {
    if (answers.use_next_year === 'Yes, definitely') patch.frequency = patch.frequency ?? 'monthly';
    else if (answers.use_next_year === 'Probably not' || answers.use_next_year === 'No') {
      patch.frequency = 'rarely';
    }
  }

  if (answers.moving) {
    if (answers.moving === "No, I wouldn't bring it") {
      patch.lastUsed = 'years_ago';
    }
  }

  return patch;
}

// ─── What-if preset scenarios ─────────────────────────────────────────────────

export interface WhatIfScenario {
  id: string;
  label: string;
  question: string;
  options: { label: string; overrides: WhatIfOverrides }[];
}

export function getWhatIfScenarios(factors: ItemFactors): WhatIfScenario[] {
  const scenarios: WhatIfScenario[] = [];

  // Usage frequency
  scenarios.push({
    id: 'frequency',
    label: 'How often I use it',
    question: 'What if I use this...',
    options: [
      { label: 'Regularly', overrides: { frequency: 'weekly', lastUsed: 'this_month' } },
      { label: 'Seasonally', overrides: { frequency: 'seasonal', lastUsed: 'this_year' } },
      { label: 'Rarely', overrides: { frequency: 'rarely', lastUsed: 'years_ago' } },
      { label: 'Never', overrides: { frequency: 'never', lastUsed: 'never' } },
    ],
  });

  // Sentimental
  scenarios.push({
    id: 'sentimental',
    label: 'Sentimental value',
    question: 'What if it has sentimental value?',
    options: [
      { label: 'None', overrides: { sentimentalValue: 'none' } },
      { label: 'A little', overrides: { sentimentalValue: 'low' } },
      { label: 'Meaningful', overrides: { sentimentalValue: 'medium' } },
      { label: 'Very high', overrides: { sentimentalValue: 'high' } },
    ],
  });

  // Duplicate
  scenarios.push({
    id: 'duplicate',
    label: 'Whether I own another',
    question: 'What if I already own a similar item?',
    options: [
      { label: 'I own another', overrides: { hasDuplicate: true } },
      { label: "It's the only one", overrides: { hasDuplicate: false } },
    ],
  });

  // Condition (only show if not definitive)
  if (factors.condition !== 'poor') {
    scenarios.push({
      id: 'condition',
      label: 'Condition',
      question: 'What if the condition is...',
      options: [
        { label: 'Excellent', overrides: { condition: 'excellent' } },
        { label: 'Good', overrides: { condition: 'good' } },
        { label: 'Fair', overrides: { condition: 'fair' } },
        { label: 'Poor / damaged', overrides: { condition: 'poor' } },
      ],
    });
  }

  return scenarios;
}

// ─── Size inference from category ────────────────────────────────────────────

export function inferSize(category: string, effortToSell: string): ItemSize {
  const large = ['Home & Furniture', 'Appliances', 'Sports & Fitness'];
  const tiny = ['Books & Media', 'Jewelry', 'Collectibles'];
  if (effortToSell === 'high') return 'large';
  if (effortToSell === 'low' && tiny.includes(category)) return 'tiny';
  if (large.includes(category)) return 'medium';
  return 'small';
}

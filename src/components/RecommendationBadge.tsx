import React from 'react';
import type { Recommendation, UserDecision } from '@/lib/supabase';

type DecisionValue = Recommendation | UserDecision;

interface BadgeProps {
  recommendation: DecisionValue;
  size?: 'sm' | 'md';
}

const config: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  keep:         { label: 'Keep',         bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  sell:         { label: 'Sell',         bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  donate:       { label: 'Donate',       bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  recycle:      { label: 'Recycle',      bg: 'bg-teal-50',    text: 'text-teal-700',    dot: 'bg-teal-500' },
  trash:        { label: 'Trash',        bg: 'bg-stone-100',  text: 'text-stone-600',   dot: 'bg-stone-400' },
  decide_later: { label: 'Decide later', bg: 'bg-purple-50',  text: 'text-purple-600',  dot: 'bg-purple-400' },
};

export function RecommendationBadge({ recommendation, size = 'md' }: BadgeProps) {
  const c = config[recommendation] ?? config.keep;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${c.bg} ${c.text} ${padding}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
      {c.label}
    </span>
  );
}

import React from 'react';

interface ConfidenceLabelProps {
  level: 'high' | 'medium' | 'low';
  score?: number;
  size?: 'sm' | 'md';
}

const CONFIG = {
  high:   { label: 'Very confident', short: 'Very confident', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  medium: { label: 'Fairly confident', short: 'Fairly confident', dot: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  low:    { label: 'Less sure', short: 'Less sure', dot: 'bg-stone-400',     text: 'text-stone-500',    bg: 'bg-stone-100' },
};

export function ConfidenceLabel({ level, score, size = 'md' }: ConfidenceLabelProps) {
  const c = CONFIG[level];
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-2.5 py-1 text-xs gap-1.5';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${c.bg} ${c.text} ${padding}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      {size === 'sm' ? c.short : c.label}
    </span>
  );
}

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { DecisionFactor } from '@/lib/decisionEngine';

interface WhyPanelProps {
  explanation: string;
  factors: DecisionFactor[];
  defaultOpen?: boolean;
}

const IMPACT_ICON: Record<string, string> = {
  for: '↑',
  against: '↓',
  neutral: '→',
};

const IMPACT_COLOR: Record<string, string> = {
  for: 'text-emerald-600',
  against: 'text-red-500',
  neutral: 'text-stone-400',
};

const WEIGHT_OPACITY: Record<string, string> = {
  high: 'opacity-100',
  medium: 'opacity-80',
  low: 'opacity-60',
};

export function WhyPanel({ explanation, factors, defaultOpen = false }: WhyPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-stone-100 overflow-hidden bg-stone-50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-100 transition-colors"
      >
        <span className="text-sm font-semibold text-stone-700">Why we suggest this</span>
        {open
          ? <ChevronUp size={16} className="text-stone-400 shrink-0" />
          : <ChevronDown size={16} className="text-stone-400 shrink-0" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Narrative explanation */}
          <p className="text-sm text-stone-600 leading-relaxed border-l-2 border-stone-200 pl-3">
            {explanation}
          </p>

          {/* Factor list */}
          {factors.length > 0 && (
            <div className="space-y-2">
              {factors.map((f) => (
                <div key={f.id} className={`flex items-start gap-2.5 ${WEIGHT_OPACITY[f.weight]}`}>
                  <span className={`text-sm font-bold shrink-0 w-4 text-center ${IMPACT_COLOR[f.impact]}`}>
                    {IMPACT_ICON[f.impact]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-stone-500">{f.label}:</span>
                      <span className="text-xs text-stone-700 font-medium">{f.value}</span>
                    </div>
                    <p className="text-xs text-stone-500 leading-relaxed mt-0.5">{f.sentence}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {factors.length === 0 && (
            <p className="text-xs text-stone-400 italic">Answer the questions above for a more detailed breakdown.</p>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import type { Recommendation } from '@/lib/supabase';

interface ChangeRecommendationProps {
  currentRecommendation: Recommendation;
  onChange: (rec: Recommendation) => void;
}

const OPTIONS: { value: Recommendation; label: string }[] = [
  { value: 'keep',    label: 'Keep it' },
  { value: 'sell',    label: 'Sell it' },
  { value: 'donate',  label: 'Donate it' },
  { value: 'recycle', label: 'Recycle it' },
  { value: 'trash',   label: 'Toss it' },
];

export function ChangeRecommendation({ currentRecommendation, onChange }: ChangeRecommendationProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-stone-100 overflow-hidden bg-stone-50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-100 transition-colors"
      >
        <span className="text-sm font-semibold text-stone-700">Change recommendation</span>
        {open
          ? <ChevronUp size={16} className="text-stone-400 shrink-0" />
          : <ChevronDown size={16} className="text-stone-400 shrink-0" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs text-stone-500 mb-2 leading-relaxed">
            You're in charge. If you disagree with our suggestion, pick what feels right.
          </p>
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                currentRecommendation === opt.value
                  ? 'bg-stone-900 text-white'
                  : 'bg-white text-stone-700 border border-stone-100 hover:border-stone-300'
              }`}
            >
              {opt.label}
              {currentRecommendation === opt.value && <Check size={14} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

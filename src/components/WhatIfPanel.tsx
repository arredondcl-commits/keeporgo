import React, { useState } from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
import type { WhatIfScenario, WhatIfOverrides, ItemFactors } from '@/lib/decisionEngine';
import { analyzeItem, getWhatIfScenarios } from '@/lib/decisionEngine';
import { RecommendationBadge } from './RecommendationBadge';
import type { Recommendation } from '@/lib/supabase';

interface WhatIfPanelProps {
  baseFactors: ItemFactors;
  originalRecommendation: Recommendation;
  onOverridesChange?: (overrides: WhatIfOverrides) => void;
}

export function WhatIfPanel({ baseFactors, originalRecommendation, onOverridesChange }: WhatIfPanelProps) {
  const [open, setOpen] = useState(false);
  const [overrides, setOverrides] = useState<WhatIfOverrides>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const scenarios = getWhatIfScenarios(baseFactors);

  const currentResult = Object.keys(overrides).length > 0
    ? analyzeItem(baseFactors, overrides)
    : null;

  const changed = currentResult && currentResult.recommendation !== originalRecommendation;

  function applyOption(scenarioId: string, optionLabel: string, optOverrides: WhatIfOverrides) {
    const next = { ...overrides, ...optOverrides };
    const nextSelected = { ...selectedOptions, [scenarioId]: optionLabel };
    setOverrides(next);
    setSelectedOptions(nextSelected);
    onOverridesChange?.(next);
  }

  function reset() {
    setOverrides({});
    setSelectedOptions({});
    onOverridesChange?.({});
  }

  return (
    <div className="rounded-2xl border border-stone-100 overflow-hidden bg-stone-50">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-stone-400 shrink-0" />
          <span className="text-sm font-semibold text-stone-700">What if something were different?</span>
        </div>
        {changed && (
          <span className="text-xs font-medium text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 shrink-0">
            Changed
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Live updated result */}
          {currentResult && (
            <div className={`rounded-xl p-3 border transition-all ${changed ? 'border-blue-200 bg-blue-50' : 'border-stone-100 bg-white'}`}>
              <p className="text-xs text-stone-400 mb-1.5">
                {changed ? 'Updated recommendation' : 'Same recommendation'}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <RecommendationBadge recommendation={currentResult.recommendation} />
                {changed && (
                  <>
                    <span className="text-xs text-stone-400">instead of</span>
                    <RecommendationBadge recommendation={originalRecommendation} size="sm" />
                  </>
                )}
              </div>
              {changed && (
                <p className="text-xs text-stone-600 mt-2 leading-relaxed">{currentResult.explanation}</p>
              )}
            </div>
          )}

          {/* Scenario toggles */}
          {scenarios.map((scenario) => (
            <ScenarioRow
              key={scenario.id}
              scenario={scenario}
              selected={selectedOptions[scenario.id]}
              onSelect={(label, ov) => applyOption(scenario.id, label, ov)}
            />
          ))}

          {/* Reset */}
          {Object.keys(overrides).length > 0 && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-700 transition-colors"
            >
              <RotateCcw size={12} />
              Reset to original
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ScenarioRow({ scenario, selected, onSelect }: {
  scenario: WhatIfScenario;
  selected: string | undefined;
  onSelect: (label: string, overrides: WhatIfOverrides) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-stone-500 mb-2">{scenario.question}</p>
      <div className="flex flex-wrap gap-1.5">
        {scenario.options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onSelect(opt.label, opt.overrides)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              selected === opt.label
                ? 'bg-stone-900 text-white border-stone-900'
                : 'bg-white text-stone-600 border-stone-200 hover:border-stone-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

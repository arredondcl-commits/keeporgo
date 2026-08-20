import React, { useState } from 'react';
import { ArrowRight, Camera, Sparkles, Hand, Check } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const GOAL_OPTIONS = [
  { value: 'space',    emoji: '📐', label: 'Make more space' },
  { value: 'organize', emoji: '🗂️', label: 'Get organized' },
  { value: 'move',     emoji: '🚚', label: 'Prepare for a move' },
  { value: 'downsize', emoji: '📉', label: 'Downsize' },
  { value: 'sell',     emoji: '💰', label: 'Sell valuable items' },
  { value: 'estate',   emoji: '🤝', label: 'Help with an estate cleanout' },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  function handleFinish() {
    try {
      localStorage.setItem('kog_onboarded', '1');
      if (selectedGoal) localStorage.setItem('kog_goal', selectedGoal);
    } catch { /* ignore */ }
    onComplete();
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Progress dots */}
      <div className="pt-14 px-5 max-w-lg mx-auto w-full">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={`h-1 rounded-full flex-1 transition-all duration-300 ${s <= step ? 'bg-stone-900' : 'bg-stone-200'}`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-5 flex flex-col justify-center pb-10">

        {/* Screen 1 */}
        {step === 0 && (
          <div className="animate-[fadeIn_0.4s_ease] space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-stone-900 leading-tight tracking-tight">
                Decluttering is hard because every item becomes a decision.
              </h1>
              <p className="text-lg text-stone-500 mt-4 leading-relaxed">
                We'll help you decide what to keep, sell, donate, recycle, or throw away.
              </p>
            </div>
            <button
              onClick={() => setStep(1)}
              className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white rounded-2xl py-4 text-base font-semibold hover:bg-stone-800 active:scale-[0.98] transition-all"
            >
              Continue <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Screen 2 */}
        {step === 1 && (
          <div className="animate-[fadeIn_0.4s_ease] space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-stone-900 leading-tight tracking-tight mb-2">
                How it works
              </h1>
            </div>
            <div className="space-y-6">
              <Step
                icon={<Camera size={22} />}
                title="Take pictures"
                desc="Snap a photo of any item. A few seconds is all it takes."
              />
              <Step
                icon={<Sparkles size={22} />}
                title="AI understands your items"
                desc="We identify what it is, estimate its value, and suggest what to do."
              />
              <Step
                icon={<Hand size={22} />}
                title="You stay in control"
                desc="Every recommendation is just a suggestion. You make the final call."
              />
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white rounded-2xl py-4 text-base font-semibold hover:bg-stone-800 active:scale-[0.98] transition-all"
            >
              Continue <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Screen 3 */}
        {step === 2 && (
          <div className="animate-[fadeIn_0.4s_ease] space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-stone-900 leading-tight tracking-tight">
                What are you trying to accomplish?
              </h1>
              <p className="text-base text-stone-500 mt-3">
                This helps us tailor our suggestions to your situation.
              </p>
            </div>
            <div className="space-y-2.5">
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedGoal(opt.value)}
                  className={`w-full flex items-center gap-4 rounded-2xl px-5 py-4 border-2 transition-all text-left ${
                    selectedGoal === opt.value
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-100 bg-white text-stone-700 hover:border-stone-300'
                  }`}
                >
                  <span className="text-2xl shrink-0">{opt.emoji}</span>
                  <span className="text-sm font-semibold flex-1">{opt.label}</span>
                  {selectedGoal === opt.value && <Check size={16} className="shrink-0" />}
                </button>
              ))}
            </div>
            <button
              onClick={handleFinish}
              disabled={!selectedGoal}
              className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white rounded-2xl py-4 text-base font-semibold hover:bg-stone-800 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 transition-all"
            >
              Get started <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-11 h-11 rounded-2xl bg-stone-900 text-white flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 pt-0.5">
        <p className="text-base font-semibold text-stone-900">{title}</p>
        <p className="text-sm text-stone-500 mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

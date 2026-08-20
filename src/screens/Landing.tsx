import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface LandingProps {
  onStart: () => void;
}

export function Landing({ onStart }: LandingProps) {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8 text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-stone-900 mb-5 shadow-lg">
            <Sparkles size={28} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-stone-900 tracking-tight leading-none mb-3">
            Keep or Go
          </h1>
          <p className="text-lg text-stone-500 font-medium">
            Decide what to do with everything you own.
          </p>
        </div>

        <div className="w-full max-w-sm space-y-4 mb-10">
          {[
            { icon: '📷', text: 'Photograph items one by one' },
            { icon: '🤖', text: 'AI identifies and values each item' },
            { icon: '✅', text: 'Get a keep, sell, donate, or trash verdict' },
            { icon: '💰', text: 'Generate marketplace listings instantly' },
          ].map((step) => (
            <div key={step.text} className="flex items-center gap-4 bg-white rounded-2xl px-5 py-4 shadow-sm border border-stone-100">
              <span className="text-2xl">{step.icon}</span>
              <span className="text-sm font-medium text-stone-700 text-left">{step.text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          className="w-full max-w-sm flex items-center justify-center gap-2 bg-stone-900 text-white rounded-2xl py-4 px-6 text-base font-semibold shadow-lg hover:bg-stone-800 active:scale-[0.98] transition-all"
        >
          Start with one room
          <ArrowRight size={18} />
        </button>

        <p className="mt-5 text-xs text-stone-400 max-w-xs">
          No account required. Works best one item at a time.
        </p>
      </div>

      {/* Testimonial strip */}
      <div className="border-t border-stone-100 bg-white px-6 py-6">
        <p className="text-center text-sm text-stone-500 italic leading-relaxed max-w-xs mx-auto">
          "I finally know what to do with everything in my garage."
        </p>
        <p className="text-center text-xs text-stone-400 mt-1.5">— Keep or Go user</p>
      </div>
    </div>
  );
}

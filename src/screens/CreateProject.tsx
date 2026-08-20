import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { supabase, type Project, type ProjectGoal, type ProjectStyle, GOAL_LABELS, STYLE_META } from '@/lib/supabase';
import { NavBar } from '@/components/NavBar';

const ROOM_OPTIONS = [
  { type: 'garage',   emoji: '🚗', label: 'Garage' },
  { type: 'basement', emoji: '🪜', label: 'Basement' },
  { type: 'attic',    emoji: '🏠', label: 'Attic' },
  { type: 'closet',   emoji: '👔', label: 'Closet' },
  { type: 'storage',  emoji: '📦', label: 'Storage Unit' },
  { type: 'bedroom',  emoji: '🛏️', label: 'Guest Room' },
  { type: 'kitchen',  emoji: '🍳', label: 'Kitchen' },
  { type: 'office',   emoji: '💼', label: 'Office' },
  { type: 'other',    emoji: '🏡', label: 'Other Space' },
];

const GOALS: { value: ProjectGoal; emoji: string }[] = [
  { value: 'space',    emoji: '📐' },
  { value: 'move',     emoji: '🚚' },
  { value: 'downsize', emoji: '📉' },
  { value: 'organize', emoji: '🗂️' },
  { value: 'estate',   emoji: '🤝' },
  { value: 'sell',     emoji: '💰' },
];

const STYLES: ProjectStyle[] = ['cautious', 'balanced', 'aggressive'];

interface CreateProjectProps {
  onBack: () => void;
  onCreated: (project: Project) => void;
}

export function CreateProject({ onBack, onCreated }: CreateProjectProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRoom, setSelectedRoom] = useState(ROOM_OPTIONS[0]);
  const [customName, setCustomName] = useState('');
  const [goal, setGoal] = useState<ProjectGoal>('space');
  const [style, setStyle] = useState<ProjectStyle>('balanced');
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    const name = customName.trim() || selectedRoom.label;
    const { data, error } = await supabase
      .from('projects')
      .insert({ name, room_type: selectedRoom.type, emoji: selectedRoom.emoji, goal, style })
      .select()
      .maybeSingle();
    setCreating(false);
    if (!error && data) onCreated(data);
  }

  return (
    <>
      <NavBar title="New Project" onBack={onBack} />

      {/* Step indicator */}
      <div className="max-w-lg mx-auto px-5 pt-4 pb-2">
        <div className="flex gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 rounded-full flex-1 transition-all ${s <= step ? 'bg-stone-900' : 'bg-stone-200'}`}
            />
          ))}
        </div>
        <p className="text-xs text-stone-400 mt-2">Step {step} of 3</p>
      </div>

      <div className="max-w-lg mx-auto px-5 py-5">

        {/* Step 1: Space */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold text-stone-900 mb-1">What space are you clearing?</h2>
            <p className="text-stone-500 text-sm mb-5">Pick the room or area you're starting with.</p>

            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {ROOM_OPTIONS.map((room) => (
                <button
                  key={room.type}
                  onClick={() => setSelectedRoom(room)}
                  className={`flex flex-col items-center gap-2 rounded-2xl py-4 px-2 border-2 transition-all ${
                    selectedRoom.type === room.type
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-100 bg-white text-stone-700 hover:border-stone-300'
                  }`}
                >
                  <span className="text-2xl">{room.emoji}</span>
                  <span className="text-xs font-medium leading-tight text-center">{room.label}</span>
                </button>
              ))}
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1.5">
                Custom name (optional)
              </label>
              <input
                type="text"
                placeholder={selectedRoom.label}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full flex items-center justify-center gap-2 bg-stone-900 text-white rounded-2xl py-4 text-sm font-semibold hover:bg-stone-800 transition-colors"
            >
              Continue <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2: Goal */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold text-stone-900 mb-1">What's your main goal?</h2>
            <p className="text-stone-500 text-sm mb-5">This helps focus the recommendations.</p>

            <div className="space-y-2.5 mb-6">
              {GOALS.map(({ value, emoji }) => (
                <button
                  key={value}
                  onClick={() => setGoal(value)}
                  className={`w-full flex items-center gap-4 rounded-2xl px-5 py-4 border-2 transition-all text-left ${
                    goal === value
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-100 bg-white text-stone-700 hover:border-stone-300'
                  }`}
                >
                  <span className="text-2xl shrink-0">{emoji}</span>
                  <span className="text-sm font-semibold">{GOAL_LABELS[value]}</span>
                  {goal === value && <Check size={16} className="ml-auto shrink-0" />}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-stone-200 text-stone-700 rounded-2xl py-3.5 text-sm font-semibold hover:bg-stone-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 flex items-center justify-center gap-2 bg-stone-900 text-white rounded-2xl py-3.5 text-sm font-semibold hover:bg-stone-800 transition-colors"
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Style */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold text-stone-900 mb-1">How decisive should we be?</h2>
            <p className="text-stone-500 text-sm mb-5">You can always override individual decisions.</p>

            <div className="space-y-3 mb-6">
              {STYLES.map((s) => {
                const meta = STYLE_META[s];
                return (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`w-full flex items-start gap-4 rounded-2xl px-5 py-4 border-2 transition-all text-left ${
                      style === s
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-100 bg-white text-stone-700 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-bold mb-0.5">{meta.label}</p>
                      <p className={`text-xs leading-relaxed ${style === s ? 'text-stone-300' : 'text-stone-500'}`}>
                        {meta.description}
                      </p>
                    </div>
                    {style === s && <Check size={16} className="mt-0.5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border border-stone-200 text-stone-700 rounded-2xl py-3.5 text-sm font-semibold hover:bg-stone-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={create}
                disabled={creating}
                className="flex-1 bg-stone-900 text-white rounded-2xl py-3.5 text-sm font-semibold hover:bg-stone-800 disabled:opacity-60 transition-colors"
              >
                {creating ? 'Creating...' : 'Start project'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

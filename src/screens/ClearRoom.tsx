import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { supabase, type Project, type Task } from '@/lib/supabase';
import { NavBar } from '@/components/NavBar';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface ClearRoomProps {
  project: Project;
  onBack: () => void;
  onFinished: () => void;
}

export function ClearRoom({ project, onBack, onFinished }: ClearRoomProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [celebrating, setCelebrating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', project.id)
      .eq('category', 'today')
      .order('sort_order');
    if (data) {
      setTasks(data);
      // Start at first incomplete
      const firstPending = data.findIndex((t) => !t.completed);
      setCurrentIdx(firstPending >= 0 ? firstPending : 0);
    }
    setLoading(false);
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  async function markDone() {
    const task = tasks[currentIdx];
    if (!task) return;
    const updated = { ...task, completed: true };
    setTasks((prev) => prev.map((t) => t.id === task.id ? updated : t));
    await supabase.from('tasks').update({ completed: true }).eq('id', task.id);

    const next = tasks.findIndex((t, i) => i > currentIdx && !t.completed && t.id !== task.id);
    if (next >= 0) {
      setTimeout(() => setCurrentIdx(next), 300);
    } else {
      const anyLeft = tasks.find((t) => !t.completed && t.id !== task.id);
      if (!anyLeft) {
        setCelebrating(true);
        setTimeout(() => onFinished(), 2500);
      } else {
        setCurrentIdx(tasks.findIndex((t) => !t.completed && t.id !== task.id));
      }
    }
  }

  async function skip() {
    const next = tasks.findIndex((t, i) => i > currentIdx && !t.completed);
    if (next >= 0) setCurrentIdx(next);
    else {
      const first = tasks.findIndex((t) => !t.completed);
      if (first >= 0) setCurrentIdx(first);
    }
  }

  if (loading) return <><NavBar title="Clear the Room" onBack={onBack} /><LoadingSpinner /></>;

  const incomplete = tasks.filter((t) => !t.completed);
  const completed  = tasks.filter((t) => t.completed);
  const currentTask = tasks[currentIdx];

  if (celebrating) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-5 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-stone-900 mb-2">All done for today!</h2>
        <p className="text-stone-500 text-sm">You finished every task. The rest can wait until this week.</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <>
        <NavBar title="Clear the Room" onBack={onBack} />
        <div className="max-w-lg mx-auto px-5 py-16 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-stone-500">No tasks yet. Generate an action plan first.</p>
          <button onClick={onBack} className="mt-4 text-sm text-stone-900 font-semibold underline">
            Go back
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar title="Clear the Room" onBack={onBack} />
      <div className="max-w-lg mx-auto px-4 py-6 flex flex-col min-h-[calc(100vh-56px)]">

        {/* Progress pills */}
        <div className="flex gap-1.5 mb-6 flex-wrap">
          {tasks.map((t, i) => (
            <div
              key={t.id}
              className={`h-2 rounded-full flex-1 min-w-[20px] transition-all ${
                t.completed ? 'bg-emerald-400' : i === currentIdx ? 'bg-stone-900' : 'bg-stone-200'
              }`}
            />
          ))}
        </div>

        <p className="text-xs text-stone-400 mb-1">{completed.length} of {tasks.length} done · {incomplete.length} remaining</p>

        {/* Current task — big, focused */}
        {currentTask && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-8 text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-5 text-xl">
                {currentTask.completed ? '✅' : getTaskEmoji(currentTask.title)}
              </div>
              <p className="text-xl font-bold text-stone-900 leading-snug">{currentTask.title}</p>
              {currentTask.completed && (
                <div className="mt-3 flex items-center justify-center gap-1.5 text-emerald-600">
                  <CheckCircle2 size={16} />
                  <span className="text-sm font-medium">Done</span>
                </div>
              )}
            </div>

            {!currentTask.completed && (
              <div className="space-y-2.5">
                <button
                  onClick={markDone}
                  className="w-full bg-stone-900 text-white rounded-2xl py-4 text-base font-semibold hover:bg-stone-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={18} />
                  Done — next task
                </button>
                {incomplete.length > 1 && (
                  <button
                    onClick={skip}
                    className="w-full border border-stone-200 text-stone-500 rounded-2xl py-3.5 text-sm font-medium hover:bg-stone-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    Skip for now <ChevronRight size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Remaining tasks preview */}
        {incomplete.length > 1 && (
          <div className="mt-6">
            <p className="text-xs text-stone-400 mb-2">Up next</p>
            <div className="space-y-1.5">
              {incomplete.filter((t) => t.id !== currentTask?.id).slice(0, 3).map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 bg-stone-50 rounded-xl px-4 py-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-stone-300 shrink-0" />
                  <p className="text-sm text-stone-500 line-clamp-1">{t.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function getTaskEmoji(title: string): string {
  if (/move|shelf|place/i.test(title)) return '📦';
  if (/box|donate/i.test(title)) return '❤️';
  if (/recycle/i.test(title)) return '♻️';
  if (/trash|discard/i.test(title)) return '🗑️';
  if (/photo|photograph/i.test(title)) return '📸';
  if (/list|sell/i.test(title)) return '💰';
  if (/schedule|pickup/i.test(title)) return '📅';
  return '✅';
}

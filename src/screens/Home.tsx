import React, { useEffect, useState } from 'react';
import { Plus, ChevronRight, CheckCircle2 } from 'lucide-react';
import { supabase, type Project, type Item } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface HomeProps {
  onContinueProject: (project: Project) => void;
  onNewProject: () => void;
  onSelectProject: (project: Project) => void;
}

interface ProjectWithStats extends Project {
  total: number;
  reviewed: number;
  sellValue: number;
}

export function Home({ onContinueProject, onNewProject, onSelectProject }: HomeProps) {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    const { data: projectData } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!projectData) { setLoading(false); return; }

    const ids = projectData.map((p) => p.id);
    const { data: itemData } = await supabase
      .from('items')
      .select('project_id, user_decision, recommendation, resale_value_cents')
      .in('project_id', ids);

    const withStats: ProjectWithStats[] = projectData.map((p) => {
      const items = (itemData ?? []).filter((i) => i.project_id === p.id);
      const reviewed = items.filter((i) => i.user_decision !== null).length;
      const sellValue = items
        .filter((i) => (i.user_decision ?? i.recommendation) === 'sell')
        .reduce((s: number, i: Item) => s + i.resale_value_cents, 0);
      return { ...p, total: items.length, reviewed, sellValue };
    });

    setProjects(withStats);
    setLoading(false);
  }

  const active = projects.filter((p) => p.status === 'active');
  const completed = projects.filter((p) => p.status === 'completed');
  const current = active[0] ?? null;
  const others = active.slice(1);

  const progress = current && current.total > 0
    ? Math.round((current.reviewed / current.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Header */}
      <div className="pt-14 pb-6 px-5 max-w-lg mx-auto w-full">
        <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">Keep or Go</p>
        <h1 className="text-2xl font-bold text-stone-900 leading-tight">Take photos.<br />Get a clear plan.</h1>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-5 space-y-5 pb-10">
        {loading ? (
          <LoadingSpinner />
        ) : current ? (
          <>
            {/* Active project card */}
            <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-xl shrink-0">
                    {current.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-stone-900 truncate">{current.name}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {current.reviewed} of {current.total} items reviewed
                    </p>
                  </div>
                  {current.total > 0 && (
                    <span className="text-sm font-bold text-stone-900 shrink-0">{progress}%</span>
                  )}
                </div>

                {/* Progress bar */}
                {current.total > 0 && (
                  <div className="mb-4">
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-stone-900 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-stone-400">{current.reviewed} reviewed</span>
                      <span className="text-xs text-stone-400">{current.total - current.reviewed} remaining</span>
                    </div>
                  </div>
                )}

                {/* Quick stats */}
                {current.total > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-stone-50 rounded-xl p-3">
                      <p className="text-xs text-stone-400 mb-0.5">Items to clear</p>
                      <p className="text-base font-bold text-stone-900">
                        {current.total - (current.reviewed > 0 ? Math.round(current.reviewed * 0.35) : 0)} est.
                      </p>
                    </div>
                    <div className="bg-stone-50 rounded-xl p-3">
                      <p className="text-xs text-stone-400 mb-0.5">Est. space freed</p>
                      <p className="text-base font-bold text-stone-900">
                        {current.total > 0 ? `~${Math.round(current.total * 2.2)} sq ft` : '—'}
                      </p>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => onContinueProject(current)}
                  className="w-full bg-stone-900 text-white rounded-2xl py-3.5 text-sm font-semibold hover:bg-stone-800 active:scale-[0.98] transition-all"
                >
                  {current.total === 0 ? 'Start scanning' : current.reviewed === current.total && current.total > 0 ? 'View project' : 'Keep going'}
                </button>
              </div>
            </div>

            {/* Other active projects */}
            {others.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2.5">Other rooms</p>
                <div className="space-y-2">
                  {others.map((p) => (
                    <ProjectRow key={p.id} project={p} onClick={() => onSelectProject(p)} />
                  ))}
                </div>
              </div>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2.5">Completed</p>
                <div className="space-y-2">
                  {completed.map((p) => (
                    <ProjectRow key={p.id} project={p} onClick={() => onSelectProject(p)} done />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Empty state */
          <div className="text-center py-16 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-5">
              <Plus size={28} className="text-stone-400" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 mb-2">Where do you want to start?</h2>
            <p className="text-stone-500 text-sm mb-6 max-w-xs mx-auto leading-relaxed">
              Pick one room. The goal isn't to do everything — just to make a start.
            </p>
          </div>
        )}

        {/* New project button */}
        <button
          onClick={onNewProject}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-stone-200 text-stone-500 rounded-2xl py-4 hover:border-stone-300 hover:text-stone-700 hover:bg-stone-50 active:scale-[0.99] transition-all"
        >
          <Plus size={18} />
          <span className="text-sm font-medium">Start a new room</span>
        </button>
      </div>
    </div>
  );
}

function ProjectRow({ project, onClick, done }: { project: ProjectWithStats; onClick: () => void; done?: boolean }) {
  const pct = project.total > 0 ? Math.round((project.reviewed / project.total) * 100) : 0;
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-stone-100 flex items-center gap-3 hover:border-stone-300 transition-all text-left group"
    >
      <span className="text-xl shrink-0">{project.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-900 truncate">{project.name}</p>
        <p className="text-xs text-stone-400 mt-0.5">{project.total} items · {pct}% reviewed</p>
      </div>
      {done ? (
        <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
      ) : (
        <ChevronRight size={16} className="text-stone-300 group-hover:text-stone-500 transition-colors shrink-0" />
      )}
    </button>
  );
}

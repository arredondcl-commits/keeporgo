import React, { useEffect, useState, useCallback } from 'react';
import { Check, Calendar, Sparkles } from 'lucide-react';
import { supabase, type Project, type Item, type Task } from '@/lib/supabase';
import { NavBar } from '@/components/NavBar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { formatDollars } from '@/lib/supabase';

interface ActionPlanProps {
  project: Project;
  onBack: () => void;
  onClearRoom: () => void;
  onViewSellItems: () => void;
}

function generateTasks(project: Project, items: Item[]): Omit<Task, 'id' | 'created_at'>[] {
  const decisions = items.map((i) => i.user_decision ?? i.recommendation);
  const keepCount   = decisions.filter((d) => d === 'keep').length;
  const sellItems   = items.filter((i) => (i.user_decision ?? i.recommendation) === 'sell');
  const donateCount = decisions.filter((d) => d === 'donate').length;
  const recycleCount = decisions.filter((d) => d === 'recycle').length;
  const trashCount  = decisions.filter((d) => d === 'trash').length;

  const tasks: Omit<Task, 'id' | 'created_at'>[] = [];
  let order = 1;

  // Today tasks
  if (keepCount > 0) {
    tasks.push({ project_id: project.id, category: 'today', title: `Move ${keepCount} Keep item${keepCount > 1 ? 's' : ''} to their permanent home`, completed: false, sort_order: order++ });
  }
  if (donateCount > 0) {
    tasks.push({ project_id: project.id, category: 'today', title: `Box up ${donateCount} Donate item${donateCount > 1 ? 's' : ''} and place them near the exit`, completed: false, sort_order: order++ });
  }
  if (recycleCount > 0) {
    tasks.push({ project_id: project.id, category: 'today', title: `Set aside ${recycleCount} item${recycleCount > 1 ? 's' : ''} for recycling`, completed: false, sort_order: order++ });
  }
  if (trashCount > 0) {
    tasks.push({ project_id: project.id, category: 'today', title: `Discard ${trashCount} item${trashCount > 1 ? 's' : ''} — bring bags or a bin`, completed: false, sort_order: order++ });
  }
  if (sellItems.length > 0) {
    tasks.push({ project_id: project.id, category: 'today', title: `Photograph ${sellItems.length} Sell item${sellItems.length > 1 ? 's' : ''} for listings`, completed: false, sort_order: order++ });
  }

  // This week tasks
  const highValueSell = sellItems.filter((i) => i.resale_value_cents >= 5000);
  const easyEbay = sellItems.filter((i) => i.effort_level === 'low');
  const pickupItems = sellItems.filter((i) => i.effort_level === 'high');

  highValueSell.slice(0, 3).forEach((item) => {
    tasks.push({ project_id: project.id, category: 'this_week', title: `List ${item.name} — suggested $${Math.round(item.listing_price_cents / 100)}`, completed: false, sort_order: order++ });
  });
  if (easyEbay.length > 0) {
    tasks.push({ project_id: project.id, category: 'this_week', title: `List ${easyEbay.length} small item${easyEbay.length > 1 ? 's' : ''} on eBay (easy to ship)`, completed: false, sort_order: order++ });
  }
  if (donateCount > 0) {
    tasks.push({ project_id: project.id, category: 'this_week', title: 'Schedule donation pickup or drop-off', completed: false, sort_order: order++ });
  }
  if (recycleCount > 0) {
    tasks.push({ project_id: project.id, category: 'this_week', title: 'Take recycling to local facility', completed: false, sort_order: order++ });
  }
  if (pickupItems.length > 0) {
    tasks.push({ project_id: project.id, category: 'this_week', title: `Arrange local pickup for ${pickupItems.length} large item${pickupItems.length > 1 ? 's' : ''}`, completed: false, sort_order: order++ });
  }

  return tasks;
}

export function ActionPlan({ project, onBack, onClearRoom, onViewSellItems }: ActionPlanProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: itemData }, { data: taskData }] = await Promise.all([
      supabase.from('items').select('*').eq('project_id', project.id),
      supabase.from('tasks').select('*').eq('project_id', project.id).order('sort_order'),
    ]);
    if (itemData) setItems(itemData);
    if (taskData) setTasks(taskData);
    setLoading(false);
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  async function generatePlan() {
    setGenerating(true);
    // Remove old auto-generated tasks
    await supabase.from('tasks').delete().eq('project_id', project.id);
    const newTasks = generateTasks(project, items);
    if (newTasks.length > 0) {
      const { data } = await supabase.from('tasks').insert(newTasks).select();
      if (data) setTasks(data);
    }
    setGenerating(false);
  }

  async function toggleTask(task: Task) {
    const updated = { ...task, completed: !task.completed };
    setTasks((prev) => prev.map((t) => t.id === task.id ? updated : t));
    await supabase.from('tasks').update({ completed: updated.completed }).eq('id', task.id);
  }

  const todayTasks = tasks.filter((t) => t.category === 'today');
  const weekTasks  = tasks.filter((t) => t.category === 'this_week');

  const sellValue = items
    .filter((i) => (i.user_decision ?? i.recommendation) === 'sell')
    .reduce((s, i) => s + i.resale_value_cents, 0);
  const sellCount = items.filter((i) => (i.user_decision ?? i.recommendation) === 'sell').length;
  const donateCount = items.filter((i) => (i.user_decision ?? i.recommendation) === 'donate').length;
  const clearCount = items.filter((i) => ['donate','recycle','trash'].includes(i.user_decision ?? i.recommendation)).length;
  const estSqFt = Math.round(clearCount * 2.4);

  const completedCount = tasks.filter((t) => t.completed).length;
  const allDone = tasks.length > 0 && completedCount === tasks.length;

  if (loading) return <><NavBar title="Action Plan" onBack={onBack} /><LoadingSpinner /></>;

  return (
    <>
      <NavBar title={`${project.name} Plan`} onBack={onBack} />
      <div className="max-w-lg mx-auto px-4 py-5 space-y-5 pb-10">

        {/* Summary banner */}
        <div className="bg-stone-900 text-white rounded-3xl p-5">
          <p className="text-xs text-stone-400 uppercase tracking-wide mb-2">You've made the decisions.</p>
          <p className="text-lg font-bold leading-snug mb-4">Here's your plan to clear {project.name.toLowerCase()}.</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xl font-bold">{clearCount}</p>
              <p className="text-xs text-stone-400">items leaving</p>
            </div>
            <div>
              <p className="text-xl font-bold">~{estSqFt} ft²</p>
              <p className="text-xs text-stone-400">space freed</p>
            </div>
            <div>
              <p className="text-xl font-bold">{sellValue > 0 ? formatDollars(sellValue) : '—'}</p>
              <p className="text-xs text-stone-400">est. value</p>
            </div>
          </div>
        </div>

        {/* Generate plan button */}
        {tasks.length === 0 ? (
          <button
            onClick={generatePlan}
            disabled={generating || items.length === 0}
            className="w-full flex items-center justify-center gap-2 border-2 border-stone-900 text-stone-900 rounded-2xl py-3.5 text-sm font-semibold hover:bg-stone-900 hover:text-white disabled:opacity-50 transition-all"
          >
            <Sparkles size={16} />
            {generating ? 'Building your plan...' : 'Generate action plan'}
          </button>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-400">{completedCount} of {tasks.length} tasks done</p>
            <button onClick={generatePlan} disabled={generating} className="text-xs text-stone-400 hover:text-stone-700 transition-colors">
              Regenerate
            </button>
          </div>
        )}

        {/* Today tasks */}
        {todayTasks.length > 0 && (
          <TaskSection
            title="Today"
            icon="☀️"
            subtitle={`~${todayTasks.length * 15} min · ${todayTasks.length} tasks`}
            tasks={todayTasks}
            onToggle={toggleTask}
          />
        )}

        {/* This week tasks */}
        {weekTasks.length > 0 && (
          <TaskSection
            title="This week"
            icon="📅"
            subtitle={`${weekTasks.length} follow-up tasks`}
            tasks={weekTasks}
            onToggle={toggleTask}
          />
        )}

        {/* Supplies estimate */}
        {tasks.length > 0 && (
          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Suggested supplies</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-stone-700">
              {donateCount > 0 && <span>📦 {Math.ceil(donateCount / 6)} donation bag{Math.ceil(donateCount / 6) > 1 ? 's' : ''}</span>}
              {clearCount > 0 && <span>🗑️ {Math.ceil(clearCount / 8)} trash bag{Math.ceil(clearCount / 8) > 1 ? 's' : ''}</span>}
              {sellCount > 0 && <span>📱 Phone for photos</span>}
              <span>🖊️ Labels + marker</span>
            </div>
          </div>
        )}

        {/* CTA row */}
        <div className="flex gap-3">
          {sellCount > 0 && (
            <button
              onClick={onViewSellItems}
              className="flex-1 border border-stone-200 text-stone-700 rounded-2xl py-3 text-sm font-semibold hover:bg-stone-50 transition-colors"
            >
              Review sell items
            </button>
          )}
          <button
            onClick={onClearRoom}
            className="flex-1 bg-stone-900 text-white rounded-2xl py-3 text-sm font-semibold hover:bg-stone-800 transition-colors"
          >
            Clear the room
          </button>
        </div>
      </div>
    </>
  );
}

function TaskSection({ title, icon, subtitle, tasks, onToggle }: {
  title: string;
  icon: string;
  subtitle: string;
  tasks: Task[];
  onToggle: (t: Task) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base">{icon}</span>
        <div>
          <p className="text-sm font-bold text-stone-900">{title}</p>
          <p className="text-xs text-stone-400">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onToggle(task)}
            className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 border text-left transition-all ${
              task.completed
                ? 'bg-stone-50 border-stone-100'
                : 'bg-white border-stone-100 hover:border-stone-300 shadow-sm'
            }`}
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
              task.completed ? 'border-emerald-500 bg-emerald-500' : 'border-stone-300'
            }`}>
              {task.completed && <Check size={11} className="text-white" />}
            </div>
            <span className={`text-sm flex-1 leading-snug ${task.completed ? 'line-through text-stone-400' : 'text-stone-800 font-medium'}`}>
              {task.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Plus, ChevronRight, Package } from 'lucide-react';
import { supabase, type Project } from '@/lib/supabase';
import { NavBar } from '@/components/NavBar';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const ROOM_OPTIONS = [
  { type: 'garage', emoji: '🚗', label: 'Garage' },
  { type: 'basement', emoji: '🪜', label: 'Basement' },
  { type: 'attic', emoji: '🏠', label: 'Attic' },
  { type: 'closet', emoji: '👔', label: 'Closet' },
  { type: 'storage', emoji: '📦', label: 'Storage Unit' },
  { type: 'bedroom', emoji: '🛏️', label: 'Guest Room' },
  { type: 'kitchen', emoji: '🍳', label: 'Kitchen' },
  { type: 'office', emoji: '💼', label: 'Office' },
  { type: 'other', emoji: '🏡', label: 'Other' },
];

interface ProjectsProps {
  onSelectProject: (project: Project) => void;
  onBack: () => void;
}

export function Projects({ onSelectProject, onBack }: ProjectsProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(ROOM_OPTIONS[0]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setProjects(data);
      await loadItemCounts(data.map((p) => p.id));
    }
    setLoading(false);
  }

  async function loadItemCounts(ids: string[]) {
    if (ids.length === 0) return;
    const { data } = await supabase
      .from('items')
      .select('project_id')
      .in('project_id', ids);
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((r) => {
        counts[r.project_id] = (counts[r.project_id] ?? 0) + 1;
      });
      setItemCounts(counts);
    }
  }

  async function createProject() {
    const projectName = name.trim() || selectedRoom.label;
    setCreating(true);
    const { data, error } = await supabase
      .from('projects')
      .insert({ name: projectName, room_type: selectedRoom.type, emoji: selectedRoom.emoji })
      .select()
      .maybeSingle();
    setCreating(false);
    if (!error && data) {
      setShowCreate(false);
      setName('');
      onSelectProject(data);
    }
  }

  return (
    <>
      <NavBar title="My Projects" onBack={onBack} right={
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 text-stone-900 hover:text-stone-600 transition-colors">
          <Plus size={20} />
        </button>
      } />
      <div className="max-w-lg mx-auto px-4 py-6">
        {loading ? (
          <LoadingSpinner message="Loading projects..." />
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🏡</div>
            <h2 className="text-xl font-semibold text-stone-900 mb-2">No projects yet</h2>
            <p className="text-stone-500 text-sm mb-6">Start with one room — garage, basement, closet, anywhere.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-stone-900 text-white rounded-2xl px-6 py-3 text-sm font-semibold shadow-sm hover:bg-stone-800 transition-colors"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onSelectProject(project)}
                className="w-full bg-white rounded-2xl p-5 shadow-sm border border-stone-100 flex items-center gap-4 hover:border-stone-300 hover:shadow-md transition-all text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-stone-50 flex items-center justify-center text-2xl shrink-0">
                  {project.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-900 truncate">{project.name}</p>
                  <p className="text-sm text-stone-400 mt-0.5">
                    {itemCounts[project.id] ?? 0} item{(itemCounts[project.id] ?? 0) !== 1 ? 's' : ''} scanned
                  </p>
                </div>
                <ChevronRight size={18} className="text-stone-300 group-hover:text-stone-500 transition-colors shrink-0" />
              </button>
            ))}

            <button
              onClick={() => setShowCreate(true)}
              className="w-full border-2 border-dashed border-stone-200 rounded-2xl p-5 flex items-center justify-center gap-2 text-stone-400 hover:border-stone-300 hover:text-stone-600 transition-all"
            >
              <Plus size={18} />
              <span className="text-sm font-medium">New project</span>
            </button>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-stone-900 mb-1">New Project</h2>
            <p className="text-sm text-stone-500 mb-5">Which room are you tackling?</p>

            <div className="grid grid-cols-3 gap-2 mb-5">
              {ROOM_OPTIONS.map((room) => (
                <button
                  key={room.type}
                  onClick={() => { setSelectedRoom(room); setName(''); }}
                  className={`flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all border ${
                    selectedRoom.type === room.type
                      ? 'bg-stone-900 border-stone-900 text-white'
                      : 'bg-stone-50 border-transparent text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <span className="text-2xl">{room.emoji}</span>
                  <span className="text-xs font-medium">{room.label}</span>
                </button>
              ))}
            </div>

            <div className="mb-5">
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
                Project name (optional)
              </label>
              <input
                type="text"
                placeholder={selectedRoom.label}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 border border-stone-200 text-stone-700 rounded-xl py-3 text-sm font-semibold hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createProject}
                disabled={creating}
                className="flex-1 bg-stone-900 text-white rounded-xl py-3 text-sm font-semibold hover:bg-stone-800 disabled:opacity-60 transition-colors"
              >
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

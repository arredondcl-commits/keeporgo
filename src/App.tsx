import { useState, useEffect } from 'react';
import { supabase, type Project, type Item } from '@/lib/supabase';
import { Landing } from '@/screens/Landing';
import { Onboarding } from '@/screens/Onboarding';
import { Home } from '@/screens/Home';
import { CreateProject } from '@/screens/CreateProject';
import { ProjectDashboard } from '@/screens/ProjectDashboard';
import { ScanItems } from '@/screens/ScanItems';
import { ReviewQueue } from '@/screens/ReviewQueue';
import { ItemDetail } from '@/screens/ItemDetail';
import { ActionPlan } from '@/screens/ActionPlan';
import { CompletionSummary } from '@/screens/CompletionSummary';
import { SellFlow } from '@/screens/SellFlow';
import { Projects } from '@/screens/Projects';
import { ClearRoom } from '@/screens/ClearRoom';

type Screen =
  | { name: 'landing' }
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'create_project' }
  | { name: 'project_dashboard'; projectId: string }
  | { name: 'scan_items'; project: Project }
  | { name: 'review_queue'; project: Project }
  | { name: 'item_detail'; item: Item; project: Project }
  | { name: 'action_plan'; project: Project }
  | { name: 'completion_summary'; project: Project }
  | { name: 'sell_flow'; item: Item; project: Project }
  | { name: 'projects' }
  | { name: 'clear_room' };

function loadScreen(): Screen {
  const saved = localStorage.getItem('kog_screen');
  if (saved) {
    try { return JSON.parse(saved); } catch { /* ignore */ }
  }
  return { name: 'landing' };
}

function saveScreen(s: Screen) {
  if (s.name === 'landing' || s.name === 'home' || s.name === 'onboarding') {
    localStorage.removeItem('kog_screen');
  } else {
    localStorage.setItem('kog_screen', JSON.stringify(s));
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(loadScreen);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => { saveScreen(screen); }, [screen]);

  // Check if onboarding is done
  useEffect(() => {
    const done = localStorage.getItem('kog_onboarding_done');
    if (done) setOnboardingDone(true);
  }, []);

  function go(screen: Screen) {
    setScreen(screen);
    window.scrollTo(0, 0);
  }

  // ── Landing ──
  if (screen.name === 'landing') {
    return (
      <Landing
        onStart={() => go(onboardingDone ? { name: 'home' } : { name: 'onboarding' })}
      />
    );
  }

  // ── Onboarding ──
  if (screen.name === 'onboarding') {
    return (
      <Onboarding
        onComplete={() => {
          localStorage.setItem('kog_onboarding_done', '1');
          setOnboardingDone(true);
          go({ name: 'home' });
        }}
      />
    );
  }

  // ── Home ──
  if (screen.name === 'home') {
    return (
      <Home
        onNewProject={() => go({ name: 'create_project' })}
        onOpenProject={(p) => go({ name: 'project_dashboard', projectId: p.id })}
        onProjects={() => go({ name: 'projects' })}
        onClearRoom={() => go({ name: 'clear_room' })}
      />
    );
  }

  // ── Create Project ──
  if (screen.name === 'create_project') {
    return (
      <CreateProject
        onBack={() => go({ name: 'home' })}
        onCreated={(p) => go({ name: 'project_dashboard', projectId: p.id })}
      />
    );
  }

  // ── Project Dashboard ──
  if (screen.name === 'project_dashboard') {
    return (
      <ProjectDashboard
        projectId={screen.projectId}
        onBack={() => go({ name: 'home' })}
        onScan={(p) => go({ name: 'scan_items', project: p })}
        onReviewQueue={(p) => go({ name: 'review_queue', project: p })}
        onActionPlan={(p) => go({ name: 'action_plan', project: p })}
        onComplete={(p) => go({ name: 'completion_summary', project: p })}
      />
    );
  }

  // ── Scan Items ──
  if (screen.name === 'scan_items') {
    return (
      <ScanItems
        project={screen.project}
        onBack={() => go({ name: 'project_dashboard', projectId: screen.project.id })}
        onItemSaved={(item) => go({ name: 'item_detail', item, project: screen.project })}
        onGoToQueue={() => go({ name: 'review_queue', project: screen.project })}
      />
    );
  }

  // ── Review Queue ──
  if (screen.name === 'review_queue') {
    return (
      <ReviewQueue
        project={screen.project}
        onBack={() => go({ name: 'project_dashboard', projectId: screen.project.id })}
        onItem={(item) => go({ name: 'item_detail', item, project: screen.project })}
        onScan={() => go({ name: 'scan_items', project: screen.project })}
        onActionPlan={() => go({ name: 'action_plan', project: screen.project })}
      />
    );
  }

  // ── Item Detail ──
  if (screen.name === 'item_detail') {
    return (
      <ItemDetail
        item={screen.item}
        project={screen.project}
        onBack={() => go({ name: 'review_queue', project: screen.project })}
        onSell={() => go({ name: 'sell_flow', item: screen.item, project: screen.project })}
      />
    );
  }

  // ── Action Plan ──
  if (screen.name === 'action_plan') {
    return (
      <ActionPlan
        project={screen.project}
        onBack={() => go({ name: 'project_dashboard', projectId: screen.project.id })}
        onComplete={() => go({ name: 'completion_summary', project: screen.project })}
      />
    );
  }

  // ── Completion Summary ──
  if (screen.name === 'completion_summary') {
    return (
      <CompletionSummary
        project={screen.project}
        onHome={() => go({ name: 'home' })}
      />
    );
  }

  // ── Sell Flow ──
  if (screen.name === 'sell_flow') {
    return (
      <SellFlow
        item={screen.item}
        onBack={() => go({ name: 'item_detail', item: screen.item, project: screen.project })}
        onListingCreated={() => go({ name: 'review_queue', project: screen.project })}
      />
    );
  }

  // ── Projects List ──
  if (screen.name === 'projects') {
    return (
      <Projects
        onBack={() => go({ name: 'home' })}
        onOpenProject={(p) => go({ name: 'project_dashboard', projectId: p.id })}
      />
    );
  }

  // ── Clear Room ──
  if (screen.name === 'clear_room') {
    return (
      <ClearRoom
        onBack={() => go({ name: 'home' })}
      />
    );
  }

  return <Landing onStart={() => go({ name: 'onboarding' })} />;
}

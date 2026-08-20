import React, { useState, useEffect } from 'react';
import { Home } from '@/screens/Home';
import { CreateProject } from '@/screens/CreateProject';
import { ProjectDashboard } from '@/screens/ProjectDashboard';
import { ScanItems } from '@/screens/ScanItems';
import { ReviewQueue } from '@/screens/ReviewQueue';
import { ActionPlan } from '@/screens/ActionPlan';
import { ClearRoom } from '@/screens/ClearRoom';
import { CompletionSummary } from '@/screens/CompletionSummary';
import { ItemDetail } from '@/screens/ItemDetail';
import { SellFlow } from '@/screens/SellFlow';
import { Onboarding } from '@/screens/Onboarding';
import type { Project, Item, Listing } from '@/lib/supabase';

type Screen =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'dashboard';   project: Project }
  | { name: 'scan';        project: Project }
  | { name: 'queue';       project: Project }
  | { name: 'action_plan'; project: Project }
  | { name: 'clear_room';  project: Project }
  | { name: 'completion';  project: Project }
  | { name: 'item';        item: Item; project: Project; from: Screen }
  | { name: 'sell';        item: Item; project: Project; from: Screen };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem('kog_onboarded')) {
        setNeedsOnboarding(true);
      }
    } catch { /* ignore */ }
  }, []);

  function go(s: Screen) { setScreen(s); }

  const goHome = () => go({ name: 'home' });

  if (needsOnboarding) {
    return <Onboarding onComplete={() => setNeedsOnboarding(false)} />;
  }

  if (screen.name === 'home') {
    return (
      <Home
        onContinueProject={(project) => go({ name: 'dashboard', project })}
        onNewProject={() => go({ name: 'create' })}
        onSelectProject={(project) => go({ name: 'dashboard', project })}
      />
    );
  }

  if (screen.name === 'create') {
    return (
      <CreateProject
        onBack={goHome}
        onCreated={(project) => go({ name: 'scan', project })}
      />
    );
  }

  if (screen.name === 'dashboard') {
    const { project } = screen;
    return (
      <ProjectDashboard
        project={project}
        onBack={goHome}
        onScanItems={() => go({ name: 'scan', project })}
        onViewItem={(item) => go({ name: 'item', item, project, from: screen })}
        onReviewQueue={() => go({ name: 'queue', project })}
        onActionPlan={() => go({ name: 'action_plan', project })}
      />
    );
  }

  if (screen.name === 'scan') {
    const { project } = screen;
    return (
      <ScanItems
        project={project}
        onBack={() => go({ name: 'dashboard', project })}
        onItemSaved={() => go({ name: 'queue', project })}
        onGoToQueue={() => go({ name: 'queue', project })}
      />
    );
  }

  if (screen.name === 'queue') {
    const { project } = screen;
    return (
      <ReviewQueue
        project={project}
        onBack={() => go({ name: 'dashboard', project })}
        onComplete={() => go({ name: 'action_plan', project })}
        onScanMore={() => go({ name: 'scan', project })}
      />
    );
  }

  if (screen.name === 'action_plan') {
    const { project } = screen;
    return (
      <ActionPlan
        project={project}
        onBack={() => go({ name: 'dashboard', project })}
        onClearRoom={() => go({ name: 'clear_room', project })}
        onViewSellItems={() => go({ name: 'queue', project })}
      />
    );
  }

  if (screen.name === 'clear_room') {
    const { project } = screen;
    return (
      <ClearRoom
        project={project}
        onBack={() => go({ name: 'action_plan', project })}
        onFinished={() => go({ name: 'completion', project })}
      />
    );
  }

  if (screen.name === 'completion') {
    const { project } = screen;
    return (
      <CompletionSummary
        project={project}
        onBack={() => go({ name: 'dashboard', project })}
        onStartNewRoom={() => go({ name: 'create' })}
        onReviewSellItems={() => go({ name: 'queue', project })}
      />
    );
  }

  if (screen.name === 'item') {
    const { item, project, from } = screen;
    return (
      <ItemDetail
        item={item}
        onBack={() => go(from)}
        onDeleted={() => go(from)}
        onCreateListing={(i) => go({ name: 'sell', item: i, project, from: screen })}
      />
    );
  }

  if (screen.name === 'sell') {
    const { item, project, from } = screen;
    return (
      <SellFlow
        item={item}
        onBack={() => go(from)}
        onListingCreated={(_listing: Listing) => go({ name: 'dashboard', project })}
      />
    );
  }

  return null;
}

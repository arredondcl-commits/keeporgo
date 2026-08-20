import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface NavBarProps {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function NavBar({ title, onBack, right }: NavBarProps) {
  return (
    <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-stone-100">
      <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
        {onBack ? (
          <button onClick={onBack} className="flex items-center gap-1.5 text-stone-500 hover:text-stone-900 transition-colors -ml-1 p-1">
            <ArrowLeft size={18} />
            <span className="text-sm">Back</span>
          </button>
        ) : (
          <div className="w-16" />
        )}
        <span className="text-sm font-semibold text-stone-900 tracking-tight">{title}</span>
        <div className="w-16 flex justify-end">{right}</div>
      </div>
    </div>
  );
}

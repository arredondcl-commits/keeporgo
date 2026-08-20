import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-stone-200 border-t-stone-700 animate-spin" />
      <p className="text-sm text-stone-500">{message}</p>
    </div>
  );
}

import React from 'react';

interface ConfidenceRingProps {
  score: number;
  size?: number;
}

export function ConfidenceRing({ score, size = 40 }: ConfidenceRingProps) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;
  const color = score >= 85 ? '#10b981' : score >= 65 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={3} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={3}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-xs font-semibold text-stone-700">{score}</span>
    </div>
  );
}

"use client";

import type { GameMode } from "@/lib/game/types";

interface ModeSelectProps {
  value: GameMode;
  onChange: (mode: GameMode) => void;
}

const MODES: { value: GameMode; label: string; sub: string }[] = [
  { value: "two-player", label: "2 Player", sub: "7 cards · 2 sequences" },
  { value: "three-player", label: "3 Player", sub: "6 cards · 1 sequence" },
  { value: "two-team", label: "2 Teams of 2", sub: "6 cards · 2 sequences" },
];

export default function ModeSelect({ value, onChange }: ModeSelectProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          onClick={() => onChange(mode.value)}
          className={`flex flex-col items-center gap-0.5 rounded-lg border-2 px-2 py-2 text-center transition ${
            value === mode.value
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
              : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
          }`}
        >
          <span
            className={`text-xs font-semibold ${
              value === mode.value
                ? "text-blue-700 dark:text-blue-300"
                : "text-zinc-700 dark:text-zinc-200"
            }`}
          >
            {mode.label}
          </span>
          <span className="text-[0.65rem] text-zinc-400">{mode.sub}</span>
        </button>
      ))}
    </div>
  );
}

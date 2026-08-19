"use client";

import type { GameMode } from "@/lib/game/types";

interface ModeSelectProps {
  value: GameMode;
  onChange: (mode: GameMode) => void;
}

// Sequences-to-win is no longer fixed per mode — it's a separate toggle
// (default 2) chosen alongside hints, since even 3-player games can feel
// too short at 1 sequence. See WaitingRoom's "Sequences to win" control.
const MODES: { value: GameMode; label: string; sub: string }[] = [
  { value: "two-player", label: "2 Player", sub: "7 cards each" },
  { value: "three-player", label: "3 Player", sub: "6 cards each" },
  { value: "two-team", label: "2 Teams of 2", sub: "6 cards each" },
];

export default function ModeSelect({ value, onChange }: ModeSelectProps) {
  return (
    <div role="radiogroup" aria-label="Game mode" className="grid grid-cols-3 gap-2">
      {MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          role="radio"
          aria-checked={value === mode.value}
          onClick={() => onChange(mode.value)}
          className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-2 text-center transition-colors ${
            value === mode.value
              ? "border-gold-500 bg-gradient-to-b from-gold-400 to-gold-500 shadow-card"
              : "border-card-border hover:border-gold-400/60"
          }`}
        >
          <span
            className={`text-xs font-semibold ${
              value === mode.value ? "text-ink-fixed" : "text-panel-ink"
            }`}
          >
            {mode.label}
          </span>
          <span className={`text-[0.65rem] ${value === mode.value ? "text-ink-fixed/70" : "text-panel-ink-soft"}`}>
            {mode.sub}
          </span>
        </button>
      ))}
    </div>
  );
}

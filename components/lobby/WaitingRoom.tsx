"use client";

import { useState } from "react";
import type { ChipColor, GameMode, PlayerMeta } from "@/lib/game/types";

interface WaitingRoomProps {
  roomCode: string;
  mode: GameMode;
  players: PlayerMeta[];
  isHost: boolean;
  hintsDraft: boolean;
  onHintsChange: (value: boolean) => void;
  onStart: () => void;
  starting: boolean;
}

const MODE_LABELS: Record<GameMode, string> = {
  "two-player": "2 Player",
  "three-player": "3 Player",
  "two-team": "2 Teams of 2",
};

const MAX_PLAYERS: Record<GameMode, number> = {
  "two-player": 2,
  "three-player": 3,
  "two-team": 4,
};

const CHIP_DOT_CLASSES: Record<ChipColor, string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
};

export default function WaitingRoom({
  roomCode,
  mode,
  players,
  isHost,
  hintsDraft,
  onHintsChange,
  onStart,
  starting,
}: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const limit = MAX_PLAYERS[mode];
  const full = players.length >= limit;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail (permissions, insecure context); the
      // code is already shown on screen either way, so this is just a
      // missed convenience, not a broken flow.
    }
  }

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-2">
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          {MODE_LABELS[mode]}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          title="Click to copy"
          className="group flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 font-mono text-2xl font-bold tracking-widest text-zinc-800 transition hover:border-blue-400 hover:bg-blue-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-blue-950"
        >
          {roomCode}
          <span className="text-xs font-sans font-normal text-zinc-400 group-hover:text-blue-500">
            {copied ? "Copied!" : "Copy"}
          </span>
        </button>
        <p className="text-sm text-zinc-500">Share this code with the others.</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
          <span>Players</span>
          <span>
            {players.length}/{limit}
          </span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: limit }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < players.length ? "bg-blue-500" : "bg-zinc-200 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>
        <ul className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
          {players.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 px-1 py-0.5 text-sm">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CHIP_DOT_CLASSES[p.chipColor]}`} />
              <span className="flex-1 truncate">{p.displayName}</span>
              {p.team ? (
                <span className="text-xs text-zinc-400">Team {p.team}</span>
              ) : null}
              {i === 0 ? (
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  Host
                </span>
              ) : null}
            </li>
          ))}
          {Array.from({ length: limit - players.length }).map((_, i) => (
            <li
              key={`empty-${i}`}
              className="px-1 py-0.5 text-sm text-zinc-300 italic dark:text-zinc-600"
            >
              Waiting for player…
            </li>
          ))}
        </ul>
      </div>

      {full && isHost ? (
        <div className="flex flex-col items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={hintsDraft}
              onChange={(e) => onHintsChange(e.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
            Enable hints for everyone
          </label>
          <button
            type="button"
            disabled={starting}
            onClick={onStart}
            className="rounded-lg bg-blue-600 px-6 py-2.5 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {starting ? "Starting…" : "Start game"}
          </button>
        </div>
      ) : full ? (
        <p className="text-sm text-zinc-400">Waiting for the host to start the game…</p>
      ) : null}
    </main>
  );
}

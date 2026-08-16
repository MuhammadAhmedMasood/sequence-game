"use client";

import { useState } from "react";
import type { ChipColor, GameMode, PlayerId, PlayerMeta, Team } from "@/lib/game/types";

interface WaitingRoomProps {
  roomCode: string;
  mode: GameMode;
  players: PlayerMeta[];
  isHost: boolean;
  myPlayerId: PlayerId | null;
  onSetTeam: (team: Team) => void;
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
  myPlayerId,
  onSetTeam,
  hintsDraft,
  onHintsChange,
  onStart,
  starting,
}: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const limit = MAX_PLAYERS[mode];
  const full = players.length >= limit;

  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");
  const myPlayer = players.find((p) => p.id === myPlayerId);
  const teamsBalanced = mode !== "two-team" || (teamA.length === 2 && teamB.length === 2);
  const canStart = full && teamsBalanced;

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
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 dark:from-zinc-950 dark:via-zinc-950 dark:to-indigo-950">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="flex flex-col items-center gap-2">
          <span className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm">
            {MODE_LABELS[mode]}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            title="Click to copy"
            className="group flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 font-mono text-2xl font-bold tracking-widest text-zinc-800 transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-indigo-950"
          >
            {roomCode}
            <span className="text-xs font-sans font-normal text-zinc-400 group-hover:text-indigo-500">
              {copied ? "Copied!" : "Copy"}
            </span>
          </button>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Share this code with the others.</p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span>Players</span>
            <span>
              {players.length}/{limit}
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: limit }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < players.length
                    ? "bg-gradient-to-r from-indigo-500 to-violet-500"
                    : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            ))}
          </div>
          <ul className="flex flex-col gap-1.5 rounded-xl border border-zinc-200 p-2 dark:border-zinc-700">
            {players.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 px-1 py-0.5 text-sm">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CHIP_DOT_CLASSES[p.chipColor]}`} />
                <span className="flex-1 truncate">
                  {p.displayName}
                  {p.id === myPlayerId ? <span className="text-zinc-400"> (you)</span> : null}
                </span>
                {p.team ? (
                  <span className="text-xs text-zinc-400">Team {p.team}</span>
                ) : null}
                {i === 0 ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
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

        {mode === "two-team" && myPlayer ? (
          <div className="flex w-full flex-col gap-2">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Pick your team
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSetTeam("A")}
                disabled={myPlayer.team === "A" || teamA.length >= 2}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  myPlayer.team === "A"
                    ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                    : "border-zinc-200 text-zinc-600 hover:border-red-300 hover:bg-red-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-red-950/40"
                }`}
              >
                <span className="h-3 w-3 rounded-full bg-red-500" />
                Team A ({teamA.length}/2)
              </button>
              <button
                type="button"
                onClick={() => onSetTeam("B")}
                disabled={myPlayer.team === "B" || teamB.length >= 2}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  myPlayer.team === "B"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    : "border-zinc-200 text-zinc-600 hover:border-blue-300 hover:bg-blue-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-blue-950/40"
                }`}
              >
                <span className="h-3 w-3 rounded-full bg-blue-500" />
                Team B ({teamB.length}/2)
              </button>
            </div>
          </div>
        ) : null}

        {full && isHost ? (
          <div className="flex w-full flex-col items-center gap-3">
            {!teamsBalanced ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Each team needs exactly 2 players before you can start.
              </p>
            ) : null}
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={hintsDraft}
                onChange={(e) => onHintsChange(e.target.checked)}
                className="h-4 w-4 accent-indigo-500"
              />
              Enable hints for everyone
            </label>
            <button
              type="button"
              disabled={starting || !canStart}
              onClick={onStart}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 font-semibold text-white shadow-md transition hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {starting ? "Starting…" : "Start game"}
            </button>
          </div>
        ) : full && !teamsBalanced ? (
          <p className="text-sm text-zinc-400">Waiting for teams to even out…</p>
        ) : full ? (
          <p className="text-sm text-zinc-400">Waiting for the host to start the game…</p>
        ) : null}
      </div>
    </main>
  );
}

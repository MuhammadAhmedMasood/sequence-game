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
  onSwapTeam: (otherPlayerId: PlayerId) => void;
  hintsDraft: boolean;
  onHintsChange: (value: boolean) => void;
  sequencesToWinDraft: number;
  onSequencesToWinChange: (value: number) => void;
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

const TEAM_COLUMN_STYLES: Record<
  "A" | "B",
  { border: string; heading: string; hover: string }
> = {
  A: {
    border: "border-red-200 dark:border-red-900",
    heading: "text-red-600 dark:text-red-400",
    hover: "border-red-400 bg-red-50 dark:bg-red-950/40",
  },
  B: {
    border: "border-blue-200 dark:border-blue-900",
    heading: "text-blue-600 dark:text-blue-400",
    hover: "border-blue-400 bg-blue-50 dark:bg-blue-950/40",
  },
};

interface TeamColumnsProps {
  players: PlayerMeta[];
  myPlayerId: PlayerId | null;
  onSetTeam: (team: Team) => void;
  onSwapTeam: (otherPlayerId: PlayerId) => void;
}

// Drag-and-drop is self-only: a player can pick up and move their own
// name block between the two team columns, but not anyone else's — an
// "any player can move any player" model would need every row writable
// by every seated player, a much bigger RLS blast radius for one UI
// convenience (see supabase/schema.sql's "update own player before
// start" policy). Built on Pointer Events (not HTML5 drag-and-drop)
// specifically so the same handlers work for both mouse and touch —
// native HTML5 DnD doesn't fire from touchscreens on most mobile
// browsers, and this app has to be draggable on a phone too.
//
// Once both columns hold 2/2 (the normal state once all 4 seats are
// taken), there's no empty slot left to move into — dropping on the
// other column would always be a no-op. Dropping directly onto one of
// its occupants instead trades places with them (swap_player_team),
// which is why hover tracks a specific player row, not just a column.
function TeamColumns({ players, myPlayerId, onSetTeam, onSwapTeam }: TeamColumnsProps) {
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverTeam, setHoverTeam] = useState<Team | null>(null);
  const [hoverPlayerId, setHoverPlayerId] = useState<PlayerId | null>(null);

  const myPlayer = players.find((p) => p.id === myPlayerId);
  const dragging = dragPos !== null && myPlayer !== undefined;

  function teamCount(team: Team) {
    return players.filter((p) => p.team === team).length;
  }

  function canDropOn(team: Team) {
    return !!myPlayer && team !== myPlayer.team && teamCount(team) < 2;
  }

  function canSwapWith(otherPlayerId: PlayerId) {
    if (!myPlayer || otherPlayerId === myPlayerId) return false;
    const other = players.find((p) => p.id === otherPlayerId);
    return !!other && other.team !== myPlayer.team;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!myPlayer) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragPos({ x: e.clientX, y: e.clientY });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragPos({ x: e.clientX, y: e.clientY });
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const row = el?.closest<HTMLElement>("[data-player-row]");
    if (row?.dataset.playerId && canSwapWith(row.dataset.playerId)) {
      setHoverPlayerId(row.dataset.playerId);
      setHoverTeam(null);
      return;
    }
    setHoverPlayerId(null);
    const column = el?.closest<HTMLElement>("[data-team-column]");
    setHoverTeam((column?.dataset.team as Team) ?? null);
  }

  function endDrag() {
    if (dragging && hoverPlayerId && canSwapWith(hoverPlayerId)) {
      onSwapTeam(hoverPlayerId);
    } else if (dragging && hoverTeam && canDropOn(hoverTeam)) {
      onSetTeam(hoverTeam);
    }
    setDragPos(null);
    setHoverTeam(null);
    setHoverPlayerId(null);
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {myPlayer ? "Drag your name into a team, or onto a player to swap" : "Teams"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(["A", "B"] as const).map((team) => {
          const teamPlayers = players.filter((p) => p.team === team);
          const style = TEAM_COLUMN_STYLES[team];
          const isValidHover = hoverTeam === team && canDropOn(team);

          return (
            <div
              key={team}
              data-team-column
              data-team={team}
              className={`flex flex-col gap-1.5 rounded-xl border-2 p-2 transition-colors ${
                isValidHover ? style.hover : style.border
              }`}
            >
              <p className={`text-center text-xs font-semibold ${style.heading}`}>
                Team {team} ({teamPlayers.length}/2)
              </p>
              {Array.from({ length: 2 }).map((_, slot) => {
                const p = teamPlayers[slot];
                if (!p) {
                  return (
                    <div
                      key={`empty-${slot}`}
                      className="flex h-10 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-xs text-zinc-300 dark:border-zinc-700 dark:text-zinc-600"
                    >
                      Empty
                    </div>
                  );
                }
                const isMe = p.id === myPlayerId;
                const isBeingDragged = isMe && dragging;
                const isSwapTarget = hoverPlayerId === p.id;
                return (
                  <div
                    key={p.id}
                    data-player-row
                    data-player-id={p.id}
                    onPointerDown={isMe ? handlePointerDown : undefined}
                    onPointerMove={isMe ? handlePointerMove : undefined}
                    onPointerUp={isMe ? endDrag : undefined}
                    onPointerCancel={isMe ? endDrag : undefined}
                    style={isMe ? { touchAction: "none" } : undefined}
                    className={`flex h-10 items-center gap-2 rounded-lg border px-2 text-sm select-none ${
                      isMe
                        ? "cursor-grab border-indigo-300 bg-indigo-50 active:cursor-grabbing dark:border-indigo-700 dark:bg-indigo-950"
                        : isSwapTarget
                          ? "border-indigo-400 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-950/40"
                          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
                    } ${isBeingDragged ? "opacity-30" : ""}`}
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CHIP_DOT_CLASSES[p.chipColor]}`} />
                    <span className="flex-1 truncate">
                      {p.displayName}
                      {isMe ? " (you)" : ""}
                    </span>
                    {p.seatIndex === 0 ? (
                      <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[0.6rem] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Host
                      </span>
                    ) : null}
                    {isMe ? (
                      <span className="shrink-0 text-zinc-400" aria-hidden>
                        ⠿
                      </span>
                    ) : null}
                    {isSwapTarget ? (
                      <span className="shrink-0 text-indigo-500 dark:text-indigo-400" aria-hidden>
                        ⇄
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {dragging && myPlayer ? (
        <div
          style={{
            position: "fixed",
            left: dragPos.x,
            top: dragPos.y,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 50,
          }}
          className="flex items-center gap-2 rounded-lg border border-indigo-400 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-lg dark:bg-zinc-800 dark:text-zinc-100"
        >
          <span className={`h-2.5 w-2.5 rounded-full ${CHIP_DOT_CLASSES[myPlayer.chipColor]}`} />
          {myPlayer.displayName}
        </div>
      ) : null}
    </div>
  );
}

export default function WaitingRoom({
  roomCode,
  mode,
  players,
  isHost,
  myPlayerId,
  onSetTeam,
  onSwapTeam,
  hintsDraft,
  onHintsChange,
  sequencesToWinDraft,
  onSequencesToWinChange,
  onStart,
  starting,
}: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const limit = MAX_PLAYERS[mode];
  const full = players.length >= limit;

  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");
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
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/80">
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

          {mode === "two-team" ? (
            <TeamColumns
              players={players}
              myPlayerId={myPlayerId}
              onSetTeam={onSetTeam}
              onSwapTeam={onSwapTeam}
            />
          ) : (
            <ul className="flex flex-col gap-1.5 rounded-xl border border-zinc-200 p-2 dark:border-zinc-700">
              {players.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 px-1 py-0.5 text-sm">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CHIP_DOT_CLASSES[p.chipColor]}`} />
                  <span className="flex-1 truncate">
                    {p.displayName}
                    {p.id === myPlayerId ? <span className="text-zinc-400"> (you)</span> : null}
                  </span>
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
          )}
        </div>

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
            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <span>Sequences to win</span>
              <div className="flex overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-600">
                {([1, 2] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onSequencesToWinChange(n)}
                    className={`px-3 py-1 text-sm font-medium transition ${
                      sequencesToWinDraft === n
                        ? "bg-indigo-500 text-white"
                        : "bg-white text-zinc-600 hover:bg-indigo-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
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

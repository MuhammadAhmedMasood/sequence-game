"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GameMode } from "@/lib/game/types";
import { createRoom, joinRoom } from "@/lib/supabase/queries";
import ModeSelect from "./ModeSelect";

// Not identity — just a convenience so a disconnected player who lands on
// "/" instead of their room URL can find their way back. Actual
// reconnection is identity-based (see lib/supabase/client.ts): navigating
// straight to /room/[code] already works without this.
const LAST_ROOM_KEY = "sequence:lastRoomCode";

export default function OnlinePlayPanel() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<GameMode>("two-player");
  const [joinCode, setJoinCode] = useState("");
  const [busyAction, setBusyAction] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRoomCode, setLastRoomCode] = useState<string | null>(null);

  useEffect(() => {
    setLastRoomCode(localStorage.getItem(LAST_ROOM_KEY));
  }, []);

  function goToRoom(roomCode: string) {
    localStorage.setItem(LAST_ROOM_KEY, roomCode);
    router.push(`/room/${roomCode}`);
  }

  async function handleCreate() {
    if (!displayName.trim()) {
      setError("Enter your name first.");
      return;
    }
    setBusyAction("create");
    setError(null);
    try {
      const { roomCode } = await createRoom(mode, displayName.trim());
      goToRoom(roomCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleJoin() {
    if (!displayName.trim() || !joinCode.trim()) {
      setError("Enter your name and a room code.");
      return;
    }
    setBusyAction("join");
    setError(null);
    try {
      const { roomCode } = await joinRoom(joinCode.trim(), displayName.trim());
      goToRoom(roomCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join room");
    } finally {
      setBusyAction(null);
    }
  }

  const inputClasses =
    "rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-zinc-600 dark:bg-zinc-800 dark:focus:ring-blue-950";

  return (
    <div className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      {lastRoomCode ? (
        <button
          type="button"
          onClick={() => goToRoom(lastRoomCode)}
          className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
        >
          <span>Rejoin room {lastRoomCode}</span>
          <span aria-hidden>→</span>
        </button>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="display-name" className="text-xs font-semibold text-zinc-500">
          Your name
        </label>
        <input
          id="display-name"
          type="text"
          placeholder="e.g. Alex"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputClasses}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-zinc-500">New game</p>
        <ModeSelect value={mode} onChange={setMode} />
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={handleCreate}
          className="mt-1 rounded-lg bg-blue-600 py-2.5 font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
        >
          {busyAction === "create" ? "Creating…" : "Create room"}
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs font-medium text-zinc-400">
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        or
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-zinc-500">Have a code?</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ROOM CODE"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className={`flex-1 font-mono uppercase tracking-widest ${inputClasses}`}
          />
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={handleJoin}
            className="shrink-0 rounded-lg bg-zinc-800 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-zinc-900 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            {busyAction === "join" ? "Joining…" : "Join"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

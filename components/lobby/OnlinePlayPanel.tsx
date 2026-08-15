"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GameMode } from "@/lib/game/types";
import { createRoom, joinRoom } from "@/lib/supabase/queries";

// Not identity — just a convenience so a disconnected player who lands on
// "/" instead of their room URL can find their way back. Actual
// reconnection is identity-based (see lib/supabase/client.ts): navigating
// straight to /room/[code] already works without this.
const LAST_ROOM_KEY = "sequence:lastRoomCode";

// Milestone 3 scope: minimal but real create/join UI to prove the
// Supabase wiring end-to-end. Milestone 4 replaces this with the real
// landing page design.
export default function OnlinePlayPanel() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<GameMode>("two-player");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    setError(null);
    try {
      const { roomCode } = await createRoom(mode, displayName.trim());
      goToRoom(roomCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!displayName.trim() || !joinCode.trim()) {
      setError("Enter your name and a room code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { roomCode } = await joinRoom(joinCode.trim(), displayName.trim());
      goToRoom(roomCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join room");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-2 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">
      <p className="font-semibold text-zinc-700 dark:text-zinc-200">Play online</p>

      {lastRoomCode ? (
        <button
          type="button"
          onClick={() => goToRoom(lastRoomCode)}
          className="rounded border border-blue-500 px-2 py-1 text-left font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
        >
          Rejoin room {lastRoomCode}
        </button>
      ) : null}

      <input
        type="text"
        placeholder="Your name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
      />
      <div className="flex gap-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as GameMode)}
          className="flex-1 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
        >
          <option value="two-player">2 Player</option>
          <option value="three-player">3 Player</option>
          <option value="two-team">2 Teams of 2</option>
        </select>
        <button
          type="button"
          disabled={busy}
          onClick={handleCreate}
          className="rounded bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Create room
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Room code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          className="flex-1 rounded border border-zinc-300 px-2 py-1 uppercase dark:border-zinc-600 dark:bg-zinc-800"
        />
        <button
          type="button"
          disabled={busy}
          onClick={handleJoin}
          className="rounded bg-zinc-700 px-3 py-1 font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          Join room
        </button>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
    </div>
  );
}

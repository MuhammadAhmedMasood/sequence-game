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
    "rounded-xl border border-card-border bg-card-face px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-gold-500 focus:ring-2 focus:ring-gold-300/40";

  return (
    <div className="animate-fade-slide-up flex w-full flex-col gap-5 rounded-frame border border-panel-border bg-panel p-6 shadow-panel backdrop-blur-sm sm:p-7">
      {lastRoomCode ? (
        <button
          type="button"
          onClick={() => goToRoom(lastRoomCode)}
          className="group flex items-center justify-between rounded-xl border border-gold-500/40 bg-gold-200/20 px-4 py-2.5 text-sm font-medium text-panel-ink transition hover:bg-gold-200/35"
        >
          <span>
            Rejoin room <span className="font-mono tracking-widest text-gold-700">{lastRoomCode}</span>
          </span>
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="display-name" className="text-xs font-semibold text-panel-ink-soft">
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
        <p className="text-xs font-semibold text-panel-ink-soft">New game</p>
        <ModeSelect value={mode} onChange={setMode} />
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={handleCreate}
          className="mt-1 rounded-xl bg-gradient-to-b from-gold-400 to-gold-600 py-2.5 font-semibold text-ink-fixed shadow-card transition hover:brightness-105 active:brightness-95 disabled:opacity-50"
        >
          {busyAction === "create" ? "Creating…" : "Create room"}
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs font-medium text-panel-ink-soft">
        <div className="h-px flex-1 bg-panel-border" />
        or
        <div className="h-px flex-1 bg-panel-border" />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-panel-ink-soft">Have a code?</p>
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
            className="shrink-0 rounded-xl bg-ink px-4 py-2 font-semibold text-card-face shadow-card transition hover:brightness-125 disabled:opacity-50"
          >
            {busyAction === "join" ? "Joining…" : "Join"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-suit/30 bg-red-suit/10 px-3 py-2 text-sm text-red-suit">
          {error}
        </p>
      ) : null}
    </div>
  );
}

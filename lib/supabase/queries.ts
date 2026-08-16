import { ensureAuthUserId } from "@/lib/player/identity";
import type { ChipColor, GameMode, Team } from "@/lib/game/types";
import { supabase } from "./client";

interface ModeLimits {
  maxPlayers: number;
  handSize: number;
  sequencesToWin: number;
}

// Mirrors the per-mode setup in CLAUDE.md/docs/RULES.md. Kept separate
// from app/page.tsx's local hot-seat MODE_CONFIG: that one seats a full
// known roster at once (via turnOrder.buildSeating); this one seats
// players one at a time as they join a live room, so seats are assigned
// incrementally instead.
const MODE_LIMITS: Record<GameMode, ModeLimits> = {
  "two-player": { maxPlayers: 2, handSize: 7, sequencesToWin: 2 },
  "three-player": { maxPlayers: 3, handSize: 6, sequencesToWin: 1 },
  "two-team": { maxPlayers: 4, handSize: 6, sequencesToWin: 2 },
};

// Avoids visually ambiguous characters (0/O, 1/I).
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

// Team alternates as seats fill (TeamA-P1, TeamB-P1, TeamA-P2, TeamB-P2),
// matching turnOrder.buildSeating's interleaving for the local demo.
function seatAssignment(mode: GameMode, seatIndex: number): { chipColor: ChipColor; team: Team } {
  if (mode === "two-team") {
    const team: Team = seatIndex % 2 === 0 ? "A" : "B";
    return { chipColor: team === "A" ? "red" : "blue", team };
  }
  const colors: ChipColor[] = ["red", "blue", "green"];
  return { chipColor: colors[seatIndex], team: null };
}

export interface JoinedRoom {
  gameId: string;
  roomCode: string;
  playerId: string;
}

export async function createRoom(mode: GameMode, displayName: string): Promise<JoinedRoom> {
  const authUserId = await ensureAuthUserId();
  const limits = MODE_LIMITS[mode];

  // room_code has a unique constraint — retry a handful of times on the
  // (very unlikely) chance of a collision with an existing room.
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = generateRoomCode();
    const { data: game, error: gameError } = await supabase
      .from("games")
      .insert({
        room_code: roomCode,
        mode,
        hand_size: limits.handSize,
        sequences_to_win: limits.sequencesToWin,
      })
      .select()
      .single();

    if (gameError) {
      lastError = gameError;
      if (gameError.code === "23505") continue; // unique_violation on room_code
      throw new Error(gameError.message);
    }

    const { chipColor, team } = seatAssignment(mode, 0);
    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({
        game_id: game.id,
        auth_user_id: authUserId,
        display_name: displayName,
        seat_index: 0,
        team,
        chip_color: chipColor,
      })
      .select()
      .single();
    if (playerError || !player) {
      throw new Error(playerError?.message ?? "Failed to join the room you just created");
    }

    return { gameId: game.id, roomCode: game.room_code, playerId: player.id };
  }

  throw new Error(
    lastError instanceof Error ? lastError.message : "Could not generate a unique room code",
  );
}

export async function joinRoom(roomCode: string, displayName: string): Promise<JoinedRoom> {
  const authUserId = await ensureAuthUserId();
  const normalizedCode = roomCode.trim().toUpperCase();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, room_code, mode, status")
    .eq("room_code", normalizedCode)
    .single();
  if (gameError || !game) {
    throw new Error("Room not found — check the code and try again.");
  }

  // Reconnecting: this identity already has a seat here (e.g. they closed
  // the tab and came back, or typed the code again instead of using
  // browser history) — hand them back their existing seat rather than
  // trying to claim a new one, regardless of whether the game already
  // started.
  const { data: existingPlayer } = await supabase
    .from("players")
    .select("id")
    .eq("game_id", game.id)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (existingPlayer) {
    return { gameId: game.id, roomCode: game.room_code, playerId: existingPlayer.id };
  }

  if (game.status !== "lobby") {
    throw new Error("That game has already started.");
  }

  const limits = MODE_LIMITS[game.mode as GameMode];

  // A join race (two people joining the same open seat at once) surfaces
  // as a unique-constraint error on (game_id, seat_index) — retry a
  // couple of times against a freshly counted seat.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { count, error: countError } = await supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("game_id", game.id);
    if (countError) throw new Error(countError.message);

    const seatIndex = count ?? 0;
    if (seatIndex >= limits.maxPlayers) {
      throw new Error("Room is full.");
    }

    const { chipColor, team } = seatAssignment(game.mode as GameMode, seatIndex);
    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({
        game_id: game.id,
        auth_user_id: authUserId,
        display_name: displayName,
        seat_index: seatIndex,
        team,
        chip_color: chipColor,
      })
      .select()
      .single();

    if (playerError) {
      lastError = playerError;
      if (playerError.code === "23505") continue; // seat taken, retry
      throw new Error(playerError.message);
    }

    return { gameId: game.id, roomCode: game.room_code, playerId: player!.id };
  }

  throw new Error(lastError instanceof Error ? lastError.message : "Could not claim a seat");
}

// Lets a player switch their own team in the 2v2 lobby before the game
// starts. Relies on the "update own player before start" RLS policy
// (auth_user_id = auth.uid(), and only while games.status = 'lobby');
// deal_game re-derives seat_index/turn order from each player's final
// team choice, so no seat/turn bookkeeping is needed here.
export async function setTeam(playerId: string, team: Team): Promise<void> {
  const { error } = await supabase
    .from("players")
    .update({ team, chip_color: team === "A" ? "red" : "blue" })
    .eq("id", playerId);
  if (error) throw new Error(error.message);
}

// hintsEnabled and sequencesToWin are whole-game settings the host picks
// once, here — every player sees the same values for the rest of the
// game (see RoomClient.tsx). sequencesToWin overrides the per-mode
// default already written by createRoom (MODE_LIMITS) — it's a plain 1
// or 2 toggle, not mode-derived, since even 3-player games can feel too
// short at 1. The update is only reachable by the host in the first
// place: the "update on your turn" RLS policy requires seat_index to
// match games.current_seat_index, which defaults to 0 (the host's seat)
// until deal_game changes it.
export async function startGame(
  gameId: string,
  hintsEnabled: boolean,
  sequencesToWin: number,
): Promise<void> {
  const { error: settingError } = await supabase
    .from("games")
    .update({ hints_enabled: hintsEnabled, sequences_to_win: sequencesToWin })
    .eq("id", gameId);
  if (settingError) throw new Error(settingError.message);

  const { error } = await supabase.rpc("deal_game", { p_game_id: gameId });
  if (error) throw new Error(error.message);
}

// Host-only, only once the previous round actually ended (rematch_game
// itself re-checks both — this call would just fail otherwise). Resets
// the board/hands/deck and, when resetTeams is false, redeals
// immediately so the room lands straight back in a fresh round; when
// true, it goes back to the lobby's team picker instead.
export async function rematchGame(gameId: string, resetTeams: boolean): Promise<void> {
  const { error } = await supabase.rpc("rematch_game", {
    p_game_id: gameId,
    p_reset_teams: resetTeams,
  });
  if (error) throw new Error(error.message);
}

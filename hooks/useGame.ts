"use client";

import { useCallback, useEffect, useState } from "react";
import { applyMove, validateMove } from "@/lib/game/moves";
import type {
  CardInstance,
  Move,
  MoveAction,
  PlayerId,
  PlayerMeta,
} from "@/lib/game/types";
import { ensureAuthUserId } from "@/lib/player/identity";
import { supabase } from "@/lib/supabase/client";
import type { GameRow, PlayerRow } from "@/lib/supabase/types";

function toPlayerMeta(row: PlayerRow): PlayerMeta {
  return {
    id: row.id,
    displayName: row.display_name,
    seatIndex: row.seat_index,
    team: row.team,
    chipColor: row.chip_color,
  };
}

export interface UseGameResult {
  loading: boolean;
  error: string | null;
  game: GameRow | null;
  players: PlayerMeta[];
  myPlayerId: PlayerId | null;
  myHand: CardInstance[];
  playMove: (card: CardInstance, action: MoveAction) => Promise<void>;
  swapDeadCard: (card: CardInstance) => Promise<void>;
}

// Subscribes to a live game: initial fetch of the games/players/own-hand
// rows, then Realtime subscriptions that keep them in sync (see
// supabase/schema.sql for the RLS + publication setup this depends on).
// playMove/swapDeadCard run the shared pure game-logic module locally
// first (same validateMove/applyMove Milestone 2 built and unit-tested),
// then persist: play_card_and_draw handles the secret hand/deck mutation
// server-side, and a direct `games` UPDATE (allowed by RLS only on your
// turn) publishes the resulting public board state to everyone.
export function useGame(gameId: string | null): UseGameResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameRow | null>(null);
  const [players, setPlayers] = useState<PlayerMeta[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<PlayerId | null>(null);
  const [myHand, setMyHand] = useState<CardInstance[]>([]);

  // Shared by the initial load and the reconnect catch-up below: fetches
  // fresh game/players/own-hand state from scratch. Needed on reconnect
  // because Postgres Changes has no replay — events that happened while a
  // tab was backgrounded or offline are simply missed, so the client has
  // to explicitly re-sync rather than trust the delta stream alone.
  const refetch = useCallback(async () => {
    if (!gameId) return;
    try {
      const authUserId = await ensureAuthUserId();

      const [gameResult, playersResult] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).single(),
        supabase.from("players").select("*").eq("game_id", gameId).order("seat_index"),
      ]);
      if (gameResult.error) throw gameResult.error;
      if (playersResult.error) throw playersResult.error;

      const playerRows = playersResult.data ?? [];
      setGame(gameResult.data);
      setPlayers(playerRows.map(toPlayerMeta));

      const me = playerRows.find((p) => p.auth_user_id === authUserId);
      if (me) {
        setMyPlayerId(me.id);
        const { data: handRow } = await supabase
          .from("hands")
          .select("cards")
          .eq("player_id", me.id)
          .maybeSingle();
        setMyHand(handRow?.cards ?? []);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load game");
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    setLoading(true);
    refetch().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, refetch]);

  // A dropped connection (bad wifi, laptop sleep, backgrounded tab) means
  // missed Realtime events — catch up by refetching whenever the tab
  // becomes visible again or the browser reports it's back online.
  useEffect(() => {
    if (!gameId) return;
    function handleReconnectSignal() {
      if (document.visibilityState === "visible") refetch();
    }
    window.addEventListener("online", handleReconnectSignal);
    document.addEventListener("visibilitychange", handleReconnectSignal);
    return () => {
      window.removeEventListener("online", handleReconnectSignal);
      document.removeEventListener("visibilitychange", handleReconnectSignal);
    };
  }, [gameId, refetch]);

  useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => setGame(payload.new as GameRow),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "players", filter: `game_id=eq.${gameId}` },
        (payload) => {
          const row = payload.new as PlayerRow;
          setPlayers((prev) =>
            prev.some((p) => p.id === row.id)
              ? prev
              : [...prev, toPlayerMeta(row)].sort((a, b) => a.seatIndex - b.seatIndex),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Separate effect: only known once the initial load above resolves.
  useEffect(() => {
    if (!myPlayerId) return;

    const channel = supabase
      .channel(`hand:${myPlayerId}`)
      .on(
        "postgres_changes",
        {
          // "*" (not just UPDATE): the hand row's very first cards arrive
          // via INSERT — deal_game creates it fresh when the game starts,
          // it doesn't yet exist to be UPDATEd.
          event: "*",
          schema: "public",
          table: "hands",
          filter: `player_id=eq.${myPlayerId}`,
        },
        (payload) => setMyHand((payload.new as { cards: CardInstance[] }).cards ?? []),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myPlayerId]);

  const playMove = useCallback(
    async (card: CardInstance, action: MoveAction) => {
      if (!game || !myPlayerId) return;
      const me = players.find((p) => p.id === myPlayerId);
      if (!me) return;

      const move: Move = { playerId: myPlayerId, card, action };
      const validation = validateMove({
        board: game.board_chips,
        sequenceUsage: game.sequence_usage,
        move,
        actingChipColor: me.chipColor,
      });
      if (!validation.ok) {
        setError(validation.reason);
        return;
      }

      const applied = applyMove({
        board: game.board_chips,
        sequences: game.sequences,
        sequenceUsage: game.sequence_usage,
        currentSeatIndex: game.current_seat_index,
        playerCount: players.length,
        turnNumber: game.turn_number,
        move,
        actingChipColor: me.chipColor,
      });

      const { error: rpcError } = await supabase.rpc("play_card_and_draw", {
        p_game_id: game.id,
        p_rank: card.rank,
        p_suit: card.suit,
        p_instance_id: card.instanceId,
      });
      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      const { error: updateError } = await supabase
        .from("games")
        .update({
          board_chips: applied.board,
          sequences: applied.sequences,
          sequence_usage: applied.sequenceUsage,
          discard_top: applied.discardTop,
          current_seat_index: applied.currentSeatIndex,
          turn_number: applied.turnNumber,
        })
        .eq("id", game.id);
      if (updateError) {
        setError(updateError.message);
        return;
      }

      await supabase.from("moves").insert({
        game_id: game.id,
        player_id: myPlayerId,
        move_number: applied.turnNumber,
        card,
        action,
      });
    },
    [game, players, myPlayerId],
  );

  const swapDeadCard = useCallback(
    async (card: CardInstance) => {
      if (!game || !myPlayerId) return;
      const me = players.find((p) => p.id === myPlayerId);
      if (!me) return;

      const validation = validateMove({
        board: game.board_chips,
        sequenceUsage: game.sequence_usage,
        move: { playerId: myPlayerId, card, action: { type: "dead-card-swap" } },
        actingChipColor: me.chipColor,
      });
      if (!validation.ok) {
        setError(validation.reason);
        return;
      }

      const { error: rpcError } = await supabase.rpc("play_card_and_draw", {
        p_game_id: game.id,
        p_rank: card.rank,
        p_suit: card.suit,
        p_instance_id: card.instanceId,
      });
      if (rpcError) setError(rpcError.message);
    },
    [game, players, myPlayerId],
  );

  return { loading, error, game, players, myPlayerId, myHand, playMove, swapDeadCard };
}

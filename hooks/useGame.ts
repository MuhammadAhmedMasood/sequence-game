"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyMove, validateMove } from "@/lib/game/moves";
import { checkWinner } from "@/lib/game/winCondition";
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

// Guards every place `game` gets overwritten from an external source
// (Realtime echo, reconnect refetch, background poll) against clobbering
// a more current state with a stale one. Without this, a refetch that
// happens to resolve *after* an optimistic local update (e.g. a
// visibilitychange firing mid-move) would silently revert the board and
// turn indicator back to the pre-move snapshot — the moved chip
// "disappears" and the turn never advances for anyone.
//
// turn_number only moves forward *within one round*, so rejecting an
// incoming row whose turn_number is behind what's already showing is
// safe there — but a rematch deliberately resets it to 0, and a naive
// turn_number-only check would reject that legitimate reset outright,
// permanently stranding the client on the finished game's board. A
// status change (lobby -> in_progress -> completed -> lobby -> ...) is
// always an intentional server-driven transition in this app, never
// something a stale read invents, so it always overrides the
// turn_number check.
function applyIfNewer(
  prev: GameRow | null,
  incoming: GameRow,
): GameRow {
  if (!prev) return incoming;
  if (incoming.status !== prev.status) return incoming;
  if (incoming.turn_number >= prev.turn_number) return incoming;
  return prev;
}

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
  // True while a move is mid-flight (RPC + games update + moves log).
  // The board round-trips over the network, so the local `game` object is
  // briefly stale after a click — a second click in that window (a rushed
  // double-click is the common case) would validate/apply against that
  // stale state and could submit a bogus or duplicate move. Callers
  // should ignore clicks while this is true.
  isSubmitting: boolean;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  // A ref alongside the state: state updates are batched/async, and two
  // clicks fired within the same tick (or before React re-renders) would
  // both see the same stale `isSubmitting` value. The ref is set/read
  // synchronously, so the *second* of two rapid clicks is reliably
  // rejected even when it lands before a re-render.
  const submittingRef = useRef(false);

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
      setGame((prev) => applyIfNewer(prev, gameResult.data));
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

  // Safety net under Realtime, not a replacement for it: a
  // postgres_changes event only reaches this client if its channel
  // subscription had already finished joining the moment the row
  // changed (no backlog/replay). A player who clicks "Start game"
  // within that join window, or whose connection blips for even a
  // couple of seconds, can miss the event outright — with nothing else
  // to correct it, their screen would stay on the wrong turn
  // indefinitely. This polls games+players only (not hands, which is
  // per-player secret data with no monotonic counter to guard against a
  // stale overwrite of an optimistic in-flight move) every few seconds
  // so the client self-heals within a bounded window even if every
  // Realtime event for a move was dropped.
  useEffect(() => {
    if (!gameId) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single()
        .then(({ data }) => {
          if (data) setGame((prev) => applyIfNewer(prev, data));
        });
      supabase
        .from("players")
        .select("*")
        .eq("game_id", gameId)
        .order("seat_index")
        .then(({ data }) => {
          if (data) setPlayers(data.map(toPlayerMeta));
        });
    }, 4000);
    return () => clearInterval(interval);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        (payload) => setGame((prev) => applyIfNewer(prev, payload.new as GameRow)),
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
      // UPDATE (not just INSERT): the lobby's team picker lets other
      // players change team/chip_color and deal_game reseats everyone's
      // seat_index — every seated player needs to see those live too, not
      // just newly-joining ones.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "players", filter: `game_id=eq.${gameId}` },
        (payload) => {
          const row = payload.new as PlayerRow;
          setPlayers((prev) =>
            prev
              .map((p) => (p.id === row.id ? toPlayerMeta(row) : p))
              .sort((a, b) => a.seatIndex - b.seatIndex),
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
      if (submittingRef.current) return;
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

      submittingRef.current = true;
      setIsSubmitting(true);
      // Snapshot for rollback: the optimistic update below is applied
      // before any network call resolves, so a failed RPC/update needs to
      // restore exactly what was on screen beforehand.
      const previousGame = game;
      const previousHand = myHand;
      try {
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
        // Checked on every placing move: a sequence just completed by this
        // move can immediately satisfy sequencesToWin, and the game has to
        // end right then rather than waiting for some later check.
        const winner = checkWinner(players, applied.sequences, game.sequences_to_win);

        // Optimistic update: apply the chip placement and turn advance
        // locally right away, instead of waiting on the RPC + games UPDATE
        // + the Realtime event that echoes it back. Without this, the
        // chip and the "Your turn!" banner only changed once that full
        // round trip landed, which read as the click having done nothing
        // (or the game having frozen) on any connection with real latency.
        setGame((prev) =>
          prev
            ? {
                ...prev,
                board_chips: applied.board,
                sequences: applied.sequences,
                sequence_usage: applied.sequenceUsage,
                discard_top: applied.discardTop,
                current_seat_index: applied.currentSeatIndex,
                turn_number: applied.turnNumber,
                winner,
                status: winner ? "completed" : prev.status,
              }
            : prev,
        );
        setMyHand((prev) => prev.filter((c) => c.instanceId !== card.instanceId));

        const { error: rpcError } = await supabase.rpc("play_card_and_draw", {
          p_game_id: game.id,
          p_rank: card.rank,
          p_suit: card.suit,
          p_instance_id: card.instanceId,
        });
        if (rpcError) {
          setError(rpcError.message);
          setGame(previousGame);
          setMyHand(previousHand);
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
            winner,
            status: winner ? "completed" : game.status,
          })
          .eq("id", game.id);
        if (updateError) {
          setError(updateError.message);
          setGame(previousGame);
          setMyHand(previousHand);
          return;
        }

        await supabase.from("moves").insert({
          game_id: game.id,
          player_id: myPlayerId,
          move_number: applied.turnNumber,
          card,
          action,
        });
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [game, players, myPlayerId, myHand],
  );

  const swapDeadCard = useCallback(
    async (card: CardInstance) => {
      if (submittingRef.current) return;
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

      submittingRef.current = true;
      setIsSubmitting(true);
      const previousHand = myHand;
      // Optimistic: pull the dead card out of hand immediately so it
      // doesn't look stuck/unresponsive; the drawn replacement arrives
      // moments later via the "hands" Realtime subscription.
      setMyHand((prev) => prev.filter((c) => c.instanceId !== card.instanceId));
      try {
        const { error: rpcError } = await supabase.rpc("play_card_and_draw", {
          p_game_id: game.id,
          p_rank: card.rank,
          p_suit: card.suit,
          p_instance_id: card.instanceId,
        });
        if (rpcError) {
          setError(rpcError.message);
          setMyHand(previousHand);
        }
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [game, players, myPlayerId, myHand],
  );

  return {
    loading,
    error,
    game,
    players,
    myPlayerId,
    myHand,
    isSubmitting,
    playMove,
    swapDeadCard,
  };
}
